import type {
  FigmaFileResponse,
  FigmaVariablesResponse,
} from "@/lib/ci-builder/figma/client";
import { generateUUID } from "@/lib/ci-builder/types";
import type { CISection, TypeScaleEntry } from "@/lib/ci-builder/types";
import { ensureSection, walkNodes } from "./helpers";

/**
 * Font hierarchy from Brand + Responsive variable collections and local text styles.
 * Maps into:
 *  - fallback_fonts  (Font Families)
 *  - typography_scale (Type Scale)
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
  if (!scaleSec.data.scale) scaleSec.data.scale = [];
  const scale: TypeScaleEntry[] = scaleSec.data.scale;

  const families = new Map<string, Set<string>>();

  // --- Local TEXT styles (same source as the Figma generator script) ---
  const textStyles = Object.entries(file.styles || {}).filter(
    ([, s]) => s.styleType === "TEXT"
  );

  const styleSamples = new Map<
    string,
    {
      fontFamily?: string;
      fontWeight?: number;
      fontSize?: number;
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
        lineHeightPx: st.lineHeightPx,
        letterSpacing: st.letterSpacing,
        sample:
          typeof n.characters === "string" ? n.characters.slice(0, 80) : undefined,
      });
    }
    if (st.fontFamily) {
      const set = families.get(st.fontFamily) || new Set<string>();
      if (st.fontWeight) set.add(String(st.fontWeight));
      families.set(st.fontFamily, set);
    }
    if (typeof st.fontSize === "number") {
      const px = Math.round(st.fontSize);
      if (!scale.some((s) => s.px === px)) {
        scale.push({ id: generateUUID(), px, token: `text-${px}` });
      }
    }
  });

  for (const [styleId, meta] of textStyles) {
    const sample = styleSamples.get(styleId);
    if (sample?.fontFamily) {
      const set = families.get(sample.fontFamily) || new Set<string>();
      if (sample.fontWeight) set.add(String(sample.fontWeight));
      families.set(sample.fontFamily, set);
    }
    if (sample?.fontSize) {
      const px = Math.round(sample.fontSize);
      if (!scale.some((s) => s.px === px)) {
        scale.push({
          id: generateUUID(),
          px,
          token: meta.name.split("/").pop()?.toLowerCase().replace(/\s+/g, "-") || `text-${px}`,
        });
      }
    }
  }

  // --- Variable collections: Brand (families) + Responsive (scale) ---
  const meta = variables?.meta;
  if (meta?.variables && meta.variableCollections) {
    for (const coll of Object.values(meta.variableCollections)) {
      const collName = (coll.name || "").toLowerCase();
      const isBrand = /brand/.test(collName);
      const isResponsive = /responsive|type\s*scale|typography/.test(collName);
      if (!isBrand && !isResponsive) continue;

      const modeId = coll.defaultModeId || coll.modes?.[0]?.modeId;
      if (!modeId) continue;

      for (const varId of coll.variableIds || []) {
        const v = meta.variables[varId];
        if (!v) continue;
        const raw = v.valuesByMode?.[modeId] as any;
        const vName = v.name.toLowerCase();

        if (isBrand && v.resolvedType === "STRING" && typeof raw === "string") {
          if (/font|family|typeface/i.test(vName) || /font|family/i.test(raw)) {
            const fam = raw.trim();
            if (fam && !families.has(fam)) families.set(fam, new Set());
          }
        }

        if (
          (isResponsive || isBrand) &&
          v.resolvedType === "FLOAT" &&
          typeof raw === "number"
        ) {
          if (/size|font-size|text-|scale|leading|tracking|line/i.test(vName)) {
            const px = Math.round(raw);
            if (px > 0 && px < 400 && !scale.some((s) => s.px === px)) {
              scale.push({
                id: generateUUID(),
                px,
                token:
                  v.name.split("/").pop()?.toLowerCase().replace(/\s+/g, "-") ||
                  `text-${px}`,
              });
            }
          }
        }
      }
    }
  }

  scale.sort((a, b) => a.px - b.px);

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

  // Font Families sub-module (fallback_fonts / font_stack renderer)
  familiesSec.data.stack = rankedFonts.length
    ? `${rankedFonts.join(", ")}, system-ui, sans-serif`
    : familiesSec.data.stack || "system-ui, -apple-system, sans-serif";
  familiesSec.data.families = rankedFonts.map((family) => ({
    id: generateUUID(),
    family,
    styles: Array.from(families.get(family) || []),
  }));

  // Also seed headline/body type_spec sections from text styles when present
  const roleMap: { re: RegExp; type: string }[] = [
    { re: /display|h1|headline\s*primary|primary/i, type: "headline_primary" },
    { re: /h2|headline\s*secondary|secondary/i, type: "headline_secondary" },
    { re: /h3|h4|headline\s*tertiary|tertiary/i, type: "headline_tertiary" },
    { re: /body|paragraph|text\s*\/\s*body/i, type: "body" },
    { re: /caption|meta|small/i, type: "caption" },
  ];

  let rowCount = 0;
  for (const [styleId, metaStyle] of textStyles) {
    const sample = styleSamples.get(styleId);
    const label = metaStyle.name;
    const hit = roleMap.find((r) => r.re.test(label));
    if (!hit) continue;
    const sec = ensureSection(sections, hit.type as any, file.name);
    if (sec.data.fontFamily) continue;
    sec.data.fontFamily = sample?.fontFamily || "";
    sec.data.fontWeight = sample?.fontWeight ? String(sample.fontWeight) : "";
    sec.data.fontSize = sample?.fontSize ? `${Math.round(sample.fontSize)}px` : "";
    sec.data.lineHeight = sample?.lineHeightPx
      ? `${Math.round(sample.lineHeightPx)}px`
      : "";
    sec.data.letterSpacing =
      sample?.letterSpacing != null ? String(sample.letterSpacing) : "";
    sec.data.sampleText =
      sample?.sample || "The quick brown fox jumps over the lazy dog";
    rowCount++;
  }

  return {
    rowCount: rowCount + rankedFonts.length + scale.length,
    familyCount: rankedFonts.length,
    scaleCount: scale.length,
  };
}
