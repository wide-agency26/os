/**
 * Hierarchy-aware Figma canvas ingest.
 *
 * Section  → Module
 * Frame    → Sub-Module  (exactly one ci_sections row)
 * *_Container → the visual export target (never the parent frame).
 *   Multiple containers on one frame become variants / do-dont items.
 */

import type { FigmaFileNode, FigmaFileResponse } from "@/lib/ci-builder/figma/client";
import { figmaColorToHex } from "@/lib/ci-builder/figma/client";
import type { CISection, SectionType } from "@/lib/ci-builder/types";
import { generateUUID } from "@/lib/ci-builder/types";
import { getSubModule } from "@/lib/ci-builder/modules-catalog";
import { appearanceFromBackground } from "@/lib/ci-builder/theme-css";
import {
  isContainerFrame,
  lookupCanvasFrame,
  matchCanvasModule,
  type CanvasFrameDef,
} from "@/lib/ci-builder/figma/canvas-map";
import { matchSectionType } from "@/lib/ci-builder/glossary";
import {
  ensureSection,
  makePendingAsset,
  wireVisualAsset,
  type PendingExport,
} from "./helpers";

function collectText(node: FigmaFileNode): string {
  const parts: string[] = [];
  const walk = (n: FigmaFileNode) => {
    if (n.type === "TEXT" && typeof n.characters === "string") {
      const t = n.characters.trim();
      if (t) parts.push(t);
    }
    for (const c of n.children || []) walk(c);
  };
  walk(node);
  return parts.join("\n");
}

function solidFillHex(node: FigmaFileNode): string | undefined {
  const fill = (node.fills || []).find(
    (f) => f?.type === "SOLID" && f.visible !== false && f.color
  );
  return fill?.color ? figmaColorToHex(fill.color) : undefined;
}

function inferStageFromNodes(
  ...nodes: Array<FigmaFileNode | undefined>
): "dark" | "light" | undefined {
  for (const n of nodes) {
    if (!n) continue;
    const hex = solidFillHex(n);
    if (hex) return appearanceFromBackground(hex);
  }
  return undefined;
}

function findContainers(frame: FigmaFileNode): FigmaFileNode[] {
  const wanted = `${frame.name}_Container`;
  const wantedLower = wanted.toLowerCase();
  const found: FigmaFileNode[] = [];

  const walk = (n: FigmaFileNode, depth: number) => {
    if (depth > 0) {
      if (isContainerFrame(n.name)) {
        found.push(n);
        return;
      }
      // Nested mapped sub-module frames are their own ingest targets.
      if (lookupCanvasFrame(n.name)) return;
    }
    for (const c of n.children || []) walk(c, depth + 1);
  };
  walk(frame, 0);

  const exact = found.filter(
    (n) => n.name === wanted || n.name.toLowerCase() === wantedLower
  );
  return exact.length ? exact : found;
}

function containerCaption(
  containerName: string,
  frameName: string,
  index: number,
  total: number
): string {
  const stripped = containerName.replace(/_Container$/i, "").trim();
  if (stripped && stripped.toLowerCase() !== frameName.toLowerCase()) {
    return stripped;
  }
  if (total > 1) return `${frameName} ${index + 1}`;
  return frameName;
}

