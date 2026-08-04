export type ManifestItem = {
  frame_name?: string;
  name?: string;
  title?: string;
  layer?: string;
  
  file?: string;
  filename?: string;
  image?: string;
  
  width?: number;
  height?: number;
  [key: string]: any;
};

export type ManifestJson = { items?: ManifestItem[] } | ManifestItem[];

export type SectionType = 
  | 'overview'
  | 'logo'
  | 'colors'
  | 'typography'
  | 'buttons'
  | 'grid_frames'
  | 'backgrounds'
  | 'imagery'
  | 'voice_tone'
  | 'applications'
  | 'dos_donts'
  | 'unmatched';

// --- Database Models ---

export interface CIGuideline {
  id: string;
  project_id: string;
  slug: string | null;
  status: 'draft' | 'published';
  theme: CITheme;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface CITheme {
  backgroundColor?: string;
  textColor?: string;
  accentColors?: string[];
  fontFamily?: string;
  borderRadius?: string;
}

export interface CISection {
  id: string;
  guideline_id: string;
  section_type: SectionType;
  position: number;
  eyebrow_label: string | null;
  headline: string | null;
  headline_emphasis: string | null;
  description: string | null;
  is_visible: boolean;
  data: any; // specific to section_type
}

export interface CIAsset {
  id: string;
  guideline_id: string;
  section_id: string | null;
  kind: string | null;
  storage_path: string;
  public_url: string;
  label: string | null;
  caption: string | null;
  metadata: {
    match_method?: 'exact' | 'synonym' | 'substring' | 'manual' | 'design_token' | null;
    [key: string]: any;
  };
  sort_order: number;
}

// --- Section Data Shapes ---

export type LogoAsset = {
  id?: string;
  assetId: string; // references CIAsset.id
  label: string;
  subtitle?: string;
  stage: 'dark' | 'light' | 'any';
  width?: string;
  fit?: 'contain' | 'cover';
};

export type MinSizeCard = {
  id: string;
  useCase: string;
  size: string;
  unit: string;
};

export type LogoSectionData = {
  logos: LogoAsset[];
  clearspaceText?: string;
  clearspaceAssetId?: string;
  minSizes?: MinSizeCard[];
  minSizeDigital?: string;
  minSizePrint?: string;
};

export type ColorSwatch = {
  id: string;
  name: string;
  hex: string;
  cssVar?: string;
};

export type ColorGroup = {
  id?: string;
  groupLabel: string;
  swatches: ColorSwatch[];
};

export type ColorsSectionData = {
  groups: ColorGroup[];
};

export type TypeRow = {
  id: string;
  label: string;
  specLine1?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  sampleText: string;
  sampleClass?: string;
};

export type TypeScaleEntry = {
  id: string;
  px: number;
  token: string;
};

export type TypographySectionData = {
  rows: TypeRow[];
  scale?: TypeScaleEntry[];
};

export type StateColors = {
  bg?: string;
  text?: string;
  border?: string;
};

export type ButtonSample = {
  id: string;
  variant: 'primary' | 'secondary' | 'ghost' | 'tab' | string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  defaultColors?: StateColors;
  hoverColors?: StateColors;
  activeColors?: StateColors;
};

export type ButtonsSectionData = {
  samples: ButtonSample[];
};

export type FrameCard = {
  id: string;
  label: string;
  sublabel?: string;
  aspectRatio?: string;
  assetId: string;
};

export type GridFramesSectionData = {
  frames: FrameCard[];
};

export type BackgroundAsset = {
  id: string;
  assetId: string;
  label?: string;
};

export type BackgroundGroup = {
  id?: string;
  groupLabel: string;
  assets: BackgroundAsset[];
};

export type BackgroundsSectionData = {
  groups: BackgroundGroup[];
};

export type RuleItem = {
  id: string;
  title: string;
  description: string;
};

export type ImagerySectionData = {
  rules: RuleItem[];
};

export type VoiceTonePill = {
  id: string;
  word: string;
};

export type VoiceTonePhrase = {
  id: string;
  text: string;
};

export type VoiceToneSectionData = {
  marqueeWords: (string | VoiceTonePill)[];
  doPhrases: (string | VoiceTonePhrase)[];
  dontPhrases: (string | VoiceTonePhrase)[];
};

export type ApplicationCard = {
  id: string;
  label: string;
  subtitle?: string;
  tag?: string;
  assetId: string;
};

export type ApplicationsSectionData = {
  apps: ApplicationCard[];
};

export type DoDontItem = {
  id: string;
  type: 'do' | 'dont';
  assetId: string;
  caption: string;
};

export type DosDontsSectionData = {
  items: DoDontItem[];
};

export type OverviewStat = {
  id: string;
  label: string;
  value: string;
};

export type OverviewTonalityCard = {
  id: string;
  icon?: string;
  label?: string;
  text: string;
};

export type OverviewSectionData = {
  leadParagraph?: string;
  stats?: OverviewStat[];
  tonalityCards?: OverviewTonalityCard[];
};
