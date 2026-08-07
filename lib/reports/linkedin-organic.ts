/**
 * LinkedIn Page Analytics organic aggregations.
 * Tolerant of LinkedIn export headers across Metrics / Visitors / Followers / Posts / Demographics.
 */

import {
  parseFlexibleDate,
  parseNumber,
  toDateKey,
  formatCompact,
  formatDelta,
  isPlausibleMonthKey,
  type DateRange,
} from "@/lib/reports/ga4-website";
import { isLinkedInOrganicSub, type DatasetSubcategory } from "@/lib/data-hub/subcategory";

export { formatCompact, formatDelta };

export interface LinkedInBundle {
  metrics: LiDailyMetric[];
  visitors: LiVisitorDay[];
  followers: LiFollowerDay[];
  posts: LiPost[];
  demographics: {
    seniority: LiDemoRow[];
    industry: LiDemoRow[];
    jobFunction: LiDemoRow[];
    companySize: LiDemoRow[];
    location: LiDemoRow[];
  };
  /** New Followers · dimension sheets (static snapshots). */
  followerDemographics: {
    seniority: LiDemoRow[];
    industry: LiDemoRow[];
    jobFunction: LiDemoRow[];
    companySize: LiDemoRow[];
    location: LiDemoRow[];
  };
  sources: { subcategory: string; name: string; rowCount: number }[];
}

export interface LiDailyMetric {
  date: Date;
  dateKey: string;
  monthKey: string;
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
  clicks: number;
  engagementRate: number; // percent
}

export interface LiVisitorDay {
  date: Date;
  dateKey: string;
  monthKey: string;
  pageViews: number;
  uniqueVisitors: number;
}

export interface LiFollowerDay {
  date: Date;
  dateKey: string;
  monthKey: string;
  organicFollowers: number;
}

export interface LiPost {
  date: Date;
  dateKey: string;
  monthKey: string;
  title: string;
  postType: string;
  impressions: number;
  clicks: number;
  likes: number;
  comments: number;
  reposts: number;
  ctr: number;
  engagementRate: number;
  url: string;
}

export interface LiDemoRow {
  label: string;
  views: number;
  share: number; // 0–100
}

export interface LiHeadline {
  impressions: number;
  pageViews: number;
  uniqueVisitors: number;
  newFollowers: number;
  interactions: number;
  engagementRate: number;
}

