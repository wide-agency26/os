/**
 * Google Ads Campaign performance.csv aggregations.
 * Handles preamble rows (skipped at ingest), comma-formatted numbers, Campaign type.
 */

import {
  type DateRange,
  parseFlexibleDate,
  parseNumber,
  toDateKey,
  formatCompact,
  formatDelta,
  isPlausibleMonthKey,
} from "@/lib/reports/ga4-website";
import { formatCurrency, formatCtr } from "@/lib/reports/meta-ads";

export type { DateRange };
export { formatCompact, formatDelta, formatCurrency, formatCtr };

export type GoogleGoalId =
  | "conversions"
  | "clicks"
  | "view_through"
  | `custom:${string}`;

export interface GoogleGoalOption {
  id: GoogleGoalId;
  label: string;
  columnKey?: string;
}

export interface GoogleAdsRow {
  date: Date;
  dateKey: string;
  monthKey: string;
  campaignName: string;
  campaignType: string;
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number; // %
  avgCpc: number;
  conversions: number;
  costPerConv: number;
  convRate: number; // %
  viewThroughConversions: number;
  imprAbsTop: number; // %
  imprTop: number; // %
  extras: Record<string, number>;
}

export interface GoogleHeadline {
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avgCpc: number;
  conversions: number;
  costPerConv: number;
  convRate: number;
}

export interface GoogleTypeBreakdown extends GoogleHeadline {
  campaignType: string;
}

export interface GoogleCampaignBreakdown extends GoogleHeadline {
  campaignName: string;
  campaignType: string;
}

export interface GoogleTrendPoint {
  dateKey: string;
  label: string;
  cost: number;
  conversions: number;
  ctr: number;
  clicks: number;
  impressions: number;
  avgCpc: number;
  imprTop: number;
  imprAbsTop: number;
}

export interface DatasetMeta {
  name?: string;
  createdAt?: string | null;
  rowCount?: number;
}

