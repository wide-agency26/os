import { SectionType } from './types';

export interface GlossaryEntry {
  section_type: SectionType;
  eyebrow_label: string;
  default_headline: string;
  prefixes: string[]; // Match against Figma frame first segment
  synonyms: string[]; // Fallback synonym matches
  description: string;
}

export const CI_GLOSSARY: GlossaryEntry[] = [
  {
    section_type: 'overview',
    eyebrow_label: '01 · Overview',
    default_headline: 'Brand Overview',
    prefixes: ['Overview'],
    synonyms: ['intro', 'about', 'introduction', 'brand', 'übersicht'],
    description: 'Hero/intro section with core brand statements',
  },
  {
    section_type: 'logo',
    eyebrow_label: '02 · Logo',
    default_headline: 'Primary Logo',
    prefixes: ['Logo'],
    synonyms: ['logo', 'logos', 'wortmarke', 'bildmarke', 'markenzeichen', 'wordmark', 'brandmark', 'logomark', 'symbol'],
    description: 'Logo variants, clearspace, and minimum sizes',
  },
  {
    section_type: 'colors',
    eyebrow_label: '03 · Colors',
    default_headline: 'Brand Colors',
    prefixes: ['Colors', 'Color', 'Farben', 'Farbe'],
    synonyms: ['farbe', 'farben', 'farbwelt', 'palette', 'colours', 'colour', 'swatch', 'swatches'],
    description: 'Primary and secondary color palettes',
  },
  {
    section_type: 'typography',
    eyebrow_label: '04 · Typography',
    default_headline: 'Typography',
    prefixes: ['Typography', 'Type', 'Fonts', 'Typografie'],
    synonyms: ['typografie', 'schrift', 'schriftart', 'schriftzug', 'font', 'fonts', 'typeface', 'text', 'typesetting'],
    description: 'Typeface families and typesetting scale',
  },
  {
    section_type: 'buttons',
    eyebrow_label: '05 · UI Elements',
    default_headline: 'Buttons & Inputs',
    prefixes: ['Buttons', 'UI'],
    synonyms: ['buttons', 'knöpfe', 'schaltflächen', 'button', 'input', 'elements', 'components', 'controls'],
    description: 'Interactive component states',
  },
  {
    section_type: 'grid_frames',
    eyebrow_label: '06 · Layout',
    default_headline: 'Grids & Frames',
    prefixes: ['Grid', 'Frame', 'Frames', 'Layout', 'Raster'],
    synonyms: ['raster', 'gitter', 'rahmen', 'grids', 'layout', 'structure', 'spacing'],
    description: 'Structural grids and aspect ratio containers',
  },
  {
    section_type: 'backgrounds',
    eyebrow_label: '07 · Backgrounds',
    default_headline: 'Background Assets',
    prefixes: ['Backgrounds', 'Background', 'BGs', 'Hintergrund'],
    synonyms: ['hintergrund', 'hintergründe', 'bg', 'backdrop', 'texture', 'textures'],
    description: 'Abstract and branded backgrounds',
  },
  {
    section_type: 'imagery',
    eyebrow_label: '08 · Imagery',
    default_headline: 'Photography & Imagery',
    prefixes: ['Imagery', 'Photo', 'Photography', 'Bildsprache'],
    synonyms: ['bildsprache', 'bilder', 'fotografie', 'photos', 'images', 'pictures', 'direction'],
    description: 'Art direction and photo style',
  },
  {
    section_type: 'voice_tone',
    eyebrow_label: '09 · Voice',
    default_headline: 'Voice & Tone',
    prefixes: ['Voice', 'Tone', 'Language', 'Sprache'],
    synonyms: ['sprache', 'tonalität', 'wording', 'copy', 'writing', 'copywriting', 'messaging'],
    description: 'Copywriting principles',
  },
  {
    section_type: 'applications',
    eyebrow_label: '10 · Applications',
    default_headline: 'In Practice',
    prefixes: ['Applications', 'Mockups', 'InUse', 'Anwendungen'],
    synonyms: ['anwendungen', 'anwendungsbeispiele', 'application', 'mockup', 'practice', 'examples'],
    description: 'Real-world brand mockups',
  },
  {
    section_type: 'dos_donts',
    eyebrow_label: '11 · Rules',
    default_headline: "Do's and Don'ts",
    prefixes: ['DoDont', 'DosDonts', 'Rules'],
    synonyms: ['richtig', 'falsch', 'erlaubt', 'verboten', 'richtig/falsch', 'erlaubt/verboten', 'dos and don\'ts', 'guidelines', 'correct', 'incorrect', 'right', 'wrong', 'do', 'dont', 'do\'s', 'don\'ts'],
    description: 'Usage rules and common mistakes',
  },
];

export interface MatchResult {
  type: SectionType | null;
  match_method: 'exact' | 'synonym' | 'substring' | null;
  parts: string[];
}

export function matchSectionType(rawName: string): MatchResult {
  // 1. Normalize delimiters
  // Split by '/', '-', '_', '>', or multiple spaces
  const normalizedStr = rawName.replace(/[\/\-\_\>]/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = normalizedStr.split(' ');
  
  if (parts.length === 0 || !parts[0]) {
    return { type: null, match_method: null, parts: [] };
  }

  const prefix = parts[0].toLowerCase();

  // 2. Exact match (Prefixes)
  for (const entry of CI_GLOSSARY) {
    if (entry.prefixes.some(p => p.toLowerCase() === prefix)) {
      return { type: entry.section_type, match_method: 'exact', parts };
    }
  }

  // 3. Synonym match (first part matches a synonym)
  for (const entry of CI_GLOSSARY) {
    if (entry.synonyms.some(s => s.toLowerCase() === prefix)) {
      return { type: entry.section_type, match_method: 'synonym', parts };
    }
  }

  // 4. Substring fallback match — skip very short synonyms (e.g. "do" in "Document")
  const fullLowercaseName = normalizedStr.toLowerCase();

  for (const word of parts.map(p => p.toLowerCase())) {
    for (const entry of CI_GLOSSARY) {
      if (
        entry.prefixes.some(p => p.toLowerCase() === word) || 
        entry.synonyms.some(s => s.toLowerCase() === word && s.length >= 3)
      ) {
        return { type: entry.section_type, match_method: 'substring', parts };
      }
    }
  }

  // Pure substring fallback — require synonym length >= 4 to avoid "do"/"bg" noise
  for (const entry of CI_GLOSSARY) {
    if (
      entry.prefixes.some(p => fullLowercaseName.includes(p.toLowerCase())) ||
      entry.synonyms.some(s => s.length >= 4 && fullLowercaseName.includes(s.toLowerCase()))
    ) {
      return { type: entry.section_type, match_method: 'substring', parts };
    }
  }

  return { type: null, match_method: null, parts };
}
