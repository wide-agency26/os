/**
 * Per-canvas-module Figma import documentation + section-type filters.
 * Driven from CANVAS_FRAME_MAP / CANVAS_COLOR_FRAME_MAP — single source for
 * module Re-sync filtering and the Edit-page info popup.
 */

import type { CanvasModuleKey } from "@/lib/ci-builder/canvas/modules";
import { CANVAS_MODULES } from "@/lib/ci-builder/canvas/modules";
import {
  CANVAS_COLOR_FRAME_MAP,
  CANVAS_FRAME_MAP,
  CANVAS_MODULE_PATTERNS,
  type CanvasFrameDef,
} from "@/lib/ci-builder/figma/canvas-map";

export type ModuleImportFrameInfo = {
  frameName: string;
  sectionType: string;
  kind: CanvasFrameDef["kind"];
  note?: string;
};

export type ModuleImportSpec = {
  key: CanvasModuleKey;
  label: string;
  /** Human-readable Figma parent Section name pattern. */
  figmaSectionHint: string;
  frames: ModuleImportFrameInfo[];
  /** Catalog section_types Figma writes for this module (skips excluded). */
  sectionTypes: string[];
  /** Always mention container export rule. */
  containerNote: string;
};

const CONTAINER_NOTE =
  "Visual frames export from the inner `*_Container` child (never the parent frame).";

/** Map canvas key → Figma moduleId used in CANVAS_MODULE_PATTERNS. */
const FIGMA_MODULE_ID: Record<CanvasModuleKey, string> = {
  core: "brand_core",
  voice: "brand_voice",
  logo: "logo_system",
  color: "colors_systems",
  type: "typography_properties",
  tokens: "design_tokens",
  ui: "ui_elements",
  imagery: "imagery",
  touch: "touchpoints",
};

/** Section types Figma fills per module — excludes skip kinds + download_links. */
const MODULE_SECTION_TYPES: Record<CanvasModuleKey, string[]> = {
  core: ["mission", "core_values", "claim_pitch", "brand_personality", "editorial_guidelines"],
  voice: ["tone_matrix", "copywriting_examples", "ai_system_prompt"],
  logo: ["logo_marks", "clear_space", "misuse_examples"],
  color: [
    "color_primary",
    "color_secondary",
    "color_accent",
    "functional",
    "hex",
    "rgb",
    "cmyk",
    "color_scale",
  ],
  type: ["fallback_fonts", "typography_scale", "line_heights", "letter_spacing"],
  tokens: ["layout_grids", "spacing_system"],
  ui: [
    "ui_primary",
    "ui_secondary",
    "ui_tertiary",
    "form_controls",
    "status_badges",
    "layout_containers",
    "ui_empty_error",
  ],
  imagery: ["brand_photography", "photography_style"],
  touch: ["social_4x5", "social_9x16", "email_signatures", "presentation_deck"],
};

/** Skip frames shown in the info popup for context (not imported). */
const MODULE_SKIP_FRAMES: Partial<Record<CanvasModuleKey, string[]>> = {
  core: ["Vision"],
  ui: ["Interactive States (Hover, Active Focus)"],
  imagery: ["Iconography & Illustration Style", "AI Image Prompts"],
  color: ["Accessibility & WCAG Contrast Rules"],
};

function noteFor(def: CanvasFrameDef): string | undefined {
  if (def.kind === "skip") return "Skipped — not imported into Edit";
  if (def.logoMarkName) {
    return `→ logo_marks as “${def.logoMarkName}”${def.logoIsMain ? " (MAIN)" : ""}`;
  }
  if (def.typeRole) return `→ typography_scale role “${def.typeRole}”`;
  if (def.doDont) return `→ misuse_examples (${def.doDont})`;
  if (def.kind === "color") return "Filled from Figma color styles / variables (not image export)";
  if (def.kind === "typography_scale" || def.kind === "typography_families") {
    return "Filled from Figma text styles / variables";
  }
  if (def.kind === "ui") return "Imported only when the container has content";
  return undefined;
}

function frameEntriesForModule(key: CanvasModuleKey): ModuleImportFrameInfo[] {
  const types = new Set(MODULE_SECTION_TYPES[key]);
  const map = key === "color" ? CANVAS_COLOR_FRAME_MAP : CANVAS_FRAME_MAP;
  const out: ModuleImportFrameInfo[] = [];
  const seen = new Set<string>();

  for (const [name, def] of Object.entries(map)) {
    if (!types.has(def.sectionType)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({
      frameName: name,
      sectionType: def.sectionType,
      kind: def.kind,
      note: noteFor(def),
    });
  }

  for (const name of MODULE_SKIP_FRAMES[key] || []) {
    const def =
      (key === "color" ? CANVAS_COLOR_FRAME_MAP[name] : CANVAS_FRAME_MAP[name]) ||
      CANVAS_FRAME_MAP[name];
    if (!def || seen.has(name)) continue;
    seen.add(name);
    out.push({
      frameName: name,
      sectionType: def.sectionType,
      kind: "skip",
      note: noteFor(def),
    });
  }

  return out;
}

function sectionHint(key: CanvasModuleKey): string {
  const figmaId = FIGMA_MODULE_ID[key];
  const pat = CANVAS_MODULE_PATTERNS.find((p) => p.moduleId === figmaId);
  if (pat) {
    return `Parent Figma Section matching /${pat.re.source}/i`;
  }
  return CANVAS_MODULES.find((m) => m.key === key)?.label || key;
}

export function figmaSectionTypesForModule(key: CanvasModuleKey): string[] {
  return MODULE_SECTION_TYPES[key].slice();
}

export function getModuleImportSpec(key: CanvasModuleKey): ModuleImportSpec {
  const mod = CANVAS_MODULES.find((m) => m.key === key)!;
  return {
    key,
    label: mod.label,
    figmaSectionHint: sectionHint(key),
    frames: frameEntriesForModule(key),
    sectionTypes: figmaSectionTypesForModule(key),
    containerNote: CONTAINER_NOTE,
  };
}

export function isCanvasModuleKey(v: unknown): v is CanvasModuleKey {
  return typeof v === "string" && CANVAS_MODULES.some((m) => m.key === v);
}
