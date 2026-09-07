import {
  type FigmaFileNode,
  type FigmaFileResponse,
  type FigmaVariable,
  type FigmaVariablesResponse,
  figmaColorToHex,
  readVariablesMeta,
  tokenNameToCssVar,
} from "@/lib/ci-builder/figma/client";
import { generateUUID } from "@/lib/ci-builder/types";
import type { CISection, ColorSwatch } from "@/lib/ci-builder/types";
import { dedupeSwatchesByHex } from "@/lib/ci-builder/color-cleanup";
import { rebalanceColorBuckets, promoteColorFamilyCards } from "@/lib/ci-builder/color-families";
import { hexToRgb, rgbToHsl } from "@/lib/ci-builder/color-utils";
import {
  lookupCanvasFrame,
  matchCanvasModule,
} from "@/lib/ci-builder/figma/canvas-map";
import {
  CI_THEME_PRESETS,
  MIN_THEME_CONTRAST,
  appearanceFromBackground,
  ensureReadableTheme,
  hexContrastRatio,
  readableInkForBackground,
} from "@/lib/ci-builder/theme-css";
import { ensureSection, walkNodes } from "./helpers";

export const COLOR_SECTION_TYPES = [
  "color_primary",
  "color_secondary",
  "color_accent",
  "functional",
  "hex",
  "rgb",
  "cmyk",
  "color_scale",
  "colors",
] as const;

export type ColorSectionType = (typeof COLOR_SECTION_TYPES)[number];

export type ColorVariablesDump = {
  source?: string;
  version?: number;
  fileName?: string;
  collections: Array<{
    name: string;
    variables: Array<{ name: string; hex: string }>;
  }>;
};

type ColorBucket = "color_primary" | "color_secondary" | "color_accent" | "functional";

const COLOR_BUCKETS: ColorBucket[] = [
  "color_primary",
  "color_secondary",
  "color_accent",
  "functional",
];

type ParsedColor = {
  name: string;
  family: string;
  step: string;
  stepNum: number;
  hex: string;
  rgb: string;
  cmyk: string;
  cssVar: string;
  bucket: ColorBucket;
  isCanonical: boolean;
};

