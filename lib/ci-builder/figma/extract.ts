/**
 * Extract a shallow tree from a Figma file for P1 preview + section suggestions.
 * Respects canvas hierarchy: Section → Sub-Module Frame (ignores *_Container children).
 */

import type { FigmaFileNode, FigmaFileResponse } from "@/lib/ci-builder/figma/client";
import { matchSectionType, CI_GLOSSARY } from "@/lib/ci-builder/glossary";
import type { SectionType, CISection, CIAsset } from "@/lib/ci-builder/types";
import { generateUUID } from "@/lib/ci-builder/types";
import type { ParseResult } from "@/lib/ci-builder/parser";
import { defaultDataFor } from "@/lib/ci-builder/figma/normalize/helpers";
import {
  isContainerFrame,
  lookupCanvasFrame,
  matchCanvasModule,
} from "@/lib/ci-builder/figma/canvas-map";

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

function classifyName(name: string): {
  section: SectionType | null;
  confidence: "mapped" | "suggested" | "unmapped";
  reason?: string;
} {
  if (isContainerFrame(name)) {
    return { section: null, confidence: "unmapped", reason: "Container wrapper (skipped)" };
  }
  const canvas = lookupCanvasFrame(name);
  if (canvas) {
    return {
      section: canvas.sectionType,
      confidence: "mapped",
      reason: "Canvas generator frame map",
    };
  }
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

function collectSubModuleFrames(doc: FigmaFileNode): FigmaFileNode[] {
  const out: FigmaFileNode[] = [];

  const walkSections = (n: FigmaFileNode) => {
    if (n.type === "SECTION" && matchCanvasModule(n.name)) {
      for (const child of n.children || []) {
        if (
          (child.type === "FRAME" ||
            child.type === "COMPONENT" ||
            child.type === "COMPONENT_SET") &&
          !isContainerFrame(child.name)
        ) {
          out.push(child);
        }
      }
      return;
    }
    for (const c of n.children || []) walkSections(c);
  };
  walkSections(doc);

  if (out.length === 0) {
    // Flat fallback: page-level frames that match the canvas map
    const pages = (doc.children || []).filter(
      (c) => c.type === "PAGE" || c.type === "CANVAS"
    );
    for (const page of pages.length ? pages : [doc]) {
      for (const child of page.children || []) {
        if (
          (child.type === "FRAME" || child.type === "COMPONENT") &&
          !isContainerFrame(child.name) &&
          lookupCanvasFrame(child.name)
        ) {
          out.push(child);
        }
      }
    }
  }

  return out;
}

function toTree(node: FigmaFileNode, depth: number): FigmaTreeNode {
  const { section, confidence } = classifyName(node.name);
  const children =
    depth > 0 && node.children
      ? node.children
          .filter(
            (c) =>
              ["PAGE", "FRAME", "COMPONENT", "COMPONENT_SET", "SECTION"].includes(
                c.type
              ) && !isContainerFrame(c.name)
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
  const subFrames = collectSubModuleFrames(file.document);

  const pages = (file.document.children || [])
    .filter((c) => c.type === "PAGE")
    .map((p) => toTree(p, 2));

  const items = subFrames.map((n) => {
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
    frameCount: subFrames.length,
    componentCount: Object.keys(file.components || {}).length,
    styleCount: Object.keys(file.styles || {}).length,
    pages,
    items,
  };
}

/**
 * P1 normalize: create section shells for confidently mapped sub-modules only.
 * Does NOT create phantom asset rows for containers or missing binaries.
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
    if (
      (item.confidence === "mapped" || item.confidence === "suggested") &&
      item.targetSection
    ) {
      ensureSection(item.targetSection);
      assigned++;
      // No phantom asset rows in P1 — full pipeline exports parent frames later
    } else {
      unassigned++;
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
      missingFiles: 0,
      detectedNameKeys: ["name"],
      detectedFileKeys: [],
      missingFileRows: [],
      message: `Figma extract: ${summary.pageCount} pages, ${summary.frameCount} sub-module frames, ${summary.componentCount} components, ${summary.styleCount} styles.`,
    },
  };
}