function canon(k: string): string {
  return k.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function indexKeys(row: Record<string, unknown>): Map<string, string> {
  const m = new Map<string, string>();
  for (const k of Object.keys(row)) m.set(canon(k), k);
  return m;
}

function resolve(index: Map<string, string>, aliases: string[]): string | null {
  for (const a of aliases) {
    const hit = index.get(canon(a));
    if (hit) return hit;
  }
  for (const a of aliases.map(canon)) {
    if (a.length < 5) continue;
    for (const [c, orig] of index) {
      if (c.includes(a) || a.includes(c)) return orig;
    }
  }
  return null;
}

/** Resolve a count column — never bind CTR / rate / % headers. */
function resolveCountCol(
  index: Map<string, string>,
  aliases: string[],
  opts?: { preferOrganic?: boolean }
): string | null {
  const reject = (c: string) =>
    /rate|ctr|clickthrough|percent|percentage|pct|ratio|avg|average/.test(c);

  const organicBoost = (c: string) =>
    opts?.preferOrganic
      ? c.includes("organic") && !c.includes("sponsored") && !c.includes("paid")
      : false;

  // 1) Exact alias hits (skip rejected)
  for (const a of aliases) {
    const hit = index.get(canon(a));
    if (hit && !reject(canon(hit))) return hit;
  }

  // 2) Prefer organic exact-ish keys containing primary token
  if (opts?.preferOrganic) {
    const organicHits = [...index.entries()]
      .filter(([c]) => !reject(c) && organicBoost(c) && aliases.some((a) => c.includes(canon(a))))
      .sort((a, b) => a[0].length - b[0].length);
    if (organicHits[0]) return organicHits[0][1];
  }

  // 3) Fuzzy — but never rate/CTR; prefer shortest non-rate match
  const candidates: { c: string; orig: string; score: number }[] = [];
  for (const a of aliases.map(canon)) {
    if (a.length < 5) continue;
    for (const [c, orig] of index) {
      if (reject(c)) continue;
      if (!(c.includes(a) || a.includes(c))) continue;
      let score = Math.abs(c.length - a.length);
      if (opts?.preferOrganic && organicBoost(c)) score -= 50;
      if (c === a) score -= 100;
      candidates.push({ c, orig, score });
    }
  }
  candidates.sort((x, y) => x.score - y.score);
  return candidates[0]?.orig || null;
}

function findDateCol(index: Map<string, string>, row: Record<string, unknown>): string | null {
  for (const a of ["date", "day", "createddate", "createdat", "startDate", "Date"]) {
    const hit = index.get(canon(a));
    if (hit) return hit;
  }
  // Prefer short/exact date keys — avoid LinkedIn preamble text that contains the word "date"
  for (const [c, orig] of index) {
    if (c === "date" || c === "day" || c === "createddate" || c.endsWith("date")) {
      if (c.length <= 24) return orig;
    }
  }
  for (const [c, orig] of index) {
    if ((c.includes("date") || c === "day") && c.length <= 40) return orig;
  }
  for (const [k, v] of Object.entries(row)) {
    if (parseFlexibleDate(v)) return k;
  }
  return null;
}

/** Prefer Created date for All posts (publish calendar), not incidental date columns. */
function findPostCreatedDateCol(
  index: Map<string, string>,
  row: Record<string, unknown>
): string | null {
  for (const a of [
    "createddate",
    "created date",
    "createdat",
    "created at",
    "publishdate",
    "published",
    "postedon",
  ]) {
    const hit = index.get(canon(a));
    if (hit) return hit;
  }
  for (const [c, orig] of index) {
    if (c.includes("created") && c.includes("date") && c.length <= 32) return orig;
  }
  return findDateCol(index, row);
}

/**
 * LinkedIn Metrics CSV often puts a long description in row 1 and the real headers
 * ("Date", "Impressions (organic)", …) in the first data row — ending up as Column_2…
 * Promote that embedded header row so column resolvers work.
 */
export function promoteEmbeddedHeaders(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  if (rows.length < 2) return rows;
  const keys = Object.keys(rows[0] || {});
  if (!keys.length) return rows;

  const genericKeys =
    keys.filter((k) => /^column_\d+$/i.test(k)).length >= Math.min(3, keys.length - 1) ||
    keys.some((k) => k.length > 80 && /aggregated|delayed|utc/i.test(k));

  const first = rows[0];
  const firstVals = keys.map((k) => String(first[k] ?? "").trim());
  const looksLikeHeaders =
    firstVals.some((v) => /^date$/i.test(v)) &&
    firstVals.some((v) => /impression|click|reaction|engagement|follower|page view/i.test(v));

  if (!genericKeys && !looksLikeHeaders) return rows;
  if (!looksLikeHeaders) return rows;

  const newKeys = keys.map((k, i) => {
    const label = firstVals[i];
    return label || k;
  });
  // Ensure uniqueness
  const seen = new Map<string, number>();
  const uniqueKeys = newKeys.map((k) => {
    const n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    return n > 1 ? `${k}_${n}` : k;
  });

  return rows.slice(1).map((row) => {
    const out: Record<string, unknown> = {};
    keys.forEach((oldKey, i) => {
      out[uniqueKeys[i]] = row[oldKey];
    });
    return out;
  });
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function parseLiMetrics(rows: Record<string, unknown>[]): LiDailyMetric[] {
  const promoted = promoteEmbeddedHeaders(rows);
  if (!promoted.length) return [];
  const index = indexKeys(promoted[0]);
  const dateCol = findDateCol(index, promoted[0]);
  if (!dateCol) return [];
  const impr = resolveCountCol(
    index,
    [
      "impressionsorganic",
      "impressions (organic)",
      "organicimpressions",
      "organic impressions",
      "impressionstotal",
      "impressions (total)",
      "totalimpressions",
      "uniqueimpressionsorganic",
      "impressions",
      "impression",
    ],
    { preferOrganic: true }
  );
  const reactions = resolveCountCol(
    index,
    ["reactionsorganic", "reactions (organic)", "reactions", "likes"],
    { preferOrganic: true }
  );
  const comments = resolveCountCol(
    index,
    ["commentsorganic", "comments (organic)", "comments"],
    { preferOrganic: true }
  );
  const reposts = resolveCountCol(
    index,
    ["repostsorganic", "reposts (organic)", "reposts", "shares"],
    { preferOrganic: true }
  );
  const clicks = resolveCountCol(
    index,
    ["clicksorganic", "clicks (organic)", "clicks"],
    { preferOrganic: true }
  );
  const engCol =
    resolve(index, [
      "engagement rate (organic)",
      "engagementrateorganic",
      "engagement rate",
      "engagementrate",
    ]) ||
    [...index.entries()].find(
      ([c]) => c.includes("engagementrate") && c.includes("organic") && !c.includes("sponsored")
    )?.[1] ||
    null;

  const out: LiDailyMetric[] = [];
  for (const row of promoted) {
    const date = parseFlexibleDate(row[dateCol]);
    if (!date) continue;
    const impressions = impr ? parseNumber(row[impr]) : 0;
    const r = reactions ? parseNumber(row[reactions]) : 0;
    const c = comments ? parseNumber(row[comments]) : 0;
    const rp = reposts ? parseNumber(row[reposts]) : 0;
    const cl = clicks ? parseNumber(row[clicks]) : 0;
    let engagementRate = engCol ? parseNumber(row[engCol]) : 0;
    if (engagementRate > 0 && engagementRate <= 1) engagementRate *= 100;
    if (!engCol && impressions > 0) {
      engagementRate = ((r + c + rp + cl) / impressions) * 100;
    }
    const d = startOfDay(date);
    out.push({
      date: d,
      dateKey: toDateKey(d),
      monthKey: monthKey(d),
      impressions,
      reactions: r,
      comments: c,
      reposts: rp,
      clicks: cl,
      engagementRate,
    });
  }
  return out;
}

export function parseLiVisitors(rows: Record<string, unknown>[]): LiVisitorDay[] {
  const promoted = promoteEmbeddedHeaders(rows);
  if (!promoted.length) return [];
  const index = indexKeys(promoted[0]);
  const dateCol = findDateCol(index, promoted[0]);
  if (!dateCol) return [];
  // Prefer Total over Overview — Overview tab is often empty while Total has traffic.
  // Avoid fuzzy "page views" which can bind desktop/mobile zero columns first.
  const pageViews =
    resolve(index, [
      "total page views (total)",
      "totalpageviewstotal",
      "overview page views (total)",
      "overviewpageviewstotal",
    ]) ||
    [...index.entries()].find(([c]) => c === "totalpageviewstotal" || c === "overviewpageviewstotal")?.[1] ||
    null;
  const unique =
    resolve(index, [
      "total unique visitors (total)",
      "totaluniquevisitorstotal",
      "overview unique visitors (total)",
      "overviewuniquevisitorstotal",
    ]) || null;
  const out: LiVisitorDay[] = [];
  for (const row of promoted) {
    const date = parseFlexibleDate(row[dateCol]);
    if (!date) continue;
    const d = startOfDay(date);
    out.push({
      date: d,
      dateKey: toDateKey(d),
      monthKey: monthKey(d),
      pageViews: pageViews ? parseNumber(row[pageViews]) : 0,
      uniqueVisitors: unique ? parseNumber(row[unique]) : 0,
    });
  }
  return out;
}

export function parseLiFollowers(rows: Record<string, unknown>[]): LiFollowerDay[] {
  const promoted = promoteEmbeddedHeaders(rows);
  if (!promoted.length) return [];
  const index = indexKeys(promoted[0]);
  const dateCol = findDateCol(index, promoted[0]);
  if (!dateCol) return [];
  const fol = resolveCountCol(index, [
    "organicfollowers",
    "organic followers",
    "newfollowers",
    "followersgained",
    "totalfollowers",
    "followers",
  ]);
  const out: LiFollowerDay[] = [];
  for (const row of promoted) {
    const date = parseFlexibleDate(row[dateCol]);
    if (!date) continue;
    const d = startOfDay(date);
    out.push({
      date: d,
      dateKey: toDateKey(d),
      monthKey: monthKey(d),
      organicFollowers: fol ? parseNumber(row[fol]) : 0,
    });
  }
  return out;
}

export function parseLiPosts(rows: Record<string, unknown>[]): LiPost[] {
  if (!rows.length) return [];
  const index = indexKeys(rows[0]);
  const dateCol = findPostCreatedDateCol(index, rows[0]);
  const title = resolve(index, ["posttitle", "post title", "title", "update", "content"]);
  const postType = resolve(index, ["posttype", "post type", "contenttype", "type"]);
  const impr = resolveCountCol(index, ["impressions", "impression"]);
  const clicks = resolveCountCol(index, ["clicks", "click"]);
  const likes = resolveCountCol(index, ["likes", "reactions", "likecount"]);
  const comments = resolveCountCol(index, ["comments", "comment"]);
  const reposts = resolveCountCol(index, ["reposts", "shares", "share"]);
  const ctr = resolve(index, ["ctr", "clickthroughrate", "click through rate (ctr)"]);
  const url = resolve(index, ["postlink", "post url", "url", "link", "permalink"]);

  const out: LiPost[] = [];
  for (const row of rows) {
    const date = dateCol ? parseFlexibleDate(row[dateCol]) : null;
    const d = date ? startOfDay(date) : startOfDay(new Date(0));
    const impressions = impr ? parseNumber(row[impr]) : 0;
    const cl = clicks ? parseNumber(row[clicks]) : 0;
    const lk = likes ? parseNumber(row[likes]) : 0;
    const cm = comments ? parseNumber(row[comments]) : 0;
    const rp = reposts ? parseNumber(row[reposts]) : 0;
    let ctrVal = ctr ? parseNumber(row[ctr]) : 0;
    if (ctrVal > 0 && ctrVal <= 1) ctrVal *= 100;
    if (!ctr && impressions > 0) ctrVal = (cl / impressions) * 100;
    const eng = impressions > 0 ? ((lk + cm + rp + cl) / impressions) * 100 : 0;
    out.push({
      date: d,
      dateKey: toDateKey(d),
      monthKey: monthKey(d),
      title: title ? String(row[title] ?? "(untitled)") : "(untitled)",
      postType: postType ? String(row[postType] ?? "Unknown") : "Unknown",
      impressions,
      clicks: cl,
      likes: lk,
      comments: cm,
      reposts: rp,
      ctr: ctrVal,
      engagementRate: eng,
      url: url ? String(row[url] ?? "") : "",
    });
  }
  return out;
}

export function parseLiDemographics(rows: Record<string, unknown>[]): LiDemoRow[] {
  if (!rows.length) return [];
  const index = indexKeys(rows[0]);
  const label = resolve(index, [
    "seniority",
    "industry",
    "jobfunction",
    "job function",
    "companysize",
    "company size",
    "location",
    "country",
    "region",
    "city",
    "name",
    "segment",
    "category",
  ]);
  const views = resolve(index, [
    "totalviews",
    "total views",
    "views",
    "viewers",
    "count",
    "totalfollowers",
    "followers",
    "organicfollowers",
  ]);
  if (!label || !views) return [];

  const parsed = rows
    .map((row) => ({
      label: String(row[label] ?? "").trim() || "(unknown)",
      views: parseNumber(row[views!]),
    }))
    .filter((r) => r.views > 0);
  const total = parsed.reduce((s, r) => s + r.views, 0) || 1;
  return parsed
    .map((r) => ({ ...r, share: (r.views / total) * 100 }))
    .sort((a, b) => b.views - a.views);
}

function emptyDemoGroup() {
  return {
    seniority: [] as LiDemoRow[],
    industry: [] as LiDemoRow[],
    jobFunction: [] as LiDemoRow[],
    companySize: [] as LiDemoRow[],
    location: [] as LiDemoRow[],
  };
}

function inferDemoSlot(
  rows: Record<string, unknown>[]
): keyof ReturnType<typeof emptyDemoGroup> | null {
  if (!rows[0]) return null;
  const k = [...indexKeys(rows[0]).keys()].join(" ");
  if (k.includes("location") || k.includes("country") || k.includes("region") || k.includes("city"))
    return "location";
  if (k.includes("seniority")) return "seniority";
  if (k.includes("industry")) return "industry";
  if (k.includes("jobfunction") || (k.includes("function") && !k.includes("company")))
    return "jobFunction";
  if (k.includes("companysize") || k.includes("companysize")) return "companySize";
  return null;
}

export interface DatasetPayload {
  name: string;
  subcategory: string | null;
  columns?: { key: string }[];
  rows: Record<string, unknown>[];
}

export function buildLinkedInBundle(datasets: DatasetPayload[]): LinkedInBundle {
  const bundle: LinkedInBundle = {
    metrics: [],
    visitors: [],
    followers: [],
    posts: [],
    demographics: emptyDemoGroup(),
    followerDemographics: emptyDemoGroup(),
    sources: [],
  };

  const assignDemo = (
    target: "visitor" | "follower",
    slot: keyof ReturnType<typeof emptyDemoGroup>,
    rows: LiDemoRow[]
  ) => {
    const group = target === "visitor" ? bundle.demographics : bundle.followerDemographics;
    if (!group[slot].length) group[slot] = rows;
  };

  for (const ds of datasets) {
    const sub = (ds.subcategory || "unknown") as DatasetSubcategory;
    if (!isLinkedInOrganicSub(sub) && sub !== "unknown") continue;

    bundle.sources.push({
      subcategory: sub,
      name: ds.name,
      rowCount: ds.rows.length,
    });

    if (sub === "linkedin_metrics" || (sub === "unknown" && looksLikeMetrics(ds.rows))) {
      if (looksLikeDemo(ds.rows) && !looksLikeMetrics(ds.rows)) {
        const demo = parseLiDemographics(ds.rows);
        const slot = inferDemoSlot(ds.rows) || "seniority";
        const followerish = /follower/i.test(ds.name);
        assignDemo(followerish ? "follower" : "visitor", slot, demo);
      } else if (looksLikePosts(ds.rows) && !looksLikeMetrics(ds.rows)) {
        bundle.posts.push(...parseLiPosts(ds.rows));
      } else {
        const metrics = parseLiMetrics(ds.rows);
        bundle.metrics.push(...metrics);
        const imprSum = metrics.reduce((s, r) => s + r.impressions, 0);
        if (imprSum === 0 && looksLikePosts(ds.rows)) {
          bundle.posts.push(...parseLiPosts(ds.rows));
        }
      }
    } else if (sub === "linkedin_visitors") {
      if (looksLikeDemo(ds.rows) && !looksLikeVisitors(ds.rows)) {
        const demo = parseLiDemographics(ds.rows);
        assignDemo("visitor", inferDemoSlot(ds.rows) || "seniority", demo);
      } else {
        bundle.visitors.push(...parseLiVisitors(ds.rows));
      }
    } else if (sub === "linkedin_followers") {
      if (looksLikeDemo(ds.rows) && !looksLikeFollowers(ds.rows)) {
        const demo = parseLiDemographics(ds.rows);
        assignDemo("follower", inferDemoSlot(ds.rows) || "seniority", demo);
      } else {
        bundle.followers.push(...parseLiFollowers(ds.rows));
      }
    } else if (sub === "linkedin_posts") {
      bundle.posts.push(...parseLiPosts(ds.rows));
    } else if (sub === "linkedin_demo_seniority") {
      assignDemo("visitor", "seniority", parseLiDemographics(ds.rows));
    } else if (sub === "linkedin_demo_industry") {
      assignDemo("visitor", "industry", parseLiDemographics(ds.rows));
    } else if (sub === "linkedin_demo_job_function") {
      assignDemo("visitor", "jobFunction", parseLiDemographics(ds.rows));
    } else if (sub === "linkedin_demo_company_size") {
      assignDemo("visitor", "companySize", parseLiDemographics(ds.rows));
    } else if (sub === "linkedin_demo_location") {
      assignDemo("visitor", "location", parseLiDemographics(ds.rows));
    } else if (sub === "linkedin_demo_follower_seniority") {
      assignDemo("follower", "seniority", parseLiDemographics(ds.rows));
    } else if (sub === "linkedin_demo_follower_industry") {
      assignDemo("follower", "industry", parseLiDemographics(ds.rows));
    } else if (sub === "linkedin_demo_follower_job_function") {
      assignDemo("follower", "jobFunction", parseLiDemographics(ds.rows));
    } else if (sub === "linkedin_demo_follower_company_size") {
      assignDemo("follower", "companySize", parseLiDemographics(ds.rows));
    } else if (sub === "linkedin_demo_follower_location") {
      assignDemo("follower", "location", parseLiDemographics(ds.rows));
    } else if (sub === "unknown") {
      if (looksLikePosts(ds.rows)) bundle.posts.push(...parseLiPosts(ds.rows));
      else if (looksLikeVisitors(ds.rows)) bundle.visitors.push(...parseLiVisitors(ds.rows));
      else if (looksLikeFollowers(ds.rows)) bundle.followers.push(...parseLiFollowers(ds.rows));
      else if (looksLikeMetrics(ds.rows)) bundle.metrics.push(...parseLiMetrics(ds.rows));
      else if (looksLikeDemo(ds.rows)) {
        const demo = parseLiDemographics(ds.rows);
        const slot = inferDemoSlot(ds.rows) || "seniority";
        const followerish = /follower/i.test(ds.name);
        assignDemo(followerish ? "follower" : "visitor", slot, demo);
      }
    }
  }

  return bundle;
}

function looksLikeMetrics(rows: Record<string, unknown>[]): boolean {
  if (!rows[0]) return false;
  const promoted = promoteEmbeddedHeaders(rows);
  const sample = promoted[0] || rows[0];
  const k = [...indexKeys(sample).keys()].join(" ");
  // Daily metrics: date + impressions (reactions/clicks optional — some exports omit them)
  const hasImpr = k.includes("impression");
  const hasEngage =
    k.includes("reaction") ||
    k.includes("click") ||
    k.includes("comment") ||
    k.includes("repost") ||
    k.includes("engagement");
  return hasImpr && (hasEngage || k.includes("date"));
}
function looksLikeVisitors(rows: Record<string, unknown>[]): boolean {
  if (!rows[0]) return false;
  const k = [...indexKeys(rows[0]).keys()].join(" ");
  return k.includes("pageview") || k.includes("uniquevisitor");
}
function looksLikeFollowers(rows: Record<string, unknown>[]): boolean {
  if (!rows[0]) return false;
  const k = [...indexKeys(rows[0]).keys()].join(" ");
  return k.includes("follower");
}
function looksLikePosts(rows: Record<string, unknown>[]): boolean {
  if (!rows[0]) return false;
  const k = [...indexKeys(rows[0]).keys()].join(" ");
  return k.includes("posttitle") || k.includes("posttype") || (k.includes("title") && k.includes("impression"));
}
function looksLikeDemo(rows: Record<string, unknown>[]): boolean {
  if (!rows[0]) return false;
  const k = [...indexKeys(rows[0]).keys()].join(" ");
  return (
    k.includes("seniority") ||
    k.includes("industry") ||
    k.includes("jobfunction") ||
    k.includes("companysize") ||
    k.includes("location") ||
    ((k.includes("country") || k.includes("region") || k.includes("city")) &&
      (k.includes("view") || k.includes("follower")))
  );
}

export function filterBundleByMonths(bundle: LinkedInBundle, months: string[]): LinkedInBundle {
  if (!months.length) return bundle;
  const set = new Set(months);
  return {
    ...bundle,
    metrics: bundle.metrics.filter((r) => set.has(r.monthKey)),
    visitors: bundle.visitors.filter((r) => set.has(r.monthKey)),
    followers: bundle.followers.filter((r) => set.has(r.monthKey)),
    posts: bundle.posts.filter((r) => !r.dateKey.startsWith("1970") && set.has(r.monthKey)),
  };
}

export function filterBundleByRange(bundle: LinkedInBundle, range: DateRange): LinkedInBundle {
  if (!range.start || !range.end) return bundle;
  const a = range.start.getTime();
  const b = range.end.getTime();
  const inRange = (d: Date) => {
    const t = d.getTime();
    return t >= a && t <= b;
  };
  return {
    ...bundle,
    metrics: bundle.metrics.filter((r) => inRange(r.date)),
    visitors: bundle.visitors.filter((r) => inRange(r.date)),
    followers: bundle.followers.filter((r) => inRange(r.date)),
    posts: bundle.posts.filter((r) => r.date.getFullYear() > 1970 && inRange(r.date)),
  };
}

export function availableLiMonths(bundle: LinkedInBundle): { key: string; label: string }[] {
  const set = new Set<string>();
  for (const r of [...bundle.metrics, ...bundle.visitors, ...bundle.followers, ...bundle.posts]) {
    if (r.monthKey && isPlausibleMonthKey(r.monthKey)) set.add(r.monthKey);
  }
  return [...set]
    .sort()
    .map((key) => {
      const [y, m] = key.split("-").map(Number);
      return {
        key,
        label: new Date(y, m - 1, 1).toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        }),
      };
    });
}

