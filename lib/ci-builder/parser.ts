import { ManifestJson, ManifestItem, SectionType, CISection, CIAsset } from './types';
import { CI_GLOSSARY, matchSectionType } from './glossary';

export interface ParseResult {
  sections: Partial<CISection>[]; // Existing + new sections
  assets: Partial<CIAsset>[]; // All items parsed
  themeSuggested: any;
  report: {
    format?: 'items_manifest' | 'design_tokens' | 'unknown';
    totalItems: number;
    assignedCount: number;
    unassignedCount: number;
    missingFiles: number;
    detectedNameKeys: string[];
    detectedFileKeys: string[];
    missingFileRows: string[]; // Track which items had missing files
    message?: string;
  };
}

export function rgbToHex(colorVal: any): string {
  if (typeof colorVal !== 'string' && typeof colorVal !== 'object') {
    return '#000000';
  }

  if (typeof colorVal === 'string') {
    const hexMatch = colorVal.match(/#[0-9A-Fa-f]{6}/);
    if (hexMatch) return hexMatch[0];

    const rgbMatch = colorVal.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return colorVal;
  }

  if (typeof colorVal === 'object' && colorVal !== null) {
    let r = colorVal.r ?? colorVal.red ?? 0;
    let g = colorVal.g ?? colorVal.green ?? 0;
    let b = colorVal.b ?? colorVal.blue ?? 0;

    // Normalize float range (0-1) to byte range (0-255)
    if (r <= 1 && g <= 1 && b <= 1 && (r > 0 || g > 0 || b > 0)) {
      r = Math.round(r * 255);
      g = Math.round(g * 255);
      b = Math.round(b * 255);
    }

    const rHex = Math.min(255, Math.max(0, Math.round(r))).toString(16).padStart(2, '0');
    const gHex = Math.min(255, Math.max(0, Math.round(g))).toString(16).padStart(2, '0');
    const bHex = Math.min(255, Math.max(0, Math.round(b))).toString(16).padStart(2, '0');
    return `#${rHex}${gHex}${bHex}`;
  }

  return '#000000';
}

export function parseManifest(
  manifest: any,
  existingSections: Partial<CISection>[] = []
): ParseResult {
  if (!manifest || typeof manifest !== 'object') {
    return buildUnknownFormatReport(manifest, existingSections);
  }

  const isArray = Array.isArray(manifest);
  const hasItems = !isArray && Boolean(manifest.items || manifest.frames || manifest.layers);
  const hasDesignTokens = !isArray && Boolean(manifest.designTokens || manifest.structure);

  if (isArray || hasItems) {
    const result = parseFlatItemsManifest(manifest, existingSections);
    result.report.format = 'items_manifest';
    return result;
  } else if (hasDesignTokens) {
    return parseDesignTokensManifest(manifest, existingSections);
  } else {
    return buildUnknownFormatReport(manifest, existingSections);
  }
}

function buildUnknownFormatReport(manifest: any, existingSections: Partial<CISection>[] = []): ParseResult {
  const detectedKeys = manifest && typeof manifest === 'object' ? Object.keys(manifest) : [];
  return {
    sections: existingSections,
    assets: [],
    themeSuggested: {},
    report: {
      format: 'unknown',
      totalItems: 0,
      assignedCount: 0,
      unassignedCount: 0,
      missingFiles: 0,
      detectedNameKeys: detectedKeys,
      detectedFileKeys: [],
      missingFileRows: [],
      message: `Unrecognized JSON format. Expected a flat items manifest (with 'items' array) or a Figma Design Tokens export (with 'designTokens' or 'structure' keys). Found top-level keys: ${detectedKeys.join(', ') || 'none'}`
    }
  };
}

function parseDesignTokensManifest(
  manifest: any,
  existingSections: Partial<CISection>[] = []
): ParseResult {
  const sectionsMap = new Map<SectionType, Partial<CISection>>();
  const assets: Partial<CIAsset>[] = [];
  const themeSuggested: any = { accentColors: [] };

  existingSections.forEach(sec => {
    if (sec.section_type) {
      sectionsMap.set(sec.section_type, { ...sec });
    }
  });

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

  const designTokens = manifest.designTokens || {};
  const metadata = manifest.metadata || {};
  const groupLabel = metadata.componentName || 'Imported Colors';

  let totalTokenCount = 0;
  let assignedCount = 0;

  // 1. Colors
  const rawColors = designTokens.colors || [];
  const colorEntries: { name: string; value: any; cssVar?: string }[] = [];

  if (Array.isArray(rawColors)) {
    rawColors.forEach((c: any, idx: number) => {
      if (typeof c === 'string') {
        colorEntries.push({ name: `Color ${idx + 1}`, value: c });
      } else if (c && typeof c === 'object') {
        colorEntries.push({
          name: c.name || c.label || c.title || `Color ${idx + 1}`,
          value: c.value || c.color || c.hex || c.rgb || c,
          cssVar: c.cssVar || c.variable
        });
      }
    });
  } else if (typeof rawColors === 'object' && rawColors !== null) {
    Object.entries(rawColors).forEach(([k, v]: [string, any]) => {
      if (typeof v === 'string' || (v && typeof v === 'object' && !v.value && !v.color && !v.hex && !v.rgb)) {
        colorEntries.push({ name: k, value: v, cssVar: `--${k.toLowerCase().replace(/\s+/g, '-')}` });
      } else if (v && typeof v === 'object') {
        colorEntries.push({
          name: v.name || k,
          value: v.value || v.color || v.hex || v.rgb || v,
          cssVar: v.cssVar || v.variable
        });
      }
    });
  }

  if (colorEntries.length > 0) {
    const colorsSection = getOrCreateSection('colors');
    if (!colorsSection.data.groups) colorsSection.data.groups = [];
    let group = colorsSection.data.groups.find((g: any) => g.groupLabel === groupLabel);
    if (!group) {
      group = { groupLabel, swatches: [] };
      colorsSection.data.groups.push(group);
    }

    colorEntries.forEach((entry) => {
      totalTokenCount++;
      assignedCount++;
      const hex = rgbToHex(entry.value);
      const swatchId = `swatch_${Math.random().toString(36).substring(2, 9)}`;
      const assetId = `temp_asset_${Math.random().toString(36).substring(2, 9)}`;

      group.swatches.push({
        id: swatchId,
        name: entry.name,
        hex,
        cssVar: entry.cssVar
      });

      const baseAsset: Partial<CIAsset> = {
        id: assetId,
        guideline_id: '',
        section_id: colorsSection.id,
        kind: 'colors',
        storage_path: '',
        public_url: '',
        label: entry.name,
        metadata: {
          match_method: 'design_token',
          hex,
          cssVar: entry.cssVar
        }
      };

      assets.push(baseAsset);

      if (entry.name.toLowerCase().includes('dark') || entry.name.toLowerCase().includes('background')) {
        if (!themeSuggested.backgroundColor) themeSuggested.backgroundColor = hex;
      } else if (themeSuggested.accentColors.length < 3) {
        themeSuggested.accentColors.push(hex);
      }
    });
  }

  // 2. Typography / Fonts
  const rawFonts = designTokens.fonts || designTokens.typography || [];
  const fontEntries: any[] = [];

  if (Array.isArray(rawFonts)) {
    rawFonts.forEach((f: any) => {
      if (typeof f === 'string') {
        fontEntries.push({ family: f });
      } else if (f && typeof f === 'object') {
        fontEntries.push(f);
      }
    });
  } else if (typeof rawFonts === 'object' && rawFonts !== null) {
    Object.entries(rawFonts).forEach(([k, v]: [string, any]) => {
      if (typeof v === 'string') {
        fontEntries.push({ family: k, details: v });
      } else if (v && typeof v === 'object') {
        fontEntries.push({ family: k, ...v });
      }
    });
  }

  if (fontEntries.length > 0) {
    const typographySection = getOrCreateSection('typography');
    if (!typographySection.data.rows) typographySection.data.rows = [];

    fontEntries.forEach((font) => {
      totalTokenCount++;
      assignedCount++;
      const family = font.family || font.name || font.fontFamily || 'Primary Font';
      const sizes = Array.isArray(font.sizes) ? font.sizes.join(', ') : (font.sizes || font.fontSize || font.size || '16px');
      const weights = Array.isArray(font.weights) ? font.weights.join(', ') : (font.weights || font.fontWeight || font.weight || '400');
      const rowId = `type_${Math.random().toString(36).substring(2, 9)}`;
      const assetId = `temp_asset_${Math.random().toString(36).substring(2, 9)}`;

      typographySection.data.rows.push({
        id: rowId,
        label: family,
        specLine1: `Sizes: ${sizes}`,
        specLine2: `Weights: ${weights}`,
        sampleText: 'The quick brown fox jumps over the lazy dog'
      });

      const baseAsset: Partial<CIAsset> = {
        id: assetId,
        guideline_id: '',
        section_id: typographySection.id,
        kind: 'typography',
        storage_path: '',
        public_url: '',
        label: family,
        metadata: {
          match_method: 'design_token',
          sizes,
          weights
        }
      };

      assets.push(baseAsset);
    });
  }

  // 3. Spacing & Effects stashed
  if (designTokens.spacing && (Array.isArray(designTokens.spacing) ? designTokens.spacing.length > 0 : Object.keys(designTokens.spacing).length > 0)) {
    const gridSec = getOrCreateSection('grid_frames');
    gridSec.data.spacing = designTokens.spacing;
  }

  if (designTokens.effects && (Array.isArray(designTokens.effects) ? designTokens.effects.length > 0 : Object.keys(designTokens.effects).length > 0)) {
    const overviewSec = getOrCreateSection('overview');
    overviewSec.data.effects = designTokens.effects;
  }

  return {
    sections: Array.from(sectionsMap.values()),
    assets,
    themeSuggested,
    report: {
      format: 'design_tokens',
      totalItems: totalTokenCount,
      assignedCount,
      unassignedCount: 0,
      missingFiles: 0,
      detectedNameKeys: Object.keys(designTokens),
      detectedFileKeys: [],
      missingFileRows: []
    }
  };
}

function parseFlatItemsManifest(
  manifest: any,
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

  const rawItems = Array.isArray(manifest) ? manifest : (manifest.items || manifest.frames || manifest.layers || []);
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
