import type { CISection } from "@/lib/ci-builder/types";
import { getSubModule } from "@/lib/ci-builder/modules-catalog";

/** MSF MVB & Digital — Test MS BRAND FILE V2 */
export const MSF_GUIDELINE_ID = "3fe7c4c5-3166-4152-96b2-92c28b17c39b";

const IMPORT_BLURB =
  /imported from figma|imported structure from figma|review before publishing|review and fill content/i;

export function isImportBoilerplate(text?: string | null): boolean {
  const t = (text || "").trim();
  if (!t) return true;
  return IMPORT_BLURB.test(t);
}

const CATALOG: Record<string, string> = {
  mission:
    "Why this brand exists. Keep new work pointed at this sentence — campaigns, decks, and product copy.",
  vision:
    "The future this brand is building toward. Use it for long-range narrative, not day-to-day product claims.",
  core_values:
    "The non-negotiables. If a line of copy or a visual choice fights these, it does not ship.",
  claim_pitch:
    "The short claim and the slightly longer pitch. Use the claim on covers; use the pitch when you have a paragraph.",
  brand_personality:
    "How the brand behaves. Match tone, pacing, and attitude here before inventing a new voice.",
  editorial_guidelines:
    "Writing rules in plain language — what we say, how we say it, and what we leave out.",
  tone_matrix:
    "Where the voice sits on each axis. Stay inside the range; do not slam every slider to an extreme in one piece.",
  copywriting_examples:
    "Approved lines and the ones we do not use. Prefer these over improvising a new slogan.",
  ai_system_prompt:
    "The instruction block for any model writing as this brand. Paste it as the system prompt; do not rewrite it ad hoc.",
  primary_logo:
    "The main lockup. Use this whenever the brand needs to introduce itself — covers, letterheads, and signed work.",
  secondary_logo:
    "A quieter lockup for tight spaces and repeating headers. Same brand, less weight.",
  tertiary_logo:
    "The reduced lockup. Use only when the primary and secondary marks cannot fit.",
  wordmark:
    "The name on its own, without the symbol. Give it room; never restyle the letters.",
  image_mark:
    "The symbol without the name. Use it only where the brand is already understood.",
  misc_logo:
    "Additional approved lockups. Do not invent new arrangements from these parts.",
  favicon:
    "The tiny mark for tabs and app icons. Always the approved crop — never a screenshot of the full logo.",
  clear_space:
    "Keep this buffer clear on every side of the mark. Nothing — type, photos, or edges — sits inside it.",
  misuse_examples:
    "What not to do. Do not stretch, recolor, outline, or crowd the mark. If it looks off, use an approved file.",
  color_primary:
    "Core brand colors. Use the main swatch for fills and type; open Scale only when you need a tint or shade.",
  color_secondary:
    "Supporting colors for text, rules, and quiet surfaces. They sit behind the primaries — they are not a second brand.",
  color_accent:
    "Sparks, not the default fill. Use the main swatch of a family; open Scale for charts, badges, and seasonal moments.",
  functional:
    "Status colors for success, warning, and error. Keep them out of brand compositions.",
  hex: "Hex values for digital work. Copy from the swatch — do not approximate by eye.",
  rgb: "RGB values for screen. Match the swatch; do not mix channels from neighboring shades.",
  cmyk: "CMYK for print. Use these builds, not a converted hex, when the job goes on press.",
  color_scale: "Tints and shades of each family. The middle / 500 step is the hero; the rest are support.",
  wcag_contrast:
    "Pairs that hold up for text. If a combination is not listed as safe, do not use it for small type.",
  headline_primary:
    "The display face for hero headlines. Do not substitute another weight or a nearby gothic.",
  headline_secondary: "The second display cut — for subheads and section titles, not body copy.",
  headline_tertiary: "A lighter display role. Use it for labels and short callouts, not long paragraphs.",
  body: "The reading face. Size, leading, and weight stay as specified so paragraphs stay even.",
  caption: "Small supporting type — captions, credits, footnotes. Do not use it for headlines.",
  fallback_fonts:
    "What to load when the brand face is missing. Keep this stack; do not swap in a random system font.",
  typography_scale:
    "Named sizes from display down to caption. Pick a step — do not invent a size between them.",
  line_heights: "Leading for each role. Match the token; do not tighten display type to fit a box.",
  letter_spacing: "Tracking for each role. Display can open up; body stays as set.",
  layout_grids: "Columns, gutters, and margins. Align to this grid instead of eyeballing padding.",
  spacing_system: "The spacing ladder. Use these steps for padding and gaps — not one-off pixel values.",
  ui_primary: "The default control. Use this treatment for the main action on a screen.",
  ui_secondary: "The quieter control. Use it next to a primary, never as a competing headline button.",
  ui_tertiary: "Ghost or text-only actions. Keep contrast legal; do not invent a fourth style.",
  interactive_states: "Hover, press, focus, disabled. Every control needs these — do not skip focus.",
  form_controls: "Inputs, selects, and checks. Keep radius, border, and text color as shown.",
  status_badges: "Small status chips. Use the functional palette; do not invent new badge colors.",
  layout_containers: "Page frames, cards, and max widths. Stay inside these, especially on wide screens.",
  photography_style:
    "How photographs should feel. Follow the do's; the don'ts are disqualifiers, not suggestions.",
  iconography: "Stroke, scale, and style for icons. Do not mix this set with a different icon library.",
  ai_image_prompts: "Starting prompts for generated imagery. Keep the constraints; change only the subject.",
  social_4x5: "The 4×5 social frame. Keep safe areas clear of the mark and of essential type.",
  social_9x16: "The 9×16 social frame. Design for the centre; platform chrome will eat the edges.",
  email_signatures:
    "The official sign-off. Copy the HTML or match this layout — do not rebuild it in the email client.",
  presentation_deck:
    "Approved slide frames. Start from these masters; do not restyle titles or the mark on a whim.",
};

