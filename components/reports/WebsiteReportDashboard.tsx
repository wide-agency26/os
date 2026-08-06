"use client";

import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Users,
  UserPlus,
  MousePointerClick,
  Percent,
  ArrowDownRight,
} from "lucide-react";
import { DateRangeControls, useDateRangeFilter } from "@/components/reports/DateRangeControls";
import {
  type HeadlineMetrics,
  type DatasetMeta,
  normalizeRows,
  filterByRange,
  filterByMonths,
  availableMonths,
  monthsToRange,
  customDateRange,
  previousPeriodRange,
  computeHeadline,
  bySource,
  dailyTrends,
  formatCompact,
  formatPercent,
  formatDuration,
  formatDelta,
} from "@/lib/reports/ga4-website";

function shortLabel(name: string, max = 16) {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

const COLORS = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
];

interface WebsiteReportDashboardProps {
  rows: Record<string, unknown>[];
  datasetName?: string;
  datasetMeta?: DatasetMeta;
}

function SectionShell({
  eyebrow,
  title,
  description,
  docHref,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  docHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">
            {eyebrow}
          </p>
          <h3 className="text-[16px] font-bold text-gray-900">{title}</h3>
          <p className="text-[12px] text-gray-500 mt-1 max-w-3xl leading-relaxed">{description}</p>
        </div>
        {docHref && (
          <a
            href={docHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-blue-600 shrink-0"
          >
            GA4 docs <ExternalLink size={12} />
          </a>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Scorecard({
  label,
  value,
  delta,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  delta: number | null;
  icon: React.ElementType;
  hint?: string;
}) {
  const d = formatDelta(delta);
  const ToneIcon = d.tone === "up" ? TrendingUp : d.tone === "down" ? TrendingDown : Minus;
  const toneClass =
    d.tone === "up"
      ? "text-emerald-700 bg-emerald-50"
      : d.tone === "down"
        ? "text-red-700 bg-red-50"
        : "text-gray-500 bg-gray-50";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 truncate">
          {label}
        </p>
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <Icon size={15} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${toneClass}`}>
          <ToneIcon size={12} />
          {d.text}
        </span>
        <span className="text-[10px] text-gray-400">vs prior period</span>
      </div>
      {hint && <p className="text-[10px] text-gray-400 mt-2 leading-snug">{hint}</p>}
    </div>
  );
}

export function WebsiteReportDashboard({
  rows,
  datasetName,
  datasetMeta,
}: WebsiteReportDashboardProps) {
  const allRows = useMemo(() => normalizeRows(rows), [rows]);
  const months = useMemo(() => availableMonths(allRows), [allRows]);

  const dateState = useDateRangeFilter();
  const { mode, selectedMonths, customStart, customEnd } = dateState;
  const [tablePage, setTablePage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<keyof HeadlineMetrics | "sessionSource" | "returningUsers">(
    "sessions"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    if (mode === "custom" && customStart && customEnd) {
      return filterByRange(allRows, customDateRange(customStart, customEnd));
    }
    if (mode === "months" && selectedMonths.length > 0) {
      return filterByMonths(allRows, selectedMonths);
    }
    return allRows;
  }, [allRows, mode, selectedMonths, customStart, customEnd]);

  const activeRange = useMemo(() => {
    if (mode === "custom" && customStart && customEnd) {
      return customDateRange(customStart, customEnd);
    }
    if (mode === "months" && selectedMonths.length > 0) {
      return monthsToRange(selectedMonths);
    }
    if (!allRows.length) return null;
    const sorted = [...allRows].sort((a, b) => a.date.getTime() - b.date.getTime());
    return {
      start: sorted[0].date,
      end: sorted[sorted.length - 1].date,
      preset: "all" as const,
    };
  }, [mode, selectedMonths, customStart, customEnd, allRows]);

  const prevRange = useMemo(
    () => (activeRange ? previousPeriodRange(activeRange) : null),
    [activeRange]
  );
  const previous = useMemo(
    () => (prevRange ? filterByRange(allRows, prevRange) : []),
    [allRows, prevRange]
  );

  const headline = useMemo(() => computeHeadline(filtered, previous), [filtered, previous]);
  const sources = useMemo(() => bySource(filtered), [filtered]);
  const trends = useMemo(() => dailyTrends(filtered), [filtered]);

  const meta: DatasetMeta = datasetMeta || {
    name: datasetName,
    rowCount: rows.length,
  };

  const acquisitionChart = useMemo(
    () =>
      sources.slice(0, 8).map((s) => ({
        name: s.sessionSource,
        sessions: s.sessions,
        totalUsers: s.totalUsers,
      })),
    [sources]
  );

  const stackedSources = useMemo(
    () =>
      sources.slice(0, 10).map((s) => ({
        name: s.sessionSource,
        newUsers: s.newUsers,
        returningUsers: s.returningUsers,
      })),
    [sources]
  );

  const durationBySource = useMemo(
    () =>
      [...sources]
        .sort((a, b) => b.userEngagementDuration - a.userEngagementDuration)
        .slice(0, 8)
        .map((s) => ({
          name: s.sessionSource,
          duration: Math.round(s.userEngagementDuration),
          durationLabel: formatDuration(s.userEngagementDuration),
        })),
    [sources]
  );

  const sortedTable = useMemo(() => {
    const copy = [...sources];
    copy.sort((a, b) => {
      const av = a[sortKey as keyof typeof a];
      const bv = b[sortKey as keyof typeof b];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av) || 0;
      const bn = Number(bv) || 0;
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return copy;
  }, [sources, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedTable.length / pageSize));
  const pageRows = sortedTable.slice(tablePage * pageSize, tablePage * pageSize + pageSize);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setTablePage(0);
  };

  if (!allRows.length) {
    return (
      <div className="p-12 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50">
        <p className="text-[14px] text-gray-600 font-medium">
          This dataset doesn’t look like a Website / GA4 export.
        </p>
        <p className="text-[12px] text-gray-500 mt-1">
          Expected columns like date, sessionSource, sessions, totalUsers, engagementRate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DateRangeControls
        months={months}
        state={dateState}
        accent="#2563eb"
        sticky
        rowCountHint={`${filtered.length.toLocaleString()} rows in selected range`}
      />

      {/* Section 1 */}
      <SectionShell
        eyebrow="Section 1"
        title="Headline Scorecards"
        description="High-level health check of your digital property. Each metric compares to the previous matching period."
        docHref="https://support.google.com/analytics/answer/12195621"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Scorecard
            label="Total Users"
            value={formatCompact(headline.current.totalUsers, 0)}
            delta={headline.deltas.totalUsers}
            icon={Users}
          />
          <Scorecard
            label="New Users"
            value={formatCompact(headline.current.newUsers, 0)}
            delta={headline.deltas.newUsers}
            icon={UserPlus}
          />
          <Scorecard
            label="Sessions"
            value={formatCompact(headline.current.sessions, 0)}
            delta={headline.deltas.sessions}
            icon={MousePointerClick}
          />
          <Scorecard
            label="Engagement Rate"
            value={formatPercent(headline.current.engagementRate)}
            delta={headline.deltas.engagementRate}
            icon={Percent}
            hint="Share of engaged sessions (GA4)"
          />
          <Scorecard
            label="Bounce Rate"
            value={formatPercent(headline.current.bounceRate)}
            delta={headline.deltas.bounceRate}
            icon={ArrowDownRight}
            hint="Inverse of engagement rate"
          />
        </div>
      </SectionShell>

      {/* Section 2 */}
      <SectionShell
        eyebrow="Section 2"
        title="Traffic & Acquisition Breakdown"
        description="Where your audience is coming from, ranked by session volume."
        docHref="https://support.google.com/analytics/answer/9212670"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={acquisitionChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => shortLabel(String(v), 18)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as { name: string; sessions: number };
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-[12px] shadow-sm max-w-xs">
                        <p className="font-semibold text-gray-900 mb-1 break-words">{row.name}</p>
                        <p>Sessions: {Number(row.sessions).toLocaleString()}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="sessions" fill="#2563eb" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={acquisitionChart}
                  dataKey="sessions"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {acquisitionChart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as { name: string; sessions: number };
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-[12px] shadow-sm max-w-xs">
                        <p className="font-semibold text-gray-900 mb-1 break-words">{row.name}</p>
                        <p>Sessions: {Number(row.sessions).toLocaleString()}</p>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value) => shortLabel(String(value), 22)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionShell>

      {/* Section 3 */}
      <SectionShell
        eyebrow="Section 3"
        title="High-Level Traffic Sources"
        description="New vs returning users by session source. Returning users are totalUsers − newUsers."
        docHref="https://support.google.com/analytics/answer/9143382"
      >
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stackedSources} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
                tickFormatter={(v) => shortLabel(String(v), 14)}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as { name: string };
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-[12px] shadow-sm max-w-xs">
                      <p className="font-semibold text-gray-900 mb-1 break-words">
                        {row.name || String(label)}
                      </p>
                      {payload.map((p) => (
                        <p key={String(p.dataKey)}>
                          {p.name}: {Number(p.value).toLocaleString()}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar dataKey="newUsers" name="New users" stackId="a" fill="#2563eb" radius={[0, 0, 0, 0]} />
              <Bar
                dataKey="returningUsers"
                name="Returning users"
                stackId="a"
                fill="#93c5fd"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionShell>

      {/* Section 4 */}
      <SectionShell
        eyebrow="Section 4"
        title="Traffic Volume Trends Over Time"
        description="Daily sessions (left axis) vs sessions per user (right axis) to spot volume spikes and loyalty shifts."
        docHref="https://support.google.com/analytics/answer/11525732"
      >
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trends} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                label={{ value: "Sessions", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#64748b" } }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                label={{
                  value: "Sessions / user",
                  angle: 90,
                  position: "insideRight",
                  style: { fontSize: 11, fill: "#64748b" },
                }}
              />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="sessions"
                name="Sessions"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="sessionsPerUser"
                name="Sessions / user"
                stroke="#d97706"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionShell>

      {/* Section 5 */}
      <SectionShell
        eyebrow="Section 5"
        title="User Engagement & Quality Matrix"
        description="Engagement vs bounce over time, plus which sources keep people interacting the longest."
        docHref="https://support.google.com/analytics/answer/11525732?hl=en"
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
                  domain={[0, 1]}
                />
                <Tooltip
                  formatter={(v) => formatPercent(Number(v))}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="engagementRate"
                  name="Engagement rate"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="bounceRate"
                  name="Bounce rate"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2 h-[320px]">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Engagement duration by source
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={durationBySource} layout="vertical" margin={{ left: 4, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => shortLabel(String(v), 16)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as {
                      name: string;
                      duration: number;
                      durationLabel: string;
                    };
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-[12px] shadow-sm max-w-xs">
                        <p className="font-semibold text-gray-900 mb-1 break-words">{row.name}</p>
                        <p>Duration: {row.durationLabel || formatDuration(row.duration)}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="duration" fill="#7c3aed" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionShell>

      {/* Section 6 */}
      <SectionShell
        eyebrow="Section 6"
        title="Detailed Data Table"
        description="Source-of-truth breakdown. Sort columns and page through results for export-ready detail."
        docHref="https://support.google.com/analytics/answer/11525732?hl=en#zippy=%2Cchange-the-primary-dimension"
      >
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
          <table className="w-full text-left text-[12px] min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {(
                  [
                    ["sessionSource", "Session source"],
                    ["totalUsers", "Total users"],
                    ["activeUsers", "Active users"],
                    ["newUsers", "New users"],
                    ["returningUsers", "Returning"],
                    ["sessions", "Sessions"],
                    ["sessionsPerUser", "Sessions / user"],
                    ["engagementRate", "Engagement"],
                    ["bounceRate", "Bounce"],
                    ["userEngagementDuration", "Eng. duration"],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="inline-flex items-center gap-1 hover:text-blue-700"
                    >
                      {label}
                      {sortKey === key && (
                        <span className="text-blue-600">{sortDir === "asc" ? "↑" : "↓"}</span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.sessionSource} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-3 py-2 font-medium text-gray-900">{row.sessionSource}</td>
                  <td className="px-3 py-2 text-gray-700">{row.totalUsers.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-700">{row.activeUsers.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-700">{row.newUsers.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-700">{row.returningUsers.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-700">{row.sessions.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-700">{row.sessionsPerUser.toFixed(2)}</td>
                  <td className="px-3 py-2 text-gray-700">{formatPercent(row.engagementRate)}</td>
                  <td className="px-3 py-2 text-gray-700">{formatPercent(row.bounceRate)}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {formatDuration(row.userEngagementDuration)}
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                    No rows in this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[12px] text-gray-600">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setTablePage(0);
              }}
              className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-900"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
            <span className="text-gray-400">
              {sortedTable.length} sources · page {tablePage + 1} / {pageCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={tablePage === 0}
              onClick={() => setTablePage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 text-[12px] border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={tablePage >= pageCount - 1}
              onClick={() => setTablePage((p) => Math.min(pageCount - 1, p + 1))}
              className="px-3 py-1.5 text-[12px] border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </SectionShell>
    </div>
  );
}
