import type { SectionType, CISection, CIAsset } from "@/lib/ci-builder/types";
import { generateUUID } from "@/lib/ci-builder/types";
import { CI_GLOSSARY } from "@/lib/ci-builder/glossary";
import {
  defaultDataForSubModule,
  getSubModule,
} from "@/lib/ci-builder/modules-catalog";
import { defaultClientDescription } from "@/lib/ci-builder/section-copy";

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
    description: defaultClientDescription(type),
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

export function classifyDoDont(label: string): "do" | "dont" {
  if (
    /correct\s*use|correct\s*usage|proper\s*use|good\s+example/i.test(label) &&
    !/don'?t|do-not|misuse|incorrect/i.test(label)
  ) {
    return "do";
  }
  if (
    /dont|don't|do-not|incorrect|falsch|verboten|wrong|misuse|not\s+to\b|bad\s+example/i.test(
      label
    )
  ) {
    return "dont";
  }
  return "do";
}

/** Wire an imported Figma visual into a catalog sub-module section's data payload. */
export function wireVisualAsset(
  sec: Partial<CISection>,
  sectionType: SectionType,
  assetId: string,
  label: string,
  opts?: {
    stage?: "dark" | "light" | "any";
    doDont?: "do" | "dont";
    groupLabel?: string;
    aspectRatio?: string;
    caption?: string;
    isMain?: boolean;
  }
): void {
  if (!sec.data) sec.data = defaultDataFor(sectionType);
  const def = getSubModule(sectionType);
  const renderer = def?.renderer;
  const shortLabel = label.split("/").pop()?.trim() || label;

  if (renderer === "logo_mark_list") {
    const marks = Array.isArray(sec.data.marks) ? [...sec.data.marks] : [];
    const name = opts?.groupLabel || shortLabel;
    const existing = marks.find((m: any) => String(m.name).toLowerCase() === name.toLowerCase());
    if (existing) {
      if (opts?.stage === "dark") existing.darkAssetId = assetId;
      else existing.lightAssetId = assetId;
      if (opts?.isMain) {
        for (const m of marks) m.isMain = m === existing;
      }
    } else {
      marks.push({
        id: generateUUID(),
        name,
        isMain: Boolean(opts?.isMain) || /primary/i.test(name),
        lightAssetId: opts?.stage === "dark" ? undefined : assetId,
        darkAssetId: opts?.stage === "dark" ? assetId : undefined,
        sortOrder: marks.length,
      });
    }
    sec.data.marks = marks;
    return;
  }

  if (sectionType === "social_4x5" || sectionType === "social_9x16") {
    if (!Array.isArray(sec.data.items)) sec.data.items = [];
    sec.data.items.push({
      id: generateUUID(),
      label: shortLabel,
      dims: sectionType === "social_4x5" ? "1080×1350" : "1080×1920",
      assetId,
    });
    return;
  }

  if (renderer === "ui_buttons") {
    if (!Array.isArray(sec.data.variants)) sec.data.variants = [];
    sec.data.variants.push({
      id: generateUUID(),
      label: shortLabel,
      assetId,
    });
    return;
  }

  if (renderer === "ui_form_controls") {
    if (!Array.isArray(sec.data.controls)) sec.data.controls = [];
    sec.data.controls.push({
      id: generateUUID(),
      label: shortLabel,
      assetId,
    });
    return;
  }

  if (renderer === "ui_states") {
    const lower = shortLabel.toLowerCase();
    if (/error/.test(lower)) {
      sec.data.errorAssetId = assetId;
      if (!sec.data.errorTitle) sec.data.errorTitle = shortLabel;
    } else {
      sec.data.emptyAssetId = assetId;
      if (!sec.data.emptyTitle) sec.data.emptyTitle = shortLabel;
    }
    return;
  }

  if (renderer === "email_sig") {
    if (!Array.isArray(sec.data.signatures)) sec.data.signatures = [];
    sec.data.signatures.push({
      id: generateUUID(),
      name: shortLabel,
      title: "",
      assetId,
    });
    if (!sec.data.assetId) sec.data.assetId = assetId;
    return;
  }

  if (sectionType === "brand_photography") {
    if (!Array.isArray(sec.data.items)) sec.data.items = [];
    sec.data.items.push({
      id: generateUUID(),
      caption: opts?.caption || shortLabel,
      assetId,
    });
    return;
  }

  if (
    renderer === "image_slot" ||
    renderer === "clearspace" ||
    renderer === "ui_button" ||
    renderer === "container_spec"
  ) {
    if (!sec.data.assetId) {
      sec.data.assetId = assetId;
      sec.data.label = shortLabel;
      if (opts?.stage) sec.data.stage = opts.stage;
    } else {
      const variants = Array.isArray(sec.data.variants)
        ? [...sec.data.variants]
        : [
            {
              id: "main",
              assetId: sec.data.assetId,
              label: sec.data.label || "",
            },
          ];
      variants.push({ id: generateUUID(), assetId, label: shortLabel });
      sec.data.variants = variants;
    }
    return;
  }

  if (renderer === "image_dual") {
    if (!sec.data.items) sec.data.items = [];
    const inferred = opts?.doDont || classifyDoDont(label);
    const caption =
      opts?.caption ||
      label
        .replace(/_Container$/i, "")
        .replace(/^(do|dont|don't|misuse|correct\s*use)[/\-_\s]*/i, "")
        .trim() ||
      label;
    sec.data.items.push({
      id: generateUUID(),
      type: inferred,
      assetId,
      caption,
    });
    return;
  }

  if (renderer === "deck") {
    if (!sec.data.slides) sec.data.slides = [];
    sec.data.slides.push({
      id: generateUUID(),
      label: shortLabel,
      assetId,
    });
    return;
  }

  if (renderer === "icon_set") {
    if (!sec.data.icons) sec.data.icons = [];
    sec.data.icons.push({
      id: generateUUID(),
      assetId,
      label: shortLabel,
    });
    return;
  }
}

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
