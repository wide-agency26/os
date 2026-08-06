/**
 * GA4 Website report aggregations over Data Hub rows.
 * Handles YYYYMMDD dates and stringified numeric CSV values.
 */

export type DatePreset = "7d" | "14d" | "30d" | "90d" | "all" | "custom";

export interface DateRange {
  start: Date | null; // inclusive
  end: Date | null; // inclusive end-of-day
  preset: DatePreset;
}

export interface NormalizedRow {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  sessionSource: string;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  sessions: number;
  sessionsPerUser: number;
  engagementRate: number; // 0–1
  bounceRate: number; // 0–1
  userEngagementDuration: number; // seconds
}

export interface MonthOption {
  key: string; // YYYY-MM
  label: string; // May 2026
}

export interface DatasetMeta {
  name?: string;
  createdAt?: string | null;
  rowCount?: number;
}

export interface HeadlineMetrics {
  totalUsers: number;
  activeUsers: number;
  sessions: number;
  engagementRate: number;
  bounceRate: number;
  newUsers: number;
  sessionsPerUser: number;
  userEngagementDuration: number;
}

export interface SourceBreakdown {
  sessionSource: string;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  sessions: number;
  sessionsPerUser: number;
  engagementRate: number;
  bounceRate: number;
  userEngagementDuration: number;
}

export interface DailyTrend {
  dateKey: string;
  label: string;
  sessions: number;
  sessionsPerUser: number;
  engagementRate: number;
  bounceRate: number;
  totalUsers: number;
  newUsers: number;
}

const KEY_ALIASES: Record<keyof Omit<NormalizedRow, "date" | "dateKey" | "monthKey">, string[]> = {
  sessionSource: ["sessionsource", "session_source", "source", "sourceMedium", "sourcemedium"],
  totalUsers: ["totalusers", "total_users", "users"],
  activeUsers: ["activeusers", "active_users"],
  newUsers: ["newusers", "new_users"],
  sessions: ["sessions", "session"],
  sessionsPerUser: ["sessionsperuser", "sessions_per_user"],
  engagementRate: ["engagementrate", "engagement_rate"],
  bounceRate: ["bouncerate", "bounce_rate"],
  userEngagementDuration: [
    "userengagementduration",
    "user_engagement_duration",
    "engagementduration",
    "averageengagementtime",
  ],
};