function chroma(hex: string): number {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return 0;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function luma(hex: string): number {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return 0.5;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hueOf(hex: string): number | null {
  try {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHsl(r, g, b).h;
  } catch {
    return null;
  }
}

function hueDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** Lime + dark green (~74°) stay one family; true complementary hues do not. */
function sameHueFamily(a: string, b: string, deg = 80): boolean {
  const ha = hueOf(a);
  const hb = hueOf(b);
  if (ha == null || hb == null) return false;
  return hueDelta(ha, hb) < deg;
}

function regroupSameHueAccents(
  byBucket: Record<ColorBucket, ColorSwatch[]>,
  parsed: ParsedColor[]
) {
  const primaries = byBucket.color_primary || [];
  if (!primaries.length) return;
  const keep: ColorSwatch[] = [];
  const move: ColorSwatch[] = [];
  for (const s of byBucket.color_accent || []) {
    if (primaries.some((p) => sameHueFamily(p.hex, s.hex))) move.push(s);
    else keep.push(s);
  }
  byBucket.color_accent = keep;
  byBucket.color_primary = [...primaries, ...move];
  for (const p of parsed) {
    if (
      p.bucket === "color_accent" &&
      primaries.some((s) => sameHueFamily(s.hex, p.hex))
    ) {
      p.bucket = "color_primary";
    }
  }
}

function pickChromeHex(parsed: ParsedColor[]): string | null {
  const primaries = parsed.filter((p) => p.bucket === "color_primary");
  const accents = parsed.filter((p) => p.bucket === "color_accent");
  const vividP = [...primaries].sort((a, b) => chroma(b.hex) - chroma(a.hex))[0];
  const vividA = [...accents].sort((a, b) => chroma(b.hex) - chroma(a.hex))[0];
  if (vividA && vividP && !sameHueFamily(vividA.hex, vividP.hex)) return vividA.hex;
  return vividP?.hex || vividA?.hex || null;
}

function bestContrastingPair(parsed: ParsedColor[]): { bg: string; text: string; ratio: number } | null {
  let best: { bg: string; text: string; ratio: number } | null = null;
  const limit = Math.min(parsed.length, 48);
  for (let i = 0; i < limit; i++) {
    for (let j = i + 1; j < limit; j++) {
      const a = parsed[i].hex;
      const b = parsed[j].hex;
      const ratio = hexContrastRatio(a, b);
      if (!best || ratio > best.ratio) {
        const aLight = luma(a) >= luma(b);
        best = {
          bg: aLight ? a : b,
          text: aLight ? b : a,
          ratio,
        };
      }
    }
  }
  return best;
}

/**
 * Page chrome from the palette — only when bg/text stay readable.
 * Brand swatches still import; unreadable pairs fall back to Light/Dark presets.
 */
function applyPageTheme(parsed: ParsedColor[], themeSuggested: Record<string, any>) {
  if (!parsed.length) return;
  const ranked = [...parsed].sort((a, b) => luma(a.hex) - luma(b.hex));
  const darkest = ranked[0];
  const lightest = ranked[ranked.length - 1];

  const namedBg = parsed.find((p) =>
    /(^|[/\s_-])(bg|background|surface|canvas)([/\s_-]|$)/i.test(`${p.family} ${p.name}`)
  );
  const namedInk = parsed.find((p) =>
    /(^|[/\s_-])(text|ink|foreground|fg|onyx|midnight)([/\s_-]|$)/i.test(
      `${p.family} ${p.name}`
    )
  );

  const pale =
    namedBg ||
    parsed.find((p) => p.bucket === "color_secondary" && luma(p.hex) > 0.78) ||
    (lightest && luma(lightest.hex) > 0.72 ? lightest : null);
  const ink =
    namedInk ||
    parsed.find((p) => /onyx|midnight|black|ink/i.test(p.family) && luma(p.hex) < 0.35) ||
    (darkest && luma(darkest.hex) < 0.28 ? darkest : null);

  let bg = String(themeSuggested.backgroundColor || pale?.hex || "").trim();
  let text = String(themeSuggested.textColor || ink?.hex || "").trim();
  if (!bg) bg = CI_THEME_PRESETS.light.backgroundColor;
  if (!text) text = readableInkForBackground(bg);

  if (hexContrastRatio(bg, text) < MIN_THEME_CONTRAST) {
    const pair = bestContrastingPair(parsed);
    if (pair && pair.ratio >= MIN_THEME_CONTRAST) {
      bg = pair.bg;
      text = pair.text;
    } else {
      const appearance = appearanceFromBackground(bg || lightest?.hex);
      bg = CI_THEME_PRESETS[appearance].backgroundColor;
      text = CI_THEME_PRESETS[appearance].textColor;
    }
  }

  const readable = ensureReadableTheme({
    ...themeSuggested,
    backgroundColor: bg,
    textColor: text,
  });
  themeSuggested.backgroundColor = readable.backgroundColor;
  themeSuggested.textColor = readable.textColor;
  themeSuggested.appearance = readable.appearance;

  const chrome = pickChromeHex(parsed);
  if (chrome) themeSuggested.accentColors = [chrome];
}

function hexToRgbString(hex: string): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return "";
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

function hexToCmyk(hex: string): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return "";
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 0.999) return "C0 M0 Y0 K100";
  const c = Math.round(((1 - r - k) / (1 - k)) * 100);
  const y = Math.round(((1 - b - k) / (1 - k)) * 100);
  const mag = Math.round(((1 - g - k) / (1 - k)) * 100);
  return `C${c} M${mag} Y${y} K${Math.round(k * 100)}`;
}

