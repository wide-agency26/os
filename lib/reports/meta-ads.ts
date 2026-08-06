/**
 * Meta Ads report aggregations over Data Hub CSV rows.
 * Tolerant of Ads Manager export headers such as:
 *   "Amount spent (EUR)", "Reporting starts", "Link clicks", "Clicks (all)",
 *   "Landing page views", "Results", "CTR (link click-through rate)", etc.
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

export type { DateRange };
export { formatCompact, formatDelta };

export type ConversionGoalId =
  | "auto"
  | "results"
  | "landing_page_views"
  | "link_clicks"
  | `custom:${string}`;

export interface ConversionOption {
  id: ConversionGoalId;
  label: string;
  /** Original CSV header when custom / mapped */
  columnKey?: string;
}

export interface MetaAdsRow {
  date: Date;
  dateKey: string;
  monthKey: string; // YYYY-MM
  campaignName: string;
  adSetName: string;
  adName: string;
  amountSpent: number;
  impressions: number;
  reach: number;
  frequency: number;
  linkClicks: number;
  landingPageViews: number;
  results: number;
  resultIndicator: string;
  ctr: number; // percent 0–100
  cpc: number;
  costPerResult: number;
  costPerLandingPageView: number;
  roas: number;
  /** Extra numeric columns for custom conversion goals */
  extras: Record<string, number>;
}

export interface MetaHeadline {
  amountSpent: number;
  impressions: number;
  reach: number;
  frequency: number;
  linkClicks: number;
  landingPageViews: number;
  results: number;
  conversions: number;
  costPerConversion: number;
  ctr: number;
  cpc: number;
  roas: number;
}

export interface CampaignBreakdown extends MetaHeadline {
  campaignName: string;
}

export interface AdSetBreakdown extends MetaHeadline {
  adSetName: string;
  campaignName: string;
}

export interface AdBreakdown extends MetaHeadline {
  adName: string;
  adSetName: string;
  campaignName: string;
}

export interface MetaTrendPoint {
  dateKey: string;
  label: string;
  amountSpent: number;
  conversions: number;
  frequency: number;
  ctr: number;
  impressions: number;
  linkClicks: number;
  landingPageViews: number;
}

export type DrillLevel = "campaign" | "adSet" | "ad";

export interface MonthOption {
  key: string; // YYYY-MM
  label: string; // May 2026
}

export interface DatasetMeta {
  name?: string;
  createdAt?: string | null;
  rowCount?: number;
}

/** Strip punctuation + currency codes so "Amount spent (EUR)" → "amountspent" */
export function canonicalizeHeader(key: string): string {
  return key
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .replace(/(eur|usd|gbp|chf|sek|nok|dkk|pln|czk|cad|aud|jpy|inr)$/i, "");
}

function buildHeaderIndex(row: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>();
  for (const k of Object.keys(row)) {
    map.set(canonicalizeHeader(k), k);
  }
  return map;
}

/**
 * Resolve a column by trying aliases in order (first match wins).
 * Also accepts prefix matches for Meta's parenthetical headers.
 */
function resolveColumn(
  index: Map<string, string>,
  aliases: string[],
  opts?: { preferExact?: boolean }
): string | null {
  const canonAliases = aliases.map(canonicalizeHeader);

  for (const alias of canonAliases) {
    const hit = index.get(alias);
    if (hit) return hit;
  }

  // Prefix / contains soft match (e.g. amountspent matches amountspent...)
  for (const alias of canonAliases) {
    if (alias.length < 4) continue;
    for (const [canon, original] of index) {
      if (canon === alias) return original;
      if (canon.startsWith(alias) || alias.startsWith(canon)) return original;
      if (canon.includes(alias) && alias.length >= 6) return original;
    }
  }

  void opts;
  return null;
}

