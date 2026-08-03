import { ManifestJson, ManifestItem, SectionType, CISection, CIAsset, ColorSwatch, ColorGroup, LogoAsset, FrameCard, BackgroundGroup, ApplicationCard, DoDontItem } from './types';
import { CI_GLOSSARY, getSectionTypeByPrefix } from './glossary';

export interface ParseResult {
  sections: Partial<CISection>[]; // We use Partial because they don't have DB IDs yet
  assets: Partial<CIAsset>[];
  unmatched: ManifestItem[];
  themeSuggested: any;
}

export function parseManifest(manifest: ManifestJson): ParseResult {
  const sectionsMap = new Map<SectionType, Partial<CISection>>();
  const assets: Partial<CIAsset>[] = [];
  const unmatched: ManifestItem[] = [];
  const themeSuggested: any = { accentColors: [] };

  // Helper to ensure section exists
  const getOrCreateSection = (type: SectionType) => {
    if (!sectionsMap.has(type)) {
      const glos = CI_GLOSSARY.find(g => g.section_type === type);
      sectionsMap.set(type, {
        section_type: type,
        eyebrow_label: glos?.eyebrow_label || '',
        headline: glos?.default_headline || '',
        is_visible: true,
        data: {}
      });
    }
    return sectionsMap.get(type)!;
  };

  manifest.items.forEach(item => {
    const sectionType = getSectionTypeByPrefix(item.frame_name);
    
    if (!sectionType) {
      unmatched.push(item);
      return;
    }

    const section = getOrCreateSection(sectionType);
    const parts = item.frame_name.split('/').map(s => s.trim());
    // parts[0] is the prefix (e.g. Logo)
    // parts[1] and onwards are specific to the type

    // Temporary ID for linking assets before DB insertion
    const tempAssetId = `temp_${Math.random().toString(36).substr(2, 9)}`;

    const baseAsset: Partial<CIAsset> = {
      id: tempAssetId,
      kind: sectionType, // default
      storage_path: item.file,
      public_url: '', // will be resolved on upload
      label: parts[1] || item.file,
      metadata: { width: item.width, height: item.height }
    };

    switch (sectionType) {
      case 'colors': {
        // e.g. Colors / Neon / Cyan #00ECFF
        const groupLabel = parts[1] || 'Primary';
        const swatchRaw = parts[2] || parts[1];
        
        let hex = '#000000';
        const hexMatch = swatchRaw.match(/#[0-9A-Fa-f]{6}/);
        if (hexMatch) {
          hex = hexMatch[0];
        }

        const name = swatchRaw.replace(/#[0-9A-Fa-f]{6}/, '').trim() || 'Color';

        if (!section.data.groups) section.data.groups = [];
        let group = section.data.groups.find((g: any) => g.groupLabel === groupLabel);
        if (!group) {
          group = { groupLabel, swatches: [] };
          section.data.groups.push(group);
        }
        
        const swatch: ColorSwatch = {
          id: `swatch_${Math.random().toString(36).substr(2, 9)}`,
          name,
          hex
        };
        group.swatches.push(swatch);

        // Theme auto-suggestion
        if (groupLabel.toLowerCase().includes('dark') || groupLabel.toLowerCase().includes('background')) {
          if (!themeSuggested.backgroundColor) themeSuggested.backgroundColor = hex;
        } else if (themeSuggested.accentColors.length < 3) {
          themeSuggested.accentColors.push(hex);
        }
        
        // Colors don't necessarily need asset entries if they are just swatches, but we can store the swatch img if needed.
        if (item.file) {
          assets.push(baseAsset);
        }
        break;
      }
      
      case 'logo': {
        // Logo / Primary / Light
        const type = parts[1] || 'Logo';
        const stageRaw = (parts[2] || 'any').toLowerCase();
        const stage = ['dark', 'light'].includes(stageRaw) ? stageRaw : 'any';

        if (!section.data.logos) section.data.logos = [];
        
        const logoAsset: LogoAsset = {
          assetId: tempAssetId,
          label: type,
          stage: stage as 'dark' | 'light' | 'any'
        };
        section.data.logos.push(logoAsset);
        assets.push({ ...baseAsset, kind: 'logo' });
        break;
      }

      case 'grid_frames': {
        // Frame / 1x1 / Speaker
        const ratio = parts[1] || '1:1';
        const label = parts[2] || 'Frame';
        
        if (!section.data.frames) section.data.frames = [];
        
        const frameCard: FrameCard = {
          id: `frame_${Math.random().toString(36).substr(2, 9)}`,
          label,
          aspectRatio: ratio,
          assetId: tempAssetId
        };
        section.data.frames.push(frameCard);
        assets.push({ ...baseAsset, kind: 'frame' });
        break;
      }

      case 'backgrounds': {
        // Backgrounds / Web / 1
        const groupLabel = parts[1] || 'Backgrounds';
        const label = parts[2] || 'Bg';

        if (!section.data.groups) section.data.groups = [];
        let group = section.data.groups.find((g: any) => g.groupLabel === groupLabel);
        if (!group) {
          group = { groupLabel, assets: [] };
          section.data.groups.push(group);
        }

        group.assets.push({
          id: `bg_${Math.random().toString(36).substr(2, 9)}`,
          assetId: tempAssetId,
          label
        });
        assets.push({ ...baseAsset, kind: 'background' });
        break;
      }

      case 'applications': {
        // Applications / E-Ticket
        const label = parts[1] || 'Mockup';
        
        if (!section.data.apps) section.data.apps = [];
        section.data.apps.push({
          id: `app_${Math.random().toString(36).substr(2, 9)}`,
          label,
          assetId: tempAssetId
        });
        assets.push({ ...baseAsset, kind: 'application' });
        break;
      }

      case 'dos_donts': {
        // DoDont / Do / Clearspace
        const typeRaw = (parts[1] || 'do').toLowerCase();
        const isDo = typeRaw === 'do';
        const caption = parts[2] || 'Usage';

        if (!section.data.items) section.data.items = [];
        section.data.items.push({
          id: `rule_${Math.random().toString(36).substr(2, 9)}`,
          type: isDo ? 'do' : 'dont',
          caption,
          assetId: tempAssetId
        });
        assets.push({ ...baseAsset, kind: isDo ? 'do' : 'dont' });
        break;
      }

      default: {
        // For anything else (like buttons or typography that might just be images exported instead of css)
        assets.push(baseAsset);
        break;
      }
    }
  });

  return {
    sections: Array.from(sectionsMap.values()),
    assets,
    unmatched,
    themeSuggested
  };
}
