/**
 * Extract a shallow tree from a Figma file for P1 preview + section suggestions.
 */

import type { FigmaFileNode, FigmaFileResponse } from "@/lib/ci-builder/figma/client";
import { matchSectionType, CI_GLOSSARY } from "@/lib/ci-builder/glossary";
import type { SectionType, CISection, CIAsset } from "@/lib/ci-builder/types";
import { generateUUID } from "@/lib/ci-builder/types";
import type { ParseResult } from "@/lib/ci-builder/parser";
import { defaultDataFor } from "@/lib/ci-builder/figma/normalize/helpers";

export type FigmaTreeNode = {
  id: string;
  name: string;
  type: string;
  sectionHint: SectionType | null;
  confidence: "mapped" | "suggested" | "unmapped";
  children?: FigmaTreeNode[];
};

export type FigmaExtractSummary = {
  fileName: string;
  version: string | null;
  lastModified: string | null;
  pageCount: number;
  frameCount: number;
  componentCount: number;
  styleCount: number;
  pages: FigmaTreeNode[];
  items: {
    sourceId: string;
    sourceName: string;
    targetSection: SectionType | null;
    confidence: "mapped" | "suggested" | "unmapped";
    reason?: string;
  }[];
};

function walkRelevant(
  node: FigmaFileNode,
  out: { id: string; name: string; type: string }[],
  depth: number
) {
  const interesting = ["PAGE", "FRAME", "COMPONENT", "COMPONENT_SET", "SECTION"];
  if (interesting.includes(node.type)) {
    out.push({ id: node.id, name: node.name, type: node.type });
  }
  if (depth <= 0 || !node.children) return;
  for (const child of node.children) {
    walkRelevant(child, out, depth - 1);
  }
}

function classifyName(name: string): {
  section: SectionType | null;
  confidence: "mapped" | "suggested" | "unmapped";
  reason?: string;
} {
  const match = matchSectionType(name);
  if (match.type) {
    return {
      section: match.type,
      confidence:
        match.match_method === "exact" || match.match_method === "synonym"
          ? "mapped"
          : "suggested",
      reason: `Matched via ${match.match_method}`,
    };
  }
  return { section: null, confidence: "unmapped", reason: "No glossary match" };
}

function toTree(node: FigmaFileNode, depth: number): FigmaTreeNode {
  const { section, confidence } = classifyName(node.name);
  const children =
    depth > 0 && node.children
      ? node.children
          .filter((c) =>
            ["PAGE", "FRAME", "COMPONENT", "COMPONENT_SET", "SECTION"].includes(c.type)
          )
          .slice(0, 40)
          .map((c) => toTree(c, depth - 1))
      : undefined;
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    sectionHint: section,
    confidence: section ? confidence : "unmapped",
    children,
  };
}

export function extractFigmaSummary(file: FigmaFileResponse): FigmaExtractSummary {
  const flat: { id: string; name: string; type: string }[] = [];
  walkRelevant(file.document, flat, 4);

  const pages = (file.document.children || [])
    .filter((c) => c.type === "PAGE")
    .map((p) => toTree(p, 2));

  const items = flat
    .filter((n) => n.type === "FRAME" || n.type === "COMPONENT" || n.type === "COMPONENT_SET")
    .map((n) => {
      const c = classifyName(n.name);
      return {
        sourceId: n.id,
        sourceName: n.name,
        targetSection: c.section,
        confidence: c.confidence,
        reason: c.reason,
      };
    });

  return {
    fileName: file.name,
    version: file.version || null,
    lastModified: file.lastModified || null,
    pageCount: pages.length,
    frameCount: flat.filter((n) => n.type === "FRAME").length,
    componentCount: Object.keys(file.components || {}).length || flat.filter((n) => n.type === "COMPONENT" || n.type === "COMPONENT_SET").length,
    styleCount: Object.keys(file.styles || {}).length,
    pages,
    items,
  };
}

/**
 * P1 normalize: create section shells for confidently mapped types,
 * leave visual assets for later phases (no image upload yet).
 */
export function figmaSummaryToParseResult(
  summary: FigmaExtractSummary,
  existingSections: Partial<CISection>[] = []
): ParseResult {
  const sections = [...existingSections];
  const assets: Partial<CIAsset>[] = [];

  const ensureSection = (type: SectionType) => {
    let sec = sections.find((s) => s.section_type === type);
    if (sec) return sec;
    const glossary = CI_GLOSSARY.find((g) => g.section_type === type);
    sec = {
      id: generateUUID(),
      section_type: type,
      position: sections.length,
      eyebrow_label: glossary?.eyebrow_label || type,
      headline: glossary?.default_headline || type,
      headline_emphasis: null,
      description: `Imported structure from Figma file “${summary.fileName}”. Review and fill content.`,
      is_visible: true,
      data: defaultDataFor(type),
    };
    sections.push(sec);
    return sec;
  };

  let assigned = 0;
  let unassigned = 0;

  for (const item of summary.items) {
    if (item.confidence === "mapped" && item.targetSection) {
      // Skip admin-only sections
      if (["overview", "imagery", "voice_tone"].includes(item.targetSection)) {
        unassigned++;
        continue;
      }
      const sec = ensureSection(item.targetSection);
      assigned++;
      // Placeholder asset row (no binary yet) for review queue / future export
      assets.push({
        id: generateUUID(),
        section_id: sec.id || null,
        kind: "figma_frame",
        storage_path: `figma://${item.sourceId}`,
        public_url: "",
        label: item.sourceName,
        caption: null,
        metadata: {
          match_method: "exact",
          figma_node_id: item.sourceId,
          import_confidence: item.confidence,
          pending_export: true,
        },
        sort_order: assets.length,
      });
    } else if (item.confidence === "suggested" && item.targetSection) {
      const sec = ensureSection(item.targetSection);
      assigned++;
      assets.push({
        id: generateUUID(),
        section_id: sec.id || null,
        kind: "figma_frame",
        storage_path: `figma://${item.sourceId}`,
        public_url: "",
        label: item.sourceName,
        caption: null,
        metadata: {
          match_method: "substring",
          figma_node_id: item.sourceId,
          import_confidence: "suggested",
          pending_export: true,
        },
        sort_order: assets.length,
      });
    } else {
      unassigned++;
      assets.push({
        id: generateUUID(),
        section_id: null,
        kind: "figma_frame",
        storage_path: `figma://${item.sourceId}`,
        public_url: "",
        label: item.sourceName,
        caption: null,
        metadata: {
          match_method: null,
          figma_node_id: item.sourceId,
          import_confidence: "unmapped",
          pending_export: true,
          reason: item.reason,
        },
        sort_order: assets.length,
      });
    }
  }

  return {
    sections,
    assets,
    themeSuggested: {},
    report: {
      format: "items_manifest",
      totalItems: summary.items.length,
      assignedCount: assigned,
      unassignedCount: unassigned,
      missingFiles: assets.filter((a) => !a.public_url).length,
      detectedNameKeys: ["name"],
      detectedFileKeys: [],
      missingFileRows: assets
        .filter((a) => a.metadata?.pending_export)
        .map((a) => a.label || "")
        .slice(0, 50),
      message: `Figma P1 extract: ${summary.pageCount} pages, ${summary.frameCount} frames, ${summary.componentCount} components, ${summary.styleCount} styles. Colors/typography/assets full import arrives in P2–P3.`,
    },
  };
}
