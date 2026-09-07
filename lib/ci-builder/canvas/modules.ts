import type { CiModuleId } from "@/lib/ci-builder/modules-catalog";

export type CanvasModuleKey =
  | "core"
  | "voice"
  | "logo"
  | "color"
  | "type"
  | "tokens"
  | "ui"
  | "imagery"
  | "touch";

export type CanvasModuleDef = {
  key: CanvasModuleKey;
  id: CiModuleId;
  num: string;
  label: string;
};

export const CANVAS_MODULES: CanvasModuleDef[] = [
  { key: "core", id: "brand_core_strategy", num: "01", label: "Brand Core & Strategy" },
  { key: "voice", id: "brand_voice_ai_texting", num: "02", label: "Brand Voice & AI Texting" },
  { key: "logo", id: "logo_system", num: "03", label: "Logo System" },
  { key: "color", id: "colors_systems", num: "04", label: "Color Systems" },
  { key: "type", id: "typography_properties", num: "05", label: "Typography" },
  { key: "tokens", id: "design_tokens", num: "06", label: "Design Tokens" },
  { key: "ui", id: "ui_elements", num: "07", label: "UI Elements" },
  { key: "imagery", id: "imagery", num: "08", label: "Imagery" },
  { key: "touch", id: "touchpoints", num: "09", label: "Touchpoints" },
];

export function canvasKeyForModuleId(id: string | null | undefined): CanvasModuleKey | null {
  const hit = CANVAS_MODULES.find((m) => m.id === id);
  return hit?.key ?? null;
}

export function resolveCanvasPage(id?: string | null): CanvasModuleKey | "landing" {
  if (!id) return "landing";
  if (CANVAS_MODULES.some((m) => m.key === id)) return id as CanvasModuleKey;
  return canvasKeyForModuleId(id) || "landing";
}

export function moduleIdForCanvasKey(key: CanvasModuleKey): CiModuleId {
  return CANVAS_MODULES.find((m) => m.key === key)!.id;
}

/** Catalog types that exist for ingest but must not appear as Edit cards. */
export const CANVAS_HIDDEN_SECTION_TYPES = new Set([
  "vision",
  "iconography",
  "ai_image_prompts",
  "interactive_states",
  "wcag_contrast",
  "hex",
  "rgb",
  "cmyk",
  "headline_primary",
  "headline_secondary",
  "headline_tertiary",
  "body",
  "caption",
  "fallback_fonts",
  "line_heights",
  "letter_spacing",
  "primary_logo",
  "secondary_logo",
  "tertiary_logo",
  "wordmark",
  "image_mark",
  "misc_logo",
  "favicon",
  "ui_primary",
  "ui_secondary",
  "ui_tertiary",
]);
