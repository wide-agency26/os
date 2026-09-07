import type {
  FigmaFileNode,
  FigmaFileResponse,
  FigmaVariable,
  FigmaVariableCollection,
  FigmaVariablesResponse,
} from "@/lib/ci-builder/figma/client";
import { generateUUID } from "@/lib/ci-builder/types";
import type { CISection, TypeScaleEntry } from "@/lib/ci-builder/types";
import { ensureSection, walkNodes } from "./helpers";

type FontStyleGroup = {
  path: string;
  leaf: string;
  textSize?: number;
  lineHeight?: number;
  paragraphSpacing?: number;
  characterSpacing?: number;
  fontWeight?: string;
  fontFamily?: string;
  fontStyle?: "italic" | "normal";
};

const FIELD_MAP: Record<string, keyof FontStyleGroup> = {
  "text size": "textSize",
  "font size": "textSize",
  size: "textSize",
  "line height": "lineHeight",
  leading: "lineHeight",
  "paragraph spacing": "paragraphSpacing",
  "character spacing": "characterSpacing",
  "letter spacing": "characterSpacing",
  tracking: "characterSpacing",
  "font weight": "fontWeight",
  weight: "fontWeight",
  "font style": "fontStyle",
  style: "fontStyle",
  italic: "fontStyle",
};

function isItalicFace(blob: string): boolean {
  return /italic|oblique/i.test(blob);
}

function italicFromFigma(st: {
  italic?: boolean;
  fontStyle?: string;
  fontPostScriptName?: string;
  fontWeight?: string | number;
}): boolean {
  if (st.italic === true) return true;
  return isItalicFace(
    `${st.fontStyle || ""} ${st.fontPostScriptName || ""} ${st.fontWeight || ""}`
  );
}

function pickModeId(coll?: FigmaVariableCollection): string | undefined {
  if (!coll) return undefined;
  const desktop = coll.modes?.find((m) => /desktop/i.test(m.name || ""));
  return desktop?.modeId || coll.defaultModeId || coll.modes?.[0]?.modeId;
}

function formatPx(n: number): string {
  return `${n}px`;
}

function parseFieldLeaf(leaf: string): keyof FontStyleGroup | null {
  const n = leaf.toLowerCase().replace(/[_-]+/g, " ").trim();
  return FIELD_MAP[n] || null;
}

/** Font/Heading/Primary/text size → group path + field. */
function parseFontVariableName(
  name: string
): { groupPath: string; field: keyof FontStyleGroup } | null {
  const parts = name.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const field = parseFieldLeaf(parts[parts.length - 1]);
  if (!field) return null;
  const groupPath = parts.slice(0, -1).join("/");
  const head = parts[0];
  if (!/^font\b/i.test(head) && !/^(heading|copy)\b/i.test(head)) return null;
  return { groupPath, field };
}

function resolveRaw(
  meta: NonNullable<FigmaVariablesResponse["meta"]>,
  variable: FigmaVariable,
  preferredModeId: string,
  depth = 0
): { value: unknown; aliasName?: string; aliasPath?: string } {
  const coll = meta.variableCollections[variable.variableCollectionId];
  const modeId =
    (variable.valuesByMode && preferredModeId in variable.valuesByMode
      ? preferredModeId
      : null) ||
    pickModeId(coll) ||
    Object.keys(variable.valuesByMode || {})[0];
  if (!modeId) return { value: undefined };
  const raw = variable.valuesByMode?.[modeId];
  if (raw && typeof raw === "object" && (raw as { type?: string }).type === "VARIABLE_ALIAS") {
    const id = (raw as { id?: string }).id;
    const aliased = id ? meta.variables[id] : undefined;
    if (aliased && depth < 10) {
      const inner = resolveRaw(meta, aliased, preferredModeId, depth + 1);
      return {
        value: inner.value,
        aliasName: inner.aliasName || aliased.name.split("/").pop() || aliased.name,
        aliasPath: aliased.name,
      };
    }
  }
  return { value: raw };
}

function familyFromPath(path: string): string | undefined {
  const m = path.match(/fonts?\/([^/]+)/i);
  return m?.[1];
}

