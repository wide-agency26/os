import {
  type FigmaFileResponse,
  type FigmaVariablesResponse,
  figmaColorToHex,
  tokenNameToCssVar,
} from "@/lib/ci-builder/figma/client";
import { generateUUID } from "@/lib/ci-builder/types";
import type { CISection, ColorGroup, ColorSwatch } from "@/lib/ci-builder/types";
import { ensureSection, walkNodes } from "./helpers";

export function normalizeColors(opts: {
  file: FigmaFileResponse;
  variables: FigmaVariablesResponse | null;
  sections: Partial<CISection>[];
  themeSuggested: Record<string, any>;
}): { swatchCount: number; fromVariables: number; fromStyles: number } {
  const { file, variables, sections, themeSuggested } = opts;
  const colorsSec = ensureSection(sections, "colors", file.name);
  if (!colorsSec.data.groups) colorsSec.data.groups = [];
  const groups: ColorGroup[] = colorsSec.data.groups;

  let fromVariables = 0;
  let fromStyles = 0;

  const meta = variables?.meta;
  if (meta?.variables && meta.variableCollections) {
    for (const coll of Object.values(meta.variableCollections)) {
      const modeId = coll.defaultModeId || coll.modes?.[0]?.modeId;
      if (!modeId) continue;

      let group = groups.find((g) => g.groupLabel === coll.name);
      if (!group) {
        group = { id: generateUUID(), groupLabel: coll.name, swatches: [] };
        groups.push(group);
      }

      for (const varId of coll.variableIds || []) {
        const v = meta.variables[varId];
        if (!v || v.resolvedType !== "COLOR") continue;
        const raw = v.valuesByMode?.[modeId] as any;
        if (!raw || typeof raw !== "object" || raw.type === "VARIABLE_ALIAS") continue;
        if (typeof raw.r !== "number") continue;

        const hex = figmaColorToHex(raw);
        const swatch: ColorSwatch = {
          id: generateUUID(),
          name: v.name.split("/").pop() || v.name,
          hex,
          cssVar: tokenNameToCssVar(v.name),
        };
        // Avoid duplicates by cssVar
        if (!group.swatches.some((s) => s.cssVar === swatch.cssVar || s.hex === hex && s.name === swatch.name)) {
          group.swatches.push(swatch);
          fromVariables++;
        }

        const lower = v.name.toLowerCase();
        if (lower.includes("background") || lower.includes("bg") || lower.endsWith("/surface")) {
          if (!themeSuggested.backgroundColor) themeSuggested.backgroundColor = hex;
        } else if (lower.includes("text") || lower.includes("foreground")) {
          if (!themeSuggested.textColor) themeSuggested.textColor = hex;
        } else {
          if (!themeSuggested.accentColors) themeSuggested.accentColors = [];
          if (themeSuggested.accentColors.length < 4 && !themeSuggested.accentColors.includes(hex)) {
            themeSuggested.accentColors.push(hex);
          }
        }
      }
    }
  }

  // Paint styles: resolve color by finding a node that uses the style
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

  if (fillStyles.length) {
    let group = groups.find((g) => g.groupLabel === "Paint styles");
    if (!group) {
      group = { id: generateUUID(), groupLabel: "Paint styles", swatches: [] };
      groups.push(group);
    }
    for (const [styleId, style] of fillStyles) {
      const hex = styleColorMap.get(styleId);
      if (!hex) continue;
      const name = style.name.split("/").pop() || style.name;
      if (group.swatches.some((s) => s.name === name && s.hex === hex)) continue;
      group.swatches.push({
        id: generateUUID(),
        name,
        hex,
        cssVar: tokenNameToCssVar(style.name),
      });
      fromStyles++;
      if (!themeSuggested.accentColors) themeSuggested.accentColors = [];
      if (themeSuggested.accentColors.length < 4 && !themeSuggested.accentColors.includes(hex)) {
        themeSuggested.accentColors.push(hex);
      }
    }
  }

  // Named color frames fallback (Color/Primary, etc.)
  if (fromVariables === 0 && fromStyles === 0) {
    let group = groups.find((g) => g.groupLabel === "Detected fills");
    if (!group) {
      group = { id: generateUUID(), groupLabel: "Detected fills", swatches: [] };
      groups.push(group);
    }
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
      group!.swatches.push({
        id: generateUUID(),
        name: n.name,
        hex,
        cssVar: tokenNameToCssVar(n.name),
      });
      fromStyles++;
    });
  }

  return {
    swatchCount: groups.reduce((s, g) => s + g.swatches.length, 0),
    fromVariables,
    fromStyles,
  };
}
