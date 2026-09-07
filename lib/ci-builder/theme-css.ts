import type { CSSProperties } from "react";
import type { CITheme, CoverHeaderId } from "@/lib/ci-builder/types";
import { cssFontStack } from "@/lib/ci-builder/types";

export const CI_THEME_PRESETS = {
  light: { backgroundColor: "#f6f6f4", textColor: "#171717" },
  dark: { backgroundColor: "#111111", textColor: "#f3f3f0" },
} as const;

/** WCAG AA for body text — below this, page chrome disappears into the canvas. */
export const MIN_THEME_CONTRAST = 4.5;

export type CiAppearance = "light" | "dark";

export function parseHexRgb(hex?: string | null): { r: number; g: number; b: number } | null {
  const m = String(hex || "")
    .replace("#", "")
    .match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return {
    r: parseInt(m[1], 16) / 255,
    g: parseInt(m[2], 16) / 255,
    b: parseInt(m[3], 16) / 255,
  };
}

function srgbChannel(c: number) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function hexLuminance(hex?: string | null): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 0.5;
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

export function hexRelativeLuminance(hex?: string | null): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 0.5;
  return (
    0.2126 * srgbChannel(rgb.r) +
    0.7152 * srgbChannel(rgb.g) +
    0.0722 * srgbChannel(rgb.b)
  );
}

