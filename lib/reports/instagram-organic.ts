/**
 * Instagram organic aggregations from Meta HTML exports
 * (Profiles Reached, Content Interactions, Posts).
 */

import { isInstagramOrganicSub, type DatasetSubcategory } from "@/lib/data-hub/subcategory";
import { formatCompact, formatDelta, parseNumber } from "@/lib/reports/ga4-website";

export { formatCompact, formatDelta };

export interface IgPost {
  caption: string;
  createdAt: Date | null;
  createdLabel: string;
  thumbnailUrl: string;
  postUrl: string;
  accountsReached: number;
  impressions: number;
  profileVisits: number;
  follows: number;
  saves: number;
  likes: number;
  comments: number;
  shares: number;
  externalLinkTaps: number;
}

export interface IgBundle {
  period: string;
  accountsReached: number;
  impressions: number;
  profileVisits: number;
  externalLinkTaps: number;
  contentInteractions: number;
  accountsEngaged: number;
  reachFollowersPct: number;
  reachNonFollowersPct: number;
  engagedFollowersPct: number;
  engagedNonFollowersPct: number;
  postInteractions: number;
  reelsInteractions: number;
  storyInteractions: number;
  posts: IgPost[];
  sources: { subcategory: string; name: string; rowCount: number }[];
}

export interface IgHeadline {
  accountsReached: number;
  impressions: number;
  profileVisits: number;
  externalLinkTaps: number;
  contentInteractions: number;
  accountsEngaged: number;
}

export interface DatasetPayload {
  name: string;
  subcategory: string | null;
  columns?: { key: string }[];
  rows: Record<string, unknown>[];
}

function num(row: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    if (row[k] != null && row[k] !== "") return parseNumber(row[k]);
  }
  // case-insensitive
  const map = new Map(
    Object.keys(row).map((k) => [k.replace(/[^a-z0-9]/gi, "").toLowerCase(), k])
  );
  for (const k of keys) {
    const hit = map.get(k.replace(/[^a-z0-9]/gi, "").toLowerCase());
    if (hit) return parseNumber(row[hit]);
  }
  return 0;
}

function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim()) return String(row[k]).trim();
  }
  const map = new Map(
    Object.keys(row).map((k) => [k.replace(/[^a-z0-9]/gi, "").toLowerCase(), k])
  );
  for (const k of keys) {
    const hit = map.get(k.replace(/[^a-z0-9]/gi, "").toLowerCase());
    if (hit && row[hit] != null) return String(row[hit]).trim();
  }
  return "";
}

function parsePostRow(row: Record<string, unknown>): IgPost {
  const createdRaw = str(row, "created_at", "created_label", "createdat");
  let createdAt: Date | null = null;
  if (createdRaw) {
    const d = new Date(createdRaw);
    if (!Number.isNaN(d.getTime())) createdAt = d;
  }
  return {
    caption: str(row, "caption"),
    createdAt,
    createdLabel: str(row, "created_label", "created_at") || (createdAt ? createdAt.toLocaleString() : ""),
    thumbnailUrl: str(row, "thumbnail_url", "thumbnailurl"),
    postUrl: str(row, "post_url", "posturl", "url"),
    accountsReached: num(row, "accounts_reached", "accountsreached"),
    impressions: num(row, "impressions"),
    profileVisits: num(row, "profile_visits", "profilevisits"),
    follows: num(row, "follows"),
    saves: num(row, "saves"),
    likes: num(row, "likes"),
    comments: num(row, "comments"),
    shares: num(row, "shares"),
    externalLinkTaps: num(row, "external_link_taps", "externallinktaps"),
  };
}

function emptyBundle(): IgBundle {
  return {
    period: "",
    accountsReached: 0,
    impressions: 0,
    profileVisits: 0,
    externalLinkTaps: 0,
    contentInteractions: 0,
    accountsEngaged: 0,
    reachFollowersPct: 0,
    reachNonFollowersPct: 0,
    engagedFollowersPct: 0,
    engagedNonFollowersPct: 0,
    postInteractions: 0,
    reelsInteractions: 0,
    storyInteractions: 0,
    posts: [],
    sources: [],
  };
}

