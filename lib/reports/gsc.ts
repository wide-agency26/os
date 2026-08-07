/**
 * Google Search Console aggregations.
 * Multi-stream: Queries / Pages / Dates / Countries / Devices / Search Appearance.
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
import {
  isGscSub,
  type DatasetSubcategory,
} from "@/lib/data-hub/subcategory";

export { formatCompact, formatDelta };

export type GscBrandMode = "all" | "branded" | "non_branded";

export interface GscMetricRow {
  dimension: string;
  clicks: number;
  impressions: number;
  ctr: number; // percent
  position: number;
  monthKey: string;
  date: Date | null;
  dateKey: string;
}

export interface GscDailyRow {
  date: Date;
  dateKey: string;
  monthKey: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscBundle {
  queries: GscMetricRow[];
  pages: GscMetricRow[];
  dates: GscDailyRow[];
  countries: GscMetricRow[];
  devices: GscMetricRow[];
  searchAppearance: GscMetricRow[];
  sources: { subcategory: string; name: string; rowCount: number }[];
}

export interface GscHeadline {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface DatasetPayload {
  name: string;
  subcategory: string | null;
  columns?: { key: string }[];
  rows: Record<string, unknown>[];
}

export interface DatasetMeta {
  name?: string;
  createdAt?: string | null;
  rowCount?: number;
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
    if (a.length < 3) continue;
    for (const [c, orig] of index) {
      if (c === a || c.includes(a) || a.includes(c)) return orig;
    }
  }
  return null;
}

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function isTotalLabel(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "total" || s === "totals" || s === "summary" || s === "";
}

function parseCoreMetrics(row: Record<string, unknown>, index: Map<string, string>) {
  const clicksK = resolve(index, ["clicks", "click"]);
  const imprK = resolve(index, ["impressions", "impression", "impr"]);
  const ctrK = resolve(index, ["ctr", "clickthroughrate", "click through rate"]);
  const posK = resolve(index, ["position", "avgposition", "averageposition", "avg. position"]);

  const clicks = clicksK ? parseNumber(row[clicksK]) : 0;
  const impressions = imprK ? parseNumber(row[imprK]) : 0;
  let ctr = ctrK ? parseNumber(row[ctrK]) : 0;
  // GSC sometimes exports CTR as 0.0123 (ratio) vs 1.23 (%)
  if (ctrK && ctr > 0 && ctr <= 1 && impressions > 0) {
    const asPct = (clicks / impressions) * 100;
    if (Math.abs(ctr * 100 - asPct) < Math.abs(ctr - asPct)) ctr = ctr * 100;
  }
  if ((!ctrK || ctr === 0) && impressions > 0) ctr = (clicks / impressions) * 100;
  const position = posK ? parseNumber(row[posK]) : 0;
  return { clicks, impressions, ctr, position };
}

function parseDimensionRows(
  rows: Record<string, unknown>[],
  dimAliases: string[]
): GscMetricRow[] {
  if (!rows.length) return [];
  const index = indexKeys(rows[0]);
  const dimK = resolve(index, dimAliases);
  if (!dimK) return [];

  const out: GscMetricRow[] = [];
  for (const row of rows) {
    const dim = String(row[dimK] ?? "").trim();
    if (isTotalLabel(dim)) continue;
    const m = parseCoreMetrics(row, index);
    if (m.clicks === 0 && m.impressions === 0) continue;
    out.push({
      dimension: dim,
      ...m,
      monthKey: "",
      date: null,
      dateKey: "",
    });
  }
  return out;
}

export function parseGscQueries(rows: Record<string, unknown>[]): GscMetricRow[] {
  return parseDimensionRows(rows, [
    "top queries",
    "query",
    "queries",
    "search query",
    "keyword",
    "keywords",
  ]);
}

export function parseGscPages(rows: Record<string, unknown>[]): GscMetricRow[] {
  return parseDimensionRows(rows, [
    "top pages",
    "page",
    "pages",
    "landing page",
    "url",
    "landingpage",
  ]);
}

export function parseGscCountries(rows: Record<string, unknown>[]): GscMetricRow[] {
  return parseDimensionRows(rows, [
    "country",
    "countries",
    "country name",
    "country code",
  ]);
}

export function parseGscDevices(rows: Record<string, unknown>[]): GscMetricRow[] {
  return parseDimensionRows(rows, ["device", "devices", "device category", "devicecategory"]);
}

export function parseGscSearchAppearance(rows: Record<string, unknown>[]): GscMetricRow[] {
  return parseDimensionRows(rows, [
    "search appearance",
    "searchappearance",
    "rich result",
    "feature",
    "appearance",
  ]);
}

export function parseGscDates(rows: Record<string, unknown>[]): GscDailyRow[] {
  if (!rows.length) return [];
  const index = indexKeys(rows[0]);
  const dateK = resolve(index, ["date", "day", "dates"]);
  if (!dateK) return [];

  const map = new Map<string, GscDailyRow>();
  for (const row of rows) {
    const raw = row[dateK];
    const date = parseFlexibleDate(raw);
    if (!date || date.getFullYear() < 2000) continue;
    const key = toDateKey(date);
    const m = parseCoreMetrics(row, index);
    const existing = map.get(key);
    if (existing) {
      const impr = existing.impressions + m.impressions;
      const clicks = existing.clicks + m.clicks;
      const posSum =
        existing.position * existing.impressions + m.position * m.impressions;
      existing.clicks = clicks;
      existing.impressions = impr;
      existing.ctr = impr > 0 ? (clicks / impr) * 100 : 0;
      existing.position = impr > 0 ? posSum / impr : 0;
    } else {
      map.set(key, {
        date: startOfDay(date),
        dateKey: key,
        monthKey: monthKeyFromDate(date),
        clicks: m.clicks,
        impressions: m.impressions,
        ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : m.ctr,
        position: m.position,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function classifyGscStream(
  subcategory: string | null,
  name: string,
  rows: Record<string, unknown>[]
): DatasetSubcategory {
  if (subcategory && isGscSub(subcategory) && subcategory !== "gsc") {
    return subcategory as DatasetSubcategory;
  }
  const lower = name.toLowerCase();
  if (/quer(y|ies)|keyword/i.test(lower)) return "gsc_queries";
  if (/page|url|landing/i.test(lower)) return "gsc_pages";
  if (/date|daily|day/i.test(lower)) return "gsc_dates";
  if (/countr/i.test(lower)) return "gsc_countries";
  if (/device/i.test(lower)) return "gsc_devices";
  if (/appearance|snippet|rich/i.test(lower)) return "gsc_search_appearance";

  if (!rows.length) return "gsc";
  const index = indexKeys(rows[0]);
  if (resolve(index, ["date", "day"]) && !resolve(index, ["query", "page", "device", "country"])) {
    return "gsc_dates";
  }
  if (resolve(index, ["top queries", "query", "queries", "keyword"])) return "gsc_queries";
  if (resolve(index, ["top pages", "page", "pages", "url", "landing page"])) return "gsc_pages";
  if (resolve(index, ["country", "countries"])) return "gsc_countries";
  if (resolve(index, ["device", "devices"])) return "gsc_devices";
  if (resolve(index, ["search appearance", "appearance"])) return "gsc_search_appearance";
  return "gsc";
}

export function emptyGscBundle(): GscBundle {
  return {
    queries: [],
    pages: [],
    dates: [],
    countries: [],
    devices: [],
    searchAppearance: [],
    sources: [],
  };
}

export function buildGscBundle(datasets: DatasetPayload[]): GscBundle {
  const bundle = emptyGscBundle();

  for (const d of datasets) {
    if (!d.rows.length) continue;
    const stream = classifyGscStream(d.subcategory, d.name, d.rows);
    let count = 0;

    if (stream === "gsc_dates") {
      const parsed = parseGscDates(d.rows);
      bundle.dates.push(...parsed);
      count = parsed.length;
    } else if (stream === "gsc_queries" || stream === "gsc") {
      const parsed = parseGscQueries(d.rows);
      // Fallback: if no query dim, try pages/dates from same file
      if (parsed.length) {
        bundle.queries.push(...parsed);
        count = parsed.length;
      } else {
        const asDates = parseGscDates(d.rows);
        if (asDates.length) {
          bundle.dates.push(...asDates);
          count = asDates.length;
        } else {
          const asPages = parseGscPages(d.rows);
          bundle.pages.push(...asPages);
          count = asPages.length;
        }
      }
    } else if (stream === "gsc_pages") {
      const parsed = parseGscPages(d.rows);
      bundle.pages.push(...parsed);
      count = parsed.length;
    } else if (stream === "gsc_countries") {
      const parsed = parseGscCountries(d.rows);
      bundle.countries.push(...parsed);
      count = parsed.length;
    } else if (stream === "gsc_devices") {
      const parsed = parseGscDevices(d.rows);
      bundle.devices.push(...parsed);
      count = parsed.length;
    } else if (stream === "gsc_search_appearance") {
      const parsed = parseGscSearchAppearance(d.rows);
      bundle.searchAppearance.push(...parsed);
      count = parsed.length;
    }

    if (count > 0) {
      bundle.sources.push({ subcategory: stream, name: d.name, rowCount: count });
    }
  }

  // Dedupe dates by dateKey (weighted merge)
  if (bundle.dates.length) {
    const map = new Map<string, GscDailyRow>();
    for (const r of bundle.dates) {
      const ex = map.get(r.dateKey);
      if (!ex) {
        map.set(r.dateKey, { ...r });
        continue;
      }
      const impr = ex.impressions + r.impressions;
      const clicks = ex.clicks + r.clicks;
      const posSum = ex.position * ex.impressions + r.position * r.impressions;
      ex.clicks = clicks;
      ex.impressions = impr;
      ex.ctr = impr > 0 ? (clicks / impr) * 100 : 0;
      ex.position = impr > 0 ? posSum / impr : 0;
    }
    bundle.dates = [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  return bundle;
}

export function hasGscData(bundle: GscBundle): boolean {
  return (
    bundle.queries.length > 0 ||
    bundle.pages.length > 0 ||
    bundle.dates.length > 0 ||
    bundle.countries.length > 0 ||
    bundle.devices.length > 0 ||
    bundle.searchAppearance.length > 0
  );
}

export function aggregateGscMetrics(
  rows: { clicks: number; impressions: number; position: number }[]
): GscHeadline {
  let clicks = 0;
  let impressions = 0;
  let posWeighted = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    posWeighted += r.position * r.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    position: impressions > 0 ? posWeighted / impressions : 0,
  };
}

export function computeGscHeadline(bundle: GscBundle): GscHeadline {
  if (bundle.dates.length) return aggregateGscMetrics(bundle.dates);
  if (bundle.queries.length) return aggregateGscMetrics(bundle.queries);
  if (bundle.pages.length) return aggregateGscMetrics(bundle.pages);
  return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
}

export function availableGscMonths(bundle: GscBundle): { key: string; label: string }[] {
  const activity = new Map<string, number>();
  for (const d of bundle.dates) {
    if (!d.monthKey || !isPlausibleMonthKey(d.monthKey)) continue;
    const amt = (d.clicks || 0) + (d.impressions || 0);
    if (amt <= 0) continue;
    activity.set(d.monthKey, (activity.get(d.monthKey) || 0) + amt);
  }
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return [...activity.keys()]
    .sort()
    .map((key) => {
      const [y, m] = key.split("-").map(Number);
      return { key, label: `${MONTHS[m - 1]} ${y}` };
    });
}

export function filterGscBundleByMonths(bundle: GscBundle, months: string[]): GscBundle {
  if (!months.length) return bundle;
  const set = new Set(months);
  return {
    ...bundle,
    dates: bundle.dates.filter((d) => set.has(d.monthKey)),
    // Dimension sheets are period snapshots — keep as-is
  };
}

export function filterGscBundleByRange(bundle: GscBundle, range: DateRange): GscBundle {
  if (!range.start || !range.end) return bundle;
  const start = startOfDay(range.start).getTime();
  const end = endOfDay(range.end).getTime();
  return {
    ...bundle,
    dates: bundle.dates.filter((d) => {
      const t = d.date.getTime();
      return t >= start && t <= end;
    }),
  };
}

export function customGscRange(startIso: string, endIso: string): DateRange {
  return {
    start: startOfDay(new Date(startIso + "T00:00:00")),
    end: endOfDay(new Date(endIso + "T00:00:00")),
    preset: "custom",
  };
}

export function monthsToGscRange(months: string[]): DateRange | null {
  if (!months.length) return null;
  const sorted = [...months].sort();
  const [ys, ms] = sorted[0].split("-").map(Number);
  const [ye, me] = sorted[sorted.length - 1].split("-").map(Number);
  return {
    start: startOfDay(new Date(ys, ms - 1, 1)),
    end: endOfDay(new Date(ye, me, 0)),
    preset: "custom",
  };
}

export function previousGscPeriod(
  months: string[],
  mode: "months" | "all" | "custom",
  customStart: string,
  customEnd: string,
  all: GscBundle
): GscBundle {
  let start: Date | null = null;
  let end: Date | null = null;
  if (mode === "custom" && customStart && customEnd) {
    start = startOfDay(new Date(customStart + "T00:00:00"));
    end = endOfDay(new Date(customEnd + "T00:00:00"));
  } else if (mode === "months" && months.length) {
    const range = monthsToGscRange(months);
    if (range) {
      start = range.start;
      end = range.end;
    }
  } else if (all.dates.length) {
    start = all.dates[0].date;
    end = all.dates[all.dates.length - 1].date;
  }
  if (!start || !end) return emptyGscBundle();
  const msLen = end.getTime() - start.getTime();
  const prevEnd = endOfDay(new Date(start.getTime() - 24 * 60 * 60 * 1000));
  const prevStart = startOfDay(new Date(prevEnd.getTime() - msLen));
  return filterGscBundleByRange(all, {
    start: prevStart,
    end: prevEnd,
    preset: "custom",
  });
}

export function parseBrandTerms(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function isBrandedQuery(query: string, terms: string[]): boolean {
  if (!terms.length) return false;
  const q = query.toLowerCase();
  return terms.some((t) => q.includes(t));
}

export function filterQueriesByBrand(
  queries: GscMetricRow[],
  mode: GscBrandMode,
  brandTermsRaw: string
): GscMetricRow[] {
  if (mode === "all") return queries;
  const terms = parseBrandTerms(brandTermsRaw);
  if (!terms.length) return queries;
  if (mode === "branded") return queries.filter((q) => isBrandedQuery(q.dimension, terms));
  return queries.filter((q) => !isBrandedQuery(q.dimension, terms));
}

export function topQueriesByClicks(queries: GscMetricRow[], limit = 10) {
  return [...queries].sort((a, b) => b.clicks - a.clicks).slice(0, limit);
}

export function seoOpportunityQueries(queries: GscMetricRow[]) {
  return queries.filter((q) => q.impressions > 1000 && q.position >= 4 && q.position <= 15);
}

export function gscDailyTrends(bundle: GscBundle) {
  return bundle.dates.map((d) => ({
    date: d.dateKey,
    label: d.dateKey.slice(5),
    clicks: d.clicks,
    impressions: d.impressions,
    position: Number(d.position.toFixed(2)),
    ctr: Number(d.ctr.toFixed(2)),
  }));
}

export function formatCtr(pct: number): string {
  return `${pct.toFixed(2)}%`;
}

export function formatPosition(pos: number): string {
  return pos > 0 ? pos.toFixed(1) : "—";
}
