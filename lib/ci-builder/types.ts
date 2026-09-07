import type { CiSubModuleId, CiModuleId } from "./modules-catalog";

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

/** Legacy combined sections (pre-9×52) still render for existing guidelines. */
export type LegacySectionType =
  | "overview"
  | "logo"
  | "colors"
  | "typography"
  | "buttons"
  | "grid_frames"
  | "backgrounds"
  | "imagery"
  | "voice_tone"
  | "applications"
  | "dos_donts";

export type SectionType = CiSubModuleId | LegacySectionType | "unmatched";

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

/** Client-facing template (Presentation layouts). Elements mode is orthogonal. */
export type CiClientTemplate = "greenpoint" | "foundry" | "multipage";

export type CiTypeScaleRole =
  | "heading-primary"
  | "heading-secondary"
  | "heading-tertiary"
  | "copy-body"
  | "copy-caption"
  | "surface-neutral";

export type CiLogoMark = {
  id: string;
  name: string;
  isMain?: boolean;
  lightAssetId?: string;
  darkAssetId?: string;
  sortOrder?: number;
};

export type CiLinkItem = {
  id: string;
  label: string;
  url: string;
};

export type CiTokenScaleItem = {
  id: string;
  label: string;
  value: string;
  preview?: string;
};

export type CiTemplateSettings = {
  multipage?: {
    headerImageAssetId?: string;
    cornerRadius?: "none" | "soft" | "round";
    sectionSpacing?: "compact" | "comfortable" | "airy";
    landingTileColorMode?: "cycle" | "neutral" | "accent";
    showNextModuleCard?: boolean;
  };
  greenpoint?: {
    /** When true, Brand Photography may appear as photo-break bands between modules. */
    photoBreaks?: boolean;
  };
  foundry?: {
    /** Module id whose imagery feeds the landing hero. */
    landingHeroModuleId?: CiModuleId;
    gridDensity?: "comfortable" | "dense";
  };
};

export type CiFigmaSyncMeta = {
  lastSyncedAt?: string | null;
  fileKey?: string | null;
  status?: "idle" | "syncing" | "ok" | "error";
  message?: string | null;
};

export interface CITheme {
  /** Overhaul schema marker. 2 = post logo_marks / three-template migration. */
  schemaVersion?: number;
  /** Client Presentation template. Default greenpoint. */
  clientTemplate?: CiClientTemplate;
  /** Module-level hide list (no per-field visibility). */
  hiddenModules?: CiModuleId[];
  teamName?: string;
  pointOfContact?: string;
  contactEmail?: string;
  templateSettings?: CiTemplateSettings;
  figmaSync?: CiFigmaSyncMeta;
  backgroundColor?: string;
  textColor?: string;
  /** Page appearance preset. Custom hex still wins; this is the Light/Dark toggle. */
  appearance?: "light" | "dark";
  accentColors?: string[];
  /** @deprecated Prefer primaryFont + primaryFontFallback */
  fontFamily?: string;
  primaryFont?: string;
  secondaryFont?: string;
  tertiaryFont?: string;
  primaryFontFallback?: string;
  secondaryFontFallback?: string;
  tertiaryFontFallback?: string;
  /** Distinct typefaces discovered from Figma/JSON import */
  availableFonts?: string[];
  borderRadius?: string;
  /**
   * Brand book Colors Systems layout.
   * merge = families in one wrapping row; small = H3 breakers; large = H2 breakers.
   */
  colorChapterLayout?: "merge" | "small" | "large";
  /** Cover / hero heading. Empty falls back to the project name. */
  coverTitle?: string;
  /** When false, hide the cover title on Brand book and Elements. Default true. */
  showCoverTitle?: boolean;
  /** Small eyebrow above the cover title. Empty hides it. */
  coverEyebrow?: string;
  /** Line under the cover title. Empty hides it. */
  coverSubtitle?: string;
  /**
   * Brand book hero header blocks. Missing keys default to shown.
   * Hide a block from clients/PDF without deleting the underlying content.
   */
  coverHeader?: Partial<Record<CoverHeaderId, boolean>>;
  /** Chapter breaker alignment in editor + brand book. */
  breakerAlign?: "left" | "center" | "right";
  /** Chapter breaker type size: S caption, M tertiary, L secondary, XL primary. */
  breakerSize?: "s" | "m" | "l" | "xl";
  /** Copy-as-prompt chip background. Empty = black on light, white on dark. */
  promptButtonBg?: string;
  /** Copy-as-prompt chip text. Empty = inverted against promptButtonBg. */
  promptButtonFg?: string;
  /** Logo / image-slot card stage: padding, zoom, and well size (Elements + Brand book). */
  logoCards?: {
    padding?: "none" | "sm" | "md" | "lg";
    /** 0.5–2, default 1 */
    zoom?: number;
    /** Stage aspect: S≈5/4, M≈4/3, L≈1/1 */
    size?: "S" | "M" | "L";
  };
  /**
   * Brand-book module / footer presentation (tone, text, accent, background).
   * Sub-module sections keep layout-only overrides in `data.presentation`.
   */
  modulePresentation?: Partial<
    Record<CiModuleId | "footer" | "other", SectionPresentation>
  >;
}

