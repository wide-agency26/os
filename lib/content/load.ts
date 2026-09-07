import { mapSettings } from "./assemble";
import {
  coverUrlFromMedia,
  parseMediaByPlatform,
  parseMediaList,
  parsePublishedLinks,
  resolveMediaKind,
  resolvePostMedia,
} from "./media";
import type {
  ContentCalendar,
  ContentComment,
  ContentPost,
  ContentSettings,
  ContextDoc,
} from "./types";

type Sb = any;

export function mapPost(row: any): ContentPost {
  const media = parseMediaList(row.media);
  const media_by_platform = parseMediaByPlatform(row.media_by_platform);
  const published_links = parsePublishedLinks(row.published_links, row.published_permalink);
  const media_kind = resolveMediaKind(row.media_kind, {
    is_video: Boolean(row.is_video),
    visual_format: row.visual_format,
    media,
  });
  const isVideo = media_kind === "video" || Boolean(row.is_video);
  const visual_format =
    row.visual_format === "feed" ||
    row.visual_format === "reel" ||
    row.visual_format === "story"
      ? row.visual_format
      : isVideo
        ? "reel"
        : "feed";
  const platforms = row.platforms || ["linkedin", "instagram"];
  const derivedCover =
    coverUrlFromMedia(resolvePostMedia({ media, media_by_platform, visual_asset_url: null }, platforms[0])) ||
    coverUrlFromMedia(media) ||
    row.visual_asset_url ||
    null;
  const story_repost =
    row.story_repost && typeof row.story_repost === "object"
      ? {
          strategy_text: String(row.story_repost.strategy_text || ""),
          sticker_type: String(row.story_repost.sticker_type || "none"),
          ...(row.story_repost.link_url
            ? { link_url: String(row.story_repost.link_url) }
            : {}),
          ...(row.story_repost.link_label
            ? { link_label: String(row.story_repost.link_label) }
            : {}),
          ...(Array.isArray(row.story_repost.stickers)
            ? { stickers: row.story_repost.stickers.map(String) }
            : {}),
          ...(row.story_repost.cta_hint
            ? { cta_hint: String(row.story_repost.cta_hint) }
            : {}),
          ...(row.story_repost.music_hint !== undefined
            ? { music_hint: row.story_repost.music_hint }
            : {}),
          ...(row.story_repost.frame_notes
            ? { frame_notes: String(row.story_repost.frame_notes) }
            : {}),
        }
      : null;
  return {
    id: row.id,
    calendar_id: row.calendar_id,
    project_id: row.project_id,
    post_number: Number(row.post_number),
    platforms,
    scheduled_date: row.scheduled_date,
    pillar: row.pillar,
    hook_angle: row.hook_angle,
    visual_brief: row.visual_brief || {},
    visual_asset_url: derivedCover,
    published_permalink: published_links.instagram || row.published_permalink || null,
    published_links,
    media_kind,
    media,
    media_by_platform,
    visual_format,
    captions: row.captions || {},
    hashtags: row.hashtags || {},
    team_reshare_captions:
      row.team_reshare_captions && typeof row.team_reshare_captions === "object"
        ? row.team_reshare_captions
        : {},
    voiceover_script: row.voiceover_script || {},
    ad_status: row.ad_status || "organic",
    story_repost,
    linked_post_id: row.linked_post_id || null,
    is_video: isVideo,
    status_production: row.status_production || "wip",
    status_approval: row.status_approval || "draft",
    angle_approved: Boolean(row.angle_approved),
    locked: Boolean(row.locked),
    remarks: row.remarks,
    version_history: Array.isArray(row.version_history) ? row.version_history : [],
  };
}

export async function ensureSettings(
  supabase: Sb,
  projectId: string
): Promise<ContentSettings> {
  const { data } = await supabase
    .from("content_settings")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (data) return mapSettings(data, projectId);
  const seed = mapSettings(null, projectId);
  await supabase.from("content_settings").insert([
    {
      project_id: projectId,
      pillars: seed.pillars,
      languages: seed.languages,
      client_languages: seed.client_languages,
      platform_personas: seed.platform_personas,
      cadence: seed.cadence,
      next_post_number: 1,
      social_assets: seed.social_assets || {},
    },
  ]);
  return seed;
}

export async function ensureCalendar(
  supabase: Sb,
  projectId: string,
  periodStart: string
): Promise<ContentCalendar> {
  const { data } = await supabase
    .from("content_calendars")
    .select("*")
    .eq("project_id", projectId)
    .eq("period_start", periodStart)
    .maybeSingle();
  if (data) return data as ContentCalendar;
  const { data: created, error } = await supabase
    .from("content_calendars")
    .insert([{ project_id: projectId, period_start: periodStart, status: "draft" }])
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return created as ContentCalendar;
}

