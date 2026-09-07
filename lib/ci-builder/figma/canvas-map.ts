/**
 * Exact frame / section names produced by the Figma CI canvas generator (`run.js`).
 * Hierarchy: Section = Module → top-level Frame = Sub-Module → `${name}_Container` = visual export target.
 * The CI template always puts content in those containers (never export the parent).
 */

import type { CiSubModuleId } from "@/lib/ci-builder/modules-catalog";

export type CanvasIngestKind =
  | "text"
  | "visual"
  | "typography_families"
  | "typography_scale"
  | "color"
  | "ui"
  | "skip";

export type CanvasFrameDef = {
  sectionType: CiSubModuleId;
  kind: CanvasIngestKind;
  /** Prefer SVG export when ingesting a visual frame. */
  preferSvg?: boolean;
  /** For misuse_examples: parent frame role, applied to every inner container. */
  doDont?: "do" | "dont";
  logoMarkName?: string;
  logoIsMain?: boolean;
  typeRole?:
    | "heading-primary"
    | "heading-secondary"
    | "heading-tertiary"
    | "copy-body"
    | "copy-caption";
};

/** Exact Sub-Module frame names from the generator script → catalog section types. */
export const CANVAS_FRAME_MAP: Record<string, CanvasFrameDef> = {
  // 01. Brand Core & Strategy
  Mission: { sectionType: "mission", kind: "text" },
  Vision: { sectionType: "vision", kind: "skip" },
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
    sectionType: "logo_marks",
    kind: "visual",
    preferSvg: true,
    logoMarkName: "Primary",
    logoIsMain: true,
  },
  "Secondary Logo": {
    sectionType: "logo_marks",
    kind: "visual",
    preferSvg: true,
    logoMarkName: "Secondary",
  },
  "Tertiary Logo": {
    sectionType: "logo_marks",
    kind: "visual",
    preferSvg: true,
    logoMarkName: "Tertiary",
  },
  Wordmark: {
    sectionType: "logo_marks",
    kind: "visual",
    preferSvg: true,
    logoMarkName: "Wordmark",
  },
  "Image Mark": {
    sectionType: "logo_marks",
    kind: "visual",
    preferSvg: true,
    logoMarkName: "Image Mark",
  },
  Favicon: {
    sectionType: "logo_marks",
    kind: "visual",
    preferSvg: true,
    logoMarkName: "Favicon",
  },
  "Misc Lockups": {
    sectionType: "logo_marks",
    kind: "visual",
    preferSvg: true,
    logoMarkName: "Misc",
  },
  "Clear Space": { sectionType: "clear_space", kind: "visual", preferSvg: true },
  "Misuse Examples": {
    sectionType: "misuse_examples",
    kind: "visual",
    doDont: "dont",
  },
  "Correct Use": {
    sectionType: "misuse_examples",
    kind: "visual",
    doDont: "do",
  },
  "Correct Usage": {
    sectionType: "misuse_examples",
    kind: "visual",
    doDont: "do",
  },

  // 05. Typography Properties
  "Live Text Styles: Font Families": {
    sectionType: "fallback_fonts",
    kind: "typography_families",
  },
  "Live Text Styles: Type Scale": {
    sectionType: "typography_scale",
    kind: "typography_scale",
  },
  "Headline Primary": {
    sectionType: "typography_scale",
    kind: "typography_scale",
    typeRole: "heading-primary",
  },
  "Headline Secondary": {
    sectionType: "typography_scale",
    kind: "typography_scale",
    typeRole: "heading-secondary",
  },
  "Headline Tertiary": {
    sectionType: "typography_scale",
    kind: "typography_scale",
    typeRole: "heading-tertiary",
  },
  Body: { sectionType: "typography_scale", kind: "typography_scale", typeRole: "copy-body" },
  Caption: {
    sectionType: "typography_scale",
    kind: "typography_scale",
    typeRole: "copy-caption",
  },
  "Fallback Fonts": { sectionType: "fallback_fonts", kind: "typography_families" },
  "Line-Heights": { sectionType: "line_heights", kind: "typography_scale" },
  "Letter-Spacing": { sectionType: "letter_spacing", kind: "typography_scale" },

  // 06. Design Tokens
  "Layout Grids": { sectionType: "layout_grids", kind: "visual" },
  "Spacing System": { sectionType: "spacing_system", kind: "visual" },

  // 07. UI Elements — only import when container has content
  Primary: { sectionType: "ui_primary", kind: "ui" },
  Secondary: { sectionType: "ui_secondary", kind: "ui" },
  Tertiary: { sectionType: "ui_tertiary", kind: "ui" },
  "Interactive States (Hover, Active Focus)": {
    sectionType: "interactive_states",
    kind: "skip",
  },
  "Form Controls": { sectionType: "form_controls", kind: "ui" },
  "Feedback & Status Badges": { sectionType: "status_badges", kind: "ui" },
  "Layout Containers (Cards, Modals)": {
    sectionType: "layout_containers",
    kind: "ui",
  },
  "Empty & Error States": { sectionType: "ui_empty_error", kind: "ui" },
  "Empty States": { sectionType: "ui_empty_error", kind: "ui" },
  "Brand Photography": { sectionType: "brand_photography", kind: "visual" },

  // 08. Imagery
  "Image Placeholder (1:1 Square)": {
    sectionType: "brand_photography",
    kind: "visual",
  },
  "Image Placeholder (4:5 Portrait)": {
    sectionType: "brand_photography",
    kind: "visual",
  },
  "Image Placeholder (9:16 Story)": {
    sectionType: "brand_photography",
    kind: "visual",
  },
  "Photography Style (Do's & Don'ts)": {
    sectionType: "photography_style",
    kind: "visual",
  },
  "Photography Style (Dos & Donts)": {
    sectionType: "photography_style",
    kind: "visual",
  },
  "Iconography & Illustration Style": {
    sectionType: "iconography",
    kind: "skip",
  },
  "AI Image Prompts": { sectionType: "ai_image_prompts", kind: "skip" },

  // 09. Touchpoints
  "Social Media 4x5": { sectionType: "social_4x5", kind: "visual" },
  "Social Media 9x16": { sectionType: "social_9x16", kind: "visual" },
  "Email Signatures": { sectionType: "email_signatures", kind: "visual" },
  "Presentation Deck": { sectionType: "presentation_deck", kind: "visual" },
};

