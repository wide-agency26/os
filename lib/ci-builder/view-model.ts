/**
 * Single derivation layer for CI client templates.
 * All three templates (greenpoint / foundry / multipage) read from this — never
 * re-derive with template-local silent fallbacks.
 */

import type {
  CIAsset,
  CISection,
  CITheme,
  CiClientTemplate,
  CiLogoMark,
  CiTypeScaleRole,
  ColorSwatch,
} from "@/lib/ci-builder/types";
import { CI_SCHEMA_VERSION } from "@/lib/ci-builder/types";
import {
  CI_MODULES,
  getSubModule,
  sortSectionsByCatalog,
  type CiModuleId,
} from "@/lib/ci-builder/modules-catalog";
import { hexToRgb, hexToCmykToken, toHexColor, isCompleteHex } from "@/lib/ci-builder/color-utils";
import { sectionHasClientValue } from "@/lib/ci-builder/section-value";
import { isFormatColorSection } from "@/lib/ci-builder/color-cleanup";
import { polishClientFacingSections } from "@/lib/ci-builder/polish-client-content";

export type DerivedSwatch = ColorSwatch & {
  rgbComputed: string;
  cmykComputed: string;
};

export type TypeRoleResolved = {
  role: CiTypeScaleRole;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  fontSize?: string;
  lineHeight?: string;
  letterSpacing?: string;
  token?: string;
  /** True when resolved from an explicit role tag (not a silent first-row fallback). */
  explicit: boolean;
};

export type PrimaryTypefaceResult =
  | { status: "set"; row: TypeRoleResolved }
  | { status: "not_set" };

export type GuidelineViewModel = {
  brandName: string;
  theme: CITheme;
  template: CiClientTemplate;
  schemaVersion: number;
  sections: Partial<CISection>[];
  assets: Partial<CIAsset>[];
  modules: Array<{
    id: CiModuleId;
    label: string;
    index: number;
    hidden: boolean;
    sections: Partial<CISection>[];
  }>;
  mainLogo: CiLogoMark | null;
  logoMarks: CiLogoMark[];
  typeRoles: Partial<Record<CiTypeScaleRole, TypeRoleResolved>>;
  primaryTypeface: PrimaryTypefaceResult;
  typeCssVars: Record<string, string>;
  proportionBars: Array<{ id: string; name: string; hex: string; proportion: number }>;
  brandColorVars: Record<string, string>;
  teamName: string;
  pointOfContact: string;
  contactEmail: string;
};

const TYPE_ROLES: CiTypeScaleRole[] = [
  "heading-primary",
  "heading-secondary",
  "heading-tertiary",
  "copy-body",
  "copy-caption",
  "surface-neutral",
];

const ROLE_ALIASES: Record<string, CiTypeScaleRole> = {
  "heading-primary": "heading-primary",
  "headline-primary": "heading-primary",
  "headline primary": "heading-primary",
  "heading-secondary": "heading-secondary",
  "headline-secondary": "heading-secondary",
  "heading-tertiary": "heading-tertiary",
  "headline-tertiary": "heading-tertiary",
  "copy-body": "copy-body",
  body: "copy-body",
  "copy-caption": "copy-caption",
  caption: "copy-caption",
  "surface-neutral": "surface-neutral",
};

export function resolveClientTemplate(theme?: CITheme | null): CiClientTemplate {
  const t = theme?.clientTemplate;
  if (t === "foundry" || t === "multipage" || t === "greenpoint") return t;
  return "greenpoint";
}

