import type { FigmaFileResponse } from "@/lib/ci-builder/figma/client";
import { matchSectionType } from "@/lib/ci-builder/glossary";
import { generateUUID } from "@/lib/ci-builder/types";
import type { CISection, ButtonSample, StateColors } from "@/lib/ci-builder/types";
import {
  ensureSection,
  walkNodes,
  makePendingAsset,
  type PendingExport,
} from "./helpers";
import { figmaColorToHex } from "@/lib/ci-builder/figma/client";
import {
  ingestCanvasHierarchy,
  pendingsToAssets as hierarchyPendingsToAssets,
} from "./hierarchy";

function solidFillHex(node: any): string | undefined {
  const fill = (node.fills || []).find(
    (f: any) => f?.type === "SOLID" && f.visible !== false && f.color
  );
  return fill?.color ? figmaColorToHex(fill.color) : undefined;
}

function solidStrokeHex(node: any): string | undefined {
  const stroke = (node.strokes || []).find(
    (f: any) => f?.type === "SOLID" && f.visible !== false && f.color
  );
  return stroke?.color ? figmaColorToHex(stroke.color) : undefined;
}

function textColorHex(node: any): string | undefined {
  let found: string | undefined;
  walkNodes(node, (n) => {
    if (found || n.type !== "TEXT") return;
    found = solidFillHex(n);
  });
  return found;
}

/**
 * Legacy button sample extraction — only used as a soft enrichment
 * after hierarchy ingest. Does not create duplicate section assets.
 */
export function normalizeButtons(opts: {
  file: FigmaFileResponse;
  sections: Partial<CISection>[];
}): { sampleCount: number } {
  const { file, sections } = opts;
  // Prefer catalog ui_primary if present; otherwise legacy buttons section
  const btnSec =
    sections.find((s) => s.section_type === "ui_primary") ||
    ensureSection(sections, "buttons", file.name);

  if (!btnSec.data) btnSec.data = {};
  if (!btnSec.data.samples) btnSec.data.samples = [];
  const samples: ButtonSample[] = btnSec.data.samples;
  if (samples.length > 0) return { sampleCount: samples.length };

  const buttonNodes: any[] = [];
  walkNodes(file.document, (n) => {
    if (n.type !== "COMPONENT" && n.type !== "INSTANCE") return;
    const name = n.name || "";
    if (!/button|btn|cta|knopf/i.test(name)) return;
    buttonNodes.push(n);
  });

  const byVariant = new Map<string, any[]>();
  for (const n of buttonNodes) {
    const base =
      n.name?.split("=")[0]?.split("/")[0]?.trim() ||
      n.name?.replace(/\s*(hover|pressed|active|default|disabled).*/i, "").trim() ||
      "Button";
    const list = byVariant.get(base) || [];
    list.push(n);
    byVariant.set(base, list);
  }

  for (const [variantName, nodes] of byVariant) {
    if (samples.length >= 12) break;
    const def =
      nodes.find((n) => /default|=default|idle/i.test(n.name)) || nodes[0];
    const hover = nodes.find((n) => /hover/i.test(n.name));
    const active = nodes.find((n) => /active|pressed|click/i.test(n.name));

    const toState = (n: any | undefined): StateColors | undefined => {
      if (!n) return undefined;
      return {
        bg: solidFillHex(n),
        text: textColorHex(n) || "#ffffff",
        border: solidStrokeHex(n),
      };
    };

    const variantKey = /secondary|outline|ghost|tab/i.test(variantName)
      ? /ghost/i.test(variantName)
        ? "ghost"
        : /tab/i.test(variantName)
          ? "tab"
          : "secondary"
      : "primary";

    if (samples.some((s) => s.label === variantName)) continue;

    samples.push({
      id: generateUUID(),
      variant: variantKey,
      label: variantName.slice(0, 40) || "Button",
      size: "md",
      defaultColors: toState(def),
      hoverColors: toState(hover),
      activeColors: toState(active),
    });
  }

  return { sampleCount: samples.length };
}

/**
 * Primary visual ingest — hierarchy-aware (Section → Frame → Container).
 * Replaces the old deep walk that fractured parent frames into child assets.
 */
export function collectVisualPendings(opts: {
  file: FigmaFileResponse;
  sections: Partial<CISection>[];
}): {
  pendings: PendingExport[];
  assigned: number;
  unassigned: number;
  skippedEmptyUi: number;
  subModules: number;
} {
  return ingestCanvasHierarchy(opts);
}

export function pendingsToAssets(
  pendings: PendingExport[],
  sections: Partial<CISection>[]
) {
  return hierarchyPendingsToAssets(pendings, sections);
}

// Re-export for callers that still import makePendingAsset path helpers
export { makePendingAsset };