export function computeLiHeadline(bundle: LinkedInBundle): LiHeadline {
  let impressions = 0;
  let reactions = 0;
  let comments = 0;
  let reposts = 0;
  let clicks = 0;
  for (const r of bundle.metrics) {
    impressions += r.impressions;
    reactions += r.reactions;
    comments += r.comments;
    reposts += r.reposts;
    clicks += r.clicks;
  }

  // Prefer posts when metrics impressions are unresolved (0) but posts have impression data,
  // or when there are no metrics rows at all.
  const postImpressions = bundle.posts.reduce((s, p) => s + p.impressions, 0);
  if (bundle.posts.length && (impressions === 0 || !bundle.metrics.length) && postImpressions > 0) {
    impressions = 0;
    reactions = 0;
    comments = 0;
    reposts = 0;
    clicks = 0;
    for (const p of bundle.posts) {
      impressions += p.impressions;
      reactions += p.likes;
      comments += p.comments;
      reposts += p.reposts;
      clicks += p.clicks;
    }
  }

  let pageViews = 0;
  let uniqueVisitors = 0;
  for (const v of bundle.visitors) {
    pageViews += v.pageViews;
    uniqueVisitors += v.uniqueVisitors;
  }

  let newFollowers = 0;
  for (const f of bundle.followers) newFollowers += f.organicFollowers;

  const interactions = reactions + comments + reposts + clicks;
  const engagementRate = impressions > 0 ? (interactions / impressions) * 100 : 0;

  return {
    impressions,
    pageViews,
    uniqueVisitors,
    newFollowers,
    interactions,
    engagementRate,
  };
}

