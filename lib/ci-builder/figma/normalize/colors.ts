import {
  type FigmaFileResponse,
  type FigmaVariablesResponse,
  figmaColorToHex,
  tokenNameToCssVar,
} from "@/lib/ci-builder/figma/client";
import { generateUUID } from "@/lib/ci-builder/types";
import type { CISection, ColorSwatch } from "@/lib/ci-builder/types";
import { ensureSection, walkNodes } from "./helpers";

type ColorBucket = "color_primary" | "color_secondary" | "color_accent" | "functional";

const COLOR_BUCKETS: ColorBucket[] = [
  "color_primary",
  "color_secondary",
  "color_accent",
  "functional",
];

function hexToRgbString(hex: string): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return "";
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

function bucketForColor(varName: string, collectionName: string): ColorBucket {
  const n = `${collectionName}/${varName}`.toLowerCase();
  if (/functional|error|success|warning|info|danger|destructive/.test(n)) {
    return "functional";
  }
  if (/secondary/.test(n)) return "color_secondary";
  if (/accent|theme/.test(n)) return "color_accent";
  if (/primary|brand|palette\s*breakdown|palette/.test(n)) return "color_primary";

  const coll = collectionName.toLowerCase();
  if (/theme/.test(coll)) return "color_accent";
  if (/palette|brand/.test(coll)) return "color_primary";
  return "color_primary";
}

function ensureColorSection(
  sections: Partial<CISection>[],
  type: ColorBucket,
  fileName?: string
) {
  const sec = ensureSection(sections, type, fileName);
  if (!sec.data.swatches) sec.data.swatches = [];
  return sec;
}

function pushSwatch(sec: Partial<CISection>, swatch: ColorSwatch) {
  if (!sec.data) sec.data = { swatches: [] };
  if (!sec.data.swatches) sec.data.swatches = [];
  const list: ColorSwatch[] = sec.data.swatches;
  if (
    list.some(
      (s) =>
        s.cssVar === swatch.cssVar ||
        (s.hex === swatch.hex && s.name === swatch.name)
    )
  ) {
    return false;
  }
  list.push(swatch);
  return true;
}

