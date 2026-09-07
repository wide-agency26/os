/**
 * Parse Meta GDPR `past_instagram_insights` JSON into Data Hub row shapes
 * matching existing Sign2x Social datasets (instagram_posts / organic / etc.).
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

export type IgExportDataset = {
  name: string;
  category: "Social";
  subcategory:
    | "instagram_posts"
    | "instagram_organic"
    | "instagram_profiles_reached"
    | "instagram_content_interactions";
  rows: Record<string, unknown>[];
};

function smd(entry: any): Record<string, any> {
  const map = entry?.string_map_data || {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(map) as [string, any][]) {
    out[k] = v?.value ?? "";
    if (v?.timestamp) out[`__ts_${k}`] = v.timestamp;
  }
  return out;
}

function parseNum(raw: unknown): number {
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (!s || s === "--" || s === "—") return 0;
  const n = parseFloat(s.replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parsePct(raw: unknown): number {
  if (raw == null) return 0;
  const m = String(raw).match(/([\d.,]+)\s*%/);
  return m ? parseNum(m[1]) : parseNum(raw);
}

function parseEngagedSplit(raw: unknown) {
  const s = String(raw || "");
  const f = s.match(/Followers:\s*([\d.,]+)%/i);
  const n = s.match(/Non-followers:\s*([\d.,]+)%/i);
  return {
    engagedFollowersPct: f ? parseNum(f[1]) : 0,
    engagedNonFollowersPct: n ? parseNum(n[1]) : 0,
  };
}

function fixText(s: unknown): string {
  if (!s) return "";
  try {
    return Buffer.from(String(s), "latin1").toString("utf8").trim();
  } catch {
    return String(s).trim();
  }
}

function mediaIdFromUri(uri: string): string {
  if (!uri) return "";
  const base = String(uri).split("/").pop() || "";
  return base.replace(/\.[^.]+$/, "");
}

function isoFromTs(ts: unknown): string {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Date(n * 1000).toISOString();
}

function readInsight(dir: string, name: string): any {
  const path = join(dir, name);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * @param insightsDir path to `past_instagram_insights/`
 * @param opts.thumbByMediaId optional map of media_id → public thumbnail URL
 * @param opts.sourceLabel provenance string stored on summary rows
 * @param opts.profileUrl fallback post/profile link
 */
export function parseInstagramExportJson(
  insightsDir: string,
  opts?: {
    thumbByMediaId?: Map<string, string>;
    sourceLabel?: string;
    profileUrl?: string;
  }
): IgExportDataset[] {
  const thumbs = opts?.thumbByMediaId || new Map<string, string>();
  const sourceLabel =
    opts?.sourceLabel ||
    `instagram-sign2x.de past_instagram_insights ${new Date().toISOString().slice(0, 10)}`;
  const profileUrl = opts?.profileUrl || "https://www.instagram.com/sign2x.de/";

  const reachRaw = readInsight(insightsDir, "profiles_reached.json");
  const interactionsRaw = readInsight(insightsDir, "content_interactions.json");
  const audienceRaw = readInsight(insightsDir, "audience_insights.json");
  const postsRaw = readInsight(insightsDir, "posts.json");

  const reach = reachRaw?.organic_insights_reach?.[0];
  const interactions = interactionsRaw?.organic_insights_interactions?.[0];
  const audience = audienceRaw?.organic_insights_audience?.[0];
  const insightPosts: any[] = postsRaw?.organic_insights_posts || [];

  const R = smd(reach);
  const I = smd(interactions);
  const A = smd(audience);
  const engaged = parseEngagedSplit(I["Engaged Account By Follow Type"]);

  const periodRaw = R["Date Range"] || I["Date Range"] || A["Date Range"] || "";
  const period = periodRaw
    ? `${String(periodRaw).replace(/\s*-\s*/, " – ")} (2026)`
    : "2026-05-28 – 2026-08-26";

  const summary: Record<string, unknown>[] = [
    {
      period,
      accounts_reached: parseNum(R["Accounts Reached"]),
      impressions: parseNum(R.Impressions),
      profile_visits: parseNum(R["Profile visits"]),
      external_link_taps: parseNum(R["External link taps"]),
      content_interactions: parseNum(I["Content Interactions"]),
      accounts_engaged: parseNum(I["Accounts engaged"]),
      followers_pct: parsePct(R.Followers),
      non_followers_pct: parsePct(R["Non-Followers"]),
      engaged_followers_pct: engaged.engagedFollowersPct,
      engaged_non_followers_pct: engaged.engagedNonFollowersPct,
      post_interactions: parseNum(I["Post Interactions"]),
      reels_interactions: parseNum(I["Reels Interactions"]),
      story_interactions: parseNum(I["Story Interactions"]),
      post_likes: parseNum(I["Post Likes"]),
      post_shares: parseNum(I["Post Shares"]),
      post_saves: parseNum(I["Post Saves"]),
      reels_likes: parseNum(I["Reels Likes"]),
      reels_shares: parseNum(I["Reels Shares"]),
      followers: parseNum(A.Followers),
      source: sourceLabel,
    },
  ];

  const postRows = insightPosts.map((entry) => {
    const m = smd(entry);
    const thumb = entry.media_map_data?.["Media Thumbnail"] || {};
    const uri = thumb.uri || "";
    const id = mediaIdFromUri(uri);
    const ts = m["__ts_Creation Timestamp"] || thumb.creation_timestamp || 0;
    const created_at = isoFromTs(ts);
    const caption = fixText(thumb.title || "");
    return {
      _ig_kind: "post",
      media_id: id,
      caption,
      created_at,
      created_label: created_at
        ? new Date(created_at).toLocaleString("de-DE")
        : "",
      thumbnail_url: thumbs.get(id) || "",
      post_url: profileUrl,
      format: /\/reels\//i.test(uri)
        ? "reel"
        : /\/stories\//i.test(uri)
          ? "story"
          : "post",
      uri,
      accounts_reached: parseNum(m["Accounts reached"]),
      impressions: parseNum(m.Impressions),
      profile_visits: parseNum(m["Profile visits"]),
      follows: parseNum(m.Follows),
      saves: parseNum(m.Saves),
      likes: parseNum(m.Likes),
      comments: parseNum(m.Comments),
      shares: parseNum(m.Shares),
      external_link_taps: parseNum(
        m["External link taps"] || m["Link taps"] || m["Website taps"]
      ),
    };
  });

  postRows.sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );

  if (!summary[0].accounts_reached && !postRows.length) {
    return [];
  }

  const datasets: IgExportDataset[] = [
    {
      name: "Instagram · Posts / Reels / Stories",
      category: "Social",
      subcategory: "instagram_posts",
      rows: postRows,
    },
    {
      name: "Instagram · Content mix",
      category: "Social",
      subcategory: "instagram_content_interactions",
      rows: summary,
    },
    {
      name: "Instagram · Organic summary",
      category: "Social",
      subcategory: "instagram_profiles_reached",
      rows: summary,
    },
    {
      name: "Instagram · Organic summary",
      category: "Social",
      subcategory: "instagram_organic",
      rows: summary,
    },
  ];
  return datasets.filter((d) => d.rows.length > 0);
}
