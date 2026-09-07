export const CONTENT_PLATFORMS = ["linkedin", "instagram"] as const;
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

export type CalendarStatus = "draft" | "in_review" | "approved";
export type ApprovalStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "on_hold"
  | "needs_revision";
export type ProductionStatus = "wip" | "live";
export type AdStatus = "organic" | "paid";

export type VisualBrief = {
  background?: string;
  graphic_description?: string;
  style_notes?: string;
  animation_mechanics?: string;
  typography_notes?: string;
  /** Reel / video production (JSON keys, no extra columns). */
  first_frame?: string;
  last_frame?: string;
  video_prompt?: string;
};

/** IG Story planning (also used as companion notes on feed posts). */
export type StoryStickerType =
  | "poll"
  | "question"
  | "link"
  | "dm"
  | "countdown"
  | "slider"
  | "none"
  | string;

export type StoryRepost = {
  strategy_text: string;
  sticker_type: StoryStickerType;
  /** Primary link sticker / CTA URL (quiz, site, etc.). */
  link_url?: string;
  link_label?: string;
  /** Suggested stickers checklist (poll + link, etc.). */
  stickers?: string[];
  cta_hint?: string;
  music_hint?: string | null;
  frame_notes?: string;
};

/** Alias — richer story plan lives in story_repost jsonb. */
export type StoryPlan = StoryRepost;

export type CaptionMap = Record<string, Record<string, string>>;

export type ContentMediaKind = "image" | "carousel" | "video";
export type ContentMediaSource = "upload" | "live_ig" | "live_li" | "reuse" | "url";

export type ContentMediaItem = {
  id: string;
  url: string;
  kind: "image" | "video";
  poster_url?: string;
  source: ContentMediaSource;
  storage_path?: string;
};

export type PublishedLinks = {
  instagram?: string;
  linkedin?: string;
};

export type VersionSnapshot = {
  at: string;
  kind: "angle" | "full" | "edit";
  hook_angle?: string | null;
  captions?: CaptionMap;
  hashtags?: CaptionMap;
  visual_brief?: VisualBrief;
  voiceover_script?: Record<string, string>;
  story_repost?: StoryRepost | null;
};

export type SocialCoverKind = "company" | "employee";

export type SocialCoverOption = {
  id: string;
  label: string;
  url: string;
  kind: SocialCoverKind;
  preferred?: boolean;
};

export type LinkedInEmployeeCopy = {
  about_de: string;
  about_en: string;
  experience_bullets_de: string[];
  experience_bullets_en: string[];
  company_url: string;
};

export type ContentSocialAssets = {
  /** Legacy preferred employee cover URL (mirrored from employee_covers). */
  linkedin_employee_cover_url?: string | null;
  company_covers: SocialCoverOption[];
  employee_covers: SocialCoverOption[];
  linkedin_employee_copy: LinkedInEmployeeCopy;
};

export type ContentSettings = {
  project_id: string;
  pillars: string[];
  languages: string[];
  client_languages: string[];
  platform_personas: Record<string, string>;
  cadence: Record<string, number>;
  next_post_number: number;
  /** Project-level social assets (LinkedIn covers + employee copy kit). */
  social_assets: ContentSocialAssets;
};

export type ContextDoc = {
  id: string;
  project_id: string;
  filename: string;
  file_url: string | null;
  file_path: string | null;
  mime_type: string | null;
  extracted_text: string;
  active: boolean;
  uploaded_at: string;
};

export type ContentCalendar = {
  id: string;
  project_id: string;
  period_start: string;
  status: CalendarStatus;
  theme_notes: string | null;
};