function normalizeHeader(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function findKey(row: Record<string, unknown>, aliases: string[]): string | null {
  const map = new Map<string, string>();
  for (const k of Object.keys(row)) {
    map.set(normalizeHeader(k), k);
  }
  for (const alias of aliases) {
    const hit = map.get(normalizeHeader(alias));
    if (hit) return hit;
  }
  return null;
}

function findDateKey(row: Record<string, unknown>): string | null {
  const map = new Map<string, string>();
  for (const k of Object.keys(row)) {
    map.set(normalizeHeader(k), k);
  }
  for (const alias of ["date", "day", "eventdate", "event_date", "datetime"]) {
    const hit = map.get(normalizeHeader(alias));
    if (hit) return hit;
  }
  // Fallback: first key that looks like a date value
  for (const [k, v] of Object.entries(row)) {
    if (parseFlexibleDate(v)) return k;
  }
  return null;
}

/** Digital-marketing report dates only — rejects Excel/ID/epoch garbage years */
export function isPlausibleReportDate(d: Date | null | undefined): boolean {
  if (!d || isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const nowY = new Date().getFullYear();
  // Floor: modern paid/organic analytics era. Cap: next calendar year only.
  return y >= 2018 && y <= nowY + 1;
}

export function isPlausibleMonthKey(key: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return false;
  const nowY = new Date().getFullYear();
  return y >= 2018 && y <= nowY + 1;
}

/** Excel serial day count → Date (Lotus 1900 date system) */
function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  // ~1982–2064 — outside marketing report range we still convert then plausibility-check
  if (serial < 30000 || serial > 60000) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const d = new Date(utc);
  return isPlausibleReportDate(d) ? d : null;
}

export function parseFlexibleDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return isPlausibleReportDate(value) ? value : null;
  }

  // Numeric: Excel serial or YYYYMMDD — never treat raw epoch-ms / IDs as dates
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 20180101 && value <= 20991231 && Number.isInteger(value)) {
      const s = String(Math.trunc(value));
      if (s.length === 8) {
        const y = Number(s.slice(0, 4));
        const m = Number(s.slice(4, 6)) - 1;
        const d = Number(s.slice(6, 8));
        const dt = new Date(y, m, d);
        return isPlausibleReportDate(dt) ? dt : null;
      }
    }
    return excelSerialToDate(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Reject pure decimals / percents / tiny ints that aren't dates
  if (/^-?\d+(\.\d+)?%?$/.test(raw)) {
    const n = parseFloat(raw.replace("%", ""));
    if (!Number.isFinite(n)) return null;
    // 8-digit YYYYMMDD as string
    if (/^\d{8}$/.test(raw)) {
      const y = Number(raw.slice(0, 4));
      const m = Number(raw.slice(4, 6)) - 1;
      const d = Number(raw.slice(6, 8));
      const dt = new Date(y, m, d);
      return isPlausibleReportDate(dt) ? dt : null;
    }
    // Excel serial as string
    if (/^\d{5}(\.\d+)?$/.test(raw)) return excelSerialToDate(n);
    return null;
  }

  // YYYYMMDD (GA4 export)
  if (/^\d{8}$/.test(raw)) {
    const y = Number(raw.slice(0, 4));
    const m = Number(raw.slice(4, 6)) - 1;
    const d = Number(raw.slice(6, 8));
    const dt = new Date(y, m, d);
    return isPlausibleReportDate(dt) ? dt : null;
  }

  // YYYY-MM-DD or ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const dt = new Date(raw.slice(0, 10) + "T00:00:00");
    return isPlausibleReportDate(dt) ? dt : null;
  }

  // M/D/YYYY or D/M/YYYY (prefer US M/D when ambiguous — GSC/Meta exports)
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const y = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
    const dt = new Date(y, Number(slash[1]) - 1, Number(slash[2]));
    return isPlausibleReportDate(dt) ? dt : null;
  }

  // Named months e.g. "Jun 2026", "June 1, 2026"
  const dt = new Date(raw);
  return isPlausibleReportDate(dt) ? dt : null;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseNumber(value: unknown): number {
  if (typeof value === "number" && !isNaN(value)) return value;
  if (value == null || value === "") return 0;
  const cleaned = String(value).replace(/[$€£¥₹,%\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
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

export function normalizeRows(rows: Record<string, unknown>[]): NormalizedRow[] {
  if (!rows.length) return [];
  const sample = rows[0];
  const dateKey = findDateKey(sample);
  if (!dateKey) return [];

  const keys = {
    sessionSource: findKey(sample, KEY_ALIASES.sessionSource),
    totalUsers: findKey(sample, KEY_ALIASES.totalUsers),
    activeUsers: findKey(sample, KEY_ALIASES.activeUsers),
    newUsers: findKey(sample, KEY_ALIASES.newUsers),
    sessions: findKey(sample, KEY_ALIASES.sessions),
    sessionsPerUser: findKey(sample, KEY_ALIASES.sessionsPerUser),
    engagementRate: findKey(sample, KEY_ALIASES.engagementRate),
    bounceRate: findKey(sample, KEY_ALIASES.bounceRate),
    userEngagementDuration: findKey(sample, KEY_ALIASES.userEngagementDuration),
  };

  const out: NormalizedRow[] = [];
  for (const row of rows) {
    const date = parseFlexibleDate(row[dateKey]);
    if (!date) continue;
    const sessions = keys.sessions ? parseNumber(row[keys.sessions]) : 0;
    const totalUsers = keys.totalUsers ? parseNumber(row[keys.totalUsers]) : 0;
    const newUsers = keys.newUsers ? parseNumber(row[keys.newUsers]) : 0;
    let engagementRate = keys.engagementRate ? parseNumber(row[keys.engagementRate]) : 0;
    let bounceRate = keys.bounceRate ? parseNumber(row[keys.bounceRate]) : 0;
    // Normalize percent-looking values that were stored as 0–100
    if (engagementRate > 1) engagementRate = engagementRate / 100;
    if (bounceRate > 1) bounceRate = bounceRate / 100;
    if (!keys.bounceRate && keys.engagementRate) bounceRate = Math.max(0, 1 - engagementRate);

    const sessionsPerUser = keys.sessionsPerUser
      ? parseNumber(row[keys.sessionsPerUser])
      : totalUsers > 0
        ? sessions / totalUsers
        : 0;

    const day = startOfDay(date);
    out.push({
      date: day,
      dateKey: toDateKey(date),
      monthKey: monthKeyFromDate(day),
      sessionSource: keys.sessionSource
        ? String(row[keys.sessionSource] ?? "(not set)")
        : "(not set)",
      totalUsers,
      activeUsers: keys.activeUsers ? parseNumber(row[keys.activeUsers]) : 0,
      newUsers,
      sessions,
      sessionsPerUser,
      engagementRate,
      bounceRate,
      userEngagementDuration: keys.userEngagementDuration
        ? parseNumber(row[keys.userEngagementDuration])
        : 0,
    });
  }
  return out;
}

export function availableMonths(rows: NormalizedRow[]): MonthOption[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (isPlausibleMonthKey(r.monthKey)) set.add(r.monthKey);
  }
  return [...set]
    .sort()
    .map((key) => ({ key, label: monthLabel(key) }));
}

export function filterByMonths(rows: NormalizedRow[], months: string[]): NormalizedRow[] {
  if (!months.length) return rows;
  const set = new Set(months);
  return rows.filter((r) => set.has(r.monthKey));
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
  return {
    start: startOfDay(new Date(ys, ms - 1, 1)),
    end: endOfDay(new Date(ye, me, 0)),
    preset: "custom",
  };
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

export function dataExtent(rows: NormalizedRow[]): { min: Date; max: Date } | null {
  if (!rows.length) return null;
  let min = rows[0].date.getTime();
  let max = min;
  for (const r of rows) {
    const t = r.date.getTime();
    if (t < min) min = t;
    if (t > max) max = t;
  }
  return { min: new Date(min), max: new Date(max) };
}

export function resolveDateRange(
  preset: DatePreset,
  allRows: NormalizedRow[],
  customStart?: string,
  customEnd?: string
): DateRange {
  const extent = dataExtent(allRows);
  if (preset === "all" || !extent) {
    return { start: null, end: null, preset: "all" };
  }

  if (preset === "custom") {
    const start = customStart ? startOfDay(new Date(customStart + "T00:00:00")) : extent.min;
    const end = customEnd ? endOfDay(new Date(customEnd + "T00:00:00")) : extent.max;
    return { start, end, preset };
  }

  const days = preset === "7d" ? 7 : preset === "14d" ? 14 : preset === "30d" ? 30 : 90;
  const end = endOfDay(extent.max);
  const start = startOfDay(
    new Date(extent.max.getFullYear(), extent.max.getMonth(), extent.max.getDate() - (days - 1))
  );
  return { start, end, preset };
}

export function filterByRange(rows: NormalizedRow[], range: DateRange): NormalizedRow[] {
  if (!range.start || !range.end) return rows;
  const a = range.start.getTime();
  const b = range.end.getTime();
  return rows.filter((r) => {
    const t = r.date.getTime();
    return t >= a && t <= b;
  });
}

/** Previous period of equal length ending the day before current start */
export function previousPeriodRange(range: DateRange): DateRange | null {
  if (!range.start || !range.end) return null;
  const ms = range.end.getTime() - range.start.getTime();
  const prevEnd = endOfDay(new Date(range.start.getTime() - 24 * 60 * 60 * 1000));
  const prevStart = startOfDay(new Date(prevEnd.getTime() - ms));
  return { start: prevStart, end: prevEnd, preset: range.preset };
}

function aggregateHeadline(rows: NormalizedRow[]): HeadlineMetrics {
  let totalUsers = 0;
  let activeUsers = 0;
  let newUsers = 0;
  let sessions = 0;
  let engWeighted = 0;
  let bounceWeighted = 0;
  let duration = 0;
  let sessionWeight = 0;

  for (const r of rows) {
    totalUsers += r.totalUsers;
    activeUsers += r.activeUsers;
    newUsers += r.newUsers;
    sessions += r.sessions;
    duration += r.userEngagementDuration;
    const w = r.sessions > 0 ? r.sessions : 1;
    engWeighted += r.engagementRate * w;
    bounceWeighted += r.bounceRate * w;
    sessionWeight += w;
  }

  const engagementRate = sessionWeight > 0 ? engWeighted / sessionWeight : 0;
  const bounceRate = sessionWeight > 0 ? bounceWeighted / sessionWeight : Math.max(0, 1 - engagementRate);

  return {
    totalUsers,
    activeUsers,
    sessions,
    engagementRate,
    bounceRate,
    newUsers,
    sessionsPerUser: totalUsers > 0 ? sessions / totalUsers : 0,
    userEngagementDuration: duration,
  };
}

export function computeHeadline(
  currentRows: NormalizedRow[],
  previousRows: NormalizedRow[]
): { current: HeadlineMetrics; previous: HeadlineMetrics; deltas: Record<keyof HeadlineMetrics, number | null> } {
  const current = aggregateHeadline(currentRows);
  const previous = aggregateHeadline(previousRows);
  const deltas = {} as Record<keyof HeadlineMetrics, number | null>;
  (Object.keys(current) as (keyof HeadlineMetrics)[]).forEach((k) => {
    const prev = previous[k];
    if (prev === 0) {
      deltas[k] = current[k] === 0 ? 0 : null;
    } else {
      deltas[k] = ((current[k] - prev) / Math.abs(prev)) * 100;
    }
  });
  return { current, previous, deltas };
}

export function bySource(rows: NormalizedRow[]): SourceBreakdown[] {
  const map = new Map<string, NormalizedRow[]>();
  for (const r of rows) {
    const list = map.get(r.sessionSource) || [];
    list.push(r);
    map.set(r.sessionSource, list);
  }
  const out: SourceBreakdown[] = [];
  for (const [sessionSource, group] of map) {
    const h = aggregateHeadline(group);
    out.push({
      sessionSource,
      totalUsers: h.totalUsers,
      activeUsers: h.activeUsers,
      newUsers: h.newUsers,
      returningUsers: Math.max(0, h.totalUsers - h.newUsers),
      sessions: h.sessions,
      sessionsPerUser: h.sessionsPerUser,
      engagementRate: h.engagementRate,
      bounceRate: h.bounceRate,
      userEngagementDuration: h.userEngagementDuration,
    });
  }
  return out.sort((a, b) => b.sessions - a.sessions);
}

export function dailyTrends(rows: NormalizedRow[]): DailyTrend[] {
  const map = new Map<string, NormalizedRow[]>();
  for (const r of rows) {
    const list = map.get(r.dateKey) || [];
    list.push(r);
    map.set(r.dateKey, list);
  }
  const out: DailyTrend[] = [];
  for (const [dateKey, group] of map) {
    const h = aggregateHeadline(group);
    const d = group[0].date;
    out.push({
      dateKey,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      sessions: h.sessions,
      sessionsPerUser: h.sessionsPerUser,
      engagementRate: h.engagementRate,
      bounceRate: h.bounceRate,
      totalUsers: h.totalUsers,
      newUsers: h.newUsers,
    });
  }
  return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function formatCompact(n: number, digits = 1): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(digits)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(digits)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function formatPercent(rate01: number): string {
  return `${(rate01 * 100).toFixed(1)}%`;
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatDelta(delta: number | null): { text: string; tone: "up" | "down" | "flat" | "na" } {
  if (delta == null) return { text: "n/a", tone: "na" };
  if (Math.abs(delta) < 0.05) return { text: "0.0%", tone: "flat" };
  const text = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
  return { text, tone: delta > 0 ? "up" : "down" };
}

export function isWebsiteDataset(
  columns: { key: string; type?: string }[] | undefined,
  rows: Record<string, unknown>[] | undefined
): boolean {
  const keys = new Set(
    (columns || []).map((c) => normalizeHeader(c.key)).concat(
      rows?.[0] ? Object.keys(rows[0]).map(normalizeHeader) : []
    )
  );
  const hasSource = ["sessionsource", "session_source", "source"].some((k) =>
    keys.has(normalizeHeader(k))
  );
  const hasSessions = keys.has("sessions");
  const hasUsers = keys.has("totalusers") || keys.has("activeusers");
  return hasSource && hasSessions && hasUsers;
}