function pickModeId(coll: {
  defaultModeId?: string;
  modes?: { modeId: string; name: string }[];
}): string | undefined {
  const solid = coll.modes?.find((m) =>
    /solid|default|light|mode 1/i.test(m.name)
  );
  return solid?.modeId || coll.defaultModeId || coll.modes?.[0]?.modeId;
}

function asRgba(raw: unknown): { r: number; g: number; b: number; a?: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.r === "number" && typeof obj.g === "number" && typeof obj.b === "number") {
    return { r: obj.r, g: obj.g, b: obj.b, a: typeof obj.a === "number" ? obj.a : 1 };
  }
  if (obj.color && typeof obj.color === "object") return asRgba(obj.color);
  return null;
}

function resolveColorValue(
  raw: unknown,
  variables: Record<string, FigmaVariable>,
  modeId: string,
  depth = 0
): { r: number; g: number; b: number; a?: number } | null {
  if (depth > 8 || raw == null) return null;
  if (typeof raw !== "object") return null;
  const obj = raw as { type?: string; id?: string };
  if (obj.type === "VARIABLE_ALIAS" && obj.id) {
    const target =
      variables[obj.id] ||
      Object.values(variables).find((v) => v.id === obj.id);
    if (!target) return null;
    const next =
      target.valuesByMode?.[modeId] ??
      Object.values(target.valuesByMode || {})[0];
    return resolveColorValue(next, variables, modeId, depth + 1);
  }
  return asRgba(raw);
}

function parseStep(leaf: string): { step: string; stepNum: number; isCanonical: boolean } {
  const main = /main\s*-?\s*(\d+)/i.exec(leaf);
  if (main) {
    const n = Number(main[1]);
    return { step: String(n), stepNum: n, isCanonical: true };
  }
  const num = /(\d{2,4})\s*$/.exec(leaf.replace(/main/i, "").trim());
  if (num) {
    const n = Number(num[1]);
    return { step: String(n), stepNum: n, isCanonical: n === 500 };
  }
  return { step: leaf, stepNum: 500, isCanonical: true };
}

function familyAndStep(varName: string): { family: string; leaf: string } {
  const parts = varName.split("/").map((p) => p.trim()).filter(Boolean);
  const leaf = parts[parts.length - 1] || varName;
  const family =
    parts.length >= 2 ? parts[parts.length - 2] : parts[0] || varName;
  return { family, leaf };
}

function displayVarName(varName: string): string {
  const { family, leaf } = familyAndStep(varName);
  const { step, stepNum, isCanonical } = parseStep(leaf);
  const fam = family
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  if (isCanonical || stepNum === 500) return fam || leaf;
  if (/^\d{2,4}$/.test(step)) return `${fam} ${step}`.trim();
  return fam ? `${fam} ${leaf}` : leaf;
}