export type ContentPost = {
  id: string;
  calendar_id: string;
  project_id: string;
  post_number: number;
  platforms: string[];
  scheduled_date: string;
  pillar: string | null;
  hook_angle: string | null;
  visual_brief: VisualBrief;
  /** Derived cover URL (first media slide / poster) for cards & export. */
  visual_asset_url: string | null;
  /** @deprecated Prefer published_links.instagram. Kept for Live IG guards. */
  published_permalink: string | null;
  published_links: PublishedLinks;
  media_kind: ContentMediaKind;
  /** Shared creative slides. */
  media: ContentMediaItem[];
  /** Optional per-platform overrides; empty means use shared media. */
  media_by_platform: Partial<Record<ContentPlatform, ContentMediaItem[]>>;
  /** feed | reel | story (IG Stories 9:16). */
  visual_format: "feed" | "reel" | "story";
  captions: CaptionMap;
  /** @deprecated Prefer hashtags inside captions. Kept for legacy rows. */
  hashtags: CaptionMap;
  /**
   * Short DE/EN captions colleagues use when resharing a LinkedIn company post
   * as Team #sign2x. Empty object when not a LinkedIn post / not filled.
   */
  team_reshare_captions: Record<string, string>;
  voiceover_script: Record<string, string>;
  ad_status: AdStatus;
  story_repost: StoryRepost | null;
  /** Story → optional parent feed/reel; null = standalone Story. */
  linked_post_id: string | null;
  is_video: boolean;
  status_production: ProductionStatus;
  status_approval: ApprovalStatus;
  angle_approved: boolean;
  locked: boolean;
  remarks: string | null;
  version_history: VersionSnapshot[];
};

export type ContentComment = {
  id: string;
  post_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  resolved: boolean;
  created_at: string;
};

export type CiContextSource = {
  label: string;
  slug: string | null;
  status: string | null;
  text: string;
  chars: number;
};

export type AssembledContext = {
  ci: CiContextSource | null;
  docs: { id: string; filename: string; chars: number; active: boolean }[];
  settings: ContentSettings;
  text: string;
  chars: number;
  truncated: boolean;
};

export const CONTEXT_SOFT_LIMIT = 12_000;
export const CONTEXT_HARD_LIMIT = 16_000;

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  draft: "Draft",
  needs_review: "Needs review",
  approved: "Approved",
  on_hold: "On hold",
  needs_revision: "Needs revision",
};

export function postLabel(n: number) {
  return `#${String(n).padStart(3, "0")}`;
}

export function monthStart(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthLabel(iso: string) {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function shiftMonth(iso: string, delta: number) {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1);
  return monthStart(d);
}

export function captionAt(
  map: CaptionMap | undefined,
  platform: string,
  lang: string
) {
  return map?.[platform]?.[lang] || "";
}

/** Merge legacy hashtags into captions for display / editing / MCP. */
export function captionsWithHashtags(post: {
  captions?: CaptionMap | null;
  hashtags?: CaptionMap | null;
}): CaptionMap {
  const out: CaptionMap = {};
  for (const [plat, langs] of Object.entries(post.captions || {})) {
    out[plat] = { ...(langs || {}) };
  }
  for (const [plat, langs] of Object.entries(post.hashtags || {})) {
    out[plat] = out[plat] || {};
    for (const [lang, tags] of Object.entries(langs || {})) {
      const tag = String(tags || "").trim();
      if (!tag) continue;
      const cap = String(out[plat][lang] || "").trim();
      if (!cap) out[plat][lang] = tag;
      else if (!cap.includes(tag)) out[plat][lang] = `${cap}\n\n${tag}`;
    }
  }
  return out;
}

/** Read caption for a language across platforms (prefer first non-empty). */
export function captionForLang(
  map: CaptionMap | undefined,
  platforms: string[],
  lang: string
) {
  for (const platform of platforms) {
    const v = captionAt(map, platform, lang);
    if (v.trim()) return v;
  }
  return "";
}

/** Write the same caption text to every platform for a language. */
export function setCaptionForLang(
  map: CaptionMap,
  platforms: string[],
  lang: string,
  text: string
): CaptionMap {
  const next: CaptionMap = { ...map };
  for (const platform of platforms) {
    next[platform] = { ...(next[platform] || {}), [lang]: text };
  }
  return next;
}
