import type { CIAsset, CISection } from "@/lib/ci-builder/types";
import { getSubModule, type CiRendererKind } from "@/lib/ci-builder/modules-catalog";

export type CiDownloadsConfig = {
  showOnSubmodule: boolean;
  showOnModule: boolean;
  offerPng: boolean;
  offerOriginal: boolean;
  driveUrl: string;
  driveLabel: string;
};

export const DEFAULT_DOWNLOADS: CiDownloadsConfig = {
  showOnSubmodule: false,
  showOnModule: false,
  offerPng: true,
  offerOriginal: false,
  driveUrl: "",
  driveLabel: "Working files",
};

const VISUAL_RENDERERS = new Set<CiRendererKind>([
  "image_slot",
  "clearspace",
  "image_dual",
  "icon_set",
  "ui_button",
  "ui_buttons",
  "ui_form_controls",
  "email_sig",
  "container_spec",
  "deck",
  "logo_mark_list",
]);

export function rendererHasDownloads(kind: CiRendererKind | "generic" | undefined): boolean {
  return Boolean(kind && kind !== "generic" && VISUAL_RENDERERS.has(kind));
}

export function parseDownloads(data: unknown): CiDownloadsConfig {
  const raw =
    data && typeof data === "object"
      ? ((data as { downloads?: Record<string, unknown> }).downloads ?? {})
      : {};
  return {
    showOnSubmodule: Boolean(raw.showOnSubmodule),
    showOnModule: Boolean(raw.showOnModule),
    offerPng: raw.offerPng !== false,
    offerOriginal: Boolean(raw.offerOriginal),
    driveUrl: typeof raw.driveUrl === "string" ? raw.driveUrl.trim() : "",
    driveLabel:
      typeof raw.driveLabel === "string" && raw.driveLabel.trim()
        ? raw.driveLabel.trim()
        : DEFAULT_DOWNLOADS.driveLabel,
  };
}

export function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function urlLooksPng(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return path.endsWith(".png") || path.includes("/png");
}

export function urlLooksSvg(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return path.endsWith(".svg") || path.includes("image/svg");
}

export function pngUrlForAsset(asset: Partial<CIAsset> | undefined): string | null {
  if (!asset) return null;
  const fromMeta = asset.metadata?.png_url;
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
  if (asset.public_url && urlLooksPng(asset.public_url)) return asset.public_url;
  return asset.public_url || null;
}

export function originalUrlForAsset(asset: Partial<CIAsset> | undefined): string | null {
  return asset?.public_url?.trim() || null;
}

export function downloadApiHref(opts: {
  assetId: string;
  kind: "png" | "original";
  name?: string;
}): string {
  const q = new URLSearchParams({ assetId: opts.assetId, kind: opts.kind });
  if (opts.name) q.set("name", opts.name);
  return `/api/ci-builder/asset-download?${q.toString()}`;
}

export function findAssetById(
  assets: Partial<CIAsset>[],
  assetId?: string | null
): Partial<CIAsset> | undefined {
  if (!assetId) return undefined;
  return assets.find((a) => a.id === assetId);
}

export function primaryAssetIdFromData(data: Record<string, unknown>): string | null {
  if (typeof data.assetId === "string" && data.assetId) return data.assetId;
  const variants = data.variants;
  if (Array.isArray(variants) && variants[0]?.assetId) return String(variants[0].assetId);
  const icons = data.icons;
  if (Array.isArray(icons) && icons[0]?.assetId) return String(icons[0].assetId);
  const items = data.items;
  if (Array.isArray(items) && items[0]?.assetId) return String(items[0].assetId);
  const slides = data.slides;
  if (Array.isArray(slides) && slides[0]?.assetId) return String(slides[0].assetId);
  return null;
}

export type ModuleDownloadEntry = {
  sectionId: string;
  label: string;
  assetId: string | null;
  asset: Partial<CIAsset> | undefined;
  downloads: CiDownloadsConfig;
};

export function moduleDownloadEntries(
  sections: Partial<CISection>[],
  assets: Partial<CIAsset>[],
  moduleId: string
): ModuleDownloadEntry[] {
  const out: ModuleDownloadEntry[] = [];
  for (const sec of sections) {
    const def = getSubModule(sec.section_type);
    if (!def || def.moduleId !== moduleId) continue;
    if (!rendererHasDownloads(def.renderer)) continue;
    const data = (sec.data || {}) as Record<string, unknown>;
    const downloads = parseDownloads(data);
    if (!downloads.showOnModule) continue;
    const assetId = primaryAssetIdFromData(data);
    out.push({
      sectionId: sec.id || String(sec.section_type || ""),
      label:
        (sec.eyebrow_label || sec.headline || def.defaultHeadline || def.subModuleLabel || "").trim() ||
        "Asset",
      assetId,
      asset: findAssetById(assets, assetId),
      downloads,
    });
  }
  return out;
}

export function downloadFilename(label: string, kind: "png" | "original", asset?: Partial<CIAsset>): string {
  const base = (label || asset?.label || "asset")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 80) || "asset";
  if (kind === "png") return base.endsWith(".png") ? base : `${base}.png`;
  const url = asset?.public_url || "";
  if (urlLooksSvg(url)) return base.endsWith(".svg") ? base : `${base}.svg`;
  if (urlLooksPng(url)) return base.endsWith(".png") ? base : `${base}.png`;
  return base;
}
