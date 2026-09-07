import type { CIAsset, CISection, CITheme } from "@/lib/ci-builder/types";
import { namedThemeFonts } from "@/lib/ci-builder/load-fonts";
import { typeScaleIsFallback } from "@/lib/ci-builder/breaker-type";
import { hasFaviconOrIcon } from "@/lib/ci-builder/brand-mark";

export type ImportGap = {
  id: string;
  message: string;
};

export function collectImportGaps(opts: {
  theme?: CITheme | null;
  sections?: Partial<CISection>[] | null;
  assets?: Partial<CIAsset>[] | null;
  fontLoaded?: boolean | null;
}): ImportGap[] {
  const gaps: ImportGap[] = [];
  const theme = opts.theme || {};
  const sections = opts.sections || [];
  const assets = opts.assets || [];
  const named = namedThemeFonts(theme);

  if (named.length && opts.fontLoaded === false) {
    gaps.push({
      id: "font-missing",
      message: `${named[0]} is set but not loaded. Upload a .woff2 or confirm the Google family.`,
    });
  }

  if (typeScaleIsFallback(sections)) {
    gaps.push({
      id: "type-fallback",
      message:
        "Import didn’t include a full type scale — headers are using fallback sizes.",
    });
  }

  const colorSecs = sections.filter((s) =>
    /^(color_primary|color_secondary|color_accent)$/.test(String(s.section_type || ""))
  );
  const swatchCount = colorSecs.reduce((n, s) => {
    const swatches = (s.data as { swatches?: unknown[] } | undefined)?.swatches;
    return n + (Array.isArray(swatches) ? swatches.length : 0);
  }, 0);
  if (swatchCount === 0) {
    gaps.push({
      id: "color-families",
      message: "Import didn’t include color families — chrome is using fallback accents.",
    });
  } else {
    const primary = sections.find((s) => s.section_type === "color_primary");
    const accent = sections.find((s) => s.section_type === "color_accent");
    const pCount = Array.isArray((primary?.data as { swatches?: unknown[] })?.swatches)
      ? ((primary?.data as { swatches: unknown[] }).swatches || []).length
      : 0;
    const aCount = Array.isArray((accent?.data as { swatches?: unknown[] })?.swatches)
      ? ((accent?.data as { swatches: unknown[] }).swatches || []).length
      : 0;
    if (pCount >= 2 && aCount === 0) {
      gaps.push({
        id: "dual-primary",
        message:
          "Same-hue tokens were kept as a dual primary. Accent is empty until a different hue exists.",
      });
    }
  }

  if (!hasFaviconOrIcon(sections, assets)) {
    gaps.push({
      id: "mark-missing",
      message: "No favicon or icon was imported — the profile mark is using the primary logo.",
    });
  }

  return gaps;
}
