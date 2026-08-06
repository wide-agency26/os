/**
 * Download Figma-rendered images and upload into brand-guidelines storage.
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

  // Prefer section-assigned first, limit total
  const ordered = [
    ...pending.filter((a) => a.section_id),
    ...pending.filter((a) => !a.section_id),
  ].slice(0, maxExports);

  const svgIds = ordered
    .filter((a) => a.metadata?.prefer_svg)
    .map((a) => String(a.metadata!.figma_node_id));
  const pngIds = ordered
    .filter((a) => !a.metadata?.prefer_svg)
    .map((a) => String(a.metadata!.figma_node_id));

  let imageMap: Record<string, string | null> = {};
  try {
    if (pngIds.length) {
      imageMap = {
        ...imageMap,
        ...(await renderFigmaImages(accessToken, fileKey, pngIds, {
          format: "png",
          scale: 2,
        })),
      };
    }
    if (svgIds.length) {
      imageMap = {
        ...imageMap,
        ...(await renderFigmaImages(accessToken, fileKey, svgIds, {
          format: "svg",
          scale: 1,
        })),
      };
    }
  } catch (err) {
    console.error("Figma image render failed:", err);
    return { uploaded: 0, failed: ordered.length };
  }

  let uploaded = 0;
  let failed = 0;

  for (const asset of ordered) {
    const nodeId = String(asset.metadata!.figma_node_id);
    const url = imageMap[nodeId];
    if (!url) {
      failed++;
      continue;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) {
        failed++;
        continue;
      }
      const buf = await res.arrayBuffer();
      const isSvg = asset.metadata?.prefer_svg;
      const ext = isSvg ? "svg" : "png";
      const contentType = isSvg ? "image/svg+xml" : "image/png";
      const safe = sanitizeStorageFileName(
        `${asset.label || nodeId}.${ext}`.replace(/\s+/g, "_")
      );
      const storagePath = `${guidelineId}/figma/${Date.now()}_${safe}`;

      const { error: uploadErr } = await supabase.storage
        .from(BRAND_GUIDELINES_BUCKET)
        .upload(storagePath, buf, { contentType, upsert: true });

      if (uploadErr) {
        console.error("Storage upload error:", uploadErr);
        failed++;
        continue;
      }

      const { data } = supabase.storage
        .from(BRAND_GUIDELINES_BUCKET)
        .getPublicUrl(storagePath);

      asset.storage_path = storagePath;
      asset.public_url = data.publicUrl;
      asset.metadata = {
        ...(asset.metadata || {}),
        pending_export: false,
        figma_export_url_expired: true,
        uploaded_at: new Date().toISOString(),
      };
      uploaded++;
    } catch (err) {
      console.error("Asset export/upload failed:", err);
      failed++;
    }
  }

  return { uploaded, failed };
}
