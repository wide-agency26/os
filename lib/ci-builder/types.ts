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
  assetId: string; // references CIAsset.id
  label: string;
  stage: 'dark' | 'light' | 'any';
  width?: string;
  fit?: 'contain' | 'cover';
};
export type LogoSectionData = {
  logos: LogoAsset[];
  clearspaceText?: string;
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
  groupLabel: string;
  swatches: ColorSwatch[];
};
export type ColorsSectionData = {
  groups: ColorGroup[];
};

export type TypeRow = {
  id: string;
  label: string;
  specLine1: string;
  specLine2?: string;
  sampleText: string;
  sampleClass?: string; // class name or direct font-family/size styles
};
export type TypographySectionData = {
  rows: TypeRow[];
};

export type ButtonSample = {
  id: string;
  variant: 'primary' | 'secondary' | 'ghost' | 'tab';
  label: string;
  size?: 'sm' | 'lg';
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

export type BackgroundGroup = {
  groupLabel: string;
  assets: { id: string; assetId: string; label: string }[];
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

export type VoiceToneSectionData = {
  marqueeWords: string[];
  doPhrases: string[];
  dontPhrases: string[];
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

export type OverviewSectionData = {
  leadParagraph?: string;
  stats?: { label: string; value: string }[];
  tonalityCards?: string[];
};

