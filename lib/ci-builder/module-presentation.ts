import type { CiModuleId } from "./modules-catalog";
import type {
  CITheme,
  CISection,
  ModuleCoverPhoto,
  PresentationGapSize,
  SectionPresentation,
} from "./types";
import { readSectionPresentation } from "./types";

export type BrandBookBlockId = CiModuleId | "footer" | "other";

export const CHAPTER_GAP_PX: Record<PresentationGapSize, string> = {
  s: "24px",
  m: "48px",
  l: "96px",
};

export const HEAD_GAP_PX: Record<PresentationGapSize, string> = {
  s: "24px",
  m: "56px",
  l: "96px",
};

export const COVER_HEIGHT_PX: Record<PresentationGapSize, string> = {
  s: "240px",
  m: "360px",
  l: "480px",
};

/** Tone / ink / background / gap stored on theme.modulePresentation (no covers). */
export function pickModuleChrome(
  presentation: SectionPresentation
): SectionPresentation {
  const out: SectionPresentation = {};
  if (presentation.appearance && presentation.appearance !== "inherit") {
    out.appearance = presentation.appearance;
  }
  if (presentation.textColor) out.textColor = presentation.textColor;
  if (presentation.accentColor) out.accentColor = presentation.accentColor;
  if (presentation.backgroundColor) {
    out.backgroundColor = presentation.backgroundColor;
  }
  if (presentation.background?.assetId) {
    out.background = presentation.background;
  }
  if (presentation.chapterGap) out.chapterGap = presentation.chapterGap;
  return out;
}

/**
 * Per-section color / background overrides (no layout, no chapter gap).
 * Stored on ci_sections.data.presentation.
 */
export function pickSectionChrome(
  presentation: SectionPresentation
): SectionPresentation {
  const out: SectionPresentation = {};
  if (presentation.appearance && presentation.appearance !== "inherit") {
    out.appearance = presentation.appearance;
  }
  if (presentation.textColor) out.textColor = presentation.textColor;
  if (presentation.accentColor) out.accentColor = presentation.accentColor;
  if (presentation.backgroundColor) {
    out.backgroundColor = presentation.backgroundColor;
  }
  if (presentation.background?.assetId) {
    out.background = presentation.background;
  }
  if (presentation.headGap) out.headGap = presentation.headGap;
  return out;
}

/** @deprecated Prefer pickSectionChrome — kept for callers that only need bg. */
export function pickSectionBackground(
  presentation: SectionPresentation
): SectionPresentation {
  return pickSectionChrome(presentation);
}

/** Layout / side-image fields stored on ci_sections.data.presentation. */
export function pickLayoutPresentation(
  presentation: SectionPresentation
): SectionPresentation {
  const out: SectionPresentation = {};
  if (presentation.layout && presentation.layout !== "stack") {
    out.layout = presentation.layout;
  }
  if (presentation.mediaAssetId) {
    out.mediaAssetId = presentation.mediaAssetId;
    out.mediaFit = presentation.mediaFit;
    out.mediaPosition = presentation.mediaPosition;
  }
  return out;
}

export function mergeSectionPresentation(
  presentation: SectionPresentation
): SectionPresentation {
  return {
    ...pickLayoutPresentation(presentation),
    ...pickSectionBackground(presentation),
  };
}

export function modulePresentationIsEmpty(
  presentation: SectionPresentation
): boolean {
  return !(
    (presentation.appearance && presentation.appearance !== "inherit") ||
    presentation.textColor ||
    presentation.accentColor ||
    presentation.backgroundColor ||
    presentation.background?.assetId ||
    presentation.chapterGap
  );
}

export function sectionChromeIsEmpty(
  presentation: SectionPresentation
): boolean {
  return !(
    (presentation.appearance && presentation.appearance !== "inherit") ||
    presentation.textColor ||
    presentation.accentColor ||
    presentation.backgroundColor ||
    presentation.background?.assetId ||
    presentation.headGap
  );
}

export function sectionBackgroundIsEmpty(
  presentation: SectionPresentation
): boolean {
  return sectionChromeIsEmpty(presentation);
}

export function layoutPresentationIsEmpty(
  presentation: SectionPresentation
): boolean {
  return !(
    (presentation.layout && presentation.layout !== "stack") ||
    presentation.mediaAssetId
  );
}

export function moduleScopedSectionPresentationIsEmpty(
  presentation: SectionPresentation
): boolean {
  return (
    sectionChromeIsEmpty(presentation) &&
    layoutPresentationIsEmpty(presentation)
  );
}

export function mergeModuleScopedSectionPresentation(
  presentation: SectionPresentation
): SectionPresentation {
  return {
    ...pickSectionChrome(presentation),
    ...pickLayoutPresentation(presentation),
  };
}

export function hasModuleChrome(presentation: SectionPresentation): boolean {
  return !modulePresentationIsEmpty(presentation);
}

export function hasBackgroundPhoto(
  presentation: SectionPresentation
): boolean {
  return Boolean(presentation.background?.assetId);
}

/** Theme override first, then legacy section-level module chrome. */
export function resolveModulePresentation(
  theme: CITheme | null | undefined,
  blockId: BrandBookBlockId,
  moduleSections: Partial<CISection>[] = []
): SectionPresentation {
  const themed = theme?.modulePresentation?.[blockId];
  if (themed) {
    const normalized = readSectionPresentation({ presentation: themed });
    if (hasModuleChrome(normalized)) return normalized;
  }
  for (const sec of moduleSections) {
    const sectionPres = readSectionPresentation(sec.data);
    if (hasModuleChrome(sectionPres)) return pickModuleChrome(sectionPres);
  }
  return {};
}

export function resolveModuleCover(
  theme: CITheme | null | undefined,
  blockId: BrandBookBlockId,
  moduleSections: Partial<CISection>[] = []
): ModuleCoverPhoto | undefined {
  return resolveModulePresentation(theme, blockId, moduleSections).cover;
}

export function resolveSectionLayoutPresentation(
  data: unknown
): SectionPresentation {
  return pickLayoutPresentation(readSectionPresentation(data));
}

export function resolveSectionBackgroundPresentation(
  data: unknown
): SectionPresentation {
  return pickSectionBackground(readSectionPresentation(data));
}