function findDateColumn(index: Map<string, string>, row: Record<string, unknown>): string | null {
  const preferred = [
    "reportingstarts",
    "reportingstart",
    "startdate",
    "daystart",
    "reportingstartsdate",
    "date",
    // "Day" is Google Ads — only use late as fallback for Meta
    "day",
  ];
  for (const alias of preferred) {
    const hit = index.get(alias);
    if (hit) return hit;
  }
  // Soft: anything starting with reportingstart but not reportingend
  for (const [canon, original] of index) {
    if (canon.includes("reportingstart") && !canon.includes("end")) return original;
  }
  for (const [canon, original] of index) {
    if (canon === "date" || canon.endsWith("date")) {
      if (canon.includes("end")) continue;
      if (parseFlexibleDate(row[original])) return original;
    }
  }
  for (const [k, v] of Object.entries(row)) {
    const c = canonicalizeHeader(k);
    if (c.includes("reportingend") || c === "ends") continue;
    if (c === "day") continue; // Google Ads day column — avoid accidental Meta parse
    if (parseFlexibleDate(v)) return k;
  }
  return null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

const RESERVED_CANON = new Set([
  "reportingstarts",
  "reportingends",
  "reportingend",
  "ends",
  "campaignname",
  "adsetname",
  "adname",
  "addelivery",
  "attributionsetting",
  "reach",
  "frequency",
  "adsetbudget",
  "adsetbudgettype",
  "amountspent",
  "impressions",
  "qualityranking",
  "engagementrateranking",
  "conversionrateranking",
  "linkclicks",
  "clicksall",
  "ctrall",
  "ctrlinkclickthroughrate",
  "cpcall",
  "cpccostperlinkclick",
  "landingpageviews",
  "costperlandingpageview",
  "results",
  "resultindicator",
  "costperresult",
  "costperresults",
  "roas",
  "purchaseroas",
]);

function isLikelyActionColumn(canon: string, original: string): boolean {
  if (RESERVED_CANON.has(canon)) return false;
  if (canon.includes("ranking") || canon.includes("budget") || canon.includes("delivery")) {
    return false;
  }
  if (canon.includes("reporting") || canon === "ends") return false;
  // Heuristic: action-ish names Meta exports
  const actionHints = [
    "view",
    "click",
    "lead",
    "purchase",
    "add",
    "checkout",
    "video",
    "engage",
    "follow",
    "message",
    "shop",
    "result",
    "conversion",
    "omni",
  ];
  return actionHints.some((h) => canon.includes(h) || original.toLowerCase().includes(h));
}

export function detectConversionOptions(
  rows: Record<string, unknown>[]
): ConversionOption[] {
  if (!rows.length) return [{ id: "auto", label: "Auto-detect (recommended)" }];
  const index = buildHeaderIndex(rows[0]);
  const options: ConversionOption[] = [
    { id: "auto", label: "Auto-detect (recommended)" },
  ];

  const resultsKey = resolveColumn(index, ["results", "result"]);
  if (resultsKey) {
    options.push({ id: "results", label: "Results (Meta objective)", columnKey: resultsKey });
  }

  const lpvKey = resolveColumn(index, [
    "landingpageviews",
    "landing_page_views",
    "omnilandingpageview",
    "actionsomnilandingpageview",
  ]);
  if (lpvKey) {
    options.push({
      id: "landing_page_views",
      label: "Landing page views",
      columnKey: lpvKey,
    });
  }

  const linkKey =
    resolveColumn(index, ["linkclicks", "link_clicks", "outboundclicks"]) ||
    resolveColumn(index, ["clicksall", "clicks_all", "clicks"]);
  if (linkKey) {
    options.push({
      id: "link_clicks",
      label: canonicalizeHeader(linkKey).includes("all")
        ? "Clicks (all)"
        : "Link clicks",
      columnKey: linkKey,
    });
  }

  // Custom action columns present in the CSV
  for (const original of Object.keys(rows[0])) {
    const canon = canonicalizeHeader(original);
    if (!isLikelyActionColumn(canon, original)) continue;
    if (options.some((o) => o.columnKey === original)) continue;
    // Must look numeric in sample
    const sampleVal = rows.find((r) => r[original] != null && r[original] !== "")?.[original];
    if (sampleVal == null) continue;
    if (typeof sampleVal !== "number" && isNaN(parseNumber(sampleVal))) continue;
    options.push({
      id: `custom:${original}`,
      label: original,
      columnKey: original,
    });
  }

  return options;
}

function pickConversionValue(
  row: MetaAdsRow,
  goal: ConversionGoalId
): number {
  if (goal === "results") return row.results;
  if (goal === "landing_page_views") return row.landingPageViews;
  if (goal === "link_clicks") return row.linkClicks;
  if (goal.startsWith("custom:")) {
    const key = goal.slice("custom:".length);
    return row.extras[key] ?? 0;
  }
  // auto: Results → LPV → link clicks
  if (row.results > 0) return row.results;
  if (row.landingPageViews > 0) return row.landingPageViews;
  return row.linkClicks;
}

export function conversionGoalLabel(
  goal: ConversionGoalId,
  options: ConversionOption[]
): string {
  return options.find((o) => o.id === goal)?.label || "Conversions";
}

export function normalizeMetaRows(rows: Record<string, unknown>[]): MetaAdsRow[] {
  if (!rows.length) return [];
  // Guard: never parse Google Ads Campaign performance as Meta
  if (looksLikeGoogleAdsRows(rows)) return [];

  const sample = rows[0];
  const index = buildHeaderIndex(sample);
  const dateCol = findDateColumn(index, sample);
  if (!dateCol) return [];

  const campaignName = resolveColumn(index, ["campaignname", "campaign_name", "campaign"]);
  const adSetName = resolveColumn(index, ["adsetname", "ad_set_name", "adset"]);
  const adName = resolveColumn(index, ["adname", "ad_name", "ad"]);
  // Prefer explicit Meta spend headers — do NOT map Google "Cost"
  const amountSpent =
    resolveColumn(index, [
      "amountspent",
      "amount_spent",
      "amountspenteur",
      "amountspentusd",
      "amount spent",
    ]) ||
    // Only accept bare "spend"/"spent" when Amount spent is absent AND Cost is absent
    (!index.has("cost") && !index.has("costeur")
      ? resolveColumn(index, ["spend", "spent"])
      : null);
  // Meta uses "Impressions" — avoid soft-matching Google "Impr."
  const impressions =
    index.get("impressions") ||
    resolveColumn(index, ["impressions"]) ||
    null;
  // If only "impr" exists (Google), this is not Meta
  if (!impressions && (index.has("impr") || index.has("cost"))) {
    return [];
  }
  const reach = resolveColumn(index, ["reach"]);
  const frequency = resolveColumn(index, ["frequency", "freq"]);

  // Prefer true link clicks over "Clicks (all)"; do not prefer bare "clicks" first
  const linkClicks =
    resolveColumn(index, [
      "linkclicks",
      "link_clicks",
      "outboundclicks",
      "uniqueoutboundclicks",
      "unique link clicks",
    ]) ||
    resolveColumn(index, ["clicksall", "clicks_all", "inlineclicks"]) ||
    // Bare "clicks" only when Meta-shaped (has amount spent / reach)
    (amountSpent || reach ? resolveColumn(index, ["clicks"]) : null);

  const landingPageViews = resolveColumn(index, [
    "landingpageviews",
    "landing_page_views",
    "omnilandingpageview",
    "websitelandingpageviews",
  ]);
  const results = resolveColumn(index, ["results", "result"]);
  const resultIndicator = resolveColumn(index, [
    "resultindicator",
    "result_indicator",
    "resulttype",
  ]);

  const ctr =
    resolveColumn(index, [
      "ctrlinkclickthroughrate",
      "linkctr",
      "ctr",
      "clickthroughrate",
    ]) || resolveColumn(index, ["ctrall", "ctr_all"]);

  const cpc =
    resolveColumn(index, [
      "cpccostperlinkclick",
      "costperlinkclick",
      "cpc",
      "costperclick",
    ]) || resolveColumn(index, ["cpcall", "cpc_all"]);

  const costPerResult = resolveColumn(index, [
    "costperresult",
    "cost_per_result",
    "costperresults",
    "cpa",
    "costperconversion",
  ]);
  const costPerLpv = resolveColumn(index, [
    "costperlandingpageview",
    "cost_per_landing_page_view",
  ]);
  const roas = resolveColumn(index, [
    "roas",
    "purchaseroas",
    "websitepurchaseroas",
    "returnonadspend",
  ]);

  const extraKeys = Object.keys(sample).filter((k) => {
    const c = canonicalizeHeader(k);
    return isLikelyActionColumn(c, k);
  });

  const out: MetaAdsRow[] = [];
  for (const row of rows) {
    const date = parseFlexibleDate(row[dateCol]);
    if (!date) continue;

    const spent = amountSpent ? parseNumber(row[amountSpent]) : 0;
    const impr = impressions ? parseNumber(row[impressions]) : 0;
    const rch = reach ? parseNumber(row[reach]) : 0;
    const clicks = linkClicks ? parseNumber(row[linkClicks]) : 0;
    const lpv = landingPageViews ? parseNumber(row[landingPageViews]) : 0;
    const res = results ? parseNumber(row[results]) : 0;

    let freq = frequency ? parseNumber(row[frequency]) : 0;
    if (!freq && rch > 0) freq = impr / rch;

    let ctrVal = ctr ? parseNumber(row[ctr]) : 0;
    // Meta CTR can be ratio (0.017) or percent (1.76)
    if (ctrVal > 0 && ctrVal <= 1 && impr > 0 && clicks / impr > 0.001) {
      // If stored CTR looks like a ratio matching clicks/impr, keep as percent*100 later
      const ratio = clicks / impr;
      if (Math.abs(ctrVal - ratio) < 0.005) ctrVal = ctrVal * 100;
    }
    if ((!ctr || ctrVal === 0) && impr > 0) ctrVal = (clicks / impr) * 100;

    let cpcVal = cpc ? parseNumber(row[cpc]) : 0;
    if ((!cpc || cpcVal === 0) && clicks > 0) cpcVal = spent / clicks;

    let cpr = costPerResult ? parseNumber(row[costPerResult]) : 0;
    if ((!costPerResult || cpr === 0) && res > 0) cpr = spent / res;

    let cplpv = costPerLpv ? parseNumber(row[costPerLpv]) : 0;
    if ((!costPerLpv || cplpv === 0) && lpv > 0) cplpv = spent / lpv;

    const extras: Record<string, number> = {};
    for (const ek of extraKeys) {
      extras[ek] = parseNumber(row[ek]);
    }

    const d = startOfDay(date);
    out.push({
      date: d,
      dateKey: toDateKey(d),
      monthKey: monthKeyFromDate(d),
      campaignName: campaignName
        ? String(row[campaignName] ?? "(not set)")
        : "(not set)",
      adSetName: adSetName ? String(row[adSetName] ?? "(not set)") : "(not set)",
      adName: adName ? String(row[adName] ?? "(not set)") : "(not set)",
      amountSpent: spent,
      impressions: impr,
      reach: rch,
      frequency: freq,
      linkClicks: clicks,
      landingPageViews: lpv,
      results: res,
      resultIndicator: resultIndicator
        ? String(row[resultIndicator] ?? "")
        : "",
      ctr: ctrVal,
      cpc: cpcVal,
      costPerResult: cpr,
      costPerLandingPageView: cplpv,
      roas: roas ? parseNumber(row[roas]) : 0,
      extras,
    });
  }
  return out;
}

export function availableMonths(rows: MetaAdsRow[]): MonthOption[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (isPlausibleMonthKey(r.monthKey)) set.add(r.monthKey);
  }
  return [...set]
    .sort()
    .map((key) => ({ key, label: monthLabel(key) }));
}