function normalizeHex(hex: string): string | null {
  const raw = (hex || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return null;
}

export function parseColorVariablesDump(input: unknown): ColorVariablesDump | null {
  let obj: unknown = input;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const collections = (obj as { collections?: unknown }).collections;
  if (!Array.isArray(collections) || collections.length === 0) return null;

  const parsed: ColorVariablesDump["collections"] = [];
  for (const coll of collections) {
    if (!coll || typeof coll !== "object") continue;
    const name = String((coll as { name?: unknown }).name || "Brand Colors");
    const vars = (coll as { variables?: unknown }).variables;
    if (!Array.isArray(vars)) continue;
    const variables: Array<{ name: string; hex: string }> = [];
    for (const item of vars) {
      if (!item || typeof item !== "object") continue;
      const hex = normalizeHex(String((item as { hex?: unknown }).hex || ""));
      if (!hex) continue;
      const varName = String((item as { name?: unknown }).name || "").trim() || hex.toUpperCase();
      variables.push({ name: varName, hex });
    }
    if (variables.length) parsed.push({ name, variables });
  }
  if (!parsed.length) return null;
  return {
    source: String((obj as { source?: unknown }).source || "wide-os-figma-colors"),
    version: Number((obj as { version?: unknown }).version) || 1,
    fileName: String((obj as { fileName?: unknown }).fileName || ""),
    collections: parsed,
  };
}

function bucketForColor(varName: string, collectionName: string): ColorBucket {
  const n = `${collectionName}/${varName}`.toLowerCase();
  if (/functional|error|success|warning|info|danger|destructive/.test(n)) {
    return "functional";
  }
  if (/\/accent\/|brand colors\/accent|(^|\/)accent(\/|$)/.test(n)) {
    return "color_accent";
  }
  if (/\/secondary\//.test(n)) return "color_secondary";
  if (/\/primary\//.test(n)) return "color_primary";
  if (/\/main\//.test(n)) {
    if (/onyx|neutral|surface|gray|grey|white/.test(n) && !/alpine|cloud/.test(n)) {
      return "color_secondary";
    }
    return "color_primary";
  }
  if (/secondary/.test(n)) return "color_secondary";
  if (/accent|theme/.test(n)) return "color_accent";
  if (/primary|palette\s*breakdown|palette/.test(n)) return "color_primary";
  return "color_primary";
}

function pushParsedColor(
  parsed: ParsedColor[],
  themeSuggested: Record<string, any>,
  opts: {
    varName: string;
    hex: string;
    collectionName: string;
  }
) {
  const { family, leaf } = familyAndStep(opts.varName);
  const { step, stepNum, isCanonical } = parseStep(leaf);
  parsed.push({
    name: displayVarName(opts.varName),
    family,
    step,
    stepNum,
    hex: opts.hex,
    rgb: hexToRgbString(opts.hex),
    cmyk: hexToCmyk(opts.hex),
    cssVar: tokenNameToCssVar(opts.varName),
    bucket: bucketForColor(opts.varName, opts.collectionName),
    isCanonical: isCanonical || stepNum === 500,
  });

  const lower = opts.varName.toLowerCase();
  if (/(^|[/\s_-])(bg|background|surface|canvas)([/\s_-]|$)/.test(lower)) {
    if (!themeSuggested.backgroundColor) themeSuggested.backgroundColor = opts.hex;
  } else if (/(^|[/\s_-])(text|ink|foreground|fg)([/\s_-]|$)/.test(lower)) {
    if (!themeSuggested.textColor) themeSuggested.textColor = opts.hex;
  }
}

function collectFromVariablesMeta(
  meta: {
    variables: Record<string, FigmaVariable>;
    variableCollections: Record<string, {
      id?: string;
      name?: string;
      defaultModeId?: string;
      modes?: { modeId: string; name: string }[];
      variableIds?: string[];
    }>;
  },
  parsed: ParsedColor[],
  themeSuggested: Record<string, any>
): number {
  const collections = meta.variableCollections || {};
  const variables = meta.variables || {};
  const seen = new Set<string>();
  let count = 0;

  const process = (
    v: FigmaVariable | undefined,
    collName: string,
    modeId: string
  ) => {
    if (!v || v.resolvedType !== "COLOR" || seen.has(v.id)) return;
    seen.add(v.id);
    const raw = v.valuesByMode?.[modeId] ?? Object.values(v.valuesByMode || {})[0];
    const rgba = resolveColorValue(raw, variables, modeId);
    if (!rgba) return;
    if (typeof rgba.a === "number" && rgba.a < 0.08) return;
    const hex = figmaColorToHex(rgba);
    pushParsedColor(parsed, themeSuggested, {
      varName: v.name,
      hex,
      collectionName: collName,
    });
    count++;
  };

  for (const coll of Object.values(collections)) {
    const modeId = pickModeId(coll);
    if (!modeId) continue;
    const collName = coll.name || "";
    for (const varId of coll.variableIds || []) {
      const v =
        variables[varId] ||
        Object.values(variables).find((item) => item.id === varId);
      process(v, collName, modeId);
    }
  }

  for (const v of Object.values(variables)) {
    if (v.resolvedType !== "COLOR" || seen.has(v.id)) continue;
    const coll =
      collections[v.variableCollectionId] ||
      Object.values(collections).find((c) => c.id === v.variableCollectionId);
    const modeId =
      (coll ? pickModeId(coll) : undefined) ||
      Object.keys(v.valuesByMode || {})[0];
    if (!modeId) continue;
    process(v, coll?.name || "", modeId);
  }

  return count;
}

function collectFromDump(
  dump: ColorVariablesDump,
  parsed: ParsedColor[],
  themeSuggested: Record<string, any>
): number {
  let count = 0;
  for (const coll of dump.collections) {
    for (const item of coll.variables) {
      const hex = normalizeHex(item.hex);
      if (!hex) continue;
      pushParsedColor(parsed, themeSuggested, {
        varName: item.name,
        hex,
        collectionName: coll.name || "",
      });
      count++;
    }
  }
  return count;
}

function toSwatch(parsed: ParsedColor): ColorSwatch {
  return {
    id: generateUUID(),
    name: parsed.name,
    hex: parsed.hex,
    cssVar: parsed.cssVar,
    rgb: parsed.rgb,
    cmyk: parsed.cmyk,
    isCanonical: parsed.isCanonical || parsed.stepNum === 500,
  };
}

function swatchFromParts(name: string, hex: string): ColorSwatch {
  return {
    id: generateUUID(),
    name: name || hex.toUpperCase(),
    hex,
    cssVar: tokenNameToCssVar(name || hex),
    rgb: hexToRgbString(hex),
    cmyk: hexToCmyk(hex),
  };
}

function normalizeSwatchName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isPlaceholderSlot(swatch: ColorSwatch): boolean {
  const name = normalizeSwatchName(swatch.name);
  const generic =
    !name ||
    name === "color" ||
    name === "untitled color" ||
    name === "swatch";
  const hex = (swatch.hex || "").trim().toLowerCase();
  const emptyHex =
    !hex ||
    hex === "#" ||
    hex === "#000000" ||
    hex === "#000" ||
    hex === "#0066ff";
  return generic && emptyHex;
}

/** Write imported hex/rgb/cmyk onto the swatch cards already on the section. */
function fillSwatchSlots(
  existing: ColorSwatch[] | undefined,
  incoming: ColorSwatch[]
): ColorSwatch[] {
  if (!incoming.length) return existing || [];
  if (!existing?.length) return incoming;

  const used = new Set<number>();
  const findIncoming = (pred: (c: ColorSwatch) => boolean) =>
    incoming.findIndex((c, idx) => !used.has(idx) && pred(c));

  const out = existing.map((slot) => {
    const slotName = normalizeSwatchName(slot.name);
    let idx = -1;
    if (slotName && !isPlaceholderSlot(slot)) {
      idx = findIncoming((c) => normalizeSwatchName(c.name) === slotName);
      if (idx < 0) {
        idx = findIncoming((c) => {
          const n = normalizeSwatchName(c.name);
          return Boolean(n && slotName && (n.includes(slotName) || slotName.includes(n)));
        });
      }
    }
    if (idx < 0 && slot.cssVar) {
      const v = slot.cssVar.toLowerCase();
      idx = findIncoming((c) => (c.cssVar || "").toLowerCase() === v);
    }
    if (idx < 0 && isPlaceholderSlot(slot)) {
      idx = findIncoming(() => true);
    }
    if (idx < 0) return slot;
    used.add(idx);
    const src = incoming[idx];
    return {
      ...slot,
      name: isPlaceholderSlot(slot) ? src.name : slot.name || src.name,
      hex: src.hex,
      rgb: src.rgb || hexToRgbString(src.hex),
      cmyk: src.cmyk || hexToCmyk(src.hex),
      cssVar: slot.cssVar || src.cssVar,
    };
  });

  for (let i = 0; i < incoming.length; i++) {
    if (used.has(i)) continue;
    const src = incoming[i];
    const already = out.some(
      (s) => s.hex.toLowerCase() === src.hex.toLowerCase()
    );
    if (!already) out.push(src);
  }
  return out;
}

const HEX_IN_TEXT = /#([0-9a-fA-F]{6})\b/;

function hexFromText(text?: string): string | null {
  if (!text) return null;
  const m = HEX_IN_TEXT.exec(text);
  return m ? `#${m[1].toLowerCase()}` : null;
}

function paintHex(
  node: FigmaFileNode,
  variables: Record<string, FigmaVariable> | null
): string | null {
  const fills = node.fills || [];
  for (const fill of fills) {
    if (fill?.visible === false) continue;
    if (fill?.type && fill.type !== "SOLID") continue;
    if (fill?.color) return figmaColorToHex(fill.color);
    const bound = fill?.boundVariables?.color;
    if (bound?.id && variables) {
      const target =
        variables[bound.id] ||
        Object.values(variables).find((v) => v.id === bound.id);
      if (!target) continue;
      const raw = Object.values(target.valuesByMode || {})[0];
      const rgba = asRgba(raw);
      if (rgba) return figmaColorToHex(rgba);
    }
  }
  return null;
}

function isPageSized(node: FigmaFileNode): boolean {
  const box = node.absoluteBoundingBox;
  if (!box) return false;
  return box.width >= 720 && box.height >= 720;
}

function collectTextNodes(node: FigmaFileNode): string[] {
  const parts: string[] = [];
  walkNodes(node, (n) => {
    if (n.type === "TEXT" && typeof n.characters === "string") {
      const t = n.characters.trim();
      if (t) parts.push(t);
    }
  });
  return parts;
}

function labelFromTexts(texts: string[], fallback: string): string {
  const named = texts.find((t) => !HEX_IN_TEXT.test(t) && t.length <= 48);
  return (named || fallback).replace(/_Container$/i, "").trim() || fallback;
}

type FormatBucket = ColorBucket | "hex" | "rgb" | "cmyk" | "color_scale";

function collectSwatchesFromColorFrame(
  frame: FigmaFileNode,
  variables: Record<string, FigmaVariable> | null
): ColorSwatch[] {
  const found: ColorSwatch[] = [];
  const seen = new Set<string>();

  const push = (name: string, hex: string) => {
    const key = `${normalizeSwatchName(name)}:${hex.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(swatchFromParts(name, hex));
  };

  walkNodes(frame, (n: FigmaFileNode) => {
    if (n === frame) return;
    if (n.type === "TEXT") {
      const hex = hexFromText(n.characters);
      if (hex) {
        const name =
          (n.characters || "")
            .replace(HEX_IN_TEXT, "")
            .replace(/\b(hex|rgb|cmyk)\b/gi, "")
            .trim() || n.name;
        push(name || hex.toUpperCase(), hex);
      }
      return;
    }
    if (isPageSized(n) && !/swatch|chip|token|color/i.test(n.name || "")) return;
    const hex = paintHex(n, variables);
    if (!hex) return;
    const texts = collectTextNodes(n);
    const hexLabel = texts.map(hexFromText).find(Boolean);
    const name = labelFromTexts(texts, n.name || frame.name);
    push(name, hexLabel || hex);
  });

  if (!found.length) {
    const hex = paintHex(frame, variables);
    if (hex) push(frame.name, hex);
    for (const t of collectTextNodes(frame)) {
      const h = hexFromText(t);
      if (h) push(labelFromTexts([t], frame.name), h);
    }
  }

  return found;
}

function extractCanvasColors(
  file: FigmaFileResponse,
  variables: Record<string, FigmaVariable> | null
): { bucket: FormatBucket; swatch: ColorSwatch }[] {
  const hits: { bucket: FormatBucket; swatch: ColorSwatch }[] = [];

  const walk = (n: FigmaFileNode) => {
    const mod = n.type === "SECTION" ? matchCanvasModule(n.name) : null;
    if (mod?.moduleId === "colors_systems") {
      for (const child of n.children || []) {
        if (
          child.type !== "FRAME" &&
          child.type !== "COMPONENT" &&
          child.type !== "COMPONENT_SET"
        ) {
          continue;
        }
        const def = lookupCanvasFrame(child.name, "colors_systems");
        if (!def || def.kind !== "color") continue;
        const bucket = def.sectionType as FormatBucket;
        for (const swatch of collectSwatchesFromColorFrame(child, variables)) {
          hits.push({ bucket, swatch });
        }
      }
      return;
    }
    for (const c of n.children || []) walk(c);
  };
  walk(file.document);
  return hits;
}

function ensureColorSection(
  sections: Partial<CISection>[],
  type: SectionTypeLike,
  fileName?: string
) {
  const sec = ensureSection(sections, type as CISection["section_type"], fileName);
  if (!sec.data) sec.data = {};
  return sec;
}

type SectionTypeLike =
  | ColorBucket
  | "hex"
  | "rgb"
  | "cmyk"
  | "color_scale"
  | "colors";

function applySwatches(sec: Partial<CISection>, incoming: ColorSwatch[]) {
  if (!sec.data) sec.data = {};
  sec.data.swatches = fillSwatchSlots(sec.data.swatches, incoming);
}

export function normalizeColors(opts: {
  file: FigmaFileResponse;
  variables: FigmaVariablesResponse | null;
  sections: Partial<CISection>[];
  themeSuggested: Record<string, any>;
  dump?: ColorVariablesDump | null;
}): {
  swatchCount: number;
  fromVariables: number;
  fromStyles: number;
  fromCanvas: number;
  fromDump: number;
} {
  const { file, variables, sections, themeSuggested, dump } = opts;

  for (const bucket of COLOR_BUCKETS) {
    ensureColorSection(sections, bucket, file.name);
  }

  let fromVariables = 0;
  let fromDump = 0;
  let fromStyles = 0;
  let fromCanvas = 0;
  const parsed: ParsedColor[] = [];
  const byBucket: Record<ColorBucket, ColorSwatch[]> = {
    color_primary: [],
    color_secondary: [],
    color_accent: [],
    functional: [],
  };

  const meta = readVariablesMeta(variables);
  if (meta) {
    fromVariables = collectFromVariablesMeta(meta, parsed, themeSuggested);
  }
  if (dump) {
    fromDump = collectFromDump(dump, parsed, themeSuggested);
  }

  for (const p of parsed) byBucket[p.bucket].push(toSwatch(p));

  const varMap = meta?.variables || null;
  const canvasHits = extractCanvasColors(file, varMap);
  fromCanvas = canvasHits.length;
  for (const hit of canvasHits) {
    // Fold format/scale frames into role buckets — don't drop usable hexes.
    let bucket: ColorBucket = "color_primary";
    if (hit.bucket === "color_primary" || hit.bucket === "color_secondary" || hit.bucket === "color_accent" || hit.bucket === "functional") {
      bucket = hit.bucket;
    } else if (hit.bucket === "color_scale" || hit.bucket === "hex" || hit.bucket === "rgb" || hit.bucket === "cmyk") {
      bucket = bucketForColor(hit.swatch.name || "", "Canvas") || "color_primary";
    } else {
      continue;
    }
    const hex = hit.swatch.hex.toLowerCase();
    if (COLOR_BUCKETS.some((b) => byBucket[b].some((s) => s.hex.toLowerCase() === hex))) continue;
    byBucket[bucket].push(hit.swatch);
  }

  // Paint styles → fill any bucket that is still thin
  const styleColorMap = new Map<string, string>();
  walkNodes(file.document, (n) => {
    const styleId = n.styles?.fill;
    if (!styleId || styleColorMap.has(styleId)) return;
    const fill = (n.fills || []).find(
      (f: { type?: string; visible?: boolean; color?: { r: number; g: number; b: number } }) =>
        f?.type === "SOLID" && f.visible !== false && f.color
    );
    if (fill?.color) styleColorMap.set(styleId, figmaColorToHex(fill.color));
  });

  const fillStyles = Object.entries(file.styles || {}).filter(
    ([, s]) => s.styleType === "FILL" || s.styleType === "PAINT"
  );

  for (const [styleId, style] of fillStyles) {
    const hex = styleColorMap.get(styleId);
    if (!hex) continue;
    const bucket = bucketForColor(style.name, "Paint styles");
    const name = style.name.split("/").pop() || style.name;
    const swatch = swatchFromParts(name, hex);
    if (!byBucket[bucket].some((s) => s.hex.toLowerCase() === hex.toLowerCase())) {
      byBucket[bucket].push(swatch);
      fromStyles++;
    }
  }

  if (
    fromVariables === 0 &&
    fromDump === 0 &&
    fromStyles === 0 &&
    fromCanvas === 0
  ) {
    const seen = new Set<string>();
    walkNodes(file.document, (n: FigmaFileNode) => {
      if (!/color|swatch|palette|farbe|hex/i.test(n.name || "")) return;
      const hex = paintHex(n, varMap) || hexFromText(n.characters || undefined);
      if (!hex) return;
      const key = `${n.name}:${hex}`;
      if (seen.has(key)) return;
      seen.add(key);
      byBucket.color_primary.push(swatchFromParts(n.name, hex));
      fromStyles++;
    });
  }

  regroupSameHueAccents(byBucket, parsed);

  for (const bucket of COLOR_BUCKETS) {
    if (!byBucket[bucket].length) continue;
    applySwatches(
      ensureColorSection(sections, bucket, file.name),
      dedupeSwatchesByHex(byBucket[bucket])
    );
  }

  const rebalanced = rebalanceColorBuckets(sections);
  if (rebalanced.changed) {
    sections.splice(0, sections.length, ...rebalanced.sections);
  }

  if (parsed.length) {
    const chrome = pickChromeHex(parsed);
    themeSuggested.accentColors = chrome ? [chrome] : [];
    applyPageTheme(parsed, themeSuggested);
  }

  const promoted = promoteColorFamilyCards(sections, {
    themeAccent: Array.isArray(themeSuggested.accentColors)
      ? themeSuggested.accentColors[0]
      : null,
  });
  if (promoted.changed) {
    sections.splice(0, sections.length, ...promoted.sections);
  }

  const swatchCount = COLOR_BUCKETS.reduce((sum, b) => {
    const sec = sections.find((s) => s.section_type === b);
    return sum + (sec?.data?.swatches?.length || 0);
  }, 0);

  return { swatchCount, fromVariables, fromStyles, fromCanvas, fromDump };
}

const EMPTY_DUMP_FILE: FigmaFileResponse = {
  name: "Brand Colors",
  document: { id: "0:0", name: "Document", type: "DOCUMENT", children: [] },
};

/** Apply a plugin JSON dump onto color sections only. */
export function normalizeColorsFromDump(opts: {
  dump: ColorVariablesDump;
  sections: Partial<CISection>[];
  themeSuggested: Record<string, any>;
}): {
  swatchCount: number;
  fromVariables: number;
  fromStyles: number;
  fromCanvas: number;
  fromDump: number;
} {
  return normalizeColors({
    file: {
      ...EMPTY_DUMP_FILE,
      name: opts.dump.fileName || EMPTY_DUMP_FILE.name,
    },
    variables: null,
    sections: opts.sections,
    themeSuggested: opts.themeSuggested,
    dump: opts.dump,
  });
}
