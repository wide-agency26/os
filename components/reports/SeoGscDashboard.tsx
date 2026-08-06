"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  MousePointerClick,
  Eye,
  Percent,
  Hash,
  Search,
  Database,
  ExternalLink,
} from "lucide-react";
import { DatasetSourceBadge } from "@/components/reports/DatasetSourceBadge";
import { DateRangeControls, useDateRangeFilter } from "@/components/reports/DateRangeControls";
import {
  type GscBundle,
  type GscBrandMode,
  type DatasetMeta,
  availableGscMonths,
  filterGscBundleByMonths,
  filterGscBundleByRange,
  customGscRange,
  previousGscPeriod,
  computeGscHeadline,
  filterQueriesByBrand,
  topQueriesByClicks,
  seoOpportunityQueries,
  gscDailyTrends,
  hasGscData,
  formatCompact,
  formatDelta,
  formatCtr,
  formatPosition,
} from "@/lib/reports/gsc";
import { subcategoryLabel } from "@/lib/data-hub/subcategory";

const GSC_GREEN = "#188038";
const COLORS = ["#188038", "#4285f4", "#ea4335", "#fbbc04", "#34a853", "#ab47bc", "#5f6368"];

interface SeoGscDashboardProps {
  bundle: GscBundle;
  datasetMeta?: DatasetMeta;
  isAdmin?: boolean;
}

function SectionShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#188038] mb-1">
          {eyebrow}
        </p>
        <h3 className="text-[16px] font-bold text-gray-900">{title}</h3>
        <p className="text-[12px] text-gray-500 mt-1 max-w-3xl leading-relaxed">{description}</p>
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
  invertDelta,
}: {
  label: string;
  value: string;
  delta: number | null;
  icon: React.ElementType;
  invertDelta?: boolean;
}) {
  const d = formatDelta(delta);
  let tone = d.tone;
  if (invertDelta && (tone === "up" || tone === "down")) {
    tone = tone === "up" ? "down" : "up";
  }
  const ToneIcon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Minus;
  const toneClass =
    tone === "up"
      ? "text-emerald-700 bg-emerald-50"
      : tone === "down"
        ? "text-red-700 bg-red-50"
        : "text-gray-500 bg-gray-50";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 truncate">
          {label}
        </p>
        <div className="w-8 h-8 rounded-lg bg-[#188038]/10 text-[#188038] flex items-center justify-center shrink-0">
          <Icon size={15} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight tabular-nums">{value}</p>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${toneClass}`}
        >
          <ToneIcon size={12} />
          {d.text}
        </span>
        <span className="text-[10px] text-gray-400">vs prior period</span>
      </div>
    </div>
  );
}

function shortLabel(name: string, max = 28) {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

function pathLabel(url: string, max = 36) {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return shortLabel(path === "/" ? u.hostname : path, max);
  } catch {
    return shortLabel(url, max);
  }
}