export function filterByMonths(rows: MetaAdsRow[], months: string[]): MetaAdsRow[] {
  if (!months.length) return rows;
  const set = new Set(months);
  return rows.filter((r) => set.has(r.monthKey));
}

export function filterMetaByRange(rows: MetaAdsRow[], range: DateRange): MetaAdsRow[] {
  if (!range.start || !range.end) return rows;
  const a = range.start.getTime();
  const b = range.end.getTime();
  return rows.filter((r) => {
    const t = r.date.getTime();
    return t >= a && t <= b;
  });
}

export function customDateRange(startIso: string, endIso: string): DateRange {
  return {
    start: startOfDay(new Date(startIso + "T00:00:00")),
    end: endOfDay(new Date(endIso + "T00:00:00")),
    preset: "custom",
  };
}

export function monthsToRange(months: string[]): DateRange | null {
  if (!months.length) return null;
  const sorted = [...months].sort();
  const [ys, ms] = sorted[0].split("-").map(Number);
  const [ye, me] = sorted[sorted.length - 1].split("-").map(Number);
  const start = startOfDay(new Date(ys, ms - 1, 1));
  const end = endOfDay(new Date(ye, me, 0)); // last day of end month
  return { start, end, preset: "custom" };
}

/** Previous block of equal length ending the day before current start */
export function previousMetaPeriodRange(range: DateRange): DateRange | null {
  if (!range.start || !range.end) return null;
  const ms = range.end.getTime() - range.start.getTime();
  const prevEnd = endOfDay(new Date(range.start.getTime() - 24 * 60 * 60 * 1000));
  const prevStart = startOfDay(new Date(prevEnd.getTime() - ms));
  return { start: prevStart, end: prevEnd, preset: range.preset };
}