export async function loadMissedContentPosts(
  supabase: Sb,
  projectId: string
): Promise<ContentPost[]> {
  const { contentToday, isMissedPost } = await import("@/lib/content/calendar-day");
  const today = contentToday();
  const { data } = await supabase
    .from("content_posts")
    .select("*")
    .eq("project_id", projectId)
    .lt("scheduled_date", today)
    .neq("status_production", "live")
    .neq("status_approval", "on_hold")
    .order("scheduled_date", { ascending: true })
    .order("post_number");
  return ((data || []) as any[]).map(mapPost).filter((p: ContentPost) => isMissedPost(p, today));
}

export async function loadCalendarBundle(
  supabase: Sb,
  projectId: string,
  periodStart: string
): Promise<{
  settings: ContentSettings;
  calendar: ContentCalendar;
  posts: ContentPost[];
  missedPosts: ContentPost[];
  docs: ContextDoc[];
  comments: ContentComment[];
  unread: number;
}> {
  const settings = await ensureSettings(supabase, projectId);
  const calendar = await ensureCalendar(supabase, projectId, periodStart);
  const [{ data: posts }, { data: docs }, { count }, missedPosts] = await Promise.all([
    supabase
      .from("content_posts")
      .select("*")
      .eq("calendar_id", calendar.id)
      .order("scheduled_date")
      .order("post_number"),
    supabase
      .from("content_context_docs")
      .select("*")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("content_notifications")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("read_at", null),
    loadMissedContentPosts(supabase, projectId),
  ]);
  const postIds = (posts || []).map((p: any) => p.id);
  let comments: ContentComment[] = [];
  if (postIds.length) {
    const { data: c } = await supabase
      .from("content_post_comments")
      .select("*")
      .in("post_id", postIds)
      .order("created_at");
    comments = (c || []) as ContentComment[];
  }
  return {
    settings,
    calendar,
    posts: (posts || []).map(mapPost),
    missedPosts,
    docs: (docs || []) as ContextDoc[],
    comments,
    unread: count || 0,
  };
}

export async function loadClientVisibleMonth(
  supabase: Sb,
  projectId: string,
  periodStart: string
) {
  const settings = await ensureSettings(supabase, projectId);
  const { data: calendars } = await supabase
    .from("content_calendars")
    .select("id, period_start, status")
    .eq("project_id", projectId)
    .in("status", ["in_review", "approved"])
    .order("period_start", { ascending: false });
  const months = ((calendars || []) as { id: string; period_start: string; status: string }[]).map(
    (c) => String(c.period_start).slice(0, 10)
  );
  const chosen =
    periodStart && months.includes(periodStart) ? periodStart : months[0] || null;
  const visibleCal = ((calendars || []) as { id: string; period_start: string }[]).find(
    (c) => String(c.period_start).slice(0, 10) === chosen
  );
  if (!visibleCal || !chosen) {
    return { settings, months, periodStart: chosen, posts: [] as ContentPost[], comments: [] as ContentComment[] };
  }
  const { data: postRows } = await supabase
    .from("content_posts")
    .select("*")
    .eq("calendar_id", visibleCal.id)
    .in("status_approval", ["needs_review", "approved", "needs_revision"])
    .order("scheduled_date")
    .order("post_number");
  const posts = ((postRows || []) as any[]).map(mapPost).map((p: ContentPost) => ({
    ...p,
    remarks: null,
    // Keep Live so client sees posted cards; hide WIP production noise as wip.
    status_production: p.status_production === "live" ? ("live" as const) : ("wip" as const),
  }));
  const ids = posts.map((p: ContentPost) => p.id);
  let comments: ContentComment[] = [];
  if (ids.length) {
    const { data: c } = await supabase
      .from("content_post_comments")
      .select("*")
      .in("post_id", ids)
      .order("created_at");
    comments = (c || []) as ContentComment[];
  }
  return { settings, months, periodStart: chosen, posts, comments };
}

export async function allocatePostNumbers(
  supabase: Sb,
  projectId: string,
  count: number
): Promise<number[]> {
  const settings = await ensureSettings(supabase, projectId);
  const { data: maxRow } = await supabase
    .from("content_posts")
    .select("post_number")
    .eq("project_id", projectId)
    .order("post_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const maxExisting = Number(maxRow?.post_number) || 0;
  const start = Math.max(settings.next_post_number || 1, maxExisting + 1);
  await supabase
    .from("content_settings")
    .update({
      next_post_number: start + count,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId);
  return Array.from({ length: count }, (_, i) => start + i);
}