export function previousLiPeriod(
  months: string[],
  mode: "months" | "all" | "custom",
  customStart: string,
  customEnd: string,
  all: LinkedInBundle
): LinkedInBundle {
  // Build current range then shift back by equal length
  let start: Date | null = null;
  let end: Date | null = null;
  if (mode === "custom" && customStart && customEnd) {
    start = startOfDay(new Date(customStart + "T00:00:00"));
    end = endOfDay(new Date(customEnd + "T00:00:00"));
  } else if (mode === "months" && months.length) {
    const sorted = [...months].sort();
    const [ys, ms] = sorted[0].split("-").map(Number);
    const [ye, me] = sorted[sorted.length - 1].split("-").map(Number);
    start = startOfDay(new Date(ys, ms - 1, 1));
    end = endOfDay(new Date(ye, me, 0));
  } else {
    const keys = availableLiMonths(all).map((m) => m.key);
    if (!keys.length) return emptyBundle();
    const [ys, ms] = keys[0].split("-").map(Number);
    const [ye, me] = keys[keys.length - 1].split("-").map(Number);
    start = startOfDay(new Date(ys, ms - 1, 1));
    end = endOfDay(new Date(ye, me, 0));
  }
  if (!start || !end) return emptyBundle();
  const msLen = end.getTime() - start.getTime();
  const prevEnd = endOfDay(new Date(start.getTime() - 24 * 60 * 60 * 1000));
  const prevStart = startOfDay(new Date(prevEnd.getTime() - msLen));
  return filterBundleByRange(all, { start: prevStart, end: prevEnd, preset: "custom" });
}

