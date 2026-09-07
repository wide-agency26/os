import { createAdminClient } from "@/utils/supabase/admin";
import { isValidIgPermalink } from "@/lib/reports/instagram-organic";
import { mapPost } from "@/lib/content/load";
import type { ContentPost } from "@/lib/content/types";

type IgMediaHint = {
  media_id?: string;
  caption?: string;
  created_at?: string;
  post_url?: string;
  thumbnail_url?: string;
};

function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function normText(s: string) {
  return s
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function overlapScore(a: string, b: string): number {
  const ta = new Set(normText(a).split(" ").filter((w) => w.length > 2));
  const tb = new Set(normText(b).split(" ").filter((w) => w.length > 2));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const w of ta) if (tb.has(w)) hit++;
  return hit / Math.max(ta.size, tb.size);
}

function calendarCaption(post: ContentPost): string {
  const caps = post.captions || {};
  for (const plat of post.platforms.length ? post.platforms : ["instagram", "linkedin"]) {
    const langs = caps[plat] || {};
    for (const v of Object.values(langs)) {
      if (String(v || "").trim()) return String(v);
    }
  }
  return post.hook_angle || "";
}

function daysApart(a: string, b: string): number {
  const da = Date.parse(`${a}T12:00:00Z`);
  const db = Date.parse(`${b}T12:00:00Z`);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 99;
  return Math.abs(Math.round((da - db) / 86400000));
}

/**
 * Match Meta / dataset IG media to calendar posts: fill permalink + thumb,
 * and auto-Live strong matches on past WIP so they leave the miss list.
 */
export async function linkLiveInstagramPosts(
  projectId: string,
  media: IgMediaHint[]
): Promise<{ linked: number; autoLive: number }> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("content_posts")
    .select("*")
    .eq("project_id", projectId)
    .contains("platforms", ["instagram"]);

  const posts = ((rows || []) as any[]).map(mapPost) as ContentPost[];
  let linked = 0;
  let autoLive = 0;

  const usableMedia = media.filter((m) => isValidIgPermalink(m.post_url || ""));

  for (const post of posts) {
    if (isValidIgPermalink(post.published_permalink)) continue;

    const hook = post.hook_angle || "";
    const cap = calendarCaption(post);
    let best: { m: IgMediaHint; score: number } | null = null;

    for (const m of usableMedia) {
      const md = dayKey(m.created_at);
      if (!md || daysApart(md, post.scheduled_date) > 1) continue;
      const score = Math.max(
        overlapScore(hook, m.caption || ""),
        overlapScore(cap, m.caption || ""),
        // Empty calendar caption: date proximity alone is weak — require some caption on media
        !normText(hook) && !normText(cap) ? 0.15 : 0
      );
      if (score < 0.22) continue;
      if (!best || score > best.score) best = { m, score };
    }

    if (!best) continue;

    const patch: Record<string, unknown> = {
      published_permalink: best.m.post_url,
      updated_at: new Date().toISOString(),
    };
    if (!post.visual_asset_url && best.m.thumbnail_url) {
      patch.visual_asset_url = best.m.thumbnail_url;
    }
    if (best.m.thumbnail_url) {
      const existingMedia = Array.isArray(post.media) ? post.media : [];
      const withoutLive = existingMedia.filter((m: any) => m?.source !== "live_ig");
      patch.media = [
        {
          id: crypto.randomUUID(),
          url: best.m.thumbnail_url,
          kind: post.media_kind === "video" || post.is_video ? "video" : "image",
          source: "live_ig",
        },
        ...withoutLive,
      ];
      if (!post.media_kind || post.media_kind === "image") {
        patch.media_kind = post.is_video ? "video" : existingMedia.length > 1 ? "carousel" : "image";
      }
    }

    const strong = best.score >= 0.35;
    const shouldAutoLive =
      strong &&
      post.status_production !== "live" &&
      (post.status_production === "wip" || true);

    if (shouldAutoLive) {
      patch.status_production = "live";
      patch.locked = true;
      autoLive += 1;
    }

    const { error } = await admin.from("content_posts").update(patch).eq("id", post.id);
    if (!error) linked += 1;
  }

  return { linked, autoLive };
}