function applySummaryRow(bundle: IgBundle, row: Record<string, unknown>) {
  const period = str(row, "period");
  if (period && !bundle.period) bundle.period = period;

  const ar = num(row, "accounts_reached", "accountsreached");
  const impr = num(row, "impressions");
  const pv = num(row, "profile_visits", "profilevisits");
  const elt = num(row, "external_link_taps", "externallinktaps");
  const ci = num(row, "content_interactions", "contentinteractions");
  const ae = num(row, "accounts_engaged", "accountsengaged");

  if (ar) bundle.accountsReached = Math.max(bundle.accountsReached, ar);
  if (impr) bundle.impressions = Math.max(bundle.impressions, impr);
  if (pv) bundle.profileVisits = Math.max(bundle.profileVisits, pv);
  if (elt) bundle.externalLinkTaps = Math.max(bundle.externalLinkTaps, elt);
  if (ci) bundle.contentInteractions = Math.max(bundle.contentInteractions, ci);
  if (ae) bundle.accountsEngaged = Math.max(bundle.accountsEngaged, ae);

  const fp = num(row, "followers_pct", "followerspct");
  const nfp = num(row, "non_followers_pct", "nonfollowerspct");
  const efp = num(row, "engaged_followers_pct", "engagedfollowerspct");
  const enfp = num(row, "engaged_non_followers_pct", "engagednonfollowerspct");
  if (fp) bundle.reachFollowersPct = fp;
  if (nfp) bundle.reachNonFollowersPct = nfp;
  if (efp) bundle.engagedFollowersPct = efp;
  if (enfp) bundle.engagedNonFollowersPct = enfp;

  const pi = num(row, "post_interactions", "postinteractions");
  const ri = num(row, "reels_interactions", "reelsinteractions");
  const si = num(row, "story_interactions", "storyinteractions");
  if (pi) bundle.postInteractions = pi;
  if (ri) bundle.reelsInteractions = ri;
  if (si) bundle.storyInteractions = si;
}

export function buildInstagramBundle(datasets: DatasetPayload[]): IgBundle {
  const bundle = emptyBundle();

  for (const ds of datasets) {
    const sub = (ds.subcategory || "unknown") as DatasetSubcategory;
    if (!isInstagramOrganicSub(sub) && sub !== "unknown") continue;

    // Heuristic: unknown sheets that look like IG HTML rows
    const sample = ds.rows[0];
    const looksIg =
      isInstagramOrganicSub(sub) ||
      (sample &&
        ("_ig_kind" in sample ||
          "caption" in sample ||
          "accounts_reached" in sample ||
          "content_interactions" in sample));

    if (!looksIg) continue;

    bundle.sources.push({
      subcategory: sub,
      name: ds.name,
      rowCount: ds.rows.length,
    });

    for (const row of ds.rows) {
      const kind = str(row, "_ig_kind");
      if (kind === "post" || sub === "instagram_posts" || sub === "instagram_live") {
        if (kind === "post" || str(row, "caption") || str(row, "thumbnail_url")) {
          bundle.posts.push(parsePostRow(row));
          continue;
        }
      }
      applySummaryRow(bundle, row);
    }
  }

  // Derive missing headline totals from posts when summary missing
  if (!bundle.impressions && bundle.posts.length) {
    bundle.impressions = bundle.posts.reduce((s, p) => s + p.impressions, 0);
  }
  if (!bundle.accountsReached && bundle.posts.length) {
    bundle.accountsReached = bundle.posts.reduce((s, p) => s + p.accountsReached, 0);
  }
  if (!bundle.externalLinkTaps && bundle.posts.length) {
    bundle.externalLinkTaps = bundle.posts.reduce((s, p) => s + p.externalLinkTaps, 0);
  }
  if (!bundle.profileVisits && bundle.posts.length) {
    bundle.profileVisits = bundle.posts.reduce((s, p) => s + p.profileVisits, 0);
  }
  if (!bundle.contentInteractions && bundle.posts.length) {
    bundle.contentInteractions = bundle.posts.reduce(
      (s, p) => s + p.likes + p.comments + p.shares + p.saves,
      0
    );
  }

  // Fill follower split remainders
  if (bundle.reachFollowersPct > 0 && !bundle.reachNonFollowersPct) {
    bundle.reachNonFollowersPct = Math.max(0, 100 - bundle.reachFollowersPct);
  }
  if (bundle.engagedFollowersPct > 0 && !bundle.engagedNonFollowersPct) {
    bundle.engagedNonFollowersPct = Math.max(0, 100 - bundle.engagedFollowersPct);
  }

  return bundle;
}

