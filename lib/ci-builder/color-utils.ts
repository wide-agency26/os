/** Color math for CI Builder swatch cards. Display-only except hex/rgb/cmyk persistence. */

export type ColorFormat = "hex" | "rgb" | "hsl" | "cmyk";

export const COLOR_FORMATS: ColorFormat[] = ["hex", "rgb", "hsl", "cmyk"];

export const COLOR_FORMAT_LABELS: Record<ColorFormat, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  cmyk: "CMYK",
};

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };
export type Cmyk = { c: number; m: number; y: number; k: number };

export function toHexColor(value: string): string {
  const raw = (value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
  }
  const rgb = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgb) {
    const hex = [rgb[1], rgb[2], rgb[3]]
      .map((n) =>
        Math.min(255, Math.max(0, parseInt(n, 10)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("");
    return `#${hex}`.toUpperCase();
  }
  return "#000000";
}

export function isCompleteHex(value: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

export function normalizeTypedHex(value: string): string {
  let v = value.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  return v;
}

export function hexToRgb(hex: string): Rgb {
  const h = toHexColor(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) =>
        Math.max(0, Math.min(255, Math.round(x)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
      .toUpperCase()
  );
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) =>
    ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(255 * f(0), 255 * f(8), 255 * f(4));
}

export function rgbToCmyk(r: number, g: number, b: number): Cmyk {
  if (r === 0 && g === 0 && b === 0) return { c: 0, m: 0, y: 0, k: 100 };
  const rp = r / 255;
  const gp = g / 255;
  const bp = b / 255;
  const k = 1 - Math.max(rp, gp, bp);
  return {
    c: Math.round(((1 - rp - k) / (1 - k)) * 100) || 0,
    m: Math.round(((1 - gp - k) / (1 - k)) * 100) || 0,
    y: Math.round(((1 - bp - k) / (1 - k)) * 100) || 0,
    k: Math.round(k * 100),
  };
}

/** Persisted `ColorSwatch.rgb` format. */
export function hexToRgbCss(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Persisted `ColorSwatch.cmyk` format. */
export function hexToCmykToken(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const cmyk = rgbToCmyk(r, g, b);
  return `C${cmyk.c} M${cmyk.m} Y${cmyk.y} K${cmyk.k}`;
}

export function cmykToHex(c: number, m: number, y: number, k: number): string {
  const C = Math.min(100, Math.max(0, c)) / 100;
  const M = Math.min(100, Math.max(0, m)) / 100;
  const Y = Math.min(100, Math.max(0, y)) / 100;
  const K = Math.min(100, Math.max(0, k)) / 100;
  return rgbToHex(
    255 * (1 - C) * (1 - K),
    255 * (1 - M) * (1 - K),
    255 * (1 - Y) * (1 - K)
  );
}

/** Parse `rgb(1, 2, 3)` or `1 / 2 / 3` / `1, 2, 3`. Returns hex or null. */
export function parseRgbToHex(raw: string): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  const css = t.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (css) {
    const r = Number(css[1]);
    const g = Number(css[2]);
    const b = Number(css[3]);
    if ([r, g, b].some((n) => n > 255)) return null;
    return rgbToHex(r, g, b);
  }
  const parts = t.split(/[/,\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 3) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null;
  return rgbToHex(nums[0], nums[1], nums[2]);
}

/** Parse `C10 M20 Y30 K40` or `10 / 20 / 30 / 40`. Returns hex or null. */
export function parseCmykToHex(raw: string): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  const token = t.match(/C\s*(\d{1,3})\s*M\s*(\d{1,3})\s*Y\s*(\d{1,3})\s*K\s*(\d{1,3})/i);
  if (token) {
    const nums = token.slice(1, 5).map(Number);
    if (nums.some((n) => n > 100)) return null;
    return cmykToHex(nums[0], nums[1], nums[2], nums[3]);
  }
  const parts = t
    .replace(/%/g, "")
    .split(/[/,\s]+/)
    .map((p) => p.trim())
    .filter((p) => p && !/^[cmyk]$/i.test(p));
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) return null;
  return cmykToHex(nums[0], nums[1], nums[2], nums[3]);
}

function relLum(r: number, g: number, b: number): number {
  const vals = [r, g, b].map((v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2];
}

export function contrastRatio(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const la = relLum(a.r, a.g, a.b);
  const lb = relLum(b.r, b.g, b.b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function pickTextColor(hex: string): "#FFFFFF" | "#0A0A0A" {
  return contrastRatio(hex, "#FFFFFF") >= contrastRatio(hex, "#000000")
    ? "#FFFFFF"
    : "#0A0A0A";
}

export function contrastLabel(ratio: number): "AAA" | "AA" | "AA18" | "LOW" {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA18";
  return "LOW";
}

export function lighten(hex: string, amt: number): string {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const newL = Math.max(2, Math.min(98, hsl.l + amt * 100));
  return hslToHex(hsl.h, hsl.s, newL);
}

export function valueTextFor(hex: string, fmt: ColorFormat): string {
  const rgb = hexToRgb(hex);
  if (fmt === "rgb") return `${rgb.r} / ${rgb.g} / ${rgb.b}`;
  if (fmt === "hsl") {
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return `${hsl.h}° ${hsl.s}% ${hsl.l}%`;
  }
  if (fmt === "cmyk") {
    const c = rgbToCmyk(rgb.r, rgb.g, rgb.b);
    return `${c.c} / ${c.m} / ${c.y} / ${c.k}`;
  }
  return toHexColor(hex);
}

export function suggestCssVar(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `--color-${slug}` : "";
}

/** Top-left token hint when there is no dedicated shade field. */
export function shadeHint(name: string, cssVar?: string): string {
  const trimmed = name.trim();
  if (/^\d{2,4}$/.test(trimmed)) return trimmed;
  const fromVar = (cssVar || "").split("-").pop() || "";
  if (/^\d{2,4}$/.test(fromVar)) return fromVar;
  return "●";
}

export function formatFromLabel(label?: string): ColorFormat {
  const key = (label || "").toLowerCase();
  if (key === "rgb" || key === "hsl" || key === "cmyk") return key;
  return "hex";
}

export function nextShadeFromLast(last?: {
  name: string;
  hex: string;
  cssVar?: string;
}): {
  name: string;
  hex: string;
  cssVar: string;
  rgb: string;
  cmyk: string;
} {
  const hex = last ? lighten(last.hex, -0.08) : "#3B82F6";
  const isNumeric = !!last && /^\d+$/.test(last.name.trim());
  const name = isNumeric
    ? String(Number(last!.name.trim()) + 100)
    : last
      ? "New shade"
      : "New Swatch";
  let cssVar = suggestCssVar(name);
  if (last?.cssVar) {
    cssVar = isNumeric
      ? last.cssVar.replace(/-?\d+$/, `-${name}`)
      : `${last.cssVar.replace(/-+$/, "")}-shade`;
  }
  return {
    name,
    hex,
    cssVar,
    rgb: hexToRgbCss(hex),
    cmyk: hexToCmykToken(hex),
  };
}