function aggregateWithGoal(rows: MetaAdsRow[], goal: ConversionGoalId): MetaHeadline {
  let amountSpent = 0;
  let impressions = 0;
  let reach = 0;
  let linkClicks = 0;
  let landingPageViews = 0;
  let results = 0;
  let conversions = 0;
  let freqImpWeighted = 0;
  let impWeight = 0;
  let roasSpendWeighted = 0;
  let spendWeight = 0;

  for (const r of rows) {
    amountSpent += r.amountSpent;
    impressions += r.impressions;
    reach += r.reach;
    linkClicks += r.linkClicks;
    landingPageViews += r.landingPageViews;
    results += r.results;
    conversions += pickConversionValue(r, goal);
    if (r.impressions > 0) {
      freqImpWeighted += r.frequency * r.impressions;
      impWeight += r.impressions;
    }
    if (r.amountSpent > 0 && r.roas > 0) {
      roasSpendWeighted += r.roas * r.amountSpent;
      spendWeight += r.amountSpent;
    }
  }

  const ctr = impressions > 0 ? (linkClicks / impressions) * 100 : 0;
  const cpc = linkClicks > 0 ? amountSpent / linkClicks : 0;
  const costPerConversion = conversions > 0 ? amountSpent / conversions : 0;
  const frequency = impWeight > 0 ? freqImpWeighted / impWeight : 0;
  const roas = spendWeight > 0 ? roasSpendWeighted / spendWeight : 0;

  return {
    amountSpent,
    impressions,
    reach,
    frequency,
    linkClicks,
    landingPageViews,
    results,
    conversions,
    costPerConversion,
    ctr,
    cpc,
    roas,
  };
}

