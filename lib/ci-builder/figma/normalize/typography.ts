import type { FigmaFileResponse } from "@/lib/ci-builder/figma/client";
import { generateUUID } from "@/lib/ci-builder/types";
import type { CISection, TypeRow, TypeScaleEntry } from "@/lib/ci-builder/types";
import { ensureSection, walkNodes } from "./helpers";

export function normalizeTypography(opts: {
  file: FigmaFileResponse;
  sections: Partial<CISection>[];
  themeSuggested: Record<string, any>;
}): { rowCount: number } {
  const { file, sections, themeSuggested } = opts;
  const typoSec = ensureSection(sections, "typography", file.name);
  if (!typoSec.data.rows) typoSec.data.rows = [];
  if (!typoSec.data.scale) typoSec.data.scale = [];
  const rows: TypeRow[] = typoSec.data.rows;
  const scale: TypeScaleEntry[] = typoSec.data.scale;

  const textStyles = Object.entries(file.styles || {}).filter(
    ([, s]) => s.styleType === "TEXT"
  );

  // Collect sample text style bindings from nodes
  const styleSamples = new Map<
    string,
    { fontFamily?: string; fontWeight?: number; fontSize?: number; lineHeightPx?: number; sample?: string }
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
        sample: typeof n.characters === "string" ? n.characters.slice(0, 80) : undefined,
      });
    }
    // Also collect unique font sizes for scale
    if (typeof st.fontSize === "number") {
      const px = Math.round(st.fontSize);
      if (!scale.some((s) => s.px === px)) {
        scale.push({
          id: generateUUID(),
          px,
          token: `text-${px}`,
        });
      }
    }
    if (st.fontFamily && !themeSuggested.fontFamily) {
      themeSuggested.fontFamily = st.fontFamily;
    }
  });

  scale.sort((a, b) => a.px - b.px);

  for (const [styleId, meta] of textStyles) {
    const sample = styleSamples.get(styleId);
    const label = meta.name.split("/").pop() || meta.name;
    if (rows.some((r) => r.label === label)) continue;

    const fontFamily = sample?.fontFamily || "—";
    const fontWeight = sample?.fontWeight ? String(sample.fontWeight) : undefined;
    const fontSize = sample?.fontSize ? `${Math.round(sample.fontSize)}px` : undefined;
    const lineHeight = sample?.lineHeightPx
      ? `${Math.round(sample.lineHeightPx)}px`
      : undefined;

    const specParts = [fontFamily, fontWeight, fontSize, lineHeight].filter(Boolean);

    rows.push({
      id: generateUUID(),
      label,
      specLine1: specParts.join(" · "),
      fontFamily,
      fontWeight,
      fontSize,
      lineHeight,
      sampleText: sample?.sample || "The quick brown fox jumps over the lazy dog",
    });
  }

  // Fallback: top unique text styles from nodes when no TEXT styles exist
  if (rows.length === 0) {
    const seen = new Set<string>();
    walkNodes(file.document, (n) => {
      if (n.type !== "TEXT" || !n.style?.fontFamily) return;
      const key = `${n.style.fontFamily}-${n.style.fontWeight}-${n.style.fontSize}`;
      if (seen.has(key) || seen.size >= 12) return;
      seen.add(key);
      rows.push({
        id: generateUUID(),
        label: n.name || `Text ${rows.length + 1}`,
        specLine1: [
          n.style.fontFamily,
          n.style.fontWeight,
          n.style.fontSize ? `${Math.round(n.style.fontSize)}px` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        fontFamily: n.style.fontFamily,
        fontWeight: n.style.fontWeight ? String(n.style.fontWeight) : undefined,
        fontSize: n.style.fontSize ? `${Math.round(n.style.fontSize)}px` : undefined,
        lineHeight: n.style.lineHeightPx
          ? `${Math.round(n.style.lineHeightPx)}px`
          : undefined,
        sampleText:
          typeof n.characters === "string"
            ? n.characters.slice(0, 80)
            : "The quick brown fox jumps over the lazy dog",
      });
    });
  }

  return { rowCount: rows.length };
}