/**
 * Color Systems frames share names with UI Elements ("Primary", "Secondary").
 * Only used when the parent Figma Section is Colors Systems.
 */
export const CANVAS_COLOR_FRAME_MAP: Record<string, CanvasFrameDef> = {
  Primary: { sectionType: "color_primary", kind: "color" },
  Secondary: { sectionType: "color_secondary", kind: "color" },
  Accent: { sectionType: "color_accent", kind: "color" },
  Functional: { sectionType: "functional", kind: "color" },
  "Functional (error, success)": { sectionType: "functional", kind: "color" },
  HEX: { sectionType: "hex", kind: "color" },
  Hex: { sectionType: "hex", kind: "color" },
  RGB: { sectionType: "rgb", kind: "color" },
  CMYK: { sectionType: "cmyk", kind: "color" },
  "Color Scale": { sectionType: "color_scale", kind: "color" },
  "Color Scale (blue-500, neutral-100)": {
    sectionType: "color_scale",
    kind: "color",
  },
  "Accessibility & WCAG Contrast Rules": {
    sectionType: "wcag_contrast",
    kind: "skip",
  },
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
  { re: /design\s*tokens/i, moduleId: "design_tokens" },
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

function lookupInMap(
  map: Record<string, CanvasFrameDef>,
  key: string
): CanvasFrameDef | null {
  if (map[key]) return map[key];
  const lower = key.toLowerCase();
  for (const [k, def] of Object.entries(map)) {
    if (k.toLowerCase() === lower) return def;
  }
  return null;
}

export function lookupCanvasFrame(
  name: string,
  moduleId?: string | null
): CanvasFrameDef | null {
  const key = normalizeFrameKey(name);
  if (moduleId === "colors_systems") {
    const color = lookupInMap(CANVAS_COLOR_FRAME_MAP, key);
    if (color) return color;
  }
  return lookupInMap(CANVAS_FRAME_MAP, key);
}

export function matchCanvasModule(sectionName: string) {
  for (const m of CANVAS_MODULE_PATTERNS) {
    if (m.re.test(sectionName)) return m;
  }
  return null;
}
