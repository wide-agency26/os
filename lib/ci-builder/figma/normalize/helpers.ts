import type { SectionType, CISection, CIAsset } from "@/lib/ci-builder/types";
import { generateUUID } from "@/lib/ci-builder/types";
import { CI_GLOSSARY } from "@/lib/ci-builder/glossary";
import {
  defaultDataForSubModule,
  getSubModule,
} from "@/lib/ci-builder/modules-catalog";

export function defaultDataFor(type: SectionType): Record<string, unknown> {
  if (getSubModule(type)) {
    return defaultDataForSubModule(type);
  }
  switch (type) {
    case "logo":
      return { logos: [], minSizes: [] };
    case "colors":
      return { groups: [] };
    case "typography":
      return { rows: [], scale: [] };
    case "buttons":
      return { samples: [] };
    case "grid_frames":
      return { frames: [] };
    case "backgrounds":
      return { groups: [] };
    case "applications":
      return { apps: [] };
    case "dos_donts":
      return { items: [] };
    case "overview":
      return { leadParagraph: "", stats: [], tonalityCards: [] };
    case "imagery":
      return { rules: [] };
    case "voice_tone":
      return { marqueeWords: [], doPhrases: [], dontPhrases: [] };
    default:
      return {};
  }
}

export function ensureSection(
  sections: Partial<CISection>[],
  type: SectionType,
  fileName?: string
): Partial<CISection> {
  let sec = sections.find((s) => s.section_type === type);
  if (sec) {
    if (!sec.data) sec.data = defaultDataFor(type);
    return sec;
  }
  const glossary = CI_GLOSSARY.find((g) => g.section_type === type);
  sec = {
    id: generateUUID(),
    section_type: type,
    position: sections.length,
    eyebrow_label: glossary?.eyebrow_label || type,
    headline: glossary?.default_headline || type,
    headline_emphasis: null,
    description: fileName
      ? `Imported from Figma file “${fileName}”. Review before publishing.`
      : "Imported from Figma. Review before publishing.",
    is_visible: true,
    data: defaultDataFor(type),
  };
  sections.push(sec);
  return sec;
}

export function walkNodes(
  node: { children?: any[]; type?: string; id?: string; name?: string },
  visit: (n: any) => void
) {
  visit(node);
  for (const child of node.children || []) walkNodes(child, visit);
}

export function aspectRatioLabel(w?: number, h?: number): string | undefined {
  if (!w || !h || w <= 0 || h <= 0) return undefined;
  const r = w / h;
  if (Math.abs(r - 1) < 0.05) return "1:1";
  if (Math.abs(r - 16 / 9) < 0.08) return "16:9";
  if (Math.abs(r - 9 / 16) < 0.08) return "9:16";
  if (Math.abs(r - 4 / 5) < 0.08) return "4:5";
  if (Math.abs(r - 5 / 4) < 0.08) return "5:4";
  if (Math.abs(r - 3 / 2) < 0.08) return "3:2";
  if (Math.abs(r - 2 / 3) < 0.08) return "2:3";
  return `${Math.round(w)}×${Math.round(h)}`;
}

export type PendingExport = {
  nodeId: string;
  label: string;
  sectionType: SectionType;
  kind: string;
  assetId: string;
  preferSvg?: boolean;
  stage?: "dark" | "light" | "any";
  groupLabel?: string;
  caption?: string;
  doDont?: "do" | "dont";
};

export function makePendingAsset(
  pending: PendingExport,
  sectionId: string | null
): Partial<CIAsset> {
  return {
    id: pending.assetId,
    section_id: sectionId,
    kind: pending.kind,
    storage_path: `figma://${pending.nodeId}`,
    public_url: "",
    label: pending.label,
    caption: pending.caption || null,
    metadata: {
      figma_node_id: pending.nodeId,
      pending_export: true,
      prefer_svg: pending.preferSvg || false,
      import_source: "figma",
      section_type: pending.sectionType,
      stage: pending.stage,
      group_label: pending.groupLabel,
      do_dont: pending.doDont,
    },
    sort_order: 0,
  };
}