export function computeMetaHeadline(
  currentRows: MetaAdsRow[],
  previousRows: MetaAdsRow[],
  goal: ConversionGoalId
): {
  current: MetaHeadline;
  previous: MetaHeadline;
  deltas: Record<keyof MetaHeadline, number | null>;
} {
  const current = aggregateWithGoal(currentRows, goal);
  const previous = aggregateWithGoal(previousRows, goal);
  const deltas = {} as Record<keyof MetaHeadline, number | null>;
  (Object.keys(current) as (keyof MetaHeadline)[]).forEach((k) => {
    const prev = previous[k];
    if (prev === 0) deltas[k] = current[k] === 0 ? 0 : null;
    else deltas[k] = ((current[k] - prev) / Math.abs(prev)) * 100;
  });
  return { current, previous, deltas };
}

function groupRows(rows: MetaAdsRow[], keyFn: (r: MetaAdsRow) => string) {
  const map = new Map<string, MetaAdsRow[]>();
  for (const r of rows) {
    const k = keyFn(r);
    const list = map.get(k) || [];
    list.push(r);
    map.set(k, list);
  }
  return map;
}

export function byCampaign(rows: MetaAdsRow[], goal: ConversionGoalId): CampaignBreakdown[] {
  const map = groupRows(rows, (r) => r.campaignName);
  const out: CampaignBreakdown[] = [];
  for (const [campaignName, group] of map) {
    out.push({ campaignName, ...aggregateWithGoal(group, goal) });
  }
  return out.sort((a, b) => b.amountSpent - a.amountSpent);
}

export function byAdSet(rows: MetaAdsRow[], goal: ConversionGoalId): AdSetBreakdown[] {
  const map = groupRows(rows, (r) => `${r.campaignName}||${r.adSetName}`);
  const out: AdSetBreakdown[] = [];
  for (const [, group] of map) {
    out.push({
      adSetName: group[0].adSetName,
      campaignName: group[0].campaignName,
      ...aggregateWithGoal(group, goal),
    });
  }
  return out.sort((a, b) => b.amountSpent - a.amountSpent);
}

export function byAd(rows: MetaAdsRow[], goal: ConversionGoalId): AdBreakdown[] {
  const map = groupRows(rows, (r) => `${r.campaignName}||${r.adSetName}||${r.adName}`);
  const out: AdBreakdown[] = [];
  for (const [, group] of map) {
    out.push({
      adName: group[0].adName,
      adSetName: group[0].adSetName,
      campaignName: group[0].campaignName,
      ...aggregateWithGoal(group, goal),
    });
  }
  return out.sort((a, b) => b.amountSpent - a.amountSpent);
}