function canon(k: string): string {
  return k
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .replace(/(eur|usd|gbp|chf)$/i, "");
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

/** Strip commas / currency / % then parse */
export function parseGoogleNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let s = String(value).trim();
  if (!s || s === "--" || s === "—") return 0;
  const pct = s.endsWith("%");
  s = s.replace(/[$€£¥₹,\s]/g, "").replace(/%/g, "");
  const n = parseFloat(s);
  if (Number.isNaN(n)) return 0;
  return pct && n > 0 && n <= 1 ? n * 100 : n;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isTotalRow(campaign: string): boolean {
  const c = campaign.trim().toLowerCase();
  return c === "total" || c === "totals" || c === "--" || c === "";
}

export function normalizeGoogleRows(rows: Record<string, unknown>[]): GoogleAdsRow[] {
  if (!rows.length) return [];
  const index = indexKeys(rows[0]);
  const day = resolve(index, ["day", "date", "day (date)", "report date"]);
  const campaign = resolve(index, ["campaign", "campaign name", "campaignname"]);
  const type = resolve(index, ["campaigntype", "campaign type", "type"]);
  const cost = resolve(index, ["cost", "costeur", "spend", "amountspent"]);
  const impr = resolve(index, ["impr", "impr.", "impressions", "impression"]);
  const clicks = resolve(index, ["clicks", "click"]);
  const ctr = resolve(index, ["ctr", "ctr (%)"]);
  const cpc = resolve(index, ["avgcpc", "avg. cpc", "avg cpc", "averagecpc", "cpc"]);
  const conv = resolve(index, ["conversions", "conversion", "allconversions", "all conv."]);
  const costConv = resolve(index, [
    "costconv",
    "cost / conv.",
    "cost/conv.",
    "costperconversion",
    "cost / conversion",
  ]);
  const convRate = resolve(index, ["convrate", "conv. rate", "conversionrate", "conv rate"]);
  const vtc = resolve(index, [
    "viewthroughconversions",
    "view-through conversions",
    "view through conversions",
  ]);
  const absTop = resolve(index, [
    "imprabstop",
    "impr. (abs. top) %",
    "searchabsolutetopimpressionshare",
    "abs. top",
  ]);
  const top = resolve(index, [
    "imprtop",
    "impr. (top) %",
    "searchtopimpressionshare",
    "top %",
  ]);

  if (!campaign && !cost && !impr) return [];

  const out: GoogleAdsRow[] = [];
  for (const row of rows) {
    const name = campaign ? String(row[campaign] ?? "").trim() : "";
    if (isTotalRow(name) && !day) continue;
    if (isTotalRow(name) && Object.values(row).every((v) => !String(v ?? "").trim() || String(v).toLowerCase() === "total"))
      continue;
    if (name.toLowerCase() === "total") continue;

    const dateRaw = day ? parseFlexibleDate(row[day]) : null;
    // Campaign-only exports without Day still usable — assign epoch placeholder filtered out of trends
    const date = dateRaw ? startOfDay(dateRaw) : startOfDay(new Date(0));

    const impressions = impr ? parseGoogleNumber(row[impr]) : 0;
    const clickN = clicks ? parseGoogleNumber(row[clicks]) : 0;
    const costN = cost ? parseGoogleNumber(row[cost]) : 0;
    const convN = conv ? parseGoogleNumber(row[conv]) : 0;

    let ctrN = ctr ? parseGoogleNumber(row[ctr]) : 0;
    if (ctr && ctrN > 0 && ctrN <= 1 && !String(row[ctr]).includes("%")) ctrN *= 100;
    if (!ctr && impressions > 0) ctrN = (clickN / impressions) * 100;

    let cpcN = cpc ? parseGoogleNumber(row[cpc]) : 0;
    if (!cpc && clickN > 0) cpcN = costN / clickN;

    let costConvN = costConv ? parseGoogleNumber(row[costConv]) : 0;
    if (!costConv && convN > 0) costConvN = costN / convN;

    let convRateN = convRate ? parseGoogleNumber(row[convRate]) : 0;
    if (convRate && convRateN > 0 && convRateN <= 1 && !String(row[convRate]).includes("%"))
      convRateN *= 100;
    if (!convRate && clickN > 0) convRateN = (convN / clickN) * 100;

    const extras: Record<string, number> = {};
    for (const [k, v] of Object.entries(row)) {
      const n = parseGoogleNumber(v);
      if (n !== 0) extras[canon(k)] = n;
    }

    out.push({
      date,
      dateKey: toDateKey(date),
      monthKey: monthKey(date),
      campaignName: name || "(unnamed)",
      campaignType: type ? String(row[type] ?? "Unknown").trim() || "Unknown" : "Unknown",
      cost: costN,
      impressions,
      clicks: clickN,
      ctr: ctrN,
      avgCpc: cpcN,
      conversions: convN,
      costPerConv: costConvN,
      convRate: convRateN,
      viewThroughConversions: vtc ? parseGoogleNumber(row[vtc]) : 0,
      imprAbsTop: absTop ? parseGoogleNumber(row[absTop]) : 0,
      imprTop: top ? parseGoogleNumber(row[top]) : 0,
      extras,
    });
  }
  return out;
}

export function detectGoogleGoals(rows: Record<string, unknown>[]): GoogleGoalOption[] {
  const opts: GoogleGoalOption[] = [
    { id: "conversions", label: "All conversions" },
    { id: "clicks", label: "Clicks" },
  ];
  if (!rows[0]) return opts;
  const index = indexKeys(rows[0]);
  const vtc = resolve(index, ["viewthroughconversions", "view-through conversions"]);
  if (vtc) opts.push({ id: "view_through", label: "View-through conversions", columnKey: vtc });
  return opts;
}

function conversionValue(row: GoogleAdsRow, goal: GoogleGoalId): number {
  if (goal === "clicks") return row.clicks;
  if (goal === "view_through") return row.viewThroughConversions;
  if (goal.startsWith("custom:")) {
    const key = goal.slice(7);
    return row.extras[canon(key)] || 0;
  }
  return row.conversions;
}

export function aggregateGoogle(rows: GoogleAdsRow[], goal: GoogleGoalId = "conversions"): GoogleHeadline {
  let cost = 0;
  let impressions = 0;
  let clicks = 0;
  let conversions = 0;
  for (const r of rows) {
    cost += r.cost;
    impressions += r.impressions;
    clicks += r.clicks;
    conversions += conversionValue(r, goal);
  }
  return {
    cost,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    avgCpc: clicks > 0 ? cost / clicks : 0,
    conversions,
    costPerConv: conversions > 0 ? cost / conversions : 0,
    convRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
  };
}

export function computeGoogleHeadline(
  current: GoogleAdsRow[],
  previous: GoogleAdsRow[],
  goal: GoogleGoalId
): {
  current: GoogleHeadline;
  previous: GoogleHeadline;
  deltas: Record<keyof GoogleHeadline, number | null>;
} {
  const cur = aggregateGoogle(current, goal);
  const prev = aggregateGoogle(previous, goal);
  const deltas = {} as Record<keyof GoogleHeadline, number | null>;
  (Object.keys(cur) as (keyof GoogleHeadline)[]).forEach((k) => {
    const p = prev[k];
    if (p === 0) deltas[k] = cur[k] === 0 ? 0 : null;
    else deltas[k] = ((cur[k] - p) / Math.abs(p)) * 100;
  });
  return { current: cur, previous: prev, deltas };
}

export function availableGoogleMonths(rows: GoogleAdsRow[]): { key: string; label: string }[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (isPlausibleMonthKey(r.monthKey)) set.add(r.monthKey);
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

export function filterGoogleByMonths(rows: GoogleAdsRow[], months: string[]): GoogleAdsRow[] {
  if (!months.length) return rows;
  const set = new Set(months);
  return rows.filter((r) => set.has(r.monthKey));
}

export function filterGoogleByRange(rows: GoogleAdsRow[], range: DateRange): GoogleAdsRow[] {
  if (!range.start || !range.end) return rows;
  const a = range.start.getTime();
  const b = range.end.getTime();
  return rows.filter((r) => {
    if (r.date.getFullYear() <= 1970) return false;
    const t = r.date.getTime();
    return t >= a && t <= b;
  });
}

export function customGoogleRange(startIso: string, endIso: string): DateRange {
  return {
    start: startOfDay(new Date(startIso + "T00:00:00")),
    end: new Date(new Date(endIso + "T00:00:00").setHours(23, 59, 59, 999)),
    preset: "custom",
  };
}

export function monthsToGoogleRange(months: string[]): DateRange | null {
  if (!months.length) return null;
  const sorted = [...months].sort();
  const [ys, ms] = sorted[0].split("-").map(Number);
  const [ye, me] = sorted[sorted.length - 1].split("-").map(Number);
  return {
    start: startOfDay(new Date(ys, ms - 1, 1)),
    end: new Date(ye, me, 0, 23, 59, 59, 999),
    preset: "custom",
  };
}

export function previousGooglePeriodRange(range: DateRange): DateRange | null {
  if (!range.start || !range.end) return null;
  const msLen = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start.getTime() - 24 * 60 * 60 * 1000);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = startOfDay(new Date(prevEnd.getTime() - msLen));
  return { start: prevStart, end: prevEnd, preset: "custom" };
}

export function byCampaignType(rows: GoogleAdsRow[], goal: GoogleGoalId): GoogleTypeBreakdown[] {
  const map = new Map<string, GoogleAdsRow[]>();
  for (const r of rows) {
    const list = map.get(r.campaignType) || [];
    list.push(r);
    map.set(r.campaignType, list);
  }
  const out: GoogleTypeBreakdown[] = [];
  for (const [campaignType, group] of map) {
    out.push({ campaignType, ...aggregateGoogle(group, goal) });
  }
  return out.sort((a, b) => b.cost - a.cost);
}

export function byGoogleCampaign(
  rows: GoogleAdsRow[],
  goal: GoogleGoalId
): GoogleCampaignBreakdown[] {
  const map = new Map<string, GoogleAdsRow[]>();
  for (const r of rows) {
    const list = map.get(r.campaignName) || [];
    list.push(r);
    map.set(r.campaignName, list);
  }
  const out: GoogleCampaignBreakdown[] = [];
  for (const [campaignName, group] of map) {
    out.push({
      campaignName,
      campaignType: group[0].campaignType,
      ...aggregateGoogle(group, goal),
    });
  }
  return out.sort((a, b) => b.cost - a.cost);
}

export function googleDailyTrends(rows: GoogleAdsRow[], goal: GoogleGoalId): GoogleTrendPoint[] {
  const map = new Map<string, GoogleAdsRow[]>();
  for (const r of rows) {
    if (r.date.getFullYear() <= 1970) continue;
    const list = map.get(r.dateKey) || [];
    list.push(r);
    map.set(r.dateKey, list);
  }
  const out: GoogleTrendPoint[] = [];
  for (const [dateKey, group] of map) {
    const h = aggregateGoogle(group, goal);
    const d = group[0].date;
    const imprTop =
      group.reduce((s, r) => s + r.imprTop * r.impressions, 0) /
      (group.reduce((s, r) => s + r.impressions, 0) || 1);
    const imprAbsTop =
      group.reduce((s, r) => s + r.imprAbsTop * r.impressions, 0) /
      (group.reduce((s, r) => s + r.impressions, 0) || 1);
    out.push({
      dateKey,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      cost: h.cost,
      conversions: h.conversions,
      ctr: h.ctr,
      clicks: h.clicks,
      impressions: h.impressions,
      avgCpc: h.avgCpc,
      imprTop,
      imprAbsTop,
    });
  }
  return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function googleMonthlyTrends(rows: GoogleAdsRow[], goal: GoogleGoalId): GoogleTrendPoint[] {
  const map = new Map<string, GoogleAdsRow[]>();
  for (const r of rows) {
    if (r.date.getFullYear() <= 1970) continue;
    const list = map.get(r.monthKey) || [];
    list.push(r);
    map.set(r.monthKey, list);
  }
  const out: GoogleTrendPoint[] = [];
  for (const [mk, group] of map) {
    const h = aggregateGoogle(group, goal);
    const [y, m] = mk.split("-").map(Number);
    out.push({
      dateKey: mk,
      label: new Date(y, m - 1, 1).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      }),
      cost: h.cost,
      conversions: h.conversions,
      ctr: h.ctr,
      clicks: h.clicks,
      impressions: h.impressions,
      avgCpc: h.avgCpc,
      imprTop: 0,
      imprAbsTop: 0,
    });
  }
  return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function isGoogleAdsDataset(
  columns: { key: string }[] | undefined,
  rows?: Record<string, unknown>[]
): boolean {
  const keys = new Set(
    (columns || [])
      .map((c) => canon(c.key))
      .concat(rows?.[0] ? Object.keys(rows[0]).map(canon) : [])
  );
  const hasCost = keys.has("cost") || keys.has("costeur");
  const hasImpr = keys.has("impr") || keys.has("impressions");
  const hasType = keys.has("campaigntype");
  const hasConv = keys.has("conversions") || keys.has("costconv") || keys.has("convrate");
  // Prefer Google when Cost + Impr. (not Amount spent) or Campaign type present
  if (keys.has("amountspent") || keys.has("amountspenteur")) return false;
  return (hasCost && hasImpr && (hasType || hasConv || keys.has("campaign"))) || hasType;
}

export function googleGoalLabel(goal: GoogleGoalId, options: GoogleGoalOption[]): string {
  return options.find((o) => o.id === goal)?.label || "Conversions";
}