export function enrichSwatch(swatch: ColorSwatch): DerivedSwatch {
  const hex = isCompleteHex(swatch.hex) ? toHexColor(swatch.hex) : swatch.hex || "#000000";
  const rgb = hexToRgb(hex);
  const cmykToken = hexToCmykToken(hex);
  return {
    ...swatch,
    hex,
    rgb: swatch.rgb || `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    cmyk: swatch.cmyk || cmykToken,
    rgbComputed: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    cmykComputed: cmykToken,
  };
}

function collectLogoMarks(sections: Partial<CISection>[]): CiLogoMark[] {
  const unified = sections.find((s) => s.section_type === "logo_marks");
  if (unified) {
    const marks = ((unified.data as { marks?: CiLogoMark[] })?.marks || []).slice();
    return marks.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }
  // Legacy 7-slot fallback (pre schemaVersion 2)
  const LEGACY: Array<{ type: string; name: string }> = [
    { type: "primary_logo", name: "Primary" },
    { type: "secondary_logo", name: "Secondary" },
    { type: "wordmark", name: "Wordmark" },
    { type: "image_mark", name: "Image Mark" },
    { type: "favicon", name: "Favicon" },
    { type: "misc_logo", name: "Misc" },
    { type: "tertiary_logo", name: "Tertiary" },
  ];
  const out: CiLogoMark[] = [];
  for (const row of LEGACY) {
    const sec = sections.find((s) => s.section_type === row.type);
    if (!sec) continue;
    const data = (sec.data || {}) as {
      assetId?: string;
      variants?: { assetId?: string; stageColor?: string; label?: string }[];
      stage?: string;
    };
    const light =
      data.variants?.find((v) => /light|#fff|#ffffff/i.test(String(v.stageColor || v.label || "")))
        ?.assetId ||
      (data.stage !== "dark" ? data.assetId : "") ||
      data.assetId ||
      "";
    const dark =
      data.variants?.find((v) => /dark|#000|#111/i.test(String(v.stageColor || v.label || "")))
        ?.assetId ||
      (data.stage === "dark" ? data.assetId : "") ||
      "";
    out.push({
      id: sec.id || row.type,
      name: row.name,
      isMain: row.type === "primary_logo",
      lightAssetId: light || undefined,
      darkAssetId: dark || undefined,
    });
  }
  return out;
}

function resolveMainLogo(marks: CiLogoMark[]): CiLogoMark | null {
  if (!marks.length) return null;
  return marks.find((m) => m.isMain) || marks[0] || null;
}

type ScaleRow = {
  id?: string;
  token?: string;
  role?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  value?: string;
  px?: number;
  lineHeight?: string;
  letterSpacing?: string;
};

function collectTypeRoles(sections: Partial<CISection>[]): {
  roles: Partial<Record<CiTypeScaleRole, TypeRoleResolved>>;
  primary: PrimaryTypefaceResult;
} {
  const scaleSec =
    sections.find((s) => s.section_type === "typography_scale") ||
    sections.find((s) => getSubModule(s.section_type || "")?.renderer === "type_scale");
  const rows = ((scaleSec?.data as { scale?: ScaleRow[] })?.scale || []) as ScaleRow[];
  const roles: Partial<Record<CiTypeScaleRole, TypeRoleResolved>> = {};

  for (const row of rows) {
    const roleRaw = String(row.role || row.token || "").trim();
    const role = (TYPE_ROLES.includes(roleRaw as CiTypeScaleRole)
      ? roleRaw
      : ROLE_ALIASES[roleRaw.toLowerCase()] || "") as CiTypeScaleRole;
    if (!TYPE_ROLES.includes(role)) continue;
    if (roles[role]) continue;
    roles[role] = {
      role,
      fontFamily: row.fontFamily || "inherit",
      fontWeight: String(row.fontWeight || "400"),
      fontStyle: row.fontStyle || "normal",
      fontSize: row.value || (row.px ? `${row.px}px` : undefined),
      lineHeight: row.lineHeight,
      letterSpacing: row.letterSpacing,
      token: row.token,
      explicit: true,
    };
  }

  // Primary Typeface: ONLY from heading-primary — never silent first-row fallback
  const primary: PrimaryTypefaceResult = roles["heading-primary"]
    ? { status: "set", row: roles["heading-primary"] }
    : { status: "not_set" };

  return { roles, primary };
}

function typeCssVarsFromRoles(
  roles: Partial<Record<CiTypeScaleRole, TypeRoleResolved>>
): Record<string, string> {
  const vars: Record<string, string> = {};
  const map: Record<string, CiTypeScaleRole> = {
    "heading-primary": "heading-primary",
    "heading-secondary": "heading-secondary",
    "heading-tertiary": "heading-tertiary",
    "copy-body": "copy-body",
    "copy-caption": "copy-caption",
  };
  for (const [cssKey, role] of Object.entries(map)) {
    const r = roles[role];
    if (!r) continue;
    vars[`--tf-${cssKey}`] = r.fontFamily;
    vars[`--tw-${cssKey}`] = r.fontWeight;
    vars[`--ts-${cssKey}`] = r.fontStyle;
    if (r.fontSize) vars[`--tsz-${cssKey}`] = r.fontSize;
  }
  return vars;
}

function collectBrandColorVars(
  sections: Partial<CISection>[],
  theme?: CITheme | null
): Record<string, string> {
  const vars: Record<string, string> = {};
  let surface = "";
  let accent = "";
  for (const sec of sections) {
    const def = getSubModule(sec.section_type || "");
    if (!def || (def.renderer !== "color_group" && def.renderer !== "color_format")) continue;
    const data = (sec.data || {}) as {
      tokenKey?: string;
      role?: string;
      hex?: string;
      swatches?: ColorSwatch[];
    };
    const hexRaw =
      data.hex ||
      data.swatches?.find((s) => s.isCanonical)?.hex ||
      data.swatches?.[0]?.hex;
    if (!hexRaw) continue;
    const hex = toHexColor(hexRaw);
    const token = String(data.tokenKey || data.role || "").trim();
    if (token === "surface-neutral") surface = hex;
    if (token === "accent-primary" || sec.section_type === "color_accent") {
      if (!accent) accent = hex;
    }
    if (sec.section_type === "color_primary" && !accent) accent = hex;
    if (token) vars[`--brand-token-${token}`] = hex;
  }
  if (!accent) {
    const themeAccent = Array.isArray(theme?.accentColors) ? theme.accentColors[0] : "";
    if (themeAccent) {
      try {
        accent = toHexColor(String(themeAccent));
      } catch {
        /* ignore */
      }
    }
  }
  if (surface) {
    vars["--brand-neutral"] = surface;
    vars["--brand-bg-canvas"] = surface;
  }
  if (accent) vars["--brand-accent-primary"] = accent;
  return vars;
}

function collectProportionBars(sections: Partial<CISection>[]) {
  const bars: Array<{ id: string; name: string; hex: string; proportion: number }> = [];
  for (const sec of sections) {
    const def = getSubModule(sec.section_type || "");
    if (!def || (def.renderer !== "color_group" && def.renderer !== "color_format")) continue;
    const data = (sec.data || {}) as {
      name?: string;
      hex?: string;
      proportion?: number;
      swatches?: ColorSwatch[];
    };
    const familyHex = data.hex || data.swatches?.find((s) => s.hex)?.hex;
    const familyProp = Number(data.proportion) || 0;
    if (familyHex && familyProp > 0) {
      bars.push({
        id: sec.id || String(bars.length),
        name: String(data.name || sec.headline || "Color"),
        hex: toHexColor(familyHex),
        proportion: Math.min(100, Math.max(0, familyProp)),
      });
      continue;
    }
    const swatches = (data.swatches || []) as ColorSwatch[];
    for (const s of swatches) {
      if (typeof s.proportion === "number" && s.proportion > 0) {
        bars.push({
          id: s.id,
          name: s.name,
          hex: toHexColor(s.hex || "#000000"),
          proportion: Math.min(100, Math.max(0, s.proportion)),
        });
      }
    }
  }
  return bars;
}

export function buildGuidelineViewModel(input: {
  brandName: string;
  theme: CITheme | null | undefined;
  sections: Partial<CISection>[];
  assets: Partial<CIAsset>[];
  /**
   * `full` — canvas admin View: show every visible section (mirrors Edit content).
   * `client` (default) — public / published: hide empty shells via sectionHasClientValue.
   */
  visibility?: "client" | "full";
}): GuidelineViewModel {
  const theme = input.theme || {};
  const template = resolveClientTemplate(theme);
  const hidden = new Set(theme.hiddenModules || []);
  const visibility = input.visibility || "client";

  const polished = polishClientFacingSections(input.sections, { theme }).sections;
  const PARITY_ALWAYS = new Set(["clear_space", "ui_empty_error"]);
  const visible = sortSectionsByCatalog(
    polished.filter((s) => {
      if (s.is_visible === false) return false;
      if (isFormatColorSection(s.section_type)) return false;
      if (visibility === "full") return true;
      if (PARITY_ALWAYS.has(String(s.section_type || ""))) return true;
      return sectionHasClientValue(s, input.assets);
    })
  );

  const modules = CI_MODULES.map((mod) => {
    const secs = visible.filter((s) => getSubModule(s.section_type || "")?.moduleId === mod.id);
    return {
      id: mod.id,
      label: mod.label,
      index: mod.index,
      hidden: hidden.has(mod.id),
      sections: secs,
    };
  });

  // Include clear_space + ui_empty_error even when empty-ish but present for template parity
  // (sectionHasClientValue already filters empty — keep sections that exist as rows)
  const allSections = sortSectionsByCatalog(polished.filter((s) => s.is_visible !== false));

  const logoMarks = collectLogoMarks(allSections);
  const { roles, primary } = collectTypeRoles(allSections);

  return {
    brandName: input.brandName,
    theme,
    template,
    schemaVersion: theme.schemaVersion ?? 1,
    sections: visible,
    assets: input.assets,
    modules,
    mainLogo: resolveMainLogo(logoMarks),
    logoMarks,
    typeRoles: roles,
    primaryTypeface: primary,
    typeCssVars: typeCssVarsFromRoles(roles),
    proportionBars: collectProportionBars(allSections),
    brandColorVars: collectBrandColorVars(allSections, theme),
    teamName: theme.teamName || "",
    pointOfContact: theme.pointOfContact || "",
    contactEmail: theme.contactEmail || "",
  };
}

export function resolvePrimaryTypeface(vm: GuidelineViewModel): PrimaryTypefaceResult {
  return vm.primaryTypeface;
}

export function isSchemaV2(theme?: CITheme | null): boolean {
  return (theme?.schemaVersion ?? 0) >= CI_SCHEMA_VERSION;
}
