import type { CISection, ColorSwatch } from "@/lib/ci-builder/types";

/** Format-only catalog rows — HEX/RGB/CMYK/scale live on the color card, not as modules. */
export const FORMAT_COLOR_SECTION_TYPES = new Set([
  "hex",
  "rgb",
  "cmyk",
  "color_scale",
]);

export const COLOR_ROLE_SECTION_TYPES = [
  "color_primary",
  "color_secondary",
  "color_accent",
  "functional",
] as const;

export type ColorRoleSectionType = (typeof COLOR_ROLE_SECTION_TYPES)[number];

export const COLOR_ROLE_TYPES = new Set<string>(COLOR_ROLE_SECTION_TYPES);

export function isFormatColorSection(type?: string | null): boolean {
  return Boolean(type && FORMAT_COLOR_SECTION_TYPES.has(type));
}

export function isColorRoleSection(type?: string | null): boolean {
  return Boolean(type && COLOR_ROLE_TYPES.has(type));
}

export function colorRoleLabel(type: string): string {
  switch (type) {
    case "color_primary":
      return "Primary";
    case "color_secondary":
      return "Secondary";
    case "color_accent":
      return "Accent";
    case "functional":
      return "Functional";
    default:
      return type;
  }
}

const ROLE_PATH_SEG =
  /(^|\/)\s*(primary|secondary|accent|functional(?:\s*\([^)]*\))?)\s*(?=\/|$)/gi;

/** Keep Figma-style names in sync when a swatch changes palette. */
export function rewriteColorBucketRole(
  swatch: ColorSwatch,
  toType: ColorRoleSectionType
): ColorSwatch {
  const label = colorRoleLabel(toType);
  const name = (swatch.name || "").replace(ROLE_PATH_SEG, `$1${label}`);
  return name === swatch.name ? swatch : { ...swatch, name };
}

export function applyColorBucketMove(
  sections: Partial<CISection>[],
  args: {
    fromSectionId: string;
    swatchIds: string[];
    toType: ColorRoleSectionType;
    createDest: () => Partial<CISection>;
  }
): {
  sections: Partial<CISection>[];
  fromId: string;
  fromData: Record<string, unknown>;
  destId: string;
  destData: Record<string, unknown>;
  createdDest: boolean;
  label: string;
} | null {
  const { fromSectionId, swatchIds, toType, createDest } = args;
  const idSet = new Set(swatchIds);
  const from = sections.find((s) => s.id === fromSectionId);
  if (!from?.id || !isColorRoleSection(from.section_type)) return null;
  if (from.section_type === toType) return null;

  const fromSwatches = [...(((from.data?.swatches || []) as ColorSwatch[]))];
  const moving = fromSwatches.filter((s) => idSet.has(s.id));
  if (!moving.length) return null;

  const remaining = fromSwatches.filter((s) => !idSet.has(s.id));
  const rewritten = moving.map((s) => rewriteColorBucketRole(s, toType));

  const existingDest = sections.find((s) => s.section_type === toType);
  const createdDest = !existingDest;
  const dest = existingDest || createDest();
  if (!dest.id) return null;

  const destSwatches = [
    ...(((dest.data?.swatches || []) as ColorSwatch[])),
    ...rewritten,
  ];
  const fromData = { ...(from.data || {}), swatches: remaining };
  const destData = { ...(dest.data || {}), swatches: destSwatches };

  const withDest = existingDest ? sections : [...sections, dest];
  const next = withDest.map((s) => {
    if (s.id === from.id) return { ...s, data: fromData };
    if (s.id === dest.id) return { ...s, data: destData };
    return s;
  });

  return {
    sections: next,
    fromId: from.id,
    fromData,
    destId: dest.id,
    destData,
    createdDest,
    label: colorRoleLabel(toType),
  };
}

function isHexLikeToken(value: string): boolean {
  const s = value.replace(/^#/, "").replace(/^--/, "").replace(/-/g, "");
  return /^[0-9a-f]{3,8}$/i.test(s);
}

function swatchScore(s: ColorSwatch): number {
  const name = (s.name || "").trim();
  const cssVar = (s.cssVar || "").trim();
  let n = 0;
  if (name && !isHexLikeToken(name)) n += 4;
  if (cssVar && !isHexLikeToken(cssVar)) n += 3;
  if (/brand|primary|accent|secondary|functional/i.test(name)) n += 2;
  if (s.isCanonical) n += 2;
  if (/(^|[^\d])500([^\d]|$)/.test(`${name} ${cssVar}`)) n += 1;
  return n;
}

export function dedupeSwatchesByHex(swatches: ColorSwatch[]): ColorSwatch[] {
  const best = new Map<string, ColorSwatch>();
  for (const s of swatches) {
    const hex = (s.hex || "").toLowerCase();
    if (!hex) continue;
    const prev = best.get(hex);
    if (!prev || swatchScore(s) > swatchScore(prev)) {
      best.set(hex, s);
    }
  }
  return [...best.values()];
}

export function needsColorCatalogCleanup(
  sections: Partial<CISection>[]
): boolean {
  const seenRoles = new Set<string>();
  for (const s of sections) {
    const t = s.section_type || "";
    if (isFormatColorSection(t)) return true;
    if (COLOR_ROLE_TYPES.has(t)) {
      if (seenRoles.has(t)) return true;
      seenRoles.add(t);
      const swatches = (s.data?.swatches || []) as ColorSwatch[];
      const hexes = swatches.map((x) => (x.hex || "").toLowerCase()).filter(Boolean);
      if (hexes.length !== new Set(hexes).size) return true;
    }
  }
  return false;
}

export function pruneColorCatalogNoise(sections: Partial<CISection>[]): {
  sections: Partial<CISection>[];
  deletedSectionIds: string[];
  changed: boolean;
} {
  const deletedSectionIds: string[] = [];
  const out: Partial<CISection>[] = [];
  const roles = new Map<string, Partial<CISection>>();
  let changed = false;

  for (const sec of sections) {
    const t = sec.section_type || "";
    if (isFormatColorSection(t)) {
      if (sec.id) deletedSectionIds.push(sec.id);
      changed = true;
      continue;
    }
    if (COLOR_ROLE_TYPES.has(t)) {
      const incoming = (sec.data?.swatches || []) as ColorSwatch[];
      const unique = dedupeSwatchesByHex(incoming);
      if (unique.length !== incoming.length) changed = true;
      const prev = roles.get(t);
      if (prev) {
        const merged = dedupeSwatchesByHex([
          ...((prev.data?.swatches || []) as ColorSwatch[]),
          ...unique,
        ]);
        prev.data = { ...(prev.data || {}), swatches: merged };
        if (sec.id) deletedSectionIds.push(sec.id);
        changed = true;
        continue;
      }
      const next = {
        ...sec,
        data: { ...(sec.data || {}), swatches: unique },
      };
      roles.set(t, next);
      out.push(next);
      continue;
    }
    out.push(sec);
  }

  return { sections: out, deletedSectionIds, changed };
}