export const CI_SCHEMA_VERSION = 2;

export type CoverHeaderId =
  | "statAccent"
  | "statLogos"
  | "statChapters"
  | "railVoice"
  | "railColor"
  | "railType";

/** Brand-book-only section chrome (stored on `ci_sections.data.presentation`). */
export type SectionPresentationAppearance = "inherit" | "light" | "dark";
export type SectionPresentationLayout = "stack" | "image-left" | "image-right";

export type SectionBgFit = "cover" | "contain" | "none";
export type SectionBgAttachment = "scroll" | "fixed";
export type SectionBgRepeat = "no-repeat" | "repeat" | "repeat-x" | "repeat-y";
export type SectionBgPosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top left"
  | "top right"
  | "bottom left"
  | "bottom right";

export type SectionPresentationBackground = {
  assetId: string;
  opacity?: number;
  fit?: SectionBgFit;
  attachment?: SectionBgAttachment;
  position?: SectionBgPosition;
  repeat?: SectionBgRepeat;
};

export type PresentationGapSize = "s" | "m" | "l";

/** Optional hero strip at module boundaries (distinct from full-module bg overlay). */
export type ModuleCoverPhoto = {
  assetId: string;
  placement?: "before_title" | "after_title";
  fit?: SectionBgFit;
  position?: SectionBgPosition;
  opacity?: number;
  height?: PresentationGapSize;
};

export type SectionPresentation = {
  /**
   * Inherit = guideline ThemePanel under this section.
   * Light/dark = CI_THEME_PRESETS band; text/accent chips override on top.
   */
  appearance?: SectionPresentationAppearance;
  /** Overrides --ci-text (brand palette hex). */
  textColor?: string;
  /** Overrides --ci-accent (brand palette hex). */
  accentColor?: string;
  /** Solid background override (hex). Wins over tone preset when set. */
  backgroundColor?: string;
  layout?: SectionPresentationLayout;
  mediaAssetId?: string;
  /** Side-image object-fit (cover / contain / none). */
  mediaFit?: SectionBgFit;
  /** Side-image object-position (9-point align). */
  mediaPosition?: SectionBgPosition;
  background?: SectionPresentationBackground;
  /** Gap from section headline block to body content. */
  headGap?: PresentationGapSize;
  /** Gap from module chapter title to first sub-module (theme.modulePresentation). */
  chapterGap?: PresentationGapSize;
  /** Module cover hero strip (theme.modulePresentation). */
  cover?: ModuleCoverPhoto;
};

const BG_FITS: SectionBgFit[] = ["cover", "contain", "none"];
const BG_ATTACHMENTS: SectionBgAttachment[] = ["scroll", "fixed"];
const BG_REPEATS: SectionBgRepeat[] = [
  "no-repeat",
  "repeat",
  "repeat-x",
  "repeat-y",
];
const BG_POSITIONS: SectionBgPosition[] = [
  "top left",
  "top",
  "top right",
  "left",
  "center",
  "right",
  "bottom left",
  "bottom",
  "bottom right",
];

function normalizeBgFit(v: unknown): SectionBgFit {
  return BG_FITS.includes(v as SectionBgFit) ? (v as SectionBgFit) : "cover";
}
function normalizeBgAttachment(v: unknown): SectionBgAttachment {
  return BG_ATTACHMENTS.includes(v as SectionBgAttachment)
    ? (v as SectionBgAttachment)
    : "scroll";
}
function normalizeBgRepeat(v: unknown): SectionBgRepeat {
  return BG_REPEATS.includes(v as SectionBgRepeat)
    ? (v as SectionBgRepeat)
    : "no-repeat";
}
function normalizeBgPosition(v: unknown): SectionBgPosition {
  return BG_POSITIONS.includes(v as SectionBgPosition)
    ? (v as SectionBgPosition)
    : "center";
}