function collectFontStyleGroups(
  variables: FigmaVariablesResponse | null | undefined
): FontStyleGroup[] {
  const meta = variables?.meta;
  if (!meta?.variables || !meta.variableCollections) return [];

  const groups = new Map<string, FontStyleGroup>();

  for (const coll of Object.values(meta.variableCollections)) {
    const modeId = pickModeId(coll);
    if (!modeId) continue;

    for (const varId of coll.variableIds || []) {
      const v = meta.variables[varId];
      if (!v) continue;
      const parsed = parseFontVariableName(v.name);
      if (!parsed) continue;

      const g =
        groups.get(parsed.groupPath) ||
        ({
          path: parsed.groupPath,
          leaf: parsed.groupPath.split("/").pop() || parsed.groupPath,
        } satisfies FontStyleGroup);
      groups.set(parsed.groupPath, g);

      const resolved = resolveRaw(meta, v, modeId);
      if (parsed.field === "fontStyle") {
        const raw =
          resolved.aliasName ||
          (typeof resolved.value === "string" ? resolved.value : "") ||
          "";
        if (isItalicFace(raw)) g.fontStyle = "italic";
        else if (raw.trim()) g.fontStyle = "normal";
        continue;
      }
      if (parsed.field === "fontWeight") {
        g.fontWeight =
          resolved.aliasName ||
          (typeof resolved.value === "string" ? resolved.value : undefined) ||
          (typeof resolved.value === "number" ? String(resolved.value) : undefined);
        if (g.fontWeight && isItalicFace(g.fontWeight)) g.fontStyle = "italic";
        if (resolved.aliasPath && !g.fontFamily) {
          g.fontFamily = familyFromPath(resolved.aliasPath);
        }
        continue;
      }

      const num =
        typeof resolved.value === "number"
          ? resolved.value
          : typeof resolved.value === "string" && resolved.value.trim() !== ""
            ? Number(resolved.value)
            : NaN;
      if (!Number.isFinite(num)) continue;
      (g as unknown as Record<string, unknown>)[parsed.field] = num;
    }
  }

  return Array.from(groups.values()).filter((g) => g.textSize != null);
}

function scaleToken(g: FontStyleGroup): string {
  const parts = g.path.split("/").filter((p) => !/^fonts?$/i.test(p));
  return parts.join(" / ") || g.leaf;
}

function roleFromSpecType(type: string | null): TypeScaleEntry["role"] | undefined {
  if (type === "headline_primary") return "heading-primary";
  if (type === "headline_secondary") return "heading-secondary";
  if (type === "headline_tertiary") return "heading-tertiary";
  if (type === "body") return "copy-body";
  if (type === "caption") return "copy-caption";
  return undefined;
}

function mapGroupToTypeSpec(g: FontStyleGroup): string | null {
  const path = g.path.toLowerCase();
  const leaf = g.leaf.toLowerCase();
  if (/heading|headline/.test(path)) {
    if (leaf === "primary" || (leaf.startsWith("primary") && !/bold/.test(leaf))) {
      return "headline_primary";
    }
    if (/secondary/.test(leaf)) return "headline_secondary";
    if (/tertiary/.test(leaf)) return "headline_tertiary";
    return null;
  }
  if (/copy/.test(path) || /body|caption/.test(leaf)) {
    if (leaf === "body" || leaf === "copy") return "body";
    if (leaf === "caption") return "caption";
  }
  return null;
}

function largestTextNode(node: FigmaFileNode): FigmaFileNode | null {
  let best: FigmaFileNode | null = null;
  let bestSize = -1;
  const walk = (n: FigmaFileNode) => {
    if (n.type === "TEXT" && n.style?.fontSize != null && n.style.fontSize > bestSize) {
      best = n;
      bestSize = n.style.fontSize;
    }
    for (const c of n.children || []) walk(c);
  };
  walk(node);
  return best;
}