export function normalizeColors(opts: {
  file: FigmaFileResponse;
  variables: FigmaVariablesResponse | null;
  sections: Partial<CISection>[];
  themeSuggested: Record<string, any>;
}): { swatchCount: number; fromVariables: number; fromStyles: number } {
  const { file, variables, sections, themeSuggested } = opts;

  // Always seed empty Primary / Secondary / Accent / Functional blocks
  for (const bucket of COLOR_BUCKETS) {
    ensureColorSection(sections, bucket, file.name);
  }

  let fromVariables = 0;
  let fromStyles = 0;

  const meta = variables?.meta;
  if (meta?.variables && meta.variableCollections) {
    for (const coll of Object.values(meta.variableCollections)) {
      const modeId = coll.defaultModeId || coll.modes?.[0]?.modeId;
      if (!modeId) continue;

      // Prefer Palette Breakdown / Brand / Theme collections; still accept others
      const collName = coll.name || "";

      for (const varId of coll.variableIds || []) {
        const v = meta.variables[varId];
        if (!v || v.resolvedType !== "COLOR") continue;
        const raw = v.valuesByMode?.[modeId] as any;
        if (!raw || typeof raw !== "object" || raw.type === "VARIABLE_ALIAS") continue;
        if (typeof raw.r !== "number") continue;

        const hex = figmaColorToHex(raw);
        const rgb = hexToRgbString(hex);
        const swatch: ColorSwatch = {
          id: generateUUID(),
          name: v.name.split("/").pop() || v.name,
          hex,
          cssVar: tokenNameToCssVar(v.name),
          rgb,
        };

        const bucket = bucketForColor(v.name, collName);
        const sec = ensureColorSection(sections, bucket, file.name);
        if (pushSwatch(sec, swatch)) fromVariables++;

        const lower = v.name.toLowerCase();
        if (lower.includes("background") || lower.includes("bg") || lower.endsWith("/surface")) {
          if (!themeSuggested.backgroundColor) themeSuggested.backgroundColor = hex;
        } else if (lower.includes("text") || lower.includes("foreground")) {
          if (!themeSuggested.textColor) themeSuggested.textColor = hex;
        } else {
          if (!themeSuggested.accentColors) themeSuggested.accentColors = [];
          if (
            themeSuggested.accentColors.length < 4 &&
            !themeSuggested.accentColors.includes(hex)
          ) {
            themeSuggested.accentColors.push(hex);
          }
        }
      }
    }
  }

  // Paint styles → Primary (or bucket by name)
  const styleColorMap = new Map<string, string>();
  walkNodes(file.document, (n) => {
    const styleId = n.styles?.fill;
    if (!styleId || styleColorMap.has(styleId)) return;
    const fill = (n.fills || []).find(
      (f: any) => f?.type === "SOLID" && f.visible !== false && f.color
    );
    if (fill?.color) styleColorMap.set(styleId, figmaColorToHex(fill.color));
  });

  const fillStyles = Object.entries(file.styles || {}).filter(
    ([, s]) => s.styleType === "FILL" || s.styleType === "PAINT"
  );

  for (const [styleId, style] of fillStyles) {
    const hex = styleColorMap.get(styleId);
    if (!hex) continue;
    const name = style.name.split("/").pop() || style.name;
    const bucket = bucketForColor(style.name, "Paint styles");
    const sec = ensureColorSection(sections, bucket, file.name);
    if (
      pushSwatch(sec, {
        id: generateUUID(),
        name,
        hex,
        cssVar: tokenNameToCssVar(style.name),
        rgb: hexToRgbString(hex),
      })
    ) {
      fromStyles++;
    }
    if (!themeSuggested.accentColors) themeSuggested.accentColors = [];
    if (
      themeSuggested.accentColors.length < 4 &&
      !themeSuggested.accentColors.includes(hex)
    ) {
      themeSuggested.accentColors.push(hex);
    }
  }

  // Named color frames fallback when nothing else found
  if (fromVariables === 0 && fromStyles === 0) {
    const sec = ensureColorSection(sections, "color_primary", file.name);
    const seen = new Set<string>();
    walkNodes(file.document, (n) => {
      if (!/color|swatch|palette|farbe/i.test(n.name || "")) return;
      const fill = (n.fills || []).find(
        (f: any) => f?.type === "SOLID" && f.visible !== false && f.color
      );
      if (!fill?.color) return;
      const hex = figmaColorToHex(fill.color);
      const key = `${n.name}:${hex}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (
        pushSwatch(sec, {
          id: generateUUID(),
          name: n.name,
          hex,
          cssVar: tokenNameToCssVar(n.name),
          rgb: hexToRgbString(hex),
        })
      ) {
        fromStyles++;
      }
    });
  }

  // Also mirror into legacy combined "colors" section for old renderers
  const legacy = ensureSection(sections, "colors", file.name);
  if (!legacy.data.groups) legacy.data.groups = [];
  for (const bucket of COLOR_BUCKETS) {
    const sec = sections.find((s) => s.section_type === bucket);
    const swatches: ColorSwatch[] = sec?.data?.swatches || [];
    if (!swatches.length) continue;
    const label =
      bucket === "color_primary"
        ? "Primary"
        : bucket === "color_secondary"
          ? "Secondary"
          : bucket === "color_accent"
            ? "Accent"
            : "Functional";
    let group = legacy.data.groups.find((g: any) => g.groupLabel === label);
    if (!group) {
      group = { id: generateUUID(), groupLabel: label, swatches: [] };
      legacy.data.groups.push(group);
    }
    for (const s of swatches) {
      if (!group.swatches.some((x: ColorSwatch) => x.hex === s.hex && x.name === s.name)) {
        group.swatches.push(s);
      }
    }
  }

  const swatchCount = COLOR_BUCKETS.reduce((sum, b) => {
    const sec = sections.find((s) => s.section_type === b);
    return sum + (sec?.data?.swatches?.length || 0);
  }, 0);

  return { swatchCount, fromVariables, fromStyles };
}
