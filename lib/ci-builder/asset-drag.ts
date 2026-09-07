export const CI_ASSET_DRAG_TYPE = "application/x-wide-ci-asset";

export function setCiAssetDrag(event: {
  dataTransfer: DataTransfer;
}, assetId: string) {
  event.dataTransfer.setData(CI_ASSET_DRAG_TYPE, assetId);
  event.dataTransfer.setData("text/plain", assetId);
  event.dataTransfer.effectAllowed = "copy";
}

export function getCiAssetDragId(event: {
  dataTransfer: DataTransfer;
}): string {
  return (
    event.dataTransfer.getData(CI_ASSET_DRAG_TYPE) ||
    event.dataTransfer.getData("text/plain") ||
    ""
  ).trim();
}

const LOGO_SLOT_TYPES = new Set([
  "primary_logo",
  "secondary_logo",
  "tertiary_logo",
  "wordmark",
  "image_mark",
  "misc_logo",
  "favicon",
]);

const VISUAL_KINDS = new Set([
  "visual",
  "logo",
  "image",
  "general",
  "photo",
  "imagery",
]);

export function isLogoSlotType(sectionType?: string | null): boolean {
  return Boolean(sectionType && LOGO_SLOT_TYPES.has(sectionType));
}

export function assetLooksLikeFont(asset: {
  kind?: string | null;
  public_url?: string | null;
  storage_path?: string | null;
  label?: string | null;
}): boolean {
  if ((asset.kind || "").toLowerCase() === "font") return true;
  const hay = `${asset.public_url || ""} ${asset.storage_path || ""} ${asset.label || ""}`.toLowerCase();
  return /\.(woff2?|ttf|otf)(\?|$)/i.test(hay);
}

export function assetLooksLikeImage(asset: {
  kind?: string | null;
  public_url?: string | null;
  storage_path?: string | null;
  label?: string | null;
}): boolean {
  return !assetLooksLikeFont(asset);
}

export function filterPickerAssets<T extends {
  kind?: string | null;
  section_id?: string | null;
  public_url?: string | null;
  storage_path?: string | null;
  label?: string | null;
}>(
  assets: T[],
  opts: { accept: "image" | "font"; compatibleKind?: string }
): T[] {
  if (opts.accept === "font") {
    return assets.filter((a) => assetLooksLikeFont(a));
  }
  const kind = opts.compatibleKind || "";
  const logoSlot = kind === "all" || isLogoSlotType(kind);
  return assets.filter((a) => {
    if (assetLooksLikeFont(a)) return false;
    if (!kind || kind === "all" || logoSlot) return true;
    if (!a.kind) return true;
    if (a.kind === kind) return true;
    if (VISUAL_KINDS.has(a.kind) && logoSlot) return true;
    if (!a.section_id) return true;
    return false;
  });
}
