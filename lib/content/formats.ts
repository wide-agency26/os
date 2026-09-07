/** Social visual formats for content calendar. Feed targets differ by platform. */

export const CONTENT_VISUAL_FORMATS = ["feed", "reel", "story"] as const;
export type ContentVisualFormat = (typeof CONTENT_VISUAL_FORMATS)[number];

export type ContentFeedPlatform = "instagram" | "linkedin";

export type VisualFormatSpec = {
  id: ContentVisualFormat;
  label: string;
  aspect: string;
  aspectCss: string; // CSS aspect-ratio value
  width: number;
  height: number;
  shortLabel: string;
};

/** LinkedIn-default feed spec (backward compat for cards / export). */
export const VISUAL_FORMAT_SPECS: Record<ContentVisualFormat, VisualFormatSpec> = {
  feed: {
    id: "feed",
    label: "Feed post",
    aspect: "4:3",
    aspectCss: "4 / 3",
    width: 1350,
    height: 1080,
    shortLabel: "4:3 · 1350×1080",
  },
  reel: {
    id: "reel",
    label: "Reel / video",
    aspect: "9:16",
    aspectCss: "9 / 16",
    width: 1080,
    height: 1920,
    shortLabel: "9:16 · 1080×1920",
  },
  story: {
    id: "story",
    label: "IG Story",
    aspect: "9:16",
    aspectCss: "9 / 16",
    width: 1080,
    height: 1920,
    shortLabel: "Story · 9:16 · 1080×1920",
  },
};

export const PLATFORM_FEED_SPECS: Record<ContentFeedPlatform, VisualFormatSpec> = {
  instagram: {
    id: "feed",
    label: "Instagram feed",
    aspect: "4:5",
    aspectCss: "4 / 5",
    width: 1080,
    height: 1350,
    shortLabel: "4:5 · 1080×1350",
  },
  linkedin: {
    id: "feed",
    label: "LinkedIn feed",
    aspect: "4:3",
    aspectCss: "4 / 3",
    width: 1350,
    height: 1080,
    shortLabel: "4:3 · 1350×1080",
  },
};

export function resolveVisualFormat(
  value: string | null | undefined,
  isVideo?: boolean
): ContentVisualFormat {
  if (value === "feed" || value === "reel" || value === "story") return value;
  return isVideo ? "reel" : "feed";
}

export function formatSpecFor(
  value: string | null | undefined,
  isVideo?: boolean
): VisualFormatSpec {
  return VISUAL_FORMAT_SPECS[resolveVisualFormat(value, isVideo)];
}

export function feedSpecForPlatform(
  platform: ContentFeedPlatform,
  value?: string | null,
  isVideo?: boolean
): VisualFormatSpec {
  const fmt = resolveVisualFormat(value, isVideo);
  if (fmt === "reel" || fmt === "story") return VISUAL_FORMAT_SPECS[fmt];
  return PLATFORM_FEED_SPECS[platform];
}

export const FEED_UPLOAD_HINT = `IG ${PLATFORM_FEED_SPECS.instagram.shortLabel} · LI ${PLATFORM_FEED_SPECS.linkedin.shortLabel}`;

/** Primary feed platform for size labels / aspect on calendar cards. */
export function primaryFeedPlatform(
  platforms: string[] | null | undefined
): ContentFeedPlatform {
  const list = (platforms || []).map((p) => String(p).toLowerCase());
  if (list.includes("instagram") && !list.includes("linkedin")) return "instagram";
  if (list.includes("linkedin") && !list.includes("instagram")) return "linkedin";
  if (list.includes("instagram")) return "instagram";
  return "linkedin";
}

/** Platform-aware format spec (IG feed 1080×1350, LI feed 1350×1080). */
export function formatSpecForPost(
  post: {
    platforms?: string[] | null;
    visual_format?: string | null;
    is_video?: boolean | null;
    media_kind?: string | null;
  }
): VisualFormatSpec {
  const isVideo = Boolean(post.is_video || post.media_kind === "video");
  return feedSpecForPlatform(
    primaryFeedPlatform(post.platforms),
    post.visual_format,
    isVideo
  );
}

export function isStoryPost(post: { visual_format?: string | null }) {
  return post.visual_format === "story";
}
