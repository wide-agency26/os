/**
 * LinkedIn Campaign Manager — Creative Performance Report.
 * UTF-16 / TSV with 5 metadata preamble rows; Start Date (in UTC) as timeline.
 */

import {
  type DateRange,
  parseFlexibleDate,
  toDateKey,
  formatCompact,
  formatDelta,
  isPlausibleMonthKey,
} from "@/lib/reports/ga4-website";

export { formatCompact, formatDelta };

export type LinkedInAdsGoalId =
  | "landing_clicks"
  | "leads"
  | "video_views"
  | "conversions"
  | "clicks";

export interface LinkedInAdsGoalOption {
  id: LinkedInAdsGoalId;
  label: string;
}

export interface LinkedInAdsRow {
  date: Date;
  dateKey: string;
  monthKey: string;
  adName: string;
  campaignName: string;
  adSetName: string;
  adType: string;
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  videoViews: number;
  videoViews25: number;
  videoViews50: number;
  videoViews75: number;
  videoCompletions: number;
  landingPageClicks: number;
  leads: number;
  conversions: number;
  engagements: number;
  reactions: number;
  shares: number;
  follows: number;
  otherClicks: number;
}

export interface LinkedInAdsHeadline {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  videoViews: number;
  landingPageClicks: number;
  conversions: number;
  currency: string;
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
    if (a.length < 5) continue;
    for (const [c, orig] of index) {
      if (c.includes(a) || a.includes(c)) return orig;
    }
  }
  return null;
}

export function parseLiAdsNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  let s = String(value).trim();
  if (!s || s === "--" || s === "—") return 0;
  const pct = s.endsWith("%");
  s = s.replace(/[$€£¥₹\s]/g, "").replace(/%/g, "");
  // European decimals: "1.234,56" or "566,50"
  if (/^\d{1,3}(\.\d{3})*,\d+$/.test(s) || /^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  if (Number.isNaN(n)) return 0;
  return pct && n > 0 && n <= 1 ? n * 100 : n;
}