function harvestHeadlineFromCanvas(
  file: FigmaFileResponse,
  sections: Partial<CISection>[]
) {
  const roles: { re: RegExp; role: TypeScaleEntry["role"] }[] = [
    { re: /headline\s*primary|heading\s*primary/i, role: "heading-primary" },
    { re: /headline\s*secondary|heading\s*secondary/i, role: "heading-secondary" },
    { re: /headline\s*tertiary|heading\s*tertiary/i, role: "heading-tertiary" },
    { re: /\bbody\b/i, role: "copy-body" },
    { re: /\bcaption\b/i, role: "copy-caption" },
  ];
  const scaleSec = ensureSection(sections, "typography_scale", file.name);
  const scale = Array.isArray(scaleSec.data.scale) ? [...scaleSec.data.scale] : [];
  const visit = (node: FigmaFileNode) => {
    const hit = roles.find((r) => r.re.test(node.name || ""));
    if (
      hit &&
      ["FRAME", "GROUP", "COMPONENT", "INSTANCE", "SECTION"].includes(node.type)
    ) {
      const largest = largestTextNode(node);
      if (largest?.style) {
        const st = largest.style;
        const existing = scale.find((r: TypeScaleEntry) => r.role === hit.role);
        const row: TypeScaleEntry = {
          id: existing?.id || generateUUID(),
          px: st.fontSize != null ? Math.round(st.fontSize) : 0,
          token: hit.role || "",
          role: hit.role,
          name: hit.role,
          value: st.fontSize != null ? formatPx(Math.round(st.fontSize)) : "",
          fontFamily: st.fontFamily || existing?.fontFamily,
          fontWeight: st.fontWeight != null ? String(st.fontWeight) : existing?.fontWeight,
          fontStyle: italicFromFigma(st) ? "italic" : "normal",
          lineHeight: st.lineHeightPx != null ? formatPx(Math.round(st.lineHeightPx)) : existing?.lineHeight,
          letterSpacing:
            st.letterSpacing != null ? String(st.letterSpacing) : existing?.letterSpacing,
        };
        if (existing) {
          Object.assign(existing, row);
        } else {
          scale.push(row);
        }
      }
      return;
    }
    for (const c of node.children || []) visit(c);
  };
  if (file.document) visit(file.document);
  scaleSec.data.scale = scale;
}

function applyTypeSpec(
  sections: Partial<CISection>[],
  fileName: string,
  g: FontStyleGroup
) {
  const type = mapGroupToTypeSpec(g);
  if (!type) return false;
  const sec = ensureSection(sections, type as CISection["section_type"], fileName);
  if (sec.data.fontSize) return false;
  sec.data.fontFamily = g.fontFamily || "";
  sec.data.fontWeight = g.fontWeight || "";
  sec.data.fontStyle = g.fontStyle || "";
  sec.data.fontSize = g.textSize != null ? formatPx(g.textSize) : "";
  sec.data.lineHeight = g.lineHeight != null ? formatPx(g.lineHeight) : "";
  sec.data.letterSpacing =
    g.characterSpacing != null ? formatPx(g.characterSpacing) : "";
  sec.data.sampleText = "The quick brown fox jumps over the lazy dog";
  return true;
}

/**
 * Font hierarchy from Font/* variable groups (Desktop mode) and local text styles.
 * Maps into:
 *  - fallback_fonts  (Font Families)
 *  - typography_scale (named Font/Heading + Font/Copy styles — not a harvested px waterfall)
 *  - headline_primary / secondary / tertiary, body, caption
 *  - line_heights / letter_spacing tokens from the same groups
 */
