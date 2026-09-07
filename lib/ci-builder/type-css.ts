import type { CSSProperties } from "react";

/**
 * Turn a type-spec field into a CSS length.
 * Bare numbers become px (Figma often stores 48, not 48px).
 * Unitless line-height (0–4] stays unitless.
 */
export function cssLength(
  value: unknown,
  kind: "size" | "leading" | "tracking" = "size"
): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  if (/[a-z%]/i.test(raw)) return raw;
  if (!/^-?[\d.]+$/.test(raw)) return raw;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return undefined;
  if (kind === "leading" && n > 0 && n <= 4) return String(n);
  return `${raw}px`;
}

export function typeSpecCss(data: {
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  fontSize?: string;
  lineHeight?: string;
  letterSpacing?: string;
}): CSSProperties {
  const italic =
    data.fontStyle === "italic" ||
    /italic|oblique/i.test(String(data.fontWeight || ""));
  return {
    fontFamily: data.fontFamily || "inherit",
    fontWeight: (data.fontWeight || 600) as CSSProperties["fontWeight"],
    fontStyle: italic ? "italic" : "normal",
    fontSize: cssLength(data.fontSize, "size") || "2.5rem",
    lineHeight: cssLength(data.lineHeight, "leading") || 1.1,
    letterSpacing: cssLength(data.letterSpacing, "tracking") || "normal",
  };
}
