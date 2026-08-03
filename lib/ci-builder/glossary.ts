import { SectionType } from './types';

export interface GlossaryEntry {
  section_type: SectionType;
  eyebrow_label: string;
  default_headline: string;
  prefixes: string[]; // Match against Figma frame first segment
  description: string;
}

export const CI_GLOSSARY: GlossaryEntry[] = [
  {
    section_type: 'overview',
    eyebrow_label: '01 · Overview',
    default_headline: 'Brand Overview',
    prefixes: ['Overview'],
    description: 'Hero/intro section with core brand statements',
  },
  {
    section_type: 'logo',
    eyebrow_label: '02 · Logo',
    default_headline: 'Primary Logo',
    prefixes: ['Logo'],
    description: 'Logo variants, clearspace, and minimum sizes',
  },
  {
    section_type: 'colors',
    eyebrow_label: '03 · Colors',
    default_headline: 'Brand Colors',
    prefixes: ['Colors', 'Color'],
    description: 'Primary and secondary color palettes',
  },
  {
    section_type: 'typography',
    eyebrow_label: '04 · Typography',
    default_headline: 'Typography',
    prefixes: ['Typography', 'Type', 'Fonts'],
    description: 'Typeface families and typesetting scale',
  },
  {
    section_type: 'buttons',
    eyebrow_label: '05 · UI Elements',
    default_headline: 'Buttons & Inputs',
    prefixes: ['Buttons', 'UI'],
    description: 'Interactive component states',
  },
  {
    section_type: 'grid_frames',
    eyebrow_label: '06 · Layout',
    default_headline: 'Grids & Frames',
    prefixes: ['Grid', 'Frame', 'Frames', 'Layout'],
    description: 'Structural grids and aspect ratio containers',
  },
  {
    section_type: 'backgrounds',
    eyebrow_label: '07 · Backgrounds',
    default_headline: 'Background Assets',
    prefixes: ['Backgrounds', 'Background', 'BGs'],
    description: 'Abstract and branded backgrounds',
  },
  {
    section_type: 'imagery',
    eyebrow_label: '08 · Imagery',
    default_headline: 'Photography & Imagery',
    prefixes: ['Imagery', 'Photo', 'Photography'],
    description: 'Art direction and photo style',
  },
  {
    section_type: 'voice_tone',
    eyebrow_label: '09 · Voice',
    default_headline: 'Voice & Tone',
    prefixes: ['Voice', 'Tone', 'Language'],
    description: 'Copywriting principles',
  },
  {
    section_type: 'applications',
    eyebrow_label: '10 · Applications',
    default_headline: 'In Practice',
    prefixes: ['Applications', 'Mockups', 'InUse'],
    description: 'Real-world brand mockups',
  },
  {
    section_type: 'dos_donts',
    eyebrow_label: '11 · Rules',
    default_headline: "Do's and Don'ts",
    prefixes: ['DoDont', 'DosDonts', 'Rules'],
    description: 'Usage rules and common mistakes',
  },
];

export function getSectionTypeByPrefix(frameName: string): SectionType | null {
  const parts = frameName.split('/');
  if (parts.length === 0) return null;
  const prefix = parts[0].trim();
  
  for (const entry of CI_GLOSSARY) {
    if (entry.prefixes.some(p => p.toLowerCase() === prefix.toLowerCase())) {
      return entry.section_type;
    }
  }
  return null;
}