export function normalizeTypography(opts: {
  file: FigmaFileResponse;
  sections: Partial<CISection>[];
  themeSuggested: Record<string, any>;
  variables?: FigmaVariablesResponse | null;
}): { rowCount: number; familyCount: number; scaleCount: number } {
  const { file, sections, themeSuggested, variables } = opts;

  const familiesSec = ensureSection(sections, "fallback_fonts", file.name);
  const scaleSec = ensureSection(sections, "typography_scale", file.name);

  const families = new Map<string, Set<string>>();
  const fontGroups = collectFontStyleGroups(variables);

  // --- Local TEXT styles (family + type_spec fallback only — never a fake scale) ---
  const textStyles = Object.entries(file.styles || {}).filter(
    ([, s]) => s.styleType === "TEXT"
  );

  const styleSamples = new Map<
    string,
    {
      fontFamily?: string;
      fontWeight?: number;
      fontSize?: number;
      italic?: boolean;
      fontPostScriptName?: string;
      lineHeightPx?: number;
      letterSpacing?: number;
      sample?: string;
    }
  >();

  walkNodes(file.document, (n) => {
    if (n.type !== "TEXT") return;
    const styleId = n.styles?.text;
    const st = n.style || {};
    if (styleId && !styleSamples.has(styleId)) {
      styleSamples.set(styleId, {
        fontFamily: st.fontFamily,
        fontWeight: st.fontWeight,
        fontSize: st.fontSize,
        italic: italicFromFigma(st),
        fontPostScriptName: st.fontPostScriptName,
        lineHeightPx: st.lineHeightPx,
        letterSpacing: st.letterSpacing,
        sample:
          typeof n.characters === "string" ? n.characters.slice(0, 80) : undefined,
      });
    }
    if (st.fontFamily) {
      const set = families.get(st.fontFamily) || new Set<string>();
      if (st.fontWeight) set.add(String(st.fontWeight));
      if (italicFromFigma(st)) set.add("italic");
      families.set(st.fontFamily, set);
    }
  });

  for (const [styleId] of textStyles) {
    const sample = styleSamples.get(styleId);
    if (sample?.fontFamily) {
      const set = families.get(sample.fontFamily) || new Set<string>();
      if (sample.fontWeight) set.add(String(sample.fontWeight));
      families.set(sample.fontFamily, set);
    }
  }

  for (const g of fontGroups) {
    if (g.fontFamily) {
      const set = families.get(g.fontFamily) || new Set<string>();
      if (g.fontWeight) set.add(g.fontWeight);
      families.set(g.fontFamily, set);
    }
  }

  const scale: TypeScaleEntry[] = fontGroups.map((g) => ({
    id: generateUUID(),
    px: g.textSize || 0,
    token: scaleToken(g),
    role: roleFromSpecType(mapGroupToTypeSpec(g)),
    value: g.textSize != null ? formatPx(g.textSize) : "",
    fontFamily: g.fontFamily,
    fontWeight: g.fontWeight,
    lineHeight: g.lineHeight != null ? formatPx(g.lineHeight) : undefined,
    letterSpacing:
      g.characterSpacing != null ? formatPx(g.characterSpacing) : undefined,
    paragraphSpacing:
      g.paragraphSpacing != null ? formatPx(g.paragraphSpacing) : undefined,
    fontStyle: g.fontStyle,
  }));
  scaleSec.data.scale = scale;

  if (fontGroups.length) {
    const leadingSec = ensureSection(sections, "line_heights", file.name);
    const trackingSec = ensureSection(sections, "letter_spacing", file.name);
    leadingSec.data.tokens = fontGroups
      .filter((g) => g.lineHeight != null)
      .map((g) => ({
        id: generateUUID(),
        token: scaleToken(g),
        value: formatPx(g.lineHeight as number),
      }));
    trackingSec.data.tokens = fontGroups
      .filter((g) => g.characterSpacing != null)
      .map((g) => ({
        id: generateUUID(),
        token: scaleToken(g),
        value: formatPx(g.characterSpacing as number),
      }));
  }

  const rankedFonts = Array.from(families.keys());
  if (rankedFonts.length) {
    themeSuggested.availableFonts = rankedFonts;
    themeSuggested.primaryFont = rankedFonts[0];
    themeSuggested.secondaryFont = rankedFonts[1] || rankedFonts[0];
    themeSuggested.tertiaryFont = rankedFonts[2] || rankedFonts[1] || rankedFonts[0];
    themeSuggested.fontFamily = rankedFonts[0];
    if (!themeSuggested.primaryFontFallback) {
      themeSuggested.primaryFontFallback = "system-ui, -apple-system, sans-serif";
    }
    if (!themeSuggested.secondaryFontFallback) {
      themeSuggested.secondaryFontFallback = "Georgia, 'Times New Roman', serif";
    }
    if (!themeSuggested.tertiaryFontFallback) {
      themeSuggested.tertiaryFontFallback =
        "ui-monospace, SFMono-Regular, Menlo, monospace";
    }
  }

  familiesSec.data.stack = rankedFonts.length
    ? `${rankedFonts.join(", ")}, system-ui, sans-serif`
    : familiesSec.data.stack || "system-ui, -apple-system, sans-serif";
  familiesSec.data.families = rankedFonts.map((family) => ({
    id: generateUUID(),
    family,
    styles: Array.from(families.get(family) || []),
  }));

  let rowCount = 0;
  for (const g of fontGroups) {
    if (applyTypeSpec(sections, file.name, g)) rowCount++;
  }

  const roleMap: { re: RegExp; type: string }[] = [
    { re: /display|\bh1\b|headline\s*primary|heading.*primary|primary\s*headline|(^|\/)primary$/i, type: "headline_primary" },
    { re: /h2|headline\s*secondary|secondary/i, type: "headline_secondary" },
    { re: /h3|h4|headline\s*tertiary|tertiary/i, type: "headline_tertiary" },
    { re: /body|paragraph|text\s*\/\s*body/i, type: "body" },
    { re: /caption|meta|small/i, type: "caption" },
  ];

  for (const [styleId, metaStyle] of textStyles) {
    const sample = styleSamples.get(styleId);
    const label = metaStyle.name;
    const hit = roleMap.find((r) => r.re.test(label));
    if (!hit) continue;
    const sec = ensureSection(sections, hit.type as CISection["section_type"], file.name);
    const incomingItalic = italicFromFigma({
      italic: sample?.italic,
      fontPostScriptName: sample?.fontPostScriptName,
      fontWeight: sample?.fontWeight,
    });
    if (sec.data.fontFamily || sec.data.fontSize) {
      if (incomingItalic && sec.data.fontStyle !== "italic") {
        sec.data.fontStyle = "italic";
        if (sample?.fontFamily) sec.data.fontFamily = sample.fontFamily;
        if (sample?.fontWeight) sec.data.fontWeight = String(sample.fontWeight);
      }
      continue;
    }
    sec.data.fontFamily = sample?.fontFamily || "";
    sec.data.fontWeight = sample?.fontWeight ? String(sample.fontWeight) : "";
    sec.data.fontStyle = incomingItalic ? "italic" : "";
    sec.data.fontSize = sample?.fontSize ? formatPx(Math.round(sample.fontSize)) : "";
    sec.data.lineHeight = sample?.lineHeightPx
      ? formatPx(Math.round(sample.lineHeightPx))
      : "";
    sec.data.letterSpacing =
      sample?.letterSpacing != null ? String(sample.letterSpacing) : "";
    sec.data.sampleText =
      sample?.sample || "The quick brown fox jumps over the lazy dog";
    rowCount++;
  }

  const overlayItalicFromCanvas = (node: FigmaFileNode, trail: string[]) => {
    const here = [...trail, node.name || ""];
    if (node.type === "TEXT" && node.style && italicFromFigma(node.style)) {
      const blob = here.join(" ");
        const hit = roleMap.find((r) => r.re.test(blob));
      if (hit && /typograph|headline|heading|copy|font|05[\.\s]/i.test(blob)) {
        const sec = ensureSection(
          sections,
          hit.type as CISection["section_type"],
          file.name
        );
        sec.data.fontStyle = "italic";
        if (node.style.fontFamily) sec.data.fontFamily = node.style.fontFamily;
        if (node.style.fontWeight) {
          sec.data.fontWeight = String(node.style.fontWeight);
        }
      }
    }
    for (const child of node.children || []) overlayItalicFromCanvas(child, here);
  };
  overlayItalicFromCanvas(file.document, []);
  harvestHeadlineFromCanvas(file, sections);

  return {
    rowCount: rowCount + rankedFonts.length + scale.length,
    familyCount: rankedFonts.length,
    scaleCount: scale.length,
  };
}