/** Round money to cents to avoid float drift (e.g. 566.54 → stable 566.50 when source is cents). */
export function moneyRound(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isTotalRow(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === "total" || n === "totals" || n === "";
}

export function formatCurrencyAmount(n: number, currency = "USD", digits = 2): string {
  const rounded = digits === 2 ? moneyRound(n) : Number(n.toFixed(digits));
  const code =
    currency.toUpperCase() === "EUR"
      ? "EUR"
      : currency.toUpperCase() === "GBP"
        ? "GBP"
        : "USD";
  try {
    return rounded.toLocaleString(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  } catch {
    return `${code} ${rounded.toFixed(digits)}`;
  }
}

/**
 * @deprecated Do not convert for display — show each network in its source currency.
 * Kept only for rare blended-EUR math where Meta/Google are EUR.
 */
export function toEur(amount: number, currency: string): number {
  const c = currency.toUpperCase();
  if (c === "EUR") return moneyRound(amount);
  if (c === "USD") return moneyRound(amount * 0.92);
  if (c === "GBP") return moneyRound(amount * 1.17);
  return moneyRound(amount);
}

/** Format spend across networks that may use different currencies (no silent FX). */
export function formatMultiCurrencySpend(
  parts: { amount: number; currency: string }[]
): string {
  const byCur = new Map<string, number>();
  for (const p of parts) {
    const c = (p.currency || "USD").toUpperCase();
    byCur.set(c, moneyRound((byCur.get(c) || 0) + p.amount));
  }
  return [...byCur.entries()]
    .map(([c, amt]) => formatCurrencyAmount(amt, c))
    .join(" + ");
}

/**
 * Prefer LinkedIn's own Total row spend when present (matches Campaign Manager UI,
 * e.g. $566.50 instead of a float-sum of daily lines).
 */
export function linkedInAdsExportTotalSpend(
  rawRows: Record<string, unknown>[]
): { spend: number; currency: string } | null {
  if (!rawRows.length) return null;
  const index = indexKeys(rawRows[0]);
  const adName = resolve(index, ["adname", "ad name", "creativename", "creative name"]);
  const spend = resolve(index, ["totalspent", "total spent", "amountspent", "spend", "cost"]);
  const currency = resolve(index, ["currency", "curr"]);
  if (!adName || !spend) return null;

  for (const row of rawRows) {
    const name = String(row[adName] ?? "").trim().toLowerCase();
    if (name !== "total" && name !== "totals") continue;
    const amount = moneyRound(parseLiAdsNumber(row[spend]));
    if (amount <= 0) continue;
    const cur = currency
      ? String(row[currency] ?? "USD").trim().toUpperCase() || "USD"
      : "USD";
    return { spend: amount, currency: cur };
  }
  return null;
}

export function looksLikeLinkedInAdsRows(rows: Record<string, unknown>[] | undefined): boolean {
  if (!rows?.[0]) return false;
  const keys = new Set(Object.keys(rows[0]).map(canon));
  const hasStart =
    keys.has("startdateinutc") ||
    keys.has("startdate") ||
    [...keys].some((k) => k.includes("startdate"));
  const hasSpend = keys.has("totalspent") || keys.has("amountspent") || keys.has("spend");
  const hasCreative =
    keys.has("adname") ||
    keys.has("creativename") ||
    keys.has("clickstolandingpage") ||
    keys.has("videoviews");
  return hasStart && hasSpend && hasCreative;
}

export function normalizeLinkedInAdsRows(rows: Record<string, unknown>[]): LinkedInAdsRow[] {
  if (!rows.length) return [];
  const index = indexKeys(rows[0]);
  const dateCol = resolve(index, [
    "startdateinutc",
    "start date (in utc)",
    "startdate",
    "start date",
    "date",
    "day",
  ]);
  const adName = resolve(index, ["adname", "ad name", "creativename", "creative name"]);
  const campaign = resolve(index, ["campaignname", "campaign name", "campaign"]);
  const adSet = resolve(index, ["adsetname", "ad set name", "adset", "campaign group"]);
  const adType = resolve(index, ["adtype", "ad type", "type"]);
  const currency = resolve(index, ["currency", "curr"]);
  const spend = resolve(index, ["totalspent", "total spent", "amountspent", "spend", "cost"]);
  const impr = resolve(index, ["impressions", "impression"]);
  const clicks = resolve(index, ["clicks", "click"]);
  const ctr = resolve(index, ["clickthroughrate", "click through rate", "ctr"]);
  const cpc = resolve(index, ["averagecpc", "average cpc", "avgcpc", "cpc"]);
  const videoViews = resolve(index, ["videoviews", "video views"]);
  const v25 = resolve(index, ["videoviewsat25", "video views at 25%", "video plays at 25%"]);
  const v50 = resolve(index, ["videoviewsat50", "video views at 50%"]);
  const v75 = resolve(index, ["videoviewsat75", "video views at 75%"]);
  const vComp = resolve(index, ["videocompletions", "video completions", "video views at 100%"]);
  const lpClicks = resolve(index, [
    "clickstolandingpage",
    "clicks to landing page",
    "landingpageclicks",
  ]);
  const leads = resolve(index, ["leads", "lead"]);
  const conversions = resolve(index, ["conversions", "conversion", "externalwebsitesconversions"]);
  const reactions = resolve(index, ["reactions", "reaction"]);
  const shares = resolve(index, ["shares", "share"]);
  const follows = resolve(index, ["follows", "follow", "companyfollows"]);
  const otherClicks = resolve(index, ["otherclicks", "other clicks"]);
  const engagements = resolve(index, [
    "totalengagements",
    "total engagements",
    "engagements",
  ]);

  if (!dateCol && !spend) return [];

  const out: LinkedInAdsRow[] = [];
  for (const row of rows) {
    const name = adName ? String(row[adName] ?? "").trim() : "";
    if (isTotalRow(name) && !String(row[dateCol || ""] ?? "").trim()) continue;
    if (name.toLowerCase() === "total") continue;

    const dateRaw = dateCol ? parseFlexibleDate(row[dateCol]) : null;
    if (!dateRaw && dateCol) continue;
    const date = dateRaw ? startOfDay(dateRaw) : startOfDay(new Date(0));

    const spendN = spend ? moneyRound(parseLiAdsNumber(row[spend])) : 0;
    const imprN = impr ? parseLiAdsNumber(row[impr]) : 0;
    const clickN = clicks ? parseLiAdsNumber(row[clicks]) : 0;
    const lpN = lpClicks ? parseLiAdsNumber(row[lpClicks]) : 0;

    let ctrN = ctr ? parseLiAdsNumber(row[ctr]) : 0;
    if (ctr && ctrN > 0 && ctrN <= 1 && !String(row[ctr]).includes("%")) ctrN *= 100;
    if (!ctr && imprN > 0) ctrN = ((lpN || clickN) / imprN) * 100;

    let cpcN = cpc ? parseLiAdsNumber(row[cpc]) : 0;
    const clickBase = lpN || clickN;
    if (!cpc && clickBase > 0) cpcN = spendN / clickBase;

    const reactN = reactions ? parseLiAdsNumber(row[reactions]) : 0;
    const shareN = shares ? parseLiAdsNumber(row[shares]) : 0;
    const followN = follows ? parseLiAdsNumber(row[follows]) : 0;
    const otherN = otherClicks ? parseLiAdsNumber(row[otherClicks]) : 0;
    let engN = engagements ? parseLiAdsNumber(row[engagements]) : 0;
    if (!engagements) engN = reactN + shareN + followN + otherN;

    const cur = currency ? String(row[currency] ?? "USD").trim().toUpperCase() || "USD" : "USD";

    out.push({
      date,
      dateKey: toDateKey(date),
      monthKey: monthKey(date),
      adName: name || "(unnamed)",
      campaignName: campaign ? String(row[campaign] ?? "").trim() : "",
      adSetName: adSet ? String(row[adSet] ?? "").trim() : "",
      adType: adType ? String(row[adType] ?? "").trim() : "",
      currency: cur,
      spend: spendN,
      impressions: imprN,
      clicks: clickN,
      ctr: ctrN,
      cpc: cpcN,
      videoViews: videoViews ? parseLiAdsNumber(row[videoViews]) : 0,
      videoViews25: v25 ? parseLiAdsNumber(row[v25]) : 0,
      videoViews50: v50 ? parseLiAdsNumber(row[v50]) : 0,
      videoViews75: v75 ? parseLiAdsNumber(row[v75]) : 0,
      videoCompletions: vComp ? parseLiAdsNumber(row[vComp]) : 0,
      landingPageClicks: lpN,
      leads: leads ? parseLiAdsNumber(row[leads]) : 0,
      conversions: conversions ? parseLiAdsNumber(row[conversions]) : 0,
      engagements: engN,
      reactions: reactN,
      shares: shareN,
      follows: followN,
      otherClicks: otherN,
    });
  }
  return out;
}

export function detectLinkedInAdsGoals(rows: LinkedInAdsRow[]): LinkedInAdsGoalOption[] {
  const opts: LinkedInAdsGoalOption[] = [
    { id: "landing_clicks", label: "Clicks to landing page" },
    { id: "clicks", label: "Clicks" },
    { id: "video_views", label: "Video views" },
  ];
  if (rows.some((r) => r.leads > 0)) opts.push({ id: "leads", label: "Leads" });
  if (rows.some((r) => r.conversions > 0))
    opts.push({ id: "conversions", label: "Conversions" });
  return opts;
}

function goalValue(row: LinkedInAdsRow, goal: LinkedInAdsGoalId): number {
  switch (goal) {
    case "landing_clicks":
      return row.landingPageClicks || row.clicks;
    case "leads":
      return row.leads;
    case "video_views":
      return row.videoViews;
    case "conversions":
      return row.conversions;
    case "clicks":
      return row.clicks;
    default:
      return row.landingPageClicks || row.clicks;
  }
}

export function aggregateLinkedInAds(
  rows: LinkedInAdsRow[],
  goal: LinkedInAdsGoalId = "landing_clicks",
  exportTotal?: { spend: number; currency: string } | null
): LinkedInAdsHeadline {
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let videoViews = 0;
  let landingPageClicks = 0;
  let goalSum = 0;
  let currency = "USD";
  for (const r of rows) {
    spend += r.spend;
    impressions += r.impressions;
    clicks += r.clicks;
    videoViews += r.videoViews;
    landingPageClicks += r.landingPageClicks;
    goalSum += goalValue(r, goal);
    if (r.currency) currency = r.currency;
  }
  spend = moneyRound(spend);
  if (exportTotal && exportTotal.spend > 0) {
    // Use Campaign Manager total when it matches the detail sum within a few cents
    // or when detail sum is empty; otherwise still prefer export total (source of truth).
    spend = moneyRound(exportTotal.spend);
    if (exportTotal.currency) currency = exportTotal.currency;
  }
  const actionClicks = landingPageClicks || clicks;
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (actionClicks / impressions) * 100 : 0,
    cpc: actionClicks > 0 ? moneyRound(spend / actionClicks) : 0,
    videoViews,
    landingPageClicks,
    conversions: goalSum,
    currency,
  };
}

export function computeLinkedInAdsHeadline(
  current: LinkedInAdsRow[],
  previous: LinkedInAdsRow[],
  goal: LinkedInAdsGoalId,
  exportTotal?: { spend: number; currency: string } | null
) {
  const cur = aggregateLinkedInAds(current, goal, exportTotal);
  const prev = aggregateLinkedInAds(previous, goal);
  const deltas = {} as Record<keyof LinkedInAdsHeadline, number | null>;
  (Object.keys(cur) as (keyof LinkedInAdsHeadline)[]).forEach((k) => {
    if (k === "currency") {
      deltas[k] = null;
      return;
    }
    const p = prev[k] as number;
    const c = cur[k] as number;
    if (p === 0) deltas[k] = c === 0 ? 0 : null;
    else deltas[k] = ((c - p) / Math.abs(p)) * 100;
  });
  return { current: cur, previous: prev, deltas };
}

export function availableLinkedInAdsMonths(rows: LinkedInAdsRow[]): { key: string; label: string }[] {
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

export function filterLinkedInAdsByMonths(
  rows: LinkedInAdsRow[],
  months: string[]
): LinkedInAdsRow[] {
  if (!months.length) return rows;
  const set = new Set(months);
  return rows.filter((r) => set.has(r.monthKey));
}

export function filterLinkedInAdsByRange(
  rows: LinkedInAdsRow[],
  range: DateRange
): LinkedInAdsRow[] {
  if (!range.start || !range.end) return rows;
  const a = range.start.getTime();
  const b = range.end.getTime();
  return rows.filter((r) => {
    if (r.date.getFullYear() <= 1970) return false;
    const t = r.date.getTime();
    return t >= a && t <= b;
  });
}

export function customLinkedInAdsRange(startIso: string, endIso: string): DateRange {
  return {
    start: startOfDay(new Date(startIso + "T00:00:00")),
    end: new Date(new Date(endIso + "T00:00:00").setHours(23, 59, 59, 999)),
    preset: "custom",
  };
}

export function monthsToLinkedInAdsRange(months: string[]): DateRange | null {
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

export function previousLinkedInAdsPeriodRange(range: DateRange): DateRange | null {
  if (!range.start || !range.end) return null;
  const msLen = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start.getTime() - 24 * 60 * 60 * 1000);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = startOfDay(new Date(prevEnd.getTime() - msLen));
  return { start: prevStart, end: prevEnd, preset: "custom" };
}

export function byLinkedInCreative(rows: LinkedInAdsRow[], goal: LinkedInAdsGoalId) {
  const map = new Map<string, LinkedInAdsRow[]>();
  for (const r of rows) {
    const list = map.get(r.adName) || [];
    list.push(r);
    map.set(r.adName, list);
  }
  const out = [];
  for (const [adName, group] of map) {
    const h = aggregateLinkedInAds(group, goal);
    out.push({
      adName,
      campaignName: group[0].campaignName,
      adSetName: group[0].adSetName,
      adType: group[0].adType,
      ...h,
      videoViews25: group.reduce((s, r) => s + r.videoViews25, 0),
      videoViews50: group.reduce((s, r) => s + r.videoViews50, 0),
      videoViews75: group.reduce((s, r) => s + r.videoViews75, 0),
      videoCompletions: group.reduce((s, r) => s + r.videoCompletions, 0),
      engagements: group.reduce((s, r) => s + r.engagements, 0),
      landingPageClicks: group.reduce((s, r) => s + r.landingPageClicks, 0),
    });
  }
  return out.sort((a, b) => b.spend - a.spend);
}

export function linkedInAdsDailyTrends(rows: LinkedInAdsRow[], goal: LinkedInAdsGoalId) {
  const map = new Map<string, LinkedInAdsRow[]>();
  for (const r of rows) {
    if (r.date.getFullYear() <= 1970) continue;
    const list = map.get(r.dateKey) || [];
    list.push(r);
    map.set(r.dateKey, list);
  }
  const out = [];
  for (const [dateKey, group] of map) {
    const h = aggregateLinkedInAds(group, goal);
    out.push({
      dateKey,
      label: group[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      spend: h.spend,
      clicks: h.landingPageClicks || h.clicks,
      ctr: h.ctr,
      impressions: h.impressions,
      videoViews: h.videoViews,
    });
  }
  return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function isLinkedInAdsDataset(
  columns: { key: string }[] | undefined,
  rows?: Record<string, unknown>[]
): boolean {
  const keys = new Set(
    (columns || [])
      .map((c) => canon(c.key))
      .concat(rows?.[0] ? Object.keys(rows[0]).map(canon) : [])
  );
  return (
    (keys.has("startdateinutc") || [...keys].some((k) => k.includes("startdate"))) &&
    (keys.has("totalspent") || keys.has("amountspent")) &&
    (keys.has("adname") || keys.has("clickstolandingpage") || keys.has("videoviews"))
  );
}