function emptyBundle(): LinkedInBundle {
  return {
    metrics: [],
    visitors: [],
    followers: [],
    posts: [],
    demographics: emptyDemoGroup(),
    followerDemographics: emptyDemoGroup(),
    sources: [],
  };
}

/** Posts published over time — uses Created date from All posts. */
export function liPostsByPublishMonth(posts: LiPost[]) {
  const map = new Map<string, { monthKey: string; posts: number; impressions: number }>();
  for (const p of posts) {
    if (!p.monthKey || !isPlausibleMonthKey(p.monthKey) || p.date.getFullYear() <= 1970) continue;
    const cur = map.get(p.monthKey) || { monthKey: p.monthKey, posts: 0, impressions: 0 };
    cur.posts += 1;
    cur.impressions += p.impressions;
    map.set(p.monthKey, cur);
  }
  return [...map.values()]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((r) => {
      const [y, m] = r.monthKey.split("-").map(Number);
      return {
        ...r,
        label: new Date(y, m - 1, 1).toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        }),
      };
    });
}

export function postsByType(posts: LiPost[]) {
  const map = new Map<string, { impressions: number; interactions: number; clicks: number }>();
  for (const p of posts) {
    const cur = map.get(p.postType) || { impressions: 0, interactions: 0, clicks: 0 };
    cur.impressions += p.impressions;
    cur.clicks += p.clicks;
    cur.interactions += p.likes + p.comments + p.reposts + p.clicks;
    map.set(p.postType, cur);
  }
  return [...map.entries()]
    .map(([postType, v]) => ({ postType, ...v }))
    .sort((a, b) => b.impressions - a.impressions);
}

