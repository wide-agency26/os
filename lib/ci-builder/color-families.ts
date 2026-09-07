import type { CISection, ColorSwatch } from "@/lib/ci-builder/types";
import { generateUUID } from "@/lib/ci-builder/types";
import { dedupeSwatchesByHex } from "@/lib/ci-builder/color-cleanup";
import { hexToRgb, hexToCmykToken, rgbToHsl, toHexColor } from "@/lib/ci-builder/color-utils";

const ROLE_BUCKETS = ["color_primary", "color_secondary", "color_accent"] as const;
const DEFAULT_PROPORTIONS: Record<string, number> = {
  color_primary: 60,
  color_secondary: 30,
  color_accent: 10,
};

const ROLE_SEG =
  /^(brand colors?|colors?|primary|secondary|accent|functional|palette|main)$/i;
const STEP_SEG = /^(main\s*-?\s*)?\d{2,4}$/i;

export type ColorFamilyGroup = {
  key: string;
  label: string;
  swatches: ColorSwatch[];
  hero: ColorSwatch;
};

export function titleCaseFamily(raw: string): string {
  return (raw || "")
    .trim()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function pathSegments(swatch: ColorSwatch): string[] {
  const fromName = (swatch.name || "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (fromName.length) return fromName;
  const fromVar = (swatch.cssVar || "")
    .replace(/^--/, "")
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean);
  return fromVar;
}

export function familyKeyFromSwatch(swatch: ColorSwatch): string {
  const segs = pathSegments(swatch);
  const meaningful = segs.filter((s) => !ROLE_SEG.test(s) && !STEP_SEG.test(s));
  const raw =
    meaningful[meaningful.length - 1] ||
    segs[segs.length - 2] ||
    segs[0] ||
    "Other";
  return raw.replace(/\s+/g, " ").trim().toUpperCase();
}

export function familyLabelFromSwatch(swatch: ColorSwatch): string {
  return titleCaseFamily(familyKeyFromSwatch(swatch));
}

export function swatchStepNum(swatch: ColorSwatch): number {
  const blob = `${swatch.name || ""} ${swatch.cssVar || ""}`;
  const main = /main\s*-?\s*(\d{2,4})/i.exec(blob);
  if (main) return Number(main[1]);
  const segs = pathSegments(swatch);
  const leaf = segs[segs.length - 1] || "";
  const leafNum = /(\d{2,4})\s*$/.exec(leaf.replace(/main/i, "").trim());
  if (leafNum) return Number(leafNum[1]);
  const any = blob.match(/(\d{2,4})/g);
  if (any?.length) return Number(any[any.length - 1]);
  return swatch.isCanonical ? 500 : 0;
}

export function swatchStepLabel(swatch: ColorSwatch): string {
  const n = swatchStepNum(swatch);
  if (n === 500 || swatch.isCanonical) return "Main";
  if (n > 0) return String(n);
  const leaf = pathSegments(swatch).slice(-1)[0] || "";
  if (leaf && !ROLE_SEG.test(leaf)) return titleCaseFamily(leaf);
  return familyLabelFromSwatch(swatch);
}

export function pickHero(swatches: ColorSwatch[]): ColorSwatch {
  const ranked = [...swatches].sort(
    (a, b) => swatchStepNum(a) - swatchStepNum(b)
  );
  const marked = ranked.find((s) => s.isCanonical);
  if (marked) return marked;
  const five = ranked.find((s) => swatchStepNum(s) === 500);
  if (five) return five;
  const named = ranked.find((s) => /main/i.test(s.name || ""));
  if (named) return named;
  const mid = ranked.filter((s) => {
    const n = swatchStepNum(s);
    return n >= 400 && n <= 800;
  });
  if (mid.length) return mid[mid.length - 1];
  return ranked[ranked.length - 1] || ranked[0];
}

export function clientSwatchLabel(
  swatch: ColorSwatch,
  role: "hero" | "scale"
): string {
  if (role === "hero") return familyLabelFromSwatch(swatch);
  return swatchStepLabel(swatch);
}

export function groupSwatchesByFamily(
  swatches: ColorSwatch[]
): ColorFamilyGroup[] {
  const order: string[] = [];
  const map = new Map<string, ColorSwatch[]>();
  for (const s of swatches) {
    const key = familyKeyFromSwatch(s);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(s);
  }
  return order.map((key) => {
    const list = [...(map.get(key) || [])].sort(
      (a, b) => swatchStepNum(a) - swatchStepNum(b)
    );
    return {
      key,
      label: titleCaseFamily(key),
      swatches: list,
      hero: pickHero(list),
    };
  });
}

const MAX_PRIMARY_FAMILIES = 2;

/**
 * Keep at most two hero families in Primary; extra /Primary/ families
 * move into Secondary so that bucket is not left blank.
 */
export function rebalanceColorBuckets(sections: Partial<CISection>[]): {
  sections: Partial<CISection>[];
  changed: boolean;
} {
  const primary = sections.find((s) => s.section_type === "color_primary");
  const secondary = sections.find((s) => s.section_type === "color_secondary");
  if (!primary || !secondary) return { sections, changed: false };

  const primarySwatches = [
    ...(((primary.data?.swatches || []) as ColorSwatch[])),
  ];
  const groups = groupSwatchesByFamily(primarySwatches);
  if (groups.length <= MAX_PRIMARY_FAMILIES) {
    return { sections, changed: false };
  }

  const keep = groups.slice(0, MAX_PRIMARY_FAMILIES).flatMap((g) => g.swatches);
  const move = groups.slice(MAX_PRIMARY_FAMILIES).flatMap((g) => g.swatches);
  if (!move.length) return { sections, changed: false };

  const existingSecondary = [
    ...(((secondary.data?.swatches || []) as ColorSwatch[])),
  ];
  const mergedSecondary = dedupeSwatchesByHex([...existingSecondary, ...move]);

  let changed = keep.length !== primarySwatches.length;
  if (mergedSecondary.length !== existingSecondary.length) changed = true;
  if (!changed) return { sections, changed: false };

  return {
    changed: true,
    sections: sections.map((sec) => {
      if (sec.section_type === "color_primary") {
        return { ...sec, data: { ...(sec.data || {}), swatches: keep } };
      }
      if (sec.section_type === "color_secondary") {
        return {
          ...sec,
          data: { ...(sec.data || {}), swatches: mergedSecondary },
        };
      }
      return sec;
    }),
  };
}


function hueOfHex(hex: string): number | null {
  try {
    const { r, g, b } = hexToRgb(hex);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return rgbToHsl(r, g, b).h;
  } catch {
    return null;
  }
}

function sameHueFamily(a: string, b: string, deg = 80): boolean {
  const ha = hueOfHex(a);
  const hb = hueOfHex(b);
  if (ha == null || hb == null) return false;
  const d = Math.abs(ha - hb) % 360;
  return Math.min(d, 360 - d) < deg;
}

/** True when a role bucket has swatches but no family-card `hex` yet. */
export function needsColorFamilyPromotion(sections: Partial<CISection>[]): boolean {
  for (const sec of sections) {
    const type = String(sec.section_type || "");
    if (!ROLE_BUCKETS.includes(type as (typeof ROLE_BUCKETS)[number])) continue;
    const data = (sec.data || {}) as { hex?: string; swatches?: ColorSwatch[]; scale?: unknown[] };
    const swatches = data.swatches || [];
    if (swatches.length > 0 && !String(data.hex || "").trim()) return true;
  }
  return false;
}

/**
 * Promote role-bucket swatch arrays into Edit/Brandpad family-card fields
 * (`hex`, `name`, `rgb`, `cmyk`, `proportion`, `tokenKey`, nested `scale`).
 */
export function promoteColorFamilyCards(
  sections: Partial<CISection>[],
  opts?: { themeAccent?: string | null }
): { sections: Partial<CISection>[]; changed: boolean } {
  let changed = false;
  let next = sections.map((sec) => {
    const type = String(sec.section_type || "");
    if (!ROLE_BUCKETS.includes(type as (typeof ROLE_BUCKETS)[number])) return sec;
    const data = { ...((sec.data || {}) as Record<string, unknown>) };
    const swatches = [...(((data.swatches as ColorSwatch[]) || []))];
    if (!swatches.length) return sec;

    const groups = groupSwatchesByFamily(swatches);
    const family = groups[0];
    const hero = family?.hero || pickHero(swatches);
    if (!hero?.hex) return sec;

    const hex = toHexColor(hero.hex);
    const rgb = hexToRgb(hex);
    const rgbStr = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    const cmyk = hexToCmykToken(hex);
    const name =
      String(data.name || "").trim() ||
      family?.label ||
      familyLabelFromSwatch(hero);

    const existingScale = Array.isArray(data.scale)
      ? (data.scale as { id: string; step: string; hex: string; contrastNote?: string }[])
      : [];
    const familySwatches = family?.swatches || swatches;
    const scale =
      existingScale.length > 0
        ? existingScale
        : familySwatches
            .filter((s) => toHexColor(s.hex) !== hex)
            .map((s) => ({
              id: s.id || generateUUID(),
              step: String(swatchStepNum(s) || swatchStepLabel(s)),
              hex: toHexColor(s.hex),
              contrastNote: "",
            }));

    let tokenKey = String(data.tokenKey || "").trim();
    if (type === "color_accent" && !tokenKey) tokenKey = "accent-primary";
    if (type === "color_secondary" && !tokenKey) {
      const luma = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
      if (luma > 0.85) tokenKey = "surface-neutral";
    }

    const proportion =
      Number(data.proportion) > 0
        ? Number(data.proportion)
        : DEFAULT_PROPORTIONS[type] || 0;

    const nextSwatches = swatches.map((s) => ({
      ...s,
      isCanonical: false,
      proportion: s.proportion,
    }));
    let sawHero = false;
    for (const s of nextSwatches) {
      if (!sawHero && (s.id === hero.id || toHexColor(s.hex) === hex)) {
        s.isCanonical = true;
        s.proportion = proportion;
        s.name = name;
        sawHero = true;
      }
    }

    const nextData = {
      ...data,
      hex,
      name,
      rgb: rgbStr,
      cmyk,
      proportion,
      tokenKey,
      swatches: nextSwatches,
      scale,
    };

    if (JSON.stringify(data) !== JSON.stringify(nextData)) changed = true;
    return { ...sec, data: nextData };
  });

  // Empty accent: seed from theme accent or most chromatic non-surface swatch
  const accent = next.find((s) => s.section_type === "color_accent");
  const accentData = (accent?.data || {}) as { hex?: string; swatches?: ColorSwatch[] };
  if (accent && !(accentData.swatches || []).length && !String(accentData.hex || "").trim()) {
    const rawTheme = String(opts?.themeAccent || "").trim();
    let seedHex = "";
    if (rawTheme) {
      try {
        seedHex = toHexColor(rawTheme.startsWith("#") ? rawTheme : `#${rawTheme}`);
      } catch {
        seedHex = "";
      }
    }
    if (!seedHex) {
      const pool: ColorSwatch[] = [];
      for (const sec of next) {
        if (sec.section_type === "color_primary" || sec.section_type === "color_secondary") {
          pool.push(...(((sec.data as { swatches?: ColorSwatch[] })?.swatches) || []));
        }
      }
      const vivid = [...pool].sort((a, b) => chromaSat(b.hex) - chromaSat(a.hex))[0];
      if (vivid?.hex) seedHex = toHexColor(vivid.hex);
    }
    if (seedHex) {
      const rgb = hexToRgb(seedHex);
      const name = "Accent";
      changed = true;
      next = next.map((sec) => {
        if (sec.section_type !== "color_accent") return sec;
        return {
          ...sec,
          data: {
            ...(sec.data || {}),
            hex: seedHex,
            name,
            rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
            cmyk: hexToCmykToken(seedHex),
            proportion: DEFAULT_PROPORTIONS.color_accent,
            tokenKey: "accent-primary",
            swatches: [
              {
                id: generateUUID(),
                name,
                hex: seedHex,
                isCanonical: true,
                proportion: DEFAULT_PROPORTIONS.color_accent,
              },
            ],
            scale: [],
          },
        };
      });
    }
  }

  return { sections: next, changed };
}

function chromaSat(hex: string): number {
  try {
    const { r, g, b } = hexToRgb(toHexColor(hex));
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    return max - min;
  } catch {
    return 0;
  }
}

/** Move accent swatches that share a primary hue into the primary bucket. */
export function mergeSameHueAccentsIntoPrimary(sections: Partial<CISection>[]): {
  sections: Partial<CISection>[];
  changed: boolean;
} {
  const primary = sections.find((s) => s.section_type === "color_primary");
  const accent = sections.find((s) => s.section_type === "color_accent");
  if (!primary || !accent) return { sections, changed: false };

  const primarySwatches = [...(((primary.data?.swatches || []) as ColorSwatch[]))];
  const accentSwatches = [...(((accent.data?.swatches || []) as ColorSwatch[]))];
  if (!primarySwatches.length || !accentSwatches.length) {
    return { sections, changed: false };
  }

  const keep: ColorSwatch[] = [];
  const move: ColorSwatch[] = [];
  for (const s of accentSwatches) {
    if (primarySwatches.some((p) => sameHueFamily(p.hex, s.hex))) move.push(s);
    else keep.push(s);
  }
  if (!move.length) return { sections, changed: false };

  const mergedPrimary = dedupeSwatchesByHex([...primarySwatches, ...move]);
  return {
    changed: true,
    sections: sections.map((sec) => {
      if (sec.section_type === "color_primary") {
        return { ...sec, data: { ...(sec.data || {}), swatches: mergedPrimary } };
      }
      if (sec.section_type === "color_accent") {
        return { ...sec, data: { ...(sec.data || {}), swatches: keep } };
      }
      return sec;
    }),
  };
}
