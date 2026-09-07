import type {
  ContentMediaItem,
  ContentMediaKind,
  ContentMediaSource,
  ContentPlatform,
  ContentPost,
  PublishedLinks,
} from "./types";

export const CONTENT_MEDIA_MAX_SLIDES = 10;
export const CONTENT_MEDIA_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const CONTENT_MEDIA_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

const MEDIA_SOURCES: ContentMediaSource[] = [
  "upload",
  "live_ig",
  "live_li",
  "reuse",
  "url",
];

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Browser-loadable media URL (https/http only — never file:// or relative paths). */
export function isPublicMediaUrl(url: string | null | undefined): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  if (/^file:/i.test(raw)) return false;
  if (/^\/[^/]/.test(raw)) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function publicMediaUrlError(url: string): string {
  const preview = url.length > 72 ? `${url.slice(0, 72)}…` : url;
  if (/^file:/i.test(url)) {
    return `Local file paths cannot load in the calendar (${preview}). Upload with upload_content_post_media (base64) or use a public https:// URL.`;
  }
  return `Media URL must be public http(s) (${preview}). Use upload_content_post_media or Supabase/CDN https:// links.`;
}

export function validatePublicMediaUrls(urls: (string | null | undefined)[]): string | null {
  for (const raw of urls) {
    const url = String(raw || "").trim();
    if (!url) continue;
    if (!isPublicMediaUrl(url)) return publicMediaUrlError(url);
  }
  return null;
}

export function safeMediaFilename(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "media";
}

export function parseMediaItem(raw: unknown): ContentMediaItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const url = String(o.url || "").trim();
  if (!url || !isPublicMediaUrl(url)) return null;
  const kind = o.kind === "video" ? "video" : "image";
  const source = MEDIA_SOURCES.includes(o.source as ContentMediaSource)
    ? (o.source as ContentMediaSource)
    : "url";
  return {
    id: String(o.id || newId()),
    url,
    kind,
    poster_url: o.poster_url ? String(o.poster_url) : undefined,
    source,
    storage_path: o.storage_path ? String(o.storage_path) : undefined,
  };
}

export function parseMediaList(raw: unknown): ContentMediaItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseMediaItem).filter(Boolean) as ContentMediaItem[];
}

export function parseMediaByPlatform(
  raw: unknown
): Partial<Record<ContentPlatform, ContentMediaItem[]>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<ContentPlatform, ContentMediaItem[]>> = {};
  for (const key of ["linkedin", "instagram"] as ContentPlatform[]) {
    const list = parseMediaList((raw as Record<string, unknown>)[key]);
    if (list.length) out[key] = list;
  }
  return out;
}

export function parsePublishedLinks(raw: unknown, legacyPermalink?: string | null): PublishedLinks {
  const out: PublishedLinks = {};
  if (raw && typeof raw === "object") {
    const ig = String((raw as Record<string, unknown>).instagram || "").trim();
    const li = String((raw as Record<string, unknown>).linkedin || "").trim();
    if (ig) out.instagram = ig;
    if (li) out.linkedin = li;
  }
  if (!out.instagram && legacyPermalink?.trim()) {
    out.instagram = legacyPermalink.trim();
  }
  return out;
}

export function resolveMediaKind(
  value: unknown,
  fallback?: { is_video?: boolean; visual_format?: string; media?: ContentMediaItem[] }
): ContentMediaKind {
  if (value === "image" || value === "carousel" || value === "video") return value;
  if (fallback?.is_video || fallback?.visual_format === "reel") return "video";
  const n = fallback?.media?.length || 0;
  if (n > 1) return "carousel";
  return "image";
}

/** Cover URL for cards / export (first image or video poster). */
export function coverUrlFromMedia(items: ContentMediaItem[]): string | null {
  for (const item of items) {
    if (item.kind === "video") {
      if (item.poster_url) return item.poster_url;
      if (item.url && isPublicMediaUrl(item.url)) return item.url;
      continue;
    }
    if (item.url && isPublicMediaUrl(item.url)) return item.url;
  }
  return null;
}

export function resolvePostMedia(
  post: Pick<ContentPost, "media" | "media_by_platform" | "visual_asset_url">,
  platform?: string | null
): ContentMediaItem[] {
  if (platform === "linkedin" || platform === "instagram") {
    const override = post.media_by_platform?.[platform];
    if (override && override.length) return override;
  }
  if (post.media?.length) return post.media;
  if (post.visual_asset_url && isPublicMediaUrl(post.visual_asset_url)) {
    return [
      {
        id: "legacy",
        url: post.visual_asset_url,
        kind: "image",
        source: "url",
      },
    ];
  }
  return [];
}

export function deriveVisualAssetUrl(
  post: Pick<ContentPost, "media" | "media_by_platform" | "visual_asset_url" | "platforms">
): string | null {
  const platforms = post.platforms?.length ? post.platforms : ["instagram", "linkedin"];
  for (const p of platforms) {
    const cover = coverUrlFromMedia(resolvePostMedia(post, p));
    if (cover) return cover;
  }
  return coverUrlFromMedia(resolvePostMedia(post)) ||
    (isPublicMediaUrl(post.visual_asset_url) ? post.visual_asset_url : null);
}

export function syncPublishedPermalink(links: PublishedLinks): string | null {
  return links.instagram?.trim() || null;
}

export function mediaKindToIsVideo(kind: ContentMediaKind): boolean {
  return kind === "video";
}

export function normalizeMediaKindFromCount(
  kind: ContentMediaKind,
  count: number
): ContentMediaKind {
  if (kind === "video") return "video";
  if (count > 1) return "carousel";
  return "image";
}

export function createMediaItem(input: {
  url: string;
  kind?: "image" | "video";
  source?: ContentMediaSource;
  poster_url?: string | null;
  storage_path?: string | null;
  id?: string;
}): ContentMediaItem {
  return {
    id: input.id || newId(),
    url: input.url.trim(),
    kind: input.kind || "image",
    source: input.source || "upload",
    poster_url: input.poster_url || undefined,
    storage_path: input.storage_path || undefined,
  };
}

export function isValidLinkedInPostUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const u = new URL(url.trim());
    if (!/linkedin\.com$/i.test(u.hostname.replace(/^www\./, ""))) {
      if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return false;
    }
    return (
      /\/(posts|feed\/update|pulse)\//i.test(u.pathname) ||
      /\/activity-\d+/i.test(u.pathname) ||
      u.searchParams.has("shareId") ||
      /urn:li:/i.test(url)
    );
  } catch {
    return false;
  }
}

export function guessMediaMime(filename: string, mime: string | null): string {
  if (mime && mime !== "application/octet-stream") return mime;
  const n = filename.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".mp4")) return "video/mp4";
  if (n.endsWith(".webm")) return "video/webm";
  if (n.endsWith(".mov")) return "video/quicktime";
  return mime || "application/octet-stream";
}

export function isVideoMime(mime: string) {
  return mime.startsWith("video/");
}
