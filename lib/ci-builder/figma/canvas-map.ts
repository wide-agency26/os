/**
 * Exact frame / section names produced by the Figma CI canvas generator (`run.js`).
 * Hierarchy: Section = Module → top-level Frame = Sub-Module → `${name}_Container` = data only.
 */

import type { CiSubModuleId } from "@/lib/ci-builder/modules-catalog";

export type CanvasIngestKind =
  | "text"
  | "visual"
  | "typography_families"
  | "typography_scale"
  | "ui"
  | "skip";

export type CanvasFrameDef = {
  sectionType: CiSubModuleId;
  kind: CanvasIngestKind;
  /** Prefer SVG export when ingesting a visual frame. */
  preferSvg?: boolean;
};

/** Exact Sub-Module frame names from the generator script → catalog section types. */
export const CANVAS_FRAME_MAP: Record<string, CanvasFrameDef> = {
  // 01. Brand Core & Strategy
  Mission: { sectionType: "mission", kind: "text" },
  Vision: { sectionType: "vision", kind: "text" },
  "Core Values": { sectionType: "core_values", kind: "text" },
  "Claim / Pitch": { sectionType: "claim_pitch", kind: "text" },
  "Brand Personality & Archetype": {
    sectionType: "brand_personality",
    kind: "text",
  },
  "Editorial Guidelines (Dos & Donts)": {
    sectionType: "editorial_guidelines",
    kind: "text",
  },
  "Editorial Guidelines (Do's & Don'ts)": {
    sectionType: "editorial_guidelines",
    kind: "text",
  },

  // 02. Brand Voice & AI Texting
  "Tone of Voice Matrix Sliders": { sectionType: "tone_matrix", kind: "text" },
  "Copywriting Examples": {
    sectionType: "copywriting_examples",
    kind: "text",
  },
  "AI System Prompt": { sectionType: "ai_system_prompt", kind: "text" },

  // 03. Logo System
  "Primary Logo": {
    sectionType: "primary_logo",
    kind: "visual",
    preferSvg: true,
  },
  "Secondary Logo": {
    sectionType: "secondary_logo",
    kind: "visual",
    preferSvg: true,
  },
  "Tertiary Logo": {
    sectionType: "tertiary_logo",
    kind: "visual",
    preferSvg: true,
  },
  Wordmark: { sectionType: "wordmark", kind: "visual", preferSvg: true },
  "Image Mark": { sectionType: "image_mark", kind: "visual", preferSvg: true },
  Favicon: { sectionType: "favicon", kind: "visual", preferSvg: true },
  "Misc Lockups": { sectionType: "misc_logo", kind: "visual", preferSvg: true },
  "Clear Space": { sectionType: "clear_space", kind: "visual", preferSvg: true },
  "Misuse Examples": { sectionType: "misuse_examples", kind: "visual" },

  // 04. Typography System
  "Live Text Styles: Font Families": {
    sectionType: "fallback_fonts",
    kind: "typography_families",
  },
  "Live Text Styles: Type Scale": {
    sectionType: "typography_scale",
    kind: "typography_scale",
  },

  // 05. UI Elements — only import when container has content
  Primary: { sectionType: "ui_primary", kind: "ui" },
  Secondary: { sectionType: "ui_secondary", kind: "ui" },
  Tertiary: { sectionType: "ui_tertiary", kind: "ui" },
  "Interactive States (Hover, Active Focus)": {
    sectionType: "interactive_states",
    kind: "ui",
  },
  "Form Controls": { sectionType: "form_controls", kind: "ui" },
  "Feedback & Status Badges": { sectionType: "status_badges", kind: "ui" },
  "Layout Containers (Cards, Modals)": {
    sectionType: "layout_containers",
    kind: "ui",
  },

  // 06. Imagery
  "Image Placeholder (1:1 Square)": {
    sectionType: "photography_style",
    kind: "visual",
  },
  "Image Placeholder (4:5 Portrait)": {
    sectionType: "photography_style",
    kind: "visual",
  },
  "Image Placeholder (9:16 Story)": {
    sectionType: "photography_style",
    kind: "visual",
  },

  // 07. Touchpoints
  "Social Media 4x5": { sectionType: "social_4x5", kind: "visual" },
  "Social Media 9x16": { sectionType: "social_9x16", kind: "visual" },
  "Email Signatures": { sectionType: "email_signatures", kind: "visual" },
  "Presentation Deck": { sectionType: "presentation_deck", kind: "visual" },
};

/** Module Section names from the generator (leading index optional). */
export const CANVAS_MODULE_PATTERNS: {
  re: RegExp;
  moduleId: string;
  uiModule?: boolean;
}[] = [
  { re: /brand\s*core/i, moduleId: "brand_core" },
  { re: /brand\s*voice|ai\s*texting/i, moduleId: "brand_voice" },
  { re: /logo\s*system/i, moduleId: "logo_system" },
  { re: /typograph/i, moduleId: "typography_properties" },
  { re: /ui\s*elements/i, moduleId: "ui_elements", uiModule: true },
  { re: /\bimagery\b/i, moduleId: "imagery" },
  { re: /touchpoints/i, moduleId: "touchpoints" },
  { re: /colors?\s*systems?/i, moduleId: "colors_systems" },
];

export function normalizeFrameKey(name: string): string {
  return name
    .replace(/_Container$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isContainerFrame(name: string): boolean {
  return /_Container$/i.test(name.trim());
}

export function lookupCanvasFrame(name: string): CanvasFrameDef | null {
  const key = normalizeFrameKey(name);
  if (CANVAS_FRAME_MAP[key]) return CANVAS_FRAME_MAP[key];

  // Soft match: case-insensitive exact
  const lower = key.toLowerCase();
  for (const [k, def] of Object.entries(CANVAS_FRAME_MAP)) {
    if (k.toLowerCase() === lower) return def;
  }
  return null;
}

export function matchCanvasModule(sectionName: string) {
  for (const m of CANVAS_MODULE_PATTERNS) {
    if (m.re.test(sectionName)) return m;
  }
  return null;
}