export function metaDailyTrends(
  rows: MetaAdsRow[],
  goal: ConversionGoalId
): MetaTrendPoint[] {
  const map = groupRows(rows, (r) => r.dateKey);
  const out: MetaTrendPoint[] = [];
  for (const [dateKey, group] of map) {
    const h = aggregateWithGoal(group, goal);
    const d = group[0].date;
    out.push({
      dateKey,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      amountSpent: h.amountSpent,
      conversions: h.conversions,
      frequency: h.frequency,
      ctr: h.ctr,
      impressions: h.impressions,
      linkClicks: h.linkClicks,
      landingPageViews: h.landingPageViews,
    });
  }
  return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function metaMonthlyTrends(
  rows: MetaAdsRow[],
  goal: ConversionGoalId
): MetaTrendPoint[] {
  const map = groupRows(rows, (r) => r.monthKey);
  const out: MetaTrendPoint[] = [];
  for (const [monthKey, group] of map) {
    const h = aggregateWithGoal(group, goal);
    out.push({
      dateKey: monthKey,
      label: monthLabel(monthKey),
      amountSpent: h.amountSpent,
      conversions: h.conversions,
      frequency: h.frequency,
      ctr: h.ctr,
      impressions: h.impressions,
      linkClicks: h.linkClicks,
      landingPageViews: h.landingPageViews,
    });
  }
  return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function formatCurrency(n: number, digits = 2): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCtr(pct: number): string {
  return `${pct.toFixed(2)}%`;
}

export function formatRoas(n: number): string {
  return `${n.toFixed(2)}x`;
}

export function formatUploadedAt(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isMetaAdsDataset(
  columns: { key: string; type?: string }[] | undefined,
  rows: Record<string, unknown>[] | undefined
): boolean {
  const keys = new Set(
    (columns || [])
      .map((c) => canonicalizeHeader(c.key))
      .concat(rows?.[0] ? Object.keys(rows[0]).map(canonicalizeHeader) : [])
  );

  // Never treat Google Ads exports as Meta
  if (looksLikeGoogleAdsHeaders(keys)) return false;

  const hasSpend = [...keys].some(
    (k) =>
      k.startsWith("amountspent") ||
      k === "spend" ||
      k === "spent" ||
      k === "amountspentusd" ||
      k === "amountspenteur"
  );
  const hasImpressions = keys.has("impressions");
  const hasCampaign =
    keys.has("campaignname") || keys.has("adsetname") || keys.has("adname");
  const hasMetaSignal =
    keys.has("linkclicks") ||
    keys.has("reach") ||
    keys.has("frequency") ||
    keys.has("landingpageviews") ||
    keys.has("results") ||
    keys.has("amountspent") ||
    [...keys].some((k) => k.startsWith("amountspent"));

  return hasSpend && hasImpressions && (hasCampaign || hasMetaSignal);
}

/** True when headers look like Google Ads Campaign performance (Cost / Impr.) */
export function looksLikeGoogleAdsHeaders(keys: Set<string> | string[]): boolean {
  const set = keys instanceof Set ? keys : new Set(keys.map(canonicalizeHeader));
  const hasCost = set.has("cost") || set.has("costeur");
  const hasAmountSpent = [...set].some(
    (k) => k.startsWith("amountspent") || k === "spend" || k === "spent"
  );
  const hasGoogleShape =
    hasCost &&
    (set.has("impr") || set.has("impressions")) &&
    (set.has("campaigntype") ||
      set.has("conversions") ||
      set.has("avgcpc") ||
      set.has("convrate") ||
      set.has("campaign"));
  return hasGoogleShape && !hasAmountSpent;
}

export function looksLikeGoogleAdsRows(rows: Record<string, unknown>[] | undefined): boolean {
  if (!rows?.[0]) return false;
  return looksLikeGoogleAdsHeaders(Object.keys(rows[0]).map(canonicalizeHeader));
}

/** Mapping diagnostics useful for empty-state / debug badge */
export function describeMetaMapping(rows: Record<string, unknown>[]): {
  date: string | null;
  amountSpent: string | null;
  linkClicks: string | null;
  results: string | null;
  landingPageViews: string | null;
} {
  if (!rows.length) {
    return {
      date: null,
      amountSpent: null,
      linkClicks: null,
      results: null,
      landingPageViews: null,
    };
  }
  const index = buildHeaderIndex(rows[0]);
  return {
    date: findDateColumn(index, rows[0]),
    amountSpent: resolveColumn(index, ["amountspent", "spend", "spent"]),
    linkClicks:
      resolveColumn(index, ["linkclicks", "outboundclicks"]) ||
      resolveColumn(index, ["clicksall", "clicks"]),
    results: resolveColumn(index, ["results", "result"]),
    landingPageViews: resolveColumn(index, ["landingpageviews", "landing_page_views"]),
  };
}