export function computeIgHeadline(bundle: IgBundle): IgHeadline {
  return {
    accountsReached: bundle.accountsReached,
    impressions: bundle.impressions,
    profileVisits: bundle.profileVisits,
    externalLinkTaps: bundle.externalLinkTaps,
    contentInteractions: bundle.contentInteractions,
    accountsEngaged: bundle.accountsEngaged,
  };
}

export function hasInstagramData(bundle: IgBundle): boolean {
  return (
    bundle.accountsReached > 0 ||
    bundle.impressions > 0 ||
    bundle.contentInteractions > 0 ||
    bundle.posts.length > 0 ||
    bundle.sources.length > 0
  );
}

/** Months that have at least one dated post (for date chips — no empty months). */
export function availableIgMonths(bundle: IgBundle): { key: string; label: string }[] {
  const map = new Map<string, string>();
  for (const p of bundle.posts) {
    if (!p.createdAt) continue;
    const y = p.createdAt.getFullYear();
    const m = p.createdAt.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (!map.has(key)) {
      map.set(
        key,
        p.createdAt.toLocaleString(undefined, { month: "short", year: "numeric" })
      );
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, label]) => ({ key, label }));
}

/** Day-of-week × hour buckets for publishing schedule. */
export function igPublishHeatmap(posts: IgPost[]) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const map = new Map<string, { day: string; hour: number; posts: number; reach: number; impressions: number }>();
  for (const p of posts) {
    if (!p.createdAt) continue;
    const day = days[p.createdAt.getDay()];
    const hour = p.createdAt.getHours();
    const key = `${day}-${hour}`;
    const cur = map.get(key) || { day, hour, posts: 0, reach: 0, impressions: 0 };
    cur.posts += 1;
    cur.reach += p.accountsReached;
    cur.impressions += p.impressions;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day) || a.hour - b.hour);
}

export function igPublishScatter(posts: IgPost[]) {
  return posts
    .filter((p) => p.createdAt)
    .map((p) => ({
      label: p.createdAt!.toLocaleString(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }),
      day: p.createdAt!.getDay(),
      hour: p.createdAt!.getHours() + p.createdAt!.getMinutes() / 60,
      reach: p.accountsReached,
      impressions: p.impressions,
      taps: p.externalLinkTaps,
      caption: p.caption.slice(0, 80),
    }));
}

const STOP = new Set(
  `a an the and or but in on at to for of is it this that with as by from your you we our der die das und oder für mit ein eine im ist nicht auf den dem des zu von link bio in der`.split(
    /\s+/
  )
);

/** Caption word frequencies weighted by outbound taps / shares. */
export function igCaptionKeywords(posts: IgPost[], limit = 40) {
  const map = new Map<string, { word: string; count: number; taps: number; shares: number }>();
  for (const p of posts) {
    const words = p.caption
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .match(/[#@]?[\p{L}\p{N}_]{3,}/gu);
    if (!words) continue;
    const uniq = new Set(words);
    for (const w of uniq) {
      const key = w.replace(/^[@#]/, "");
      if (STOP.has(key) || key.length < 3) continue;
      const cur = map.get(key) || { word: w.startsWith("#") || w.startsWith("@") ? w : key, count: 0, taps: 0, shares: 0 };
      cur.count += 1;
      cur.taps += p.externalLinkTaps;
      cur.shares += p.shares;
      map.set(key, cur);
    }
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      impact: r.taps * 3 + r.shares * 2 + r.count,
    }))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, limit);
}
