import type { CSSProperties } from "react";
import type { CISection, CITheme } from "@/lib/ci-builder/types";
import { cssLength } from "@/lib/ci-builder/type-css";

export type BreakerAlign = "left" | "center" | "right";
export type BreakerSize = "s" | "m" | "l" | "xl";

export type TypeSpecSnapshot = {
  fontFamily?: string;
  fontWeight?: string;
  fontSize?: string;
  letterSpacing?: string;
  fontStyle?: string;
};

const ROLE_FOR_SIZE: Record<BreakerSize, string> = {
  s: "caption",
  m: "headline_tertiary",
  l: "headline_secondary",
  xl: "headline_primary",
};

const FALLBACK_PX: Record<BreakerSize, number> = {
  s: 12,
  m: 24,
  l: 38,
  xl: 56,
};

function parsePx(value: unknown): number | null {
  const n = parseFloat(String(value || "").replace(/px/i, ""));
  return Number.isFinite(n) ? n : null;
}

function specFromSection(sec?: Partial<CISection>): TypeSpecSnapshot | null {
  if (!sec) return null;
  const d = (sec.data || {}) as TypeSpecSnapshot;
  if (!d.fontFamily && !d.fontSize) return null;
  return {
    fontFamily: d.fontFamily,
    fontWeight: d.fontWeight,
    fontSize: cssLength(d.fontSize, "size") || d.fontSize,
    letterSpacing: cssLength(d.letterSpacing, "tracking") || d.letterSpacing,
    fontStyle: d.fontStyle,
  };
}

export function resolveBreakerAlign(theme?: CITheme | null): BreakerAlign {
  const v = theme?.breakerAlign;
  if (v === "left" || v === "center" || v === "right") return v;
  return "left";
}

export function resolveBreakerSize(theme?: CITheme | null): BreakerSize {
  const v = theme?.breakerSize;
  if (v === "s" || v === "m" || v === "l" || v === "xl") return v;
  return "xl";
}

export function typeSpecForRole(
  sections: Partial<CISection>[] | undefined,
  role: string
): TypeSpecSnapshot | null {
  return specFromSection(sections?.find((s) => s.section_type === role));
}

/** If only one size exists, derive the rest of S–XL from it. */
export function derivedBreakerSpecs(
  sections?: Partial<CISection>[] | null
): Record<BreakerSize, TypeSpecSnapshot> {
  const list = sections || [];
  const caption = typeSpecForRole(list, "caption");
  const tertiary = typeSpecForRole(list, "headline_tertiary");
  const secondary = typeSpecForRole(list, "headline_secondary");
  const primary = typeSpecForRole(list, "headline_primary");
  const base =
    secondary || primary || tertiary || caption || ({ fontSize: "38px" } as TypeSpecSnapshot);
  const basePx = parsePx(base.fontSize) || 38;

  const fill = (
    spec: TypeSpecSnapshot | null,
    size: BreakerSize,
    ratio: number
  ): TypeSpecSnapshot => {
    if (spec?.fontSize) return { ...base, ...spec };
    return {
      fontFamily: spec?.fontFamily || base.fontFamily,
      fontWeight: spec?.fontWeight || base.fontWeight,
      fontStyle: spec?.fontStyle || base.fontStyle,
      letterSpacing: spec?.letterSpacing || base.letterSpacing,
      fontSize: `${Math.round(basePx * ratio) || FALLBACK_PX[size]}px`,
    };
  };

  return {
    s: fill(caption, "s", 0.42),
    m: fill(tertiary, "m", 0.7),
    l: fill(secondary, "l", 1),
    xl: fill(primary, "xl", 1.45),
  };
}

export function breakerStyleFromTheme(
  theme?: CITheme | null,
  sections?: Partial<CISection>[] | null
): CSSProperties {
  const size = resolveBreakerSize(theme);
  const align = resolveBreakerAlign(theme);
  const specs = derivedBreakerSpecs(sections);
  const spec = specs[size];
  const caption = specs.s;
  return {
    "--ci-breaker-align": align,
    "--ci-breaker-font": spec.fontFamily || "inherit",
    "--ci-breaker-size": spec.fontSize || "38px",
    "--ci-breaker-weight": spec.fontWeight || "700",
    "--ci-breaker-tracking": spec.letterSpacing || "-0.03em",
    "--ci-breaker-style": spec.fontStyle || "normal",
    "--ci-breaker-num-size": caption.fontSize || "12px",
    "--ci-breaker-num-weight": caption.fontWeight || "600",
    "--ci-display-font": specs.xl.fontFamily || spec.fontFamily || "inherit",
    "--ci-display-size": specs.xl.fontSize || "56px",
    "--ci-display-weight": specs.xl.fontWeight || "800",
    "--ci-display-tracking": specs.xl.letterSpacing || "-0.04em",
    "--ci-display-style": specs.xl.fontStyle || "normal",
    "--ci-chapter-font": specs.l.fontFamily || spec.fontFamily || "inherit",
    "--ci-chapter-size": specs.l.fontSize || spec.fontSize || "38px",
    "--ci-chapter-weight": specs.l.fontWeight || spec.fontWeight || "700",
    "--ci-subhead-font": specs.m.fontFamily || spec.fontFamily || "inherit",
    "--ci-subhead-size": specs.m.fontSize || "22px",
    "--ci-subhead-weight": specs.m.fontWeight || "700",
    "--ci-subhead-tracking": specs.m.letterSpacing || "-0.02em",
    "--ci-subhead-style": specs.m.fontStyle || "normal",
    textAlign: align,
  } as CSSProperties;
}

export function typeScaleIsFallback(
  sections?: Partial<CISection>[] | null
): boolean {
  const specs = derivedBreakerSpecs(sections);
  const sampled = ["xl", "l", "m", "s"].filter((k) => {
    const role = ROLE_FOR_SIZE[k as BreakerSize];
    const sec = sections?.find((s) => s.section_type === role);
    return Boolean(sec && parsePx((sec.data as { fontSize?: string } | undefined)?.fontSize));
  }).length;
  return sampled === 0;
}
