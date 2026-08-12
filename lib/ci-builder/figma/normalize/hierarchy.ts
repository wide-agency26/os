/**
 * Hierarchy-aware Figma canvas ingest.
 *
 * Section  → Module
 * Frame    → Sub-Module  (exactly one ci_sections row)
 * *_Container → data/asset shell only — never its own asset/section
 */

import type { FigmaFileNode, FigmaFileResponse } from "@/lib/ci-builder/figma/client";
import type { CISection, SectionType } from "@/lib/ci-builder/types";
import { generateUUID } from "@/lib/ci-builder/types";
import { getSubModule } from "@/lib/ci-builder/modules-catalog";
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

function findContainer(frame: FigmaFileNode): FigmaFileNode | null {
  const kids = frame.children || [];
  const exact = kids.find(
    (c) => c.name === `${frame.name}_Container` || isContainerFrame(c.name)
  );
  return exact || null;
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

function applyTextData(sec: Partial<CISection>, sectionType: SectionType, text: string) {
  if (!sec.data) sec.data = {};
  const def = getSubModule(sectionType);
  const renderer = def?.renderer;
  const trimmed = text.trim();
  if (!trimmed) return;

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
        .map((label) => ({ id: generateUUID(), label }));
      break;
    case "archetype": {
      const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      sec.data.archetype = lines[0] || trimmed;
      sec.data.traits = lines.slice(1);
      break;
    }
    case "dual_list": {
      const dos: string[] = [];
      const donts: string[] = [];
      let mode: "dos" | "donts" | null = null;
      for (const line of trimmed.split(/\n+/)) {
        const t = line.trim();
        if (/^dos?:/i.test(t)) {
          mode = "dos";
          const rest = t.replace(/^dos?:/i, "").trim();
          if (rest) dos.push(rest.replace(/^[-•*]\s*/, ""));
          continue;
        }
        if (/^don'?ts?:/i.test(t)) {
          mode = "donts";
          const rest = t.replace(/^don'?ts?:/i, "").trim();
          if (rest) donts.push(rest.replace(/^[-•*]\s*/, ""));
          continue;
        }
        const cleaned = t.replace(/^[-•*]\s*/, "");
        if (!cleaned) continue;
        if (mode === "donts") donts.push(cleaned);
        else dos.push(cleaned);
      }
      sec.data.dos = dos;
      sec.data.donts = donts;
      break;
    }
    case "copy_examples": {
      const approved: string[] = [];
      const forbidden: string[] = [];
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
        if (mode === "forbidden") forbidden.push(cleaned);
        else approved.push(cleaned);
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

function resolveFrameDef(name: string): CanvasFrameDef | null {
  const exact = lookupCanvasFrame(name);
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
    ctx: { uiModule: boolean }
  ) => {
    if (isContainerFrame(frame.name)) return;

    const def = resolveFrameDef(frame.name);
    if (!def) {
      // Unmapped top-level frame — do NOT descend into children (avoids fractured assets)
      unassigned++;
      return;
    }

    subModules++;
    const container = findContainer(frame);
    const hasContent = containerHasContent(container);

    // Empty UI Element frames: skip entirely
    if ((def.kind === "ui" || ctx.uiModule) && def.kind !== "text") {
      if (!hasContent) {
        skippedEmptyUi++;
        return;
      }
    }

    // Visual / logo dropzones that are still empty: create section shell only, no broken asset
    const sec = ensureSection(sections, def.sectionType, file.name);

    if (def.kind === "text") {
      const text = collectText(container || frame);
      applyTextData(sec, def.sectionType, text);
      assigned++;
      seenSectionTypes.add(def.sectionType);
      return;
    }

    if (def.kind === "typography_families" || def.kind === "typography_scale") {
      // Typography data is filled by normalizeTypography from styles/variables.
      // Still ensure the section exists so the hierarchy is complete.
      assigned++;
      seenSectionTypes.add(def.sectionType);
      return;
    }

    // Visual + UI: one asset = parent Sub-Module frame (never container / children)
    if (!hasContent && def.kind === "visual") {
      // Empty logo/imagery dropzone — section shell only, no phantom asset
      assigned++;
      seenSectionTypes.add(def.sectionType);
      return;
    }

    // Deduplicate: one asset per section type unless multi-variant imagery
    const allowMulti =
      def.sectionType === "photography_style" ||
      def.sectionType === "misuse_examples" ||
      def.sectionType === "presentation_deck";

    if (seenSectionTypes.has(def.sectionType) && !allowMulti) {
      return;
    }
    seenSectionTypes.add(def.sectionType);

    const assetId = generateUUID();
    pendings.push({
      nodeId: frame.id,
      label: frame.name,
      sectionType: def.sectionType,
      kind: def.sectionType,
      assetId,
      preferSvg: def.preferSvg,
    });
    wireVisualAsset(sec, def.sectionType, assetId, frame.name);
    assigned++;
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
        processFrame(child, { uiModule });
      }
    }
  } else {
    for (const loose of findLooseSubModuleFrames(file.document)) {
      processFrame(loose.frame, { uiModule: loose.uiModule });
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
