/**
 * YouTube Studio organic aggregations.
 * Table data.csv = video-level aggregates; Chart data.csv = daily views time series.
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
import { isYouTubeOrganicSub, type DatasetSubcategory } from "@/lib/data-hub/subcategory";

export { formatCompact, formatDelta };

export interface YtVideo {
  videoId: string;
  title: string;
  publishTime: Date | null;
  publishKey: string;
  monthKey: string;
  durationSec: number;
  views: number;
  watchTimeHours: number;
  subscribers: number;
  avgViewDurationSec: number;
  impressions: number;
  impressionsCtr: number; // percent
}

export interface YtDailyPoint {
  date: Date;
  dateKey: string;
  monthKey: string;
  videoId: string;
  title: string;
  views: number;
}

export interface YouTubeBundle {
  videos: YtVideo[];
  daily: YtDailyPoint[];
  sources: { subcategory: string; name: string; rowCount: number }[];
}

export interface YtHeadline {
  views: number;
  watchTimeHours: number;
  subscribers: number;
  impressions: number;
  impressionsCtr: number;
  avgViewDurationSec: number;
}

export interface DatasetPayload {
  name: string;
  subcategory: string | null;
  columns?: { key: string }[];
  rows: Record<string, unknown>[];
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
    if (a.length < 4) continue;
    for (const [c, orig] of index) {
      if (c.includes(a) || a.includes(c)) return orig;
    }
  }
  return null;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parse "0:00:17", "1:23", "17", or seconds number → seconds */
