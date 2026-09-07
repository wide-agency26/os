import type { CIAsset, CISection } from "@/lib/ci-builder/types";
import { defaultDataForSubModule, getSubModule } from "@/lib/ci-builder/modules-catalog";

function nonempty(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function assetPresent(
  assetId: unknown,
  assets: Partial<CIAsset>[]
): boolean {
  const id = typeof assetId === "string" ? assetId.trim() : "";
  if (!id) return false;
  const hit = assets.find((a) => a.id === id);
  if (!hit) return true;
  return Boolean(hit.public_url || hit.storage_path);
}

function listHasText(
  raw: unknown,
  keys: string[]
): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  return raw.some((item) => {
    if (typeof item === "string") return item.trim().length > 0;
    if (!item || typeof item !== "object") return false;
    const rec = item as Record<string, unknown>;
    if (assetPresent(rec.assetId, [])) return true;
    return keys.some((k) => nonempty(rec[k]));
  });
}

/**
 * Whether a sub-module has anything a client should see.
 * Empty shells stay in Edit with a reminder.
 */
export function sectionHasClientValue(
  section: Partial<CISection>,
  assets: Partial<CIAsset>[] = []
): boolean {
  const data = (section.data || {}) as Record<string, any>;
  const kind = getSubModule(section.section_type)?.renderer;

  if (Array.isArray(data.swatches) && data.swatches.some((s: any) => s?.hex)) {
    return true;
  }
  if (assetPresent(data.assetId, assets)) return true;
  if (
    Array.isArray(data.variants) &&
    data.variants.some((v: any) => assetPresent(v?.assetId, assets))
  ) {
    return true;
  }
  if (
    Array.isArray(data.items) &&
    data.items.some(
      (i: any) =>
        assetPresent(i?.assetId, assets) ||
        nonempty(i?.caption) ||
        nonempty(i?.title) ||
        nonempty(i?.text)
    )
  ) {
    return true;
  }
  if (
    Array.isArray(data.slides) &&
    data.slides.some((s: any) => assetPresent(s?.assetId, assets) || nonempty(s?.label))
  ) {
    return true;
  }
  if (Array.isArray(data.families) && data.families.length > 0) return true;
  if (nonempty(data.body) || nonempty(data.claim) || nonempty(data.pitch)) {
    return true;
  }
  if (nonempty(data.prompt) || nonempty(data.html)) return true;
  if (nonempty(data.fontFamily) && nonempty(data.fontSize || data.sampleText)) {
    return true;
  }
  if (
    Array.isArray(data.fontFiles) &&
    data.fontFiles.some((f: any) => assetPresent(f?.assetId, assets))
  ) {
    return true;
  }

  switch (kind) {
    case "list":
      return listHasText(data.items, ["title", "description"]);
    case "archetype":
      return (
        nonempty(data.archetype) ||
        listHasText(data.traits, ["word", "text"])
      );
    case "dual_list":
      return listHasText(data.dos, ["text"]) || listHasText(data.donts, ["text"]);
    case "sliders":
      return Array.isArray(data.axes) && data.axes.length > 0;
    case "copy_examples":
      return (
        listHasText(data.approved, ["text"]) ||
        listHasText(data.forbidden, ["text"])
      );
    case "type_scale":
      return Array.isArray(data.scale) && data.scale.length > 0;
    case "type_tokens":
      return Array.isArray(data.tokens) && data.tokens.length > 0;
    case "font_stack": {
      const stack = String(data.stack || "").trim();
      if (!stack) return false;
      const fallback = String(
        (defaultDataForSubModule(section.section_type || "") as { stack?: string })
          .stack || ""
      ).trim();
      return stack !== fallback;
    }
    case "type_spec":
      return nonempty(data.fontFamily);
    case "wcag":
      return Array.isArray(data.pairs) && data.pairs.length > 0;
    case "icon_set":
      return Array.isArray(data.icons) && data.icons.length > 0;
    case "prompt_cards":
      return Array.isArray(data.prompts) && data.prompts.length > 0;
    case "ui_states":
      return (
        Array.isArray(data.states) &&
        data.states.some(
          (s: any) => assetPresent(s?.assetId, assets) || nonempty(s?.name)
        )
      );
    case "email_sig":
      return nonempty(data.html) || assetPresent(data.assetId, assets);
    case "deck":
      return (
        Array.isArray(data.slides) &&
        data.slides.some((s: any) => assetPresent(s?.assetId, assets))
      );
    case "layout_grid":
      return nonempty(data.columns);
    case "spacing":
      return Boolean(data.scale) && Object.keys(data.scale || {}).length > 0;
    case "color_group":
    case "color_format":
      return (
        nonempty(data.hex) ||
        (Array.isArray(data.swatches) && data.swatches.some((s: any) => s?.hex))
      );
    case "logo_mark_list":
      return Array.isArray(data.marks) && data.marks.length > 0;
    case "link_list":
      return listHasText(data.links, ["label", "url"]);
    case "token_scale_list":
      return Array.isArray(data.tokens) && data.tokens.length > 0;
    case "ui_buttons":
      return (
        Array.isArray(data.variants) &&
        data.variants.some(
          (v: any) => nonempty(v?.label) || nonempty(v?.bg) || assetPresent(v?.assetId, assets)
        )
      );
    case "ui_form_controls":
      return (
        Array.isArray(data.controls) &&
        data.controls.some(
          (c: any) => nonempty(c?.label) || nonempty(c?.notes) || assetPresent(c?.assetId, assets)
        )
      );
    default:
      break;
  }

  if (nonempty(section.description) && !/^use the assets/i.test(section.description || "")) {
    if (kind === "text" && !nonempty(data.body)) return false;
  }
  return false;
}