const MSF: Record<string, string> = {
  primary_logo:
    "The full MSF lockup — mark plus wordmark. Use it whenever the brand needs to introduce itself: covers, letterheads, and signed work.",
  secondary_logo:
    "A quieter MSF lockup for tight spaces and repeating headers. Same brand, less weight.",
  tertiary_logo:
    "The reduced MSF lockup. Use only when the primary and secondary marks cannot fit.",
  wordmark:
    "MSF set as type, without the symbol. Give it room; never restyle the letters or change the spacing.",
  clear_space:
    "Keep this buffer clear on every side of the mark. The unit is one cap-height of the logotype — type, photos, and edges stay out.",
  misuse_examples:
    "Do not stretch, recolor, outline, or crowd the MSF mark. If a layout fights the lockup, use an approved file instead of rebuilding it.",
  favicon:
    "The tiny MSF mark for browser tabs and app icons. Always the approved crop — never a screenshot of the full logo.",
  color_primary:
    "Midnight and Alpine Cloud are the core pair. Midnight carries the brand; Alpine Cloud is the light ground it sits on.",
  color_secondary:
    "Onyx is the supporting dark — body text, rules, and quiet chrome. It is not a second primary.",
  color_accent:
    "Cyan, Lime, Magenta, Red, Gold, and Bavarese Blu are sparks, not the default fill. Use each family's main swatch; open Scale only for tints.",
  email_signatures:
    "The official MSF sign-off. Copy the HTML or use this layout as the reference — do not rebuild it in Outlook or Gmail.",
};

export function defaultClientDescription(
  sectionType?: string | null,
  guidelineId?: string | null
): string {
  const type = sectionType || "";
  if (guidelineId === MSF_GUIDELINE_ID && MSF[type]) return MSF[type];
  if (CATALOG[type]) return CATALOG[type];
  const def = getSubModule(type);
  if (def) {
    return `${def.subModuleLabel} for this brand. Use the assets and rules in this section as specified — do not improvise a variant.`;
  }
  return "Use the assets and rules in this section as specified.";
}

export function sectionCopyNeedsPropose(description?: string | null): boolean {
  return isImportBoilerplate(description);
}

export function applyCatalogCopy(
  sections: Partial<CISection>[],
  opts?: { guidelineId?: string | null }
): { sections: Partial<CISection>[]; changed: boolean } {
  let changed = false;
  const next = sections.map((sec) => {
    if (!isImportBoilerplate(sec.description)) return sec;
    const text = defaultClientDescription(sec.section_type, opts?.guidelineId);
    if (text === (sec.description || "").trim()) return sec;
    changed = true;
    return { ...sec, description: text };
  });
  return { sections: next, changed };
}
