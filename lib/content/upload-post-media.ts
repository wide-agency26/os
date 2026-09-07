import { createAdminClient } from "@/utils/supabase/admin";
import { mapPost } from "@/lib/content/load";
import { applyMcpContentMediaInput } from "@/lib/content/post-patch";
import {
  CONTENT_MEDIA_IMAGE_MAX_BYTES,
  CONTENT_MEDIA_VIDEO_MAX_BYTES,
  createMediaItem,
  guessMediaMime,
  isPublicMediaUrl,
  isVideoMime,
  publicMediaUrlError,
  safeMediaFilename,
  validatePublicMediaUrls,
} from "@/lib/content/media";
import type { ContentPlatform } from "@/lib/content/types";

export async function uploadContentPostMediaBytes(input: {
  postId: string;
  filename: string;
  bytes: Buffer;
  mimeType?: string | null;
  platform?: ContentPlatform | "shared";
  attach?: boolean;
}): Promise<
  | { ok: true; url: string; path: string; item: ReturnType<typeof createMediaItem> }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const { data: existing, error: loadErr } = await admin
    .from("content_posts")
    .select("*")
    .eq("id", input.postId)
    .maybeSingle();
  if (loadErr) return { ok: false, error: loadErr.message };
  if (!existing) return { ok: false, error: "Post not found." };
  if (existing.status_production === "live") {
    return { ok: false, error: "Live posts cannot receive uploads. Revert to wip first." };
  }

  if (!input.bytes.length) return { ok: false, error: "File is empty." };
  const mime = guessMediaMime(input.filename, input.mimeType || null);
  const max = isVideoMime(mime) ? CONTENT_MEDIA_VIDEO_MAX_BYTES : CONTENT_MEDIA_IMAGE_MAX_BYTES;
  if (input.bytes.length > max) {
    return {
      ok: false,
      error: isVideoMime(mime) ? "Video preview is over 50 MB." : "Image is over 10 MB.",
    };
  }

  const projectId = String(existing.project_id);
  const path = `${projectId}/${input.postId}/${Date.now()}-${safeMediaFilename(input.filename)}`;
  const { error: upErr } = await admin.storage.from("content-media").upload(path, input.bytes, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: pub } = admin.storage.from("content-media").getPublicUrl(path);
  const url = pub.publicUrl;
  if (!isPublicMediaUrl(url)) {
    return { ok: false, error: "Upload succeeded but public URL is invalid." };
  }

  const item = createMediaItem({
    url,
    kind: isVideoMime(mime) ? "video" : "image",
    source: "upload",
    storage_path: path,
  });

  if (input.attach !== false) {
    const post = mapPost(existing);
    const platform = input.platform || "shared";
    let media = [...post.media];
    let media_by_platform = { ...post.media_by_platform };
    if (platform === "shared") {
      media = [...media, item];
    } else {
      media_by_platform = {
        ...media_by_platform,
        [platform]: [...(media_by_platform[platform] || []), item],
      };
    }
    const patch: Record<string, unknown> = {
      media,
      media_by_platform,
      updated_at: new Date().toISOString(),
    };
    applyMcpContentMediaInput(patch, existing);
    const { error: saveErr } = await admin
      .from("content_posts")
      .update(patch)
      .eq("id", input.postId);
    if (saveErr) return { ok: false, error: saveErr.message };
  }

  return { ok: true, url, path, item };
}

function filenameFromUrl(url: string, fallback = "media.jpg") {
  try {
    const base = new URL(url).pathname.split("/").pop() || "";
    const clean = safeMediaFilename(decodeURIComponent(base));
    return clean.includes(".") ? clean : fallback;
  } catch {
    return fallback;
  }
}

/** Fetch a public https image and upload to content-media (for MCP bots with CDN URLs). */
export async function ingestContentPostMediaFromUrl(input: {
  postId: string;
  url: string;
  filename?: string | null;
  platform?: ContentPlatform | "shared";
  attach?: boolean;
}): Promise<
  | { ok: true; url: string; path: string; item: ReturnType<typeof createMediaItem> }
  | { ok: false; error: string }
> {
  const raw = String(input.url || "").trim();
  if (!raw) return { ok: false, error: "url is required." };
  if (!isPublicMediaUrl(raw)) return { ok: false, error: publicMediaUrlError(raw) };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "url must be a valid http(s) URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "url must be http or https." };
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "127.0.0.1") {
    return { ok: false, error: "Private/local URLs cannot be ingested." };
  }

  let res: Response;
  try {
    res = await fetch(raw, { redirect: "follow" });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to fetch URL.",
    };
  }
  if (!res.ok) return { ok: false, error: `Fetch failed (${res.status}).` };

  const contentType = res.headers.get("content-type") || "";
  if (contentType && !/^image\//i.test(contentType) && !/^video\//i.test(contentType)) {
    return { ok: false, error: `URL is not an image or video (${contentType || "unknown type"}).` };
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  const filename =
    input.filename?.trim() ||
    filenameFromUrl(raw, contentType.includes("video") ? "media.mp4" : "media.jpg");

  return uploadContentPostMediaBytes({
    postId: input.postId,
    filename,
    bytes,
    mimeType: contentType.split(";")[0] || null,
    platform: input.platform,
    attach: input.attach,
  });
}

export function collectMediaUrlsFromPatch(patch: Record<string, unknown>): string[] {
  const urls: string[] = [];
  if (patch.visual_asset_url) urls.push(String(patch.visual_asset_url));
  if (Array.isArray(patch.image_urls)) {
    for (const u of patch.image_urls) urls.push(String(u));
  }
  if (Array.isArray(patch.media)) {
    for (const m of patch.media) {
      if (m && typeof m === "object") {
        const o = m as Record<string, unknown>;
        if (o.url) urls.push(String(o.url));
        if (o.poster_url) urls.push(String(o.poster_url));
      }
    }
  }
  if (patch.media_by_platform && typeof patch.media_by_platform === "object") {
    for (const list of Object.values(patch.media_by_platform as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      for (const m of list) {
        if (m && typeof m === "object") {
          const o = m as Record<string, unknown>;
          if (o.url) urls.push(String(o.url));
        }
      }
    }
  }
  return urls;
}

export function assertPublicMediaPatch(patch: Record<string, unknown>): string | null {
  return validatePublicMediaUrls(collectMediaUrlsFromPatch(patch));
}