function normalizePresentationHex(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!/^#[0-9a-fA-F]{3,8}$/.test(t)) return undefined;
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toUpperCase();
  }
  return undefined;
}

function normalizeGapSize(v: unknown): PresentationGapSize | undefined {
  return v === "s" || v === "m" || v === "l" ? v : undefined;
}

function normalizeModuleCover(raw: unknown): ModuleCoverPhoto | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as ModuleCoverPhoto;
  const assetId = r.assetId ? String(r.assetId).trim() : "";
  if (!assetId) return undefined;
  return {
    assetId,
    placement:
      r.placement === "before_title" || r.placement === "after_title"
        ? r.placement
        : "after_title",
    fit: normalizeBgFit(r.fit),
    position: normalizeBgPosition(r.position),
    opacity:
      typeof r.opacity === "number"
        ? Math.min(1, Math.max(0, r.opacity))
        : 1,
    height: normalizeGapSize(r.height) || "m",
  };
}

export function readSectionPresentation(
  data: unknown
): SectionPresentation {
  const raw =
    data && typeof data === "object"
      ? (data as { presentation?: SectionPresentation }).presentation
      : undefined;
  if (!raw || typeof raw !== "object") return {};
  const assetId = raw.background?.assetId
    ? String(raw.background.assetId).trim()
    : "";
  const textColor = normalizePresentationHex(raw.textColor);
  const accentColor = normalizePresentationHex(raw.accentColor);
  const backgroundColor = normalizePresentationHex(raw.backgroundColor);
  const headGap = normalizeGapSize(raw.headGap);
  const chapterGap = normalizeGapSize(raw.chapterGap);
  const cover = normalizeModuleCover(raw.cover);
  return {
    appearance:
      raw.appearance === "light" || raw.appearance === "dark"
        ? raw.appearance
        : "inherit",
    textColor,
    accentColor,
    backgroundColor,
    layout:
      raw.layout === "image-left" || raw.layout === "image-right"
        ? raw.layout
        : "stack",
    mediaAssetId: raw.mediaAssetId || undefined,
    mediaFit: raw.mediaAssetId
      ? normalizeBgFit(raw.mediaFit)
      : undefined,
    mediaPosition: raw.mediaAssetId
      ? normalizeBgPosition(raw.mediaPosition)
      : undefined,
    background: assetId
      ? {
          assetId,
          opacity:
            typeof raw.background?.opacity === "number"
              ? Math.min(1, Math.max(0, raw.background.opacity))
              : 0.25,
          fit: normalizeBgFit(raw.background?.fit),
          attachment: normalizeBgAttachment(raw.background?.attachment),
          position: normalizeBgPosition(raw.background?.position),
          repeat: normalizeBgRepeat(raw.background?.repeat),
        }
      : undefined,
    headGap,
    chapterGap,
    cover,
  };
}

/** True when section has any brand-book presentation override. */
export function sectionPresentationIsEmpty(
  presentation: SectionPresentation
): boolean {
  return !(
    (presentation.appearance && presentation.appearance !== "inherit") ||
    presentation.textColor ||
    presentation.accentColor ||
    presentation.backgroundColor ||
    presentation.headGap ||
    (presentation.layout && presentation.layout !== "stack") ||
    presentation.mediaAssetId ||
    presentation.background?.assetId
  );
}

/** Build a CSS font-family stack from a brand face + fallback. */
export function cssFontStack(
  font?: string | null,
  fallback?: string | null
): string {
  const fb = (fallback || "system-ui, -apple-system, sans-serif").trim();
  const raw = (font || "").trim();
  if (!raw) return fb;
  const needsQuotes = /\s/.test(raw) && !/^['"]/.test(raw);
  const face = needsQuotes ? `'${raw.replace(/'/g, "")}'` : raw;
  return `${face}, ${fb}`;
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
    png_url?: string | null;
    png_storage_path?: string | null;
    prefer_svg?: boolean;
    figma_node_id?: string;
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
  /** Optional CSS rgb() string populated from Figma Variables. */
  rgb?: string;
  /** Optional print CMYK string, e.g. "C12 M8 Y0 K40". */
  cmyk?: string;
  /** True for the 500 / main shade in a family. */
  isCanonical?: boolean;
  /** Optional usage share 0–100 for proportion bars (derived display). */
  proportion?: number | null;
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
  /** CSS size used for the specimen, e.g. "100px". */
  value?: string;
  name?: string;
  role?: CiTypeScaleRole | string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  lineHeight?: string;
  letterSpacing?: string;
  paragraphSpacing?: string;
  textTransform?: string;
  align?: string;
  colorToken?: string;
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