export function SeoGscDashboard({ bundle: rawBundle, datasetMeta, isAdmin }: SeoGscDashboardProps) {
  const months = useMemo(() => availableGscMonths(rawBundle), [rawBundle]);
  const dateState = useDateRangeFilter();
  const { mode: filterMode, selectedMonths, customStart, customEnd } = dateState;

  const [brandMode, setBrandMode] = useState<GscBrandMode>("all");
  const [brandTerms, setBrandTerms] = useState("");
  const [tableMode, setTableMode] = useState<"queries" | "pages">("queries");
  const [tableSearch, setTableSearch] = useState("");
  const [sortKey, setSortKey] = useState<"clicks" | "impressions" | "ctr" | "position" | "dimension">(
    "clicks"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);

  const filtered = useMemo(() => {
    if (filterMode === "custom" && customStart && customEnd) {
      return filterGscBundleByRange(rawBundle, customGscRange(customStart, customEnd));
    }
    if (filterMode === "months" && selectedMonths.length) {
      return filterGscBundleByMonths(rawBundle, selectedMonths);
    }
    return rawBundle;
  }, [rawBundle, filterMode, selectedMonths, customStart, customEnd]);

  const queries = useMemo(
    () => filterQueriesByBrand(filtered.queries, brandMode, brandTerms),
    [filtered.queries, brandMode, brandTerms]
  );

  const current = useMemo(() => {
    if (filtered.dates.length) return computeGscHeadline(filtered);
    if (queries.length && brandMode !== "all") {
      const clicks = queries.reduce((s, q) => s + q.clicks, 0);
      const impressions = queries.reduce((s, q) => s + q.impressions, 0);
      const posW = queries.reduce((s, q) => s + q.position * q.impressions, 0);
      return {
        clicks,
        impressions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        position: impressions > 0 ? posW / impressions : 0,
      };
    }
    return computeGscHeadline({ ...filtered, queries });
  }, [filtered, queries, brandMode]);

  const prevBundle = useMemo(
    () => previousGscPeriod(selectedMonths, filterMode, customStart, customEnd, rawBundle),
    [rawBundle, selectedMonths, filterMode, customStart, customEnd]
  );
  const previous = useMemo(() => computeGscHeadline(prevBundle), [prevBundle]);

  const deltas = useMemo(() => {
    const keys = ["clicks", "impressions", "ctr", "position"] as const;
    const out: Record<(typeof keys)[number], number | null> = {
      clicks: null,
      impressions: null,
      ctr: null,
      position: null,
    };
    for (const k of keys) {
      const c = current[k];
      const p = previous[k];
      if (p === 0) out[k] = c === 0 ? 0 : null;
      else out[k] = ((c - p) / Math.abs(p)) * 100;
    }
    return out;
  }, [current, previous]);

  const trends = useMemo(() => gscDailyTrends(filtered), [filtered]);
  const topQueries = useMemo(() => topQueriesByClicks(queries, 10), [queries]);
  const opportunities = useMemo(() => seoOpportunityQueries(queries), [queries]);

  const queryBars = topQueries.map((q) => ({
    name: shortLabel(q.dimension, 22),
    full: q.dimension,
    clicks: q.clicks,
  }));

  const scatterData = useMemo(
    () =>
      queries
        .filter((q) => q.impressions > 0 && q.position > 0)
        .slice(0, 80)
        .map((q) => ({
          name: q.dimension,
          impressions: q.impressions,
          position: Number(q.position.toFixed(2)),
          clicks: q.clicks,
          opportunity: q.impressions > 1000 && q.position >= 4 && q.position <= 15,
        })),
    [queries]
  );

  const pageShare = useMemo(() => {
    const top = [...filtered.pages].sort((a, b) => b.clicks - a.clicks).slice(0, 5);
    return top.map((p) => ({
      name: pathLabel(p.dimension, 24),
      full: p.dimension,
      value: p.clicks,
    }));
  }, [filtered.pages]);

  const deviceDonut = useMemo(
    () =>
      [...filtered.devices]
        .sort((a, b) => b.clicks - a.clicks)
        .map((d) => ({ name: d.dimension, value: d.clicks })),
    [filtered.devices]
  );

  const countryBars = useMemo(
    () =>
      [...filtered.countries]
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 8)
        .map((c) => ({
          name: shortLabel(c.dimension, 14),
          full: c.dimension,
          clicks: c.clicks,
          impressions: c.impressions,
        })),
    [filtered.countries]
  );

  const tableRows = useMemo(() => {
    const base = tableMode === "queries" ? queries : filtered.pages;
    const q = tableSearch.trim().toLowerCase();
    let rows = q
      ? base.filter((r) => r.dimension.toLowerCase().includes(q))
      : [...base];
    rows.sort((a, b) => {
      if (sortKey === "dimension") {
        return sortDir === "asc"
          ? a.dimension.localeCompare(b.dimension)
          : b.dimension.localeCompare(a.dimension);
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [tableMode, queries, filtered.pages, tableSearch, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const pageSlice = tableRows.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "position" || key === "dimension" ? "asc" : "desc");
    }
    setPage(0);
  };

  if (!hasGscData(rawBundle)) {
    return (
      <div className="p-16 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50">
        <Search className="mx-auto mb-3 text-gray-400" size={32} />
        <p className="text-[14px] text-gray-600 font-medium mb-1">No SEO data yet</p>
        <p className="text-[12px] text-gray-500 mb-3 max-w-md mx-auto">
          Upload Google Search Console exports named{" "}
          <span className="font-medium">GSC - Queries</span>,{" "}
          <span className="font-medium">GSC - Pages</span>,{" "}
          <span className="font-medium">GSC - Dates</span>, etc. under SEO in the Data Hub.
        </p>
        {isAdmin && (
          <Link
            href="/app/projects/report-data"
            className="text-[13px] text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
          >
            <Database size={14} /> Open Data Hub →
          </Link>
        )}
      </div>
    );
  }

  const sourceName =
    datasetMeta?.name ||
    rawBundle.sources.map((s) => s.name).join(" / ") ||
    "GSC multi-stream";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <DatasetSourceBadge
          meta={{
            name: sourceName,
            createdAt: datasetMeta?.createdAt,
            rowCount:
              datasetMeta?.rowCount ??
              rawBundle.sources.reduce((s, x) => s + x.rowCount, 0),
          }}
          channelLabel="SEO · Search Console"
          channelClassName="bg-emerald-50 text-[#188038]"
        />
      </div>

      {rawBundle.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rawBundle.sources.map((s) => (
            <span
              key={`${s.subcategory}-${s.name}`}
              className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600"
              title={s.name}
            >
              {subcategoryLabel(s.subcategory)} · {s.rowCount.toLocaleString()} rows
            </span>
          ))}
        </div>
      )}

      <DateRangeControls
        months={months}
        state={dateState}
        accent={GSC_GREEN}
        rowCountHint={
          months.length
            ? `${filtered.dates.length.toLocaleString()} daily points in range`
            : "Upload GSC - Dates.csv to unlock month pills"
        }
      />

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Brand filter
          </label>
          <select
            value={brandMode}
            onChange={(e) => {
              setBrandMode(e.target.value as GscBrandMode);
              setPage(0);
            }}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-[13px] min-w-[180px]"
          >
            <option value="all">All queries</option>
            <option value="non_branded">Non-branded queries</option>
            <option value="branded">Branded queries</option>
          </select>
        </div>
        {brandMode !== "all" && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Brand terms
            </label>
            <input
              type="text"
              value={brandTerms}
              onChange={(e) => {
                setBrandTerms(e.target.value);
                setPage(0);
              }}
              placeholder="e.g. wide, wide agency"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] bg-white"
            />
            {!brandTerms.trim() && (
              <p className="text-[11px] text-amber-600 mt-1">
                Enter comma-separated brand keywords to segment branded traffic.
              </p>
            )}
          </div>
        )}
        <a
          href="https://search.google.com/search-console"
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-[12px] text-[#188038] font-medium inline-flex items-center gap-1 hover:underline"
        >
          Open Search Console <ExternalLink size={12} />
        </a>
      </div>

      <SectionShell
        eyebrow="Section 1"
        title="Headline scorecards"
        description="Organic search traffic, SERP visibility, and ranking health vs the prior matching period."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Scorecard
            label="Organic clicks"
            value={formatCompact(current.clicks)}
            delta={deltas.clicks}
            icon={MousePointerClick}
          />
          <Scorecard
            label="Organic impressions"
            value={formatCompact(current.impressions)}
            delta={deltas.impressions}
            icon={Eye}
          />
          <Scorecard
            label="Average CTR"
            value={formatCtr(current.ctr)}
            delta={deltas.ctr}
            icon={Percent}
          />
          <Scorecard
            label="Average position"
            value={formatPosition(current.position)}
            delta={deltas.position}
            icon={Hash}
            invertDelta
          />
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 2"
        title="Search volume & ranking trends"
        description="Daily organic clicks and impressions against average SERP position (lower position is better)."
      >
        {trends.length === 0 ? (
          <p className="text-[13px] text-gray-500">
            Upload <span className="font-medium">GSC - Dates.csv</span> to unlock the time series.
          </p>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatCompact(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  reversed
                  domain={[1, "auto"]}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="impressions"
                  name="Impressions"
                  fill="#a8dab5"
                  opacity={0.7}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="clicks"
                  name="Clicks"
                  stroke="#188038"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="position"
                  name="Avg. position"
                  stroke="#ea4335"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 3"
        title="Top search queries"
        description="Highest-click keywords and impression vs position opportunities (high impressions, positions 4–15)."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-[300px]">
            {queryBars.length === 0 ? (
              <p className="text-[13px] text-gray-500">No query data in range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={queryBars} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    labelFormatter={(_: unknown, payload: readonly { payload?: { full?: string } }[]) =>
                      payload?.[0]?.payload?.full || ""
                    }
                  />
                  <Bar dataKey="clicks" name="Clicks" fill={GSC_GREEN} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div>
            <div className="h-[240px]">
              {scatterData.length === 0 ? (
                <p className="text-[13px] text-gray-500">No query scatter data.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      dataKey="impressions"
                      name="Impressions"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatCompact(v)}
                    />
                    <YAxis
                      type="number"
                      dataKey="position"
                      name="Position"
                      reversed
                      tick={{ fontSize: 11 }}
                    />
                    <ZAxis type="number" dataKey="clicks" range={[40, 200]} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                    <Scatter
                      data={scatterData.filter((d) => !d.opportunity)}
                      fill="#94a3b8"
                      name="Queries"
                    />
                    <Scatter
                      data={scatterData.filter((d) => d.opportunity)}
                      fill="#f59e0b"
                      name="SEO opportunities"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>
            {opportunities.length > 0 && (
              <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-2">
                {opportunities.length} low-hanging SEO win
                {opportunities.length === 1 ? "" : "s"} flagged (impressions &gt; 1,000 · position
                4–15).
              </p>
            )}
          </div>
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 4"
        title="Top organic landing pages"
        description="Which URLs capture the most organic entry traffic and how click share distributes."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-[260px]">
            {pageShare.length === 0 ? (
              <p className="text-[13px] text-gray-500">
                Upload <span className="font-medium">GSC - Pages.csv</span> for page share.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pageShare}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {pageShare.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-2 font-semibold">Page</th>
                  <th className="py-2 pr-2 font-semibold text-right">Clicks</th>
                  <th className="py-2 pr-2 font-semibold text-right">Impr.</th>
                  <th className="py-2 font-semibold text-right">CTR</th>
                </tr>
              </thead>
              <tbody>
                {[...filtered.pages]
                  .sort((a, b) => b.clicks - a.clicks)
                  .slice(0, 8)
                  .map((p) => (
                    <tr key={p.dimension} className="border-b border-gray-50">
                      <td className="py-2 pr-2 text-gray-800 max-w-[220px] truncate" title={p.dimension}>
                        {pathLabel(p.dimension, 40)}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatCompact(p.clicks)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {formatCompact(p.impressions)}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatCtr(p.ctr)}</td>
                    </tr>
                  ))}
                {filtered.pages.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-400">
                      No page rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 5"
        title="Device & geographic SERP distribution"
        description="Organic click share by device category and top countries."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-[260px]">
            {deviceDonut.length === 0 ? (
              <p className="text-[13px] text-gray-500">
                Upload <span className="font-medium">GSC - Devices.csv</span>.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceDonut}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {deviceDonut.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="h-[260px]">
            {countryBars.length === 0 ? (
              <p className="text-[13px] text-gray-500">
                Upload <span className="font-medium">GSC - Countries.csv</span>.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countryBars} layout="vertical" margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(_: unknown, payload: readonly { payload?: { full?: string } }[]) =>
                      payload?.[0]?.payload?.full || ""
                    }
                  />
                  <Legend />
                  <Bar dataKey="clicks" name="Clicks" fill="#4285f4" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="impressions" name="Impressions" fill="#a8dab5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 6"
        title="Source-of-truth SEO table"
        description="Sortable, searchable query and page performance for SEO strategists."
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-[12px]">
            {(
              [
                ["queries", "Queries"],
                ["pages", "Pages"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTableMode(id);
                  setPage(0);
                }}
                className={`px-3 py-1.5 font-medium ${
                  tableMode === id
                    ? "bg-[#188038] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={tableSearch}
            onChange={(e) => {
              setTableSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search…"
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] bg-white min-w-[180px]"
          />
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] bg-white ml-auto"
          >
            {[10, 15, 25].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                {(
                  [
                    ["dimension", tableMode === "queries" ? "Search query" : "Landing page"],
                    ["clicks", "Clicks"],
                    ["impressions", "Impressions"],
                    ["ctr", "CTR"],
                    ["position", "Avg position"],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="py-2 pr-2 font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className={`hover:text-gray-800 ${key !== "dimension" ? "w-full text-right" : ""}`}
                    >
                      {label}
                      {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageSlice.map((r) => (
                <tr key={r.dimension} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="py-2 pr-2 text-gray-800 max-w-[320px] truncate" title={r.dimension}>
                    {tableMode === "pages" ? pathLabel(r.dimension, 56) : shortLabel(r.dimension, 56)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatCompact(r.clicks)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {formatCompact(r.impressions)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatCtr(r.ctr)}</td>
                  <td className="py-2 text-right tabular-nums">{formatPosition(r.position)}</td>
                </tr>
              ))}
              {pageSlice.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    No rows match this filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3 text-[12px] text-gray-500">
          <span>
            {tableRows.length.toLocaleString()} rows · page {page + 1} / {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </SectionShell>
    </div>
  );
}