export function hexContrastRatio(a?: string | null, b?: string | null): number {
  const l1 = hexRelativeLuminance(a);
  const l2 = hexRelativeLuminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function themeHasReadableContrast(theme?: CITheme | null): boolean {
  return (
    hexContrastRatio(
      theme?.backgroundColor || CI_THEME_PRESETS.light.backgroundColor,
      theme?.textColor || CI_THEME_PRESETS.light.textColor
    ) >= MIN_THEME_CONTRAST
  );
}

export function readableInkForBackground(bg?: string | null): string {
  const appearance = appearanceFromBackground(bg);
  return CI_THEME_PRESETS[appearance].textColor;
}

export function appearanceFromBackground(hex?: string | null): CiAppearance {
  return hexLuminance(hex) < 0.45 ? "dark" : "light";
}

/** Solid chip ink that contrasts against a chip background (not page appearance). */
export function contrastPromptFg(bg?: string | null): string {
  return hexLuminance(bg) < 0.45 ? "#ffffff" : "#111111";
}

export function resolvePromptButtonBg(theme?: CITheme | null): string {
  const t = theme || {};
  if (t.promptButtonBg) return t.promptButtonBg;
  const appearance =
    t.appearance || appearanceFromBackground(t.backgroundColor);
  return appearance === "dark" ? "#ffffff" : "#111111";
}

export function resolvePromptButtonFg(theme?: CITheme | null): string {
  const t = theme || {};
  if (t.promptButtonFg) return t.promptButtonFg;
  return contrastPromptFg(resolvePromptButtonBg(t));
}

export function withAppearance(theme: CITheme, appearance: CiAppearance): CITheme {
  const preset = CI_THEME_PRESETS[appearance];
  return {
    ...theme,
    backgroundColor: preset.backgroundColor,
    textColor: preset.textColor,
    appearance,
  };
}

/**
 * Never let page bg/text collapse. Keeps brand accent; snaps ink (or the
 * whole pair) to a Light/Dark preset when contrast is too low.
 */
export function ensureReadableTheme(theme?: CITheme | null): CITheme {
  const t: CITheme = { ...(theme || {}) };
  const appearance = t.appearance || appearanceFromBackground(t.backgroundColor);
  const bg = t.backgroundColor || CI_THEME_PRESETS[appearance].backgroundColor;
  t.backgroundColor = bg;

  if (hexContrastRatio(bg, t.textColor) < MIN_THEME_CONTRAST) {
    t.textColor = readableInkForBackground(bg);
  }
  if (hexContrastRatio(t.backgroundColor, t.textColor) < MIN_THEME_CONTRAST) {
    const preset = CI_THEME_PRESETS[appearanceFromBackground(bg)];
    t.backgroundColor = preset.backgroundColor;
    t.textColor = preset.textColor;
  }

  t.appearance = appearanceFromBackground(t.backgroundColor);
  return t;
}

export const DEFAULT_COVER_EYEBROW = "Brand guidelines";
export const DEFAULT_COVER_SUBTITLE =
  "Identity, voice, and visual system.";

export function isCoverTitleVisible(theme?: CITheme | null): boolean {
  return theme?.showCoverTitle !== false;
}

export const COVER_HEADER_ITEMS: {
  id: CoverHeaderId;
  label: string;
  hint: string;
}[] = [
  { id: "statAccent", label: "Accent", hint: "Count of accent colors" },
  { id: "statLogos", label: "Logo slots", hint: "Count of logo sub-modules" },
  { id: "statChapters", label: "Chapters", hint: "Count of brand-book chapters" },
  { id: "railVoice", label: "Voice", hint: "Claim / positioning card" },
  { id: "railColor", label: "Color", hint: "Primary and secondary chips" },
  { id: "railType", label: "Type", hint: "Primary typeface name" },
];

export function isCoverHeaderItemVisible(
  theme?: CITheme | null,
  id?: CoverHeaderId | null
): boolean {
  if (!id) return true;
  return theme?.coverHeader?.[id] !== false;
}

export function withCoverHeaderItem(
  theme: CITheme | null | undefined,
  id: CoverHeaderId,
  visible: boolean
): CITheme {
  return {
    ...(theme || {}),
    coverHeader: {
      ...(theme?.coverHeader || {}),
      [id]: visible,
    },
  };
}

export function resolveCoverTitle(
  theme?: CITheme | null,
  fallback = "Brand"
): string {
  const custom = theme?.coverTitle?.trim();
  return custom || fallback.trim() || "Brand";
}

export function resolveCoverEyebrow(theme?: CITheme | null): string {
  if (theme && Object.prototype.hasOwnProperty.call(theme, "coverEyebrow")) {
    return String(theme.coverEyebrow || "").trim();
  }
  return DEFAULT_COVER_EYEBROW;
}

export function resolveCoverSubtitle(
  theme?: CITheme | null,
  fallback = DEFAULT_COVER_SUBTITLE
): string {
  if (theme && Object.prototype.hasOwnProperty.call(theme, "coverSubtitle")) {
    return String(theme.coverSubtitle || "").trim();
  }
  return fallback;
}

export const CI_RADIUS_PRESETS = [
  { label: "None", value: "0px" },
  { label: "S", value: "8px" },
  { label: "M", value: "16px" },
  { label: "L", value: "24px" },
  { label: "XL", value: "32px" },
] as const;

export function resolveThemeRadius(theme?: CITheme | null): string {
  const raw = String(theme?.borderRadius || "16px").trim();
  if (raw === "0") return "0px";
  if (/^\d+$/.test(raw)) return `${raw}px`;
  if (/^\d+(\.\d+)?px$/.test(raw)) return raw;
  return "16px";
}

export type ColorChapterLayout = "merge" | "small" | "large";

export type LogoCardPadding = "none" | "sm" | "md" | "lg";
export type LogoCardSize = "S" | "M" | "L";

export function resolveColorChapterLayout(
  theme?: CITheme | null
): ColorChapterLayout {
  const v = theme?.colorChapterLayout;
  if (v === "merge" || v === "small" || v === "large") return v;
  return "merge";
}

export function resolveLogoCardPadding(
  theme?: CITheme | null
): LogoCardPadding {
  const v = theme?.logoCards?.padding;
  if (v === "none" || v === "sm" || v === "md" || v === "lg") return v;
  return "md";
}

export function resolveLogoCardZoom(theme?: CITheme | null): number {
  const raw = theme?.logoCards?.zoom;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(2, Math.max(0.5, n));
}

export function resolveLogoCardSize(theme?: CITheme | null): LogoCardSize {
  const v = theme?.logoCards?.size;
  if (v === "S" || v === "M" || v === "L") return v;
  return "M";
}

const LOGO_PAD_PX: Record<LogoCardPadding, string> = {
  none: "0px",
  sm: "12px",
  md: "24px",
  lg: "40px",
};

const LOGO_ASPECT: Record<LogoCardSize, string> = {
  S: "5 / 4",
  M: "4 / 3",
  L: "1 / 1",
};

/** CSS variables for the guideline canvas — cards inherit surface/border/muted. */
export function ciThemeCssVars(theme?: CITheme | null): CSSProperties {
  const t = ensureReadableTheme(theme);
  const bg = t.backgroundColor || CI_THEME_PRESETS.light.backgroundColor;
  const text = t.textColor || CI_THEME_PRESETS.light.textColor;
  const accent = t.accentColors?.[0] || text;
  const radius = resolveThemeRadius(t);
  const appearance = t.appearance || appearanceFromBackground(bg);
  const promptBg = resolvePromptButtonBg(t);
  const promptFg = resolvePromptButtonFg(t);
  const logoPad = resolveLogoCardPadding(t);
  const logoZoom = resolveLogoCardZoom(t);
  const logoSize = resolveLogoCardSize(t);
  return {
    "--ci-bg": bg,
    "--ci-bg-alt": `color-mix(in srgb, ${text} 7%, ${bg})`,
    "--ci-text": text,
    "--ci-accent": accent,
    "--ci-accent-2": t.accentColors?.[1] || accent,
    "--ci-prompt-bg": promptBg,
    "--ci-prompt-fg": promptFg,
    "--ci-code-well-bg": "#0a0a0a",
    "--ci-code-well-fg": "#f3f3f0",
    "--ci-surface": `color-mix(in srgb, ${text} 8%, ${bg})`,
    "--ci-text-muted": `color-mix(in srgb, ${text} 62%, ${bg})`,
    "--ci-border": `color-mix(in srgb, ${text} 14%, transparent)`,
    "--ci-radius": radius,
    "--ci-logo-pad": LOGO_PAD_PX[logoPad],
    "--ci-logo-zoom": String(logoZoom),
    "--ci-logo-aspect": LOGO_ASPECT[logoSize],
    "--ci-font": cssFontStack(t.primaryFont || t.fontFamily, t.primaryFontFallback),
    "--ci-font-secondary": cssFontStack(
      t.secondaryFont || t.primaryFont || t.fontFamily,
      t.secondaryFontFallback || t.primaryFontFallback
    ),
    "--ci-font-tertiary": cssFontStack(
      t.tertiaryFont || t.secondaryFont,
      t.tertiaryFontFallback
    ),
    backgroundColor: "var(--ci-bg)",
    color: "var(--ci-text)",
    fontFamily: "var(--ci-font)",
  } as CSSProperties;
}

export const CI_PROMPT_CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0 bg-[var(--ci-prompt-bg,#111)] text-[var(--ci-prompt-fg,#fff)] hover:opacity-90 transition-opacity";