/** YES / NO + instruction living inside each do/dont container. */
function captionFromContainer(
  container: FigmaFileNode,
  frameName: string,
  index: number,
  total: number
): string {
  const lines = collectText(container)
    .split(/\n+/)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((t) => !/^(yes|no|do|don't|dont)$/i.test(t));
  const instruction = lines.find((t) => t.length >= 12) || lines[0];
  if (instruction) return instruction;
  return containerCaption(container.name || "", frameName, index, total);
}

function inferDoDont(
  def: CanvasFrameDef,
  frameName: string
): "do" | "dont" | undefined {
  if (def.doDont) return def.doDont;
  if (def.sectionType !== "misuse_examples") return undefined;
  if (
    /correct\s*use|correct\s*usage|proper\s*use|good\s+example/i.test(frameName) &&
    !/don'?t|misuse|incorrect/i.test(frameName)
  ) {
    return "do";
  }
  if (/misuse|don'?t|incorrect|wrong|bad\s+example/i.test(frameName)) {
    return "dont";
  }
  return undefined;
}

/** True when a dropzone/container has real nested content (not an empty shell). */
export function containerHasContent(container: FigmaFileNode | null): boolean {
  if (!container) return false;
  const kids = container.children || [];
  if (kids.length === 0) return false;
  // Ignore pure empty nested frames with no descendants
  return kids.some((k) => {
    if (k.type === "TEXT" && (k.characters || "").trim()) return true;
    if (["VECTOR", "BOOLEAN_OPERATION", "ELLIPSE", "RECTANGLE", "LINE", "STAR", "POLYGON", "COMPONENT", "INSTANCE", "GROUP"].includes(k.type)) {
      return true;
    }
    if (k.type === "FRAME" || k.type === "SECTION") {
      return (k.children || []).length > 0 || Boolean(k.fills?.length);
    }
    return (k.children || []).length > 0;
  });
}

function collapseClearspaceNodes(nodes: FigmaFileNode[]): FigmaFileNode[] {
  if (nodes.length <= 1) return nodes;
  const generic = nodes.every((n) => /clear\s*space/i.test(n.name || ""));
  if (!generic) return nodes;
  return [
    nodes.reduce((best, n) => {
      const ba =
        (best.absoluteBoundingBox?.width || 0) *
        (best.absoluteBoundingBox?.height || 0);
      const na =
        (n.absoluteBoundingBox?.width || 0) * (n.absoluteBoundingBox?.height || 0);
      return na > ba ? n : best;
    }),
  ];
}

function applyTextData(
  sec: Partial<CISection>,
  sectionType: SectionType,
  text: string,
  columns?: { left?: string; right?: string }
) {
  if (!sec.data) sec.data = {};
  const def = getSubModule(sectionType);
  const renderer = def?.renderer;
  const trimmed = text.trim();
  if (!trimmed && !columns) return;

  switch (renderer) {
    case "text":
      sec.data.body = trimmed;
      break;
    case "claim_pitch": {
      const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      sec.data.claim = lines[0] || trimmed;
      sec.data.pitch = lines.slice(1).join("\n") || "";
      break;
    }
    case "list":
      sec.data.items = trimmed
        .split(/\n+/)
        .map((l) => l.replace(/^\d+\.\s*/, "").replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean)
        .map((title) => ({ id: generateUUID(), title, description: "" }));
      break;
    case "archetype": {
      const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      sec.data.archetype = lines[0] || trimmed;
      sec.data.traits = lines.slice(1).map((word) => ({
        id: generateUUID(),
        word,
      }));
      break;
    }
    case "dual_list": {
      const dos: { id: string; text: string }[] = [];
      const donts: { id: string; text: string }[] = [];
      const isDosHeader = (t: string) =>
        /^do['’]?s?\b/i.test(t) && !/^don/i.test(t);
      const isDontsHeader = (t: string) =>
        /^(don['’]?t?s?|never|avoid)\b/i.test(t);
      const stripHeader = (t: string) =>
        t
          .replace(/^(do['’]?s?|don['’]?t?s?|never|avoid)\b\s*:?\s*/i, "")
          .replace(/^[-•*]\s*/, "")
          .trim();
      const pushLine = (
        bucket: { id: string; text: string }[],
        t: string
      ) => {
        const cleaned = stripHeader(t) || t.replace(/^[-•*]\s*/, "").trim();
        if (cleaned) bucket.push({ id: generateUUID(), text: cleaned });
      };
      if (columns) {
        for (const line of (columns.left || "").split(/\n+/)) {
          const t = line.trim();
          if (t) pushLine(dos, t);
        }
        for (const line of (columns.right || "").split(/\n+/)) {
          const t = line.trim();
          if (t) pushLine(donts, t);
        }
        sec.data.dos = dos;
        sec.data.donts = donts;
        break;
      }
      let mode: "dos" | "donts" | null = null;
      for (const line of trimmed.split(/\n+/)) {
        const t = line.trim();
        if (!t) continue;
        if (isDosHeader(t)) {
          mode = "dos";
          const rest = stripHeader(t);
          if (rest) dos.push({ id: generateUUID(), text: rest });
          continue;
        }
        if (isDontsHeader(t)) {
          mode = "donts";
          const rest = stripHeader(t);
          if (rest) donts.push({ id: generateUUID(), text: rest });
          continue;
        }
        const cleaned = t.replace(/^[-•*]\s*/, "");
        if (!cleaned) continue;
        if (mode === "donts") donts.push({ id: generateUUID(), text: cleaned });
        else if (mode === "dos") dos.push({ id: generateUUID(), text: cleaned });
        else if (donts.length === 0) dos.push({ id: generateUUID(), text: cleaned });
      }
      sec.data.dos = dos;
      sec.data.donts = donts;
      break;
    }
    case "copy_examples": {
      const approved: { id: string; text: string }[] = [];
      const forbidden: { id: string; text: string }[] = [];
      let mode: "approved" | "forbidden" | null = null;
      for (const line of trimmed.split(/\n+/)) {
        const t = line.trim();
        if (/gutes?\s*beispiel|approved|good/i.test(t)) {
          mode = "approved";
          continue;
        }
        if (/schlechtes?\s*beispiel|forbidden|bad/i.test(t)) {
          mode = "forbidden";
          continue;
        }
        const cleaned = t.replace(/^[-•*]\s*/, "");
        if (!cleaned) continue;
        if (mode === "forbidden") forbidden.push({ id: generateUUID(), text: cleaned });
        else approved.push({ id: generateUUID(), text: cleaned });
      }
      sec.data.approved = approved;
      sec.data.forbidden = forbidden;
      break;
    }
    case "code":
      sec.data.prompt = trimmed;
      break;
    case "sliders":
      // Keep default axes; optionally stash raw notes
      sec.data.notes = trimmed;
      break;
    default:
      sec.data.body = trimmed;
  }
}

function findModuleSections(doc: FigmaFileNode): FigmaFileNode[] {
  const out: FigmaFileNode[] = [];
  const walk = (n: FigmaFileNode) => {
    if (n.type === "SECTION" && matchCanvasModule(n.name)) {
      out.push(n);
      return; // don't recurse into module section for nested sections
    }
    for (const c of n.children || []) walk(c);
  };
  walk(doc);
  return out;
}

/**
 * Fallback: when the file has no SECTION nodes (flat export), treat
 * top-level page frames that match known sub-module names as candidates.
 */
function findLooseSubModuleFrames(doc: FigmaFileNode): {
  frame: FigmaFileNode;
  moduleId: string | null;
  uiModule: boolean;
}[] {
  const out: { frame: FigmaFileNode; moduleId: string | null; uiModule: boolean }[] = [];
  const pages = (doc.children || []).filter((c) => c.type === "PAGE" || c.type === "CANVAS");
  const roots = pages.length ? pages : [doc];

  for (const root of roots) {
    for (const child of root.children || []) {
      if (child.type === "SECTION") continue;
      if (child.type !== "FRAME" && child.type !== "COMPONENT") continue;
      if (isContainerFrame(child.name)) continue;
      if (lookupCanvasFrame(child.name)) {
        out.push({ frame: child, moduleId: null, uiModule: false });
      }
    }
  }
  return out;
}

function resolveFrameDef(
  name: string,
  moduleId?: string | null
): CanvasFrameDef | null {
  const exact = lookupCanvasFrame(name, moduleId);
  if (exact) return exact;
  // Glossary fallback for renamed frames — only accept catalog sub-modules
  const match = matchSectionType(name);
  if (match.type && getSubModule(match.type)) {
    const st = match.type;
    const renderer = getSubModule(st)?.renderer;
    const kind: CanvasFrameDef["kind"] =
      renderer === "text" ||
      renderer === "claim_pitch" ||
      renderer === "list" ||
      renderer === "archetype" ||
      renderer === "dual_list" ||
      renderer === "copy_examples" ||
      renderer === "code" ||
      renderer === "sliders"
        ? "text"
        : st === "fallback_fonts"
          ? "typography_families"
          : st === "typography_scale"
            ? "typography_scale"
            : st.startsWith("color_") ||
                st === "hex" ||
                st === "rgb" ||
                st === "cmyk" ||
                st === "functional" ||
                st === "wcag_contrast"
              ? "color"
              : st.startsWith("ui_") ||
                st === "interactive_states" ||
                st === "form_controls" ||
                st === "status_badges" ||
                st === "layout_containers"
              ? "ui"
              : "visual";
    return { sectionType: st as CanvasFrameDef["sectionType"], kind };
  }
  return null;
}

export function ingestCanvasHierarchy(opts: {
  file: FigmaFileResponse;
  sections: Partial<CISection>[];
}): {
  pendings: PendingExport[];
  assigned: number;
  unassigned: number;
  skippedEmptyUi: number;
  subModules: number;
} {
  const { file, sections } = opts;
  const pendings: PendingExport[] = [];
  let assigned = 0;
  let unassigned = 0;
  let skippedEmptyUi = 0;
  let subModules = 0;
  const seenSectionTypes = new Set<string>();

  const processFrame = (
    frame: FigmaFileNode,
    ctx: { uiModule: boolean; moduleId: string | null }
  ) => {
    if (isContainerFrame(frame.name)) return;

    const def = resolveFrameDef(frame.name, ctx.moduleId);
    if (!def) {
      unassigned++;
      if (containerHasContent(frame)) {
        pendings.push({
          nodeId: frame.id,
          label: frame.name,
          sectionType: "unmatched",
          kind: "unmatched",
          assetId: generateUUID(),
        });
      }
      return;
    }

    subModules++;
    const containers = findContainers(frame);
    const hasContent =
      containers.some((c) => containerHasContent(c)) ||
      (containers.length === 0 && containerHasContent(frame));

    if (def.kind === "skip") {
      unassigned++;
      if (hasContent) {
        const node = containers[0] || frame;
        pendings.push({
          nodeId: node.id,
          label: frame.name,
          sectionType: "unmatched",
          kind: "unmatched",
          assetId: generateUUID(),
        });
      }
      return;
    }

    if ((def.kind === "ui" || ctx.uiModule) && def.kind !== "text") {
      if (!hasContent) {
        skippedEmptyUi++;
        return;
      }
    }

    const sec = ensureSection(sections, def.sectionType, file.name);

    if (def.kind === "text") {
      const renderer = getSubModule(def.sectionType)?.renderer;
      if (renderer === "dual_list" && containers.length === 2) {
        applyTextData(sec, def.sectionType, "", {
          left: collectText(containers[0]),
          right: collectText(containers[1]),
        });
      } else {
        const text = containers.length
          ? containers.map(collectText).filter(Boolean).join("\n")
          : collectText(frame);
        applyTextData(sec, def.sectionType, text);
      }
      assigned++;
      seenSectionTypes.add(def.sectionType);
      return;
    }

    if (def.kind === "typography_families" || def.kind === "typography_scale" || def.kind === "color") {
      // Color hexes / type tokens are filled by normalizeColors / normalizeTypography
      // from fills, styles, and variables — not by exporting the frame as an image.
      assigned++;
      seenSectionTypes.add(def.sectionType);
      return;
    }

    if (def.kind === "visual" && containers.length === 0 && !hasContent) {
      assigned++;
      seenSectionTypes.add(def.sectionType);
      return;
    }

    // Multiple top-level frames may feed the same section (Correct Use + Misuse,
    // several Clear Space_Container variants, photography ratios, two Image Marks).
    const allowMulti =
      def.sectionType === "photography_style" ||
      def.sectionType === "brand_photography" ||
      def.sectionType === "misuse_examples" ||
      def.sectionType === "presentation_deck" ||
      def.sectionType === "logo_marks" ||
      def.sectionType === "image_mark" ||
      def.sectionType === "social_4x5" ||
      def.sectionType === "social_9x16" ||
      def.sectionType === "email_signatures" ||
      def.sectionType === "ui_primary" ||
      def.sectionType === "form_controls";

    if (seenSectionTypes.has(def.sectionType) && !allowMulti) {
      return;
    }
    seenSectionTypes.add(def.sectionType);

    // Never fall back to the parent while any *_Container exists — even if
    // REST omitted nested children and the content heuristic looks empty.
    let exportNodes = containers.length > 0 ? containers : [frame];
    if (def.sectionType === "clear_space") {
      exportNodes = collapseClearspaceNodes(exportNodes);
    }
    const doDont = inferDoDont(def, frame.name);

    for (let i = 0; i < exportNodes.length; i++) {
      const node = exportNodes[i];
      const assetId = generateUUID();
      const label = node.name || frame.name;
      const caption =
        def.sectionType === "misuse_examples"
          ? captionFromContainer(node, frame.name, i, exportNodes.length)
          : containerCaption(label, frame.name, i, exportNodes.length);
      pendings.push({
        nodeId: node.id,
        label,
        sectionType: def.sectionType,
        kind: def.sectionType,
        assetId,
        preferSvg: def.preferSvg,
        doDont,
        caption,
      });
      wireVisualAsset(sec, def.sectionType, assetId, label, {
        doDont,
        caption,
        stage: inferStageFromNodes(node, frame),
        groupLabel: def.logoMarkName,
        isMain: def.logoIsMain,
      });
      assigned++;
    }
  };

  const moduleSections = findModuleSections(file.document);

  if (moduleSections.length > 0) {
    for (const modSec of moduleSections) {
      const modMeta = matchCanvasModule(modSec.name);
      const uiModule = Boolean(modMeta?.uiModule);
      for (const child of modSec.children || []) {
        if (child.type !== "FRAME" && child.type !== "COMPONENT" && child.type !== "COMPONENT_SET") {
          continue;
        }
        processFrame(child, {
          uiModule,
          moduleId: modMeta?.moduleId || null,
        });
      }
    }
  } else {
    for (const loose of findLooseSubModuleFrames(file.document)) {
      processFrame(loose.frame, {
        uiModule: loose.uiModule,
        moduleId: loose.moduleId,
      });
    }
  }

  return { pendings, assigned, unassigned, skippedEmptyUi, subModules };
}

export function pendingsToAssets(
  pendings: PendingExport[],
  sections: Partial<CISection>[]
) {
  return pendings.map((p) => {
    const sec = sections.find((s) => s.section_type === p.sectionType);
    return makePendingAsset(p, sec?.id || null);
  });
}
