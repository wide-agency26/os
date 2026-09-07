import type { CIAsset, CISection } from "@/lib/ci-builder/types";

const MARK_TYPES = ["favicon", "image_mark", "primary_logo"] as const;

/** Real HTTP(S)/blob/data URLs only — never pending `figma://nodeId` placeholders. */
function assetUrl(asset?: Partial<CIAsset> | null): string {
  const pub = String(asset?.public_url || "").trim();
  if (pub) return pub;
  const meta = (asset?.metadata || {}) as { pending_export?: boolean };
  if (meta.pending_export) return "";
  const path = String(asset?.storage_path || "").trim();
  if (!path || path.startsWith("figma://") || path.startsWith("pending/")) return "";
  return path;
}

function assetsForSection(
  section: Partial<CISection> | undefined,
  assets: Partial<CIAsset>[]
): Partial<CIAsset>[] {
  if (!section) return [];
  const data = (section.data || {}) as { assetId?: string; variants?: { assetId?: string }[] };
  const ids = new Set<string>();
  if (data.assetId) ids.add(data.assetId);
  for (const v of data.variants || []) {
    if (v.assetId) ids.add(v.assetId);
  }
  return assets.filter((a) => {
    if (a.id && ids.has(a.id)) return true;
    if (section.id && a.section_id === section.id && assetUrl(a)) return true;
    return false;
  });
}

/**
 * Which background the mark will sit on.
 * - `dark` → prefer MAIN `darkAssetId` (logo designed for dark backgrounds)
 * - `light` → prefer MAIN `lightAssetId` (logo designed for light backgrounds)
 */
export type BrandMarkBackground = "light" | "dark";

function pickFromMainMark(
  main: { lightAssetId?: string; darkAssetId?: string },
  list: Partial<CIAsset>[],
  forBackground: BrandMarkBackground
): Partial<CIAsset> | null {
  const preferredId =
    forBackground === "dark"
      ? main.darkAssetId || main.lightAssetId
      : main.lightAssetId || main.darkAssetId;
  const fallbackId =
    forBackground === "dark" ? main.lightAssetId : main.darkAssetId;
  for (const id of [preferredId, fallbackId]) {
    if (!id) continue;
    const hit = list.find((a) => a.id === id && assetUrl(a));
    if (hit) return hit;
  }
  return null;
}

/** Favicon → icon / image mark → primary logo / MAIN from logo_marks. */
export function pickBrandMark(
  sections?: Partial<CISection>[] | null,
  assets?: Partial<CIAsset>[] | null,
  opts?: { forBackground?: BrandMarkBackground }
): Partial<CIAsset> | null {
  const list = assets || [];
  const secs = sections || [];
  const forBackground: BrandMarkBackground = opts?.forBackground || "light";

  const unified = secs.find((s) => s.section_type === "logo_marks");
  if (unified) {
    const marks = ((unified.data as { marks?: { isMain?: boolean; lightAssetId?: string; darkAssetId?: string }[] })
      ?.marks || []) as {
      isMain?: boolean;
      lightAssetId?: string;
      darkAssetId?: string;
    }[];
    const main = marks.find((m) => m.isMain) || marks[0];
    if (main) {
      const hit = pickFromMainMark(main, list, forBackground);
      if (hit) return hit;
    }
  }

  for (const type of MARK_TYPES) {
    const section = secs.find((s) => s.section_type === type);
    const fromSection = assetsForSection(section, list).find((a) => assetUrl(a));
    if (fromSection) return fromSection;
    const fromKind = list.find(
      (a) =>
        (a.kind === type ||
          (type === "image_mark" && /icon|mark|favicon/i.test(String(a.kind || a.label || ""))) ||
          (type === "favicon" && /favicon/i.test(String(a.kind || a.label || "")))) &&
        assetUrl(a)
    );
    if (fromKind) return fromKind;
  }
  return (
    list.find(
      (a) =>
        (a.kind === "primary_logo" || /logo/i.test(String(a.kind || ""))) &&
        assetUrl(a)
    ) || null
  );
}

export function brandMarkUrl(
  sections?: Partial<CISection>[] | null,
  assets?: Partial<CIAsset>[] | null,
  opts?: { forBackground?: BrandMarkBackground }
): string | null {
  const mark = pickBrandMark(sections, assets, opts);
  return mark ? assetUrl(mark) || null : null;
}

/** True when a favicon or icon/mark exists (not merely a fallback logo). */
export function hasFaviconOrIcon(
  sections?: Partial<CISection>[] | null,
  assets?: Partial<CIAsset>[] | null
): boolean {
  const list = assets || [];
  const secs = sections || [];
  for (const type of ["favicon", "image_mark"] as const) {
    const section = secs.find((s) => s.section_type === type);
    if (assetsForSection(section, list).some((a) => assetUrl(a))) return true;
    if (
      list.some(
        (a) =>
          (a.kind === type ||
            (type === "image_mark" &&
              /icon|mark|favicon/i.test(String(a.kind || a.label || ""))) ||
            (type === "favicon" && /favicon/i.test(String(a.kind || a.label || "")))) &&
          assetUrl(a)
      )
    ) {
      return true;
    }
  }
  return false;
}
