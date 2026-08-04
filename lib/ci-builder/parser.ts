import { ManifestJson, ManifestItem, SectionType, CISection, CIAsset, ColorSwatch, ColorGroup, LogoAsset, FrameCard, BackgroundGroup, ApplicationCard, DoDontItem } from './types';
import { CI_GLOSSARY, matchSectionType } from './glossary';

export interface ParseResult {
  sections: Partial<CISection>[]; // Existing + new sections
  assets: Partial<CIAsset>[]; // All items parsed
  themeSuggested: any;
  report: {
    totalItems: number;
    assignedCount: number;
    unassignedCount: number;
    missingFiles: number;
    detectedNameKeys: string[];
    detectedFileKeys: string[];
    missingFileRows: string[]; // Track which items had missing files
  };
}

export function parseManifest(
  manifest: ManifestJson,
  existingSections: Partial<CISection>[] = []
): ParseResult {
  const sectionsMap = new Map<SectionType, Partial<CISection>>();
  const assets: Partial<CIAsset>[] = [];
  const themeSuggested: any = { accentColors: [] };

  const report = {
    totalItems: 0,
    assignedCount: 0,
    unassignedCount: 0,
    missingFiles: 0,
    detectedNameKeys: [] as string[],
    detectedFileKeys: [] as string[],
    missingFileRows: [] as string[]
  };

  // Populate map with existing sections to support additive behavior
  existingSections.forEach(sec => {
    if (sec.section_type) {
      sectionsMap.set(sec.section_type, { ...sec });
    }
  });

  // Helper to ensure section exists
  const getOrCreateSection = (type: SectionType) => {
    if (!sectionsMap.has(type)) {
      const glos = CI_GLOSSARY.find(g => g.section_type === type);
      sectionsMap.set(type, {
        id: `temp_${Math.random().toString(36).substring(2, 9)}`,
        section_type: type,
        eyebrow_label: glos?.eyebrow_label || '',
        headline: glos?.default_headline || '',
        is_visible: true,
        data: {}
      });
    }
    return sectionsMap.get(type)!;
  };

  const rawItems = Array.isArray(manifest) ? manifest : (manifest.items || []);
  report.totalItems = rawItems.length;

  rawItems.forEach((item: any) => {
    // 1. Flexible key mapping
    const keys = Object.keys(item);
    const nameKey = keys.find(k => ['frame_name', 'name', 'title', 'layer'].includes(k.toLowerCase()));
    const fileKey = keys.find(k => ['file', 'filename', 'image'].includes(k.toLowerCase()));

    const rawName = nameKey ? item[nameKey] : '';
    const rawFile = fileKey ? item[fileKey] : '';

    // Track detected keys for reporting
    if (nameKey && !report.detectedNameKeys.includes(nameKey)) report.detectedNameKeys.push(nameKey);
    if (fileKey && !report.detectedFileKeys.includes(fileKey)) report.detectedFileKeys.push(fileKey);

    const nameStr = typeof rawName === 'string' ? rawName : '';
    const fileStr = typeof rawFile === 'string' ? rawFile : '';

    if (!fileStr) {
      report.missingFiles++;
      report.missingFileRows.push(nameStr || 'Unknown Item');
    }

    const { type: sectionType, match_method, parts } = matchSectionType(nameStr);
    const tempAssetId = `temp_asset_${Math.random().toString(36).substring(2, 9)}`;
    const isMissingFile = !fileStr;

    const baseAsset: Partial<CIAsset> = {
      id: tempAssetId,
      kind: sectionType || 'unmatched',
      storage_path: fileStr || '', // Ensure it's never undefined
      public_url: '', // To be resolved later
      label: parts.length > 1 ? parts.slice(1).join(' ') : (nameStr || fileStr || 'Untitled Asset'),
      metadata: { 
        width: item.width, 
        height: item.height,
        match_method: match_method || null,
        is_missing_file: isMissingFile
      }
    };

    // Color extraction: always run if hex exists, regardless of section match
    const hexMatch = nameStr.match(/#[0-9A-Fa-f]{6}/);
    if (hexMatch) {
      const hex = hexMatch[0];
      const colorSec = getOrCreateSection('colors');
      if (!colorSec.data.groups) colorSec.data.groups = [];
      let groupLabel = 'Extracted';
      
      // If it matched colors section specifically, use its grouping logic
      if (sectionType === 'colors') {
         groupLabel = parts[1] || 'Primary';
      }
      
      let group = colorSec.data.groups.find((g: any) => g.groupLabel === groupLabel);
      if (!group) {
        group = { groupLabel, swatches: [] };
        colorSec.data.groups.push(group);
      }
      group.swatches.push({
        id: `swatch_${Math.random().toString(36).substring(2, 9)}`,
        name: nameStr.replace(hex, '').trim() || 'Color',
        hex
      });
      
      // Theme auto-suggestion
      if (groupLabel.toLowerCase().includes('dark') || groupLabel.toLowerCase().includes('background')) {
        if (!themeSuggested.backgroundColor) themeSuggested.backgroundColor = hex;
      } else if (themeSuggested.accentColors.length < 3) {
        themeSuggested.accentColors.push(hex);
      }
    }

    if (!sectionType) {
      report.unassignedCount++;
      baseAsset.section_id = null; // Explicitly unassigned
      assets.push(baseAsset);
      return;
    }

    report.assignedCount++;
    const section = getOrCreateSection(sectionType);
    baseAsset.section_id = section.id;

    switch (sectionType) {
      case 'colors': {
        // Hex logic handled above globally for all items with hex codes.
        // We still add the asset for colors if there's a file, but the swatch is already made.
        assets.push(baseAsset);
        break;
      }
      
      case 'logo': {
        const typeLabel = parts[1] || 'Logo';
        const stageRaw = (parts[2] || 'any').toLowerCase();
        const stage = ['dark', 'light'].includes(stageRaw) ? stageRaw : 'any';

        if (!section.data.logos) section.data.logos = [];
        section.data.logos.push({
          assetId: tempAssetId,
          label: typeLabel,
          stage: stage as 'dark' | 'light' | 'any'
        });
        assets.push({ ...baseAsset, kind: 'logo' });
        break;
      }

      case 'grid_frames': {
        const ratio = parts[1] || '1:1';
        const label = parts[2] || 'Frame';
        
        if (!section.data.frames) section.data.frames = [];
        section.data.frames.push({
          id: `frame_${Math.random().toString(36).substring(2, 9)}`,
          label,
          aspectRatio: ratio,
          assetId: tempAssetId
        });
        assets.push({ ...baseAsset, kind: 'frame' });
        break;
      }

      case 'backgrounds': {
        const groupLabel = parts[1] || 'Backgrounds';
        const label = parts.slice(2).join(' ') || 'Bg';

        if (!section.data.groups) section.data.groups = [];
        let group = section.data.groups.find((g: any) => g.groupLabel === groupLabel);
        if (!group) {
          group = { groupLabel, assets: [] };
          section.data.groups.push(group);
        }

        group.assets.push({
          id: `bg_${Math.random().toString(36).substring(2, 9)}`,
          assetId: tempAssetId,
          label
        });
        assets.push({ ...baseAsset, kind: 'background' });
        break;
      }

      case 'applications': {
        const label = parts.slice(1).join(' ') || 'Mockup';
        if (!section.data.apps) section.data.apps = [];
        section.data.apps.push({
          id: `app_${Math.random().toString(36).substring(2, 9)}`,
          label,
          assetId: tempAssetId
        });
        assets.push({ ...baseAsset, kind: 'application' });
        break;
      }

      case 'dos_donts': {
        const typeRaw = (parts[1] || 'do').toLowerCase();
        const isDo = typeRaw === 'do';
        const caption = parts.slice(2).join(' ') || 'Usage';

        if (!section.data.items) section.data.items = [];
        section.data.items.push({
          id: `rule_${Math.random().toString(36).substring(2, 9)}`,
          type: isDo ? 'do' : 'dont',
          caption,
          assetId: tempAssetId
        });
        assets.push({ ...baseAsset, kind: isDo ? 'do' : 'dont' });
        break;
      }

      default: {
        assets.push(baseAsset);
        break;
      }
    }
  });

  // Deduplicate keys for report
  report.detectedNameKeys = Array.from(new Set(report.detectedNameKeys));
  report.detectedFileKeys = Array.from(new Set(report.detectedFileKeys));

  return {
    sections: Array.from(sectionsMap.values()),
    assets,
    themeSuggested,
    report
  };
}
