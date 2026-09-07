/**
 * Download Figma-rendered images and upload into brand-guidelines storage.
 * Logo frames keep SVG for display and also store a PNG @2x sibling for downloads.
 */

import {
  renderFigmaImages,
} from "@/lib/ci-builder/figma/client";
import type { CIAsset } from "@/lib/ci-builder/types";
import {
  BRAND_GUIDELINES_BUCKET,
  sanitizeStorageFileName,
} from "@/lib/brand-guideline/storage";

type SupabaseLike = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: ArrayBuffer | Blob | Buffer,
        opts?: { contentType?: string; upsert?: boolean }
      ) => Promise<{ error: any }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

async function uploadBuffer(
  supabase: SupabaseLike,
  guidelineId: string,
  label: string,
  ext: "svg" | "png",
  buf: ArrayBuffer,
  contentType: string
): Promise<{ storagePath: string; publicUrl: string } | null> {
  const safe = sanitizeStorageFileName(
    `${label || "asset"}.${ext}`.replace(/\s+/g, "_")
  );
  const storagePath = `${guidelineId}/figma/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
  const { error: uploadErr } = await supabase.storage
    .from(BRAND_GUIDELINES_BUCKET)
    .upload(storagePath, buf, { contentType, upsert: true });
  if (uploadErr) {
    console.error("Storage upload error:", uploadErr);
    return null;
  }
  const { data } = supabase.storage
    .from(BRAND_GUIDELINES_BUCKET)
    .getPublicUrl(storagePath);
  return { storagePath, publicUrl: data.publicUrl };
}

export async function exportAndUploadAssets(opts: {
  accessToken: string;
  fileKey: string;
  guidelineId: string;
  assets: Partial<CIAsset>[];
  supabase: SupabaseLike;
  maxExports?: number;
}): Promise<{ uploaded: number; failed: number }> {
  const { accessToken, fileKey, guidelineId, assets, supabase } = opts;
  const maxExports = opts.maxExports ?? 60;

  const pending = assets.filter(
    (a) => a.metadata?.pending_export && a.metadata?.figma_node_id
  );
  if (!pending.length) return { uploaded: 0, failed: 0 };

  const ordered = [
    ...pending.filter((a) => a.section_id),
    ...pending.filter((a) => !a.section_id),
  ].slice(0, maxExports);

  const svgIds = ordered
    .filter((a) => a.metadata?.prefer_svg)
    .map((a) => String(a.metadata!.figma_node_id));
  const pngOnlyIds = ordered
    .filter((a) => !a.metadata?.prefer_svg)
    .map((a) => String(a.metadata!.figma_node_id));
  const pngIds = [...new Set([...pngOnlyIds, ...svgIds])];

  let pngMap: Record<string, string | null> = {};
  let svgMap: Record<string, string | null> = {};
  try {
    if (pngIds.length) {
      pngMap = await renderFigmaImages(accessToken, fileKey, pngIds, {
        format: "png",
        scale: 2,
      });
    }
    if (svgIds.length) {
      svgMap = await renderFigmaImages(accessToken, fileKey, svgIds, {
        format: "svg",
        scale: 1,
      });
    }
  } catch (err) {
    console.error("Figma image render failed:", err);
    return { uploaded: 0, failed: ordered.length };
  }

  let uploaded = 0;
  let failed = 0;

  for (const asset of ordered) {
    const nodeId = String(asset.metadata!.figma_node_id);
    const isSvg = Boolean(asset.metadata?.prefer_svg);
    const displayUrl = isSvg ? svgMap[nodeId] : pngMap[nodeId];
    if (!displayUrl) {
      failed++;
      continue;
    }

    try {
      const res = await fetch(displayUrl);
      if (!res.ok) {
        failed++;
        continue;
      }
      const buf = await res.arrayBuffer();
      const ext = isSvg ? "svg" : "png";
      const contentType = isSvg ? "image/svg+xml" : "image/png";
      const put = await uploadBuffer(
        supabase,
        guidelineId,
        String(asset.label || nodeId),
        ext,
        buf,
        contentType
      );
      if (!put) {
        failed++;
        continue;
      }

      asset.storage_path = put.storagePath;
      asset.public_url = put.publicUrl;
      const meta: Record<string, unknown> = {
        ...(asset.metadata || {}),
        pending_export: false,
        figma_export_url_expired: true,
        uploaded_at: new Date().toISOString(),
      };

      const pngRemote = pngMap[nodeId];
      if (isSvg && pngRemote) {
        try {
          const pngRes = await fetch(pngRemote);
          if (pngRes.ok) {
            const pngBuf = await pngRes.arrayBuffer();
            const pngPut = await uploadBuffer(
              supabase,
              guidelineId,
              String(asset.label || nodeId),
              "png",
              pngBuf,
              "image/png"
            );
            if (pngPut) {
              meta.png_url = pngPut.publicUrl;
              meta.png_storage_path = pngPut.storagePath;
            }
          }
        } catch (err) {
          console.error("PNG sibling upload failed:", err);
        }
      } else if (!isSvg) {
        meta.png_url = put.publicUrl;
        meta.png_storage_path = put.storagePath;
      }

      asset.metadata = meta;
      uploaded++;
    } catch (err) {
      console.error("Asset export/upload failed:", err);
      failed++;
    }
  }

  return { uploaded, failed };
}