export function liDailyTrends(bundle: LinkedInBundle) {
  const map = new Map<
    string,
    {
      dateKey: string;
      label: string;
      pageViews: number;
      uniqueVisitors: number;
      followers: number;
      impressions: number;
      engagements: number;
    }
  >();

  const ensure = (dateKey: string, date: Date) => {
    if (!map.has(dateKey)) {
      map.set(dateKey, {
        dateKey,
        label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        pageViews: 0,
        uniqueVisitors: 0,
        followers: 0,
        impressions: 0,
        engagements: 0,
      });
    }
    return map.get(dateKey)!;
  };

  for (const v of bundle.visitors) {
    const row = ensure(v.dateKey, v.date);
    row.pageViews += v.pageViews;
    row.uniqueVisitors += v.uniqueVisitors;
  }
  for (const f of bundle.followers) {
    ensure(f.dateKey, f.date).followers += f.organicFollowers;
  }
  for (const m of bundle.metrics) {
    const row = ensure(m.dateKey, m.date);
    row.impressions += m.impressions;
    row.engagements += m.reactions + m.comments + m.reposts + m.clicks;
  }
  // If daily metrics had no impressions, fold post-level activity into trends by date
  const metricsImpr = bundle.metrics.reduce((s, m) => s + m.impressions, 0);
  if (metricsImpr === 0) {
    for (const p of bundle.posts) {
      if (p.date.getFullYear() <= 1970) continue;
      const row = ensure(p.dateKey, p.date);
      row.impressions += p.impressions;
      row.engagements += p.likes + p.comments + p.reposts + p.clicks;
    }
  }

  return [...map.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function hasLinkedInData(bundle: LinkedInBundle): boolean {
  return (
    bundle.metrics.length > 0 ||
    bundle.visitors.length > 0 ||
    bundle.followers.length > 0 ||
    bundle.posts.length > 0 ||
    bundle.demographics.seniority.length > 0 ||
    bundle.demographics.industry.length > 0 ||
    bundle.demographics.jobFunction.length > 0 ||
    bundle.demographics.companySize.length > 0 ||
    bundle.demographics.location.length > 0 ||
    bundle.followerDemographics.seniority.length > 0 ||
    bundle.followerDemographics.industry.length > 0 ||
    bundle.followerDemographics.jobFunction.length > 0 ||
    bundle.followerDemographics.companySize.length > 0 ||
    bundle.followerDemographics.location.length > 0
  );
}