export function parseDurationSeconds(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const parts = s.split(":").map((p) => parseFloat(p));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function formatDuration(sec: number): string {
  if (!sec || sec < 0) return "0:00";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function isTotalRow(row: Record<string, unknown>, contentKey: string | null): boolean {
  if (!contentKey) return false;
  const v = String(row[contentKey] ?? "").trim().toLowerCase();
  return v === "total" || v === "totals" || v === "summary";
}

export function parseYtTable(rows: Record<string, unknown>[]): YtVideo[] {
  if (!rows.length) return [];
  const index = indexKeys(rows[0]);
  const content = resolve(index, ["content", "video_id", "videoid", "video"]);
  const title = resolve(index, ["videotitle", "video title", "title"]);
  const publish = resolve(index, [
    "videopublishtime",
    "video publish time",
    "publishtime",
    "published",
  ]);
  const duration = resolve(index, ["duration", "videoduration", "length"]);
  const views = resolve(index, ["views", "view"]);
  const watch = resolve(index, ["watchtimehours", "watch time (hours)", "watchtime"]);
  const subs = resolve(index, ["subscribers", "subscribersgained", "netsubscribers"]);
  const avgDur = resolve(index, [
    "averageviewduration",
    "average view duration",
    "avgviewduration",
  ]);
  const impr = resolve(index, ["impressions", "impression"]);
  const ctr = resolve(index, [
    "impressionsclickthroughrate",
    "impressions click-through rate(%)",
    "impressionsctr",
    "ctr",
  ]);

  const out: YtVideo[] = [];
  for (const row of rows) {
    if (isTotalRow(row, content)) continue;
    const t = title ? String(row[title] ?? "").trim() : "";
    const id = content ? String(row[content] ?? "").trim() : t || `row-${out.length}`;
    if (!t && !id) continue;

    const pub = publish ? parseFlexibleDate(row[publish]) : null;
    let ctrVal = ctr ? parseNumber(row[ctr]) : 0;
    if (ctrVal > 0 && ctrVal <= 1) ctrVal *= 100;

    out.push({
      videoId: id,
      title: t || id,
      publishTime: pub,
      publishKey: pub ? toDateKey(pub) : "",
      monthKey: pub ? monthKey(pub) : "",
      durationSec: duration ? parseDurationSeconds(row[duration]) : 0,
      views: views ? parseNumber(row[views]) : 0,
      watchTimeHours: watch ? parseNumber(row[watch]) : 0,
      subscribers: subs ? parseNumber(row[subs]) : 0,
      avgViewDurationSec: avgDur ? parseDurationSeconds(row[avgDur]) : 0,
      impressions: impr ? parseNumber(row[impr]) : 0,
      impressionsCtr: ctrVal,
    });
  }
  return out;
}

export function parseYtChart(rows: Record<string, unknown>[]): YtDailyPoint[] {
  if (!rows.length) return [];
  const index = indexKeys(rows[0]);
  const dateCol = resolve(index, ["date", "day"]);
  if (!dateCol) return [];
  const content = resolve(index, ["content", "video_id", "videoid"]);
  const title = resolve(index, ["videotitle", "video title", "title"]);
  const views = resolve(index, ["views", "view"]);

  const out: YtDailyPoint[] = [];
  for (const row of rows) {
    if (isTotalRow(row, content)) continue;
    const date = parseFlexibleDate(row[dateCol]);
    if (!date) continue;
    const d = startOfDay(date);
    const t = title ? String(row[title] ?? "").trim() : "";
    const id = content ? String(row[content] ?? "").trim() : t;
    out.push({
      date: d,
      dateKey: toDateKey(d),
      monthKey: monthKey(d),
      videoId: id,
      title: t || id,
      views: views ? parseNumber(row[views]) : 0,
    });
  }
  return out;
}

function looksLikeYtTable(rows: Record<string, unknown>[]): boolean {
  if (!rows[0]) return false;
  const k = [...indexKeys(rows[0]).keys()].join(" ");
  return (
    k.includes("videotitle") &&
    k.includes("views") &&
    (k.includes("watchtime") || k.includes("impressions") || k.includes("averageview"))
  );
}

function looksLikeYtChart(rows: Record<string, unknown>[]): boolean {
  if (!rows[0]) return false;
  const k = [...indexKeys(rows[0]).keys()].join(" ");
  return k.includes("date") && k.includes("views") && (k.includes("videotitle") || k.includes("content"));
}

export function buildYouTubeBundle(datasets: DatasetPayload[]): YouTubeBundle {
  const bundle: YouTubeBundle = { videos: [], daily: [], sources: [] };

  for (const ds of datasets) {
    const sub = (ds.subcategory || "unknown") as DatasetSubcategory;
    if (!isYouTubeOrganicSub(sub) && sub !== "unknown") continue;

    bundle.sources.push({
      subcategory: sub,
      name: ds.name,
      rowCount: ds.rows.length,
    });

    if (sub === "youtube_table") {
      bundle.videos.push(...parseYtTable(ds.rows));
    } else if (sub === "youtube_chart") {
      bundle.daily.push(...parseYtChart(ds.rows));
    } else if (sub === "youtube_organic" || sub === "unknown") {
      if (looksLikeYtChart(ds.rows)) bundle.daily.push(...parseYtChart(ds.rows));
      else if (looksLikeYtTable(ds.rows)) bundle.videos.push(...parseYtTable(ds.rows));
    }
  }

  return bundle;
}

export function filterYtBundleByMonths(bundle: YouTubeBundle, months: string[]): YouTubeBundle {
  if (!months.length) return bundle;
  const set = new Set(months);
  return {
    ...bundle,
    daily: bundle.daily.filter((r) => set.has(r.monthKey)),
    // Table data: keep videos published in the selected months (Video publish time)
    videos: bundle.videos.filter(
      (v) => !v.monthKey || !isPlausibleMonthKey(v.monthKey) || set.has(v.monthKey)
    ),
  };
}

export function filterYtBundleByRange(bundle: YouTubeBundle, range: DateRange): YouTubeBundle {
  if (!range.start || !range.end) return bundle;
  const a = range.start.getTime();
  const b = range.end.getTime();
  return {
    ...bundle,
    daily: bundle.daily.filter((r) => {
      const t = r.date.getTime();
      return t >= a && t <= b;
    }),
    videos: bundle.videos.filter((v) => {
      if (!v.publishTime) return true;
      const t = v.publishTime.getTime();
      return t >= a && t <= b;
    }),
  };
}

/**
 * Month chips for YouTube — prefer Chart daily views with activity.
 * Video publish time is for markers / content filters, not empty month pills.
 */
export function availableYtMonths(bundle: YouTubeBundle): { key: string; label: string }[] {
  const activity = new Map<string, number>();

  for (const r of bundle.daily) {
    if (!r.monthKey || !isPlausibleMonthKey(r.monthKey) || r.views <= 0) continue;
    activity.set(r.monthKey, (activity.get(r.monthKey) || 0) + r.views);
  }

  if (activity.size === 0) {
    for (const v of bundle.videos) {
      if (!v.monthKey || !isPlausibleMonthKey(v.monthKey)) continue;
      const amt = v.views > 0 ? v.views : 0;
      if (amt <= 0) continue;
      activity.set(v.monthKey, (activity.get(v.monthKey) || 0) + amt);
    }
  }

  return [...activity.keys()]
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

export function computeYtHeadline(bundle: YouTubeBundle, useFilteredDaily = false): YtHeadline {
  // Prefer table aggregates for headline when present
  if (bundle.videos.length && !useFilteredDaily) {
    let views = 0;
    let watchTimeHours = 0;
    let subscribers = 0;
    let impressions = 0;
    let avgViewWeighted = 0;
    let viewWeight = 0;
    for (const v of bundle.videos) {
      views += v.views;
      watchTimeHours += v.watchTimeHours;
      subscribers += v.subscribers;
      impressions += v.impressions;
      avgViewWeighted += v.avgViewDurationSec * v.views;
      viewWeight += v.views;
    }
    const impressionsCtr =
      impressions > 0
        ? (views / impressions) * 100
        : bundle.videos.reduce((s, v) => s + v.impressionsCtr * v.impressions, 0) /
            (impressions || 1) ||
          0;
    // Use blended CTR from video CTRs when impressions present
    let ctrSum = 0;
    let ctrW = 0;
    for (const v of bundle.videos) {
      if (v.impressions > 0) {
        ctrSum += v.impressionsCtr * v.impressions;
        ctrW += v.impressions;
      }
    }
    return {
      views,
      watchTimeHours,
      subscribers,
      impressions,
      impressionsCtr: ctrW > 0 ? ctrSum / ctrW : impressionsCtr,
      avgViewDurationSec: viewWeight > 0 ? avgViewWeighted / viewWeight : 0,
    };
  }

  // Fallback: sum chart daily views
  let views = 0;
  for (const d of bundle.daily) views += d.views;
  return {
    views,
    watchTimeHours: 0,
    subscribers: 0,
    impressions: 0,
    impressionsCtr: 0,
    avgViewDurationSec: 0,
  };
}

export function ytDailyViews(bundle: YouTubeBundle) {
  const map = new Map<string, { dateKey: string; label: string; views: number; date: Date }>();
  for (const r of bundle.daily) {
    const cur = map.get(r.dateKey);
    if (cur) cur.views += r.views;
    else
      map.set(r.dateKey, {
        dateKey: r.dateKey,
        label: r.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        views: r.views,
        date: r.date,
      });
  }
  return [...map.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function ytPublishMarkers(bundle: YouTubeBundle) {
  return bundle.videos
    .filter((v) => v.publishTime)
    .map((v) => ({
      dateKey: v.publishKey,
      title: v.title,
      label: v.publishTime!.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    }));
}

export function hasYouTubeData(bundle: YouTubeBundle): boolean {
  return bundle.videos.length > 0 || bundle.daily.length > 0;
}

export function previousYtPeriod(
  months: string[],
  mode: "months" | "all" | "custom",
  customStart: string,
  customEnd: string,
  all: YouTubeBundle
): YouTubeBundle {
  let start: Date | null = null;
  let end: Date | null = null;
  if (mode === "custom" && customStart && customEnd) {
    start = startOfDay(new Date(customStart + "T00:00:00"));
    end = new Date(new Date(customEnd + "T00:00:00").setHours(23, 59, 59, 999));
  } else if (mode === "months" && months.length) {
    const sorted = [...months].sort();
    const [ys, ms] = sorted[0].split("-").map(Number);
    const [ye, me] = sorted[sorted.length - 1].split("-").map(Number);
    start = startOfDay(new Date(ys, ms - 1, 1));
    end = new Date(ye, me, 0, 23, 59, 59, 999);
  } else {
    const keys = availableYtMonths(all).map((m) => m.key);
    if (!keys.length) return { ...all, daily: [], videos: [] };
    const [ys, ms] = keys[0].split("-").map(Number);
    const [ye, me] = keys[keys.length - 1].split("-").map(Number);
    start = startOfDay(new Date(ys, ms - 1, 1));
    end = new Date(ye, me, 0, 23, 59, 59, 999);
  }
  if (!start || !end) return { ...all, daily: [], videos: [] };
  const msLen = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = startOfDay(new Date(prevEnd.getTime() - msLen));
  return filterYtBundleByRange(all, { start: prevStart, end: prevEnd, preset: "custom" });
}
