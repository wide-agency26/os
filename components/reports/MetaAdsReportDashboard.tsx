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
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Banknote,
  Eye,
  MousePointerClick,
  Percent,
  Target,
  Coins,
  Activity,
  Filter,
} from "lucide-react";
import { DateRangeControls, useDateRangeFilter } from "@/components/reports/DateRangeControls";
import {
  type ConversionGoalId,
  type DrillLevel,
  type DatasetMeta,
  normalizeMetaRows,
  detectConversionOptions,
  conversionGoalLabel,
  availableMonths,
  filterByMonths,
  filterMetaByRange,
  customDateRange,
  monthsToRange,
  previousMetaPeriodRange,
  computeMetaHeadline,
  byCampaign,
  byAdSet,
  byAd,
  metaDailyTrends,
  metaMonthlyTrends,
  formatCompact,
  formatCurrency,
  formatCtr,
  formatDelta,
  describeMetaMapping,
} from "@/lib/reports/meta-ads";

const COLORS = [
  "#1877f2",
  "#42b72a",
  "#f7b928",
  "#f02849",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#db2777",
  "#4f46e5",
  "#059669",
];

interface MetaAdsReportDashboardProps {
  rows: Record<string, unknown>[];
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
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#1877f2] mb-1">
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
            className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-[#1877f2] shrink-0"
          >
            Meta docs <ExternalLink size={12} />
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
        <div className="w-8 h-8 rounded-lg bg-[#1877f2]/10 text-[#1877f2] flex items-center justify-center shrink-0">
          <Icon size={15} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
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

function shortName(name: string, max = 16) {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

export function MetaAdsReportDashboard({ rows, datasetMeta }: MetaAdsReportDashboardProps) {
  const allRows = useMemo(() => normalizeMetaRows(rows), [rows]);
  const conversionOptions = useMemo(() => detectConversionOptions(rows), [rows]);
  const months = useMemo(() => availableMonths(allRows), [allRows]);
  const mapping = useMemo(() => describeMetaMapping(rows), [rows]);

  const dateState = useDateRangeFilter();
  const {
    mode,
    selectedMonths,
    customStart,
    customEnd,
  } = dateState;
  const [goal, setGoal] = useState<ConversionGoalId>("auto");
  const [trendGrain, setTrendGrain] = useState<"daily" | "monthly">("daily");
  const [hideZeroSpend, setHideZeroSpend] = useState(true);
  const [tablePage, setTablePage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [drill, setDrill] = useState<DrillLevel>("campaign");
  const [sortKey, setSortKey] = useState("amountSpent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    if (mode === "custom" && customStart && customEnd) {
      return filterMetaByRange(allRows, customDateRange(customStart, customEnd));
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
    () => (activeRange ? previousMetaPeriodRange(activeRange) : null),
    [activeRange]
  );
  const previous = useMemo(
    () => (prevRange ? filterMetaByRange(allRows, prevRange) : []),
    [allRows, prevRange]
  );

  const headline = useMemo(
    () => computeMetaHeadline(filtered, previous, goal),
    [filtered, previous, goal]
  );
  const campaigns = useMemo(() => byCampaign(filtered, goal), [filtered, goal]);
  const adSets = useMemo(() => byAdSet(filtered, goal), [filtered, goal]);
  const ads = useMemo(() => byAd(filtered, goal), [filtered, goal]);
  const trends = useMemo(
    () =>
      trendGrain === "monthly"
        ? metaMonthlyTrends(filtered, goal)
        : metaDailyTrends(filtered, goal),
    [filtered, goal, trendGrain]
  );

  const goalLabel = conversionGoalLabel(goal, conversionOptions);

  const spendChart = useMemo(
    () =>
      campaigns.slice(0, 8).map((c) => ({
        // Full name as category key — truncated labels collide across MSF26 campaigns
        name: c.campaignName,
        amountSpent: Math.round(c.amountSpent * 100) / 100,
        conversions: c.conversions,
      })),
    [campaigns]
  );

  const funnelChart = useMemo(
    () =>
      campaigns.slice(0, 8).map((c) => ({
        name: c.campaignName,
        impressions: c.impressions,
        linkClicks: c.linkClicks,
        landingPageViews: c.landingPageViews,
        conversions: c.conversions,
      })),
    [campaigns]
  );

  const scatterData = useMemo(
    () =>
      ads
        .filter((a) => a.frequency > 0 && a.amountSpent > 0)
        .slice(0, 50)
        .map((a) => ({
          name: a.adName,
          frequency: Math.round(a.frequency * 100) / 100,
          cpa: Math.round(a.costPerConversion * 100) / 100,
          ctr: Math.round(a.ctr * 100) / 100,
          spend: a.amountSpent,
        })),
    [ads]
  );

  const tableSource = useMemo(() => {
    const base =
      drill === "adSet"
        ? adSets.map((a) => ({
            dim: a.adSetName,
            sub: a.campaignName,
            ...a,
          }))
        : drill === "ad"
          ? ads.map((a) => ({
              dim: a.adName,
              sub: `${a.campaignName} · ${a.adSetName}`,
              ...a,
            }))
          : campaigns.map((c) => ({
              dim: c.campaignName,
              sub: "",
              ...c,
            }));
    return hideZeroSpend ? base.filter((r) => r.amountSpent > 0) : base;
  }, [drill, campaigns, adSets, ads, hideZeroSpend]);

  const sortedTable = useMemo(() => {
    const copy = [...tableSource];
    copy.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av) || 0;
      const bn = Number(bv) || 0;
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return copy;
  }, [tableSource, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedTable.length / pageSize));
  const pageRows = sortedTable.slice(tablePage * pageSize, tablePage * pageSize + pageSize);

  const toggleSort = (key: string) => {
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
          Couldn’t parse dates from this Meta Ads export.
        </p>
        <p className="text-[12px] text-gray-500 mt-1 max-w-lg mx-auto">
          Need a date column such as <code>Reporting starts</code> or <code>date</code>.
        </p>
      </div>
    );
  }

  const h = headline.current;
  const d = headline.deltas;
  const clicksNote =
    mapping.linkClicks && /clicksall/i.test(canonicalizeLoose(mapping.linkClicks))
      ? "Using “Clicks (all)” — re-upload with Link clicks, Landing page views, and Results columns for the full funnel."
      : !mapping.results && !mapping.landingPageViews
        ? "This export has no Results / Landing page views columns. Conversion selector falls back to clicks until you re-upload a fuller Ads Manager export."
        : null;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="sticky top-0 z-20 space-y-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {clicksNote && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 inline-block">
                  {clicksNote}
                </p>
              )}
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-2 min-w-[220px]">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Conversion metric
              </label>
              <select
                value={goal}
                onChange={(e) => {
                  setGoal(e.target.value as ConversionGoalId);
                  setTablePage(0);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-[13px] bg-white text-gray-900 focus:ring-1 focus:ring-[#1877f2] outline-none min-w-[220px]"
              >
                {conversionOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DateRangeControls
          months={months}
          state={dateState}
          accent="#1877f2"
          rowCountHint={`${filtered.length.toLocaleString()} rows in selected range`}
        />
      </div>

      <SectionShell
        eyebrow="Section 1"
        title="Headline Scorecards"
        description="Paid investment, efficiency, and conversion outcomes for the selected date range — compared to the previous matching period."
        docHref="https://www.facebook.com/business/help/447834205297697"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
          <Scorecard
            label="Amount Spent"
            value={formatCurrency(h.amountSpent)}
            delta={d.amountSpent}
            icon={Banknote}
          />
          <Scorecard
            label="Impressions"
            value={formatCompact(h.impressions, 0)}
            delta={d.impressions}
            icon={Eye}
          />
          <Scorecard
            label="Link Clicks"
            value={formatCompact(h.linkClicks, 0)}
            delta={d.linkClicks}
            icon={MousePointerClick}
          />
          <Scorecard label="CTR" value={formatCtr(h.ctr)} delta={d.ctr} icon={Percent} />
          <Scorecard
            label={goalLabel}
            value={formatCompact(h.conversions, 0)}
            delta={d.conversions}
            icon={Target}
          />
          <Scorecard
            label="CPA"
            value={h.conversions > 0 ? formatCurrency(h.costPerConversion) : "—"}
            delta={d.costPerConversion}
            icon={Coins}
            invertDelta
          />
          <Scorecard
            label="Avg CPC"
            value={h.linkClicks > 0 ? formatCurrency(h.cpc) : "—"}
            delta={d.cpc}
            icon={Activity}
            invertDelta
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-gray-500">
          <span>
            Reach{" "}
            <strong className="text-gray-800">
              {h.reach > 0 ? formatCompact(h.reach, 0) : "—"}
            </strong>
          </span>
          <span>
            Avg frequency <strong className="text-gray-800">{h.frequency.toFixed(2)}</strong>
          </span>
          {h.landingPageViews > 0 && (
            <span>
              Landing page views{" "}
              <strong className="text-gray-800">{formatCompact(h.landingPageViews, 0)}</strong>
            </span>
          )}
          {h.results > 0 && (
            <span>
              Results <strong className="text-gray-800">{formatCompact(h.results, 0)}</strong>
            </span>
          )}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 2"
        title="Campaign & Budget Allocation"
        description="Where budget was spent and which campaigns drove the selected conversion metric."
        docHref="https://www.facebook.com/business/help/397103717129884"
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 h-[300px]">
            <p className="text-[12px] font-medium text-gray-600 mb-2">Spend by campaign</p>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={spendChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={120}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => shortName(String(v), 18)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as {
                      name: string;
                      amountSpent: number;
                      conversions: number;
                    };
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-[12px] shadow-sm max-w-xs">
                        <p className="font-semibold text-gray-900 mb-1 break-words">{row.name}</p>
                        <p>Spend: {formatCurrency(row.amountSpent)}</p>
                        <p>
                          {goalLabel}: {formatCompact(row.conversions, 0)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="amountSpent" name="Spend" fill="#1877f2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2 h-[300px]">
            <p className="text-[12px] font-medium text-gray-600 mb-2">
              {goalLabel} share
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={spendChart.filter((c) => c.conversions > 0)}
                  dataKey="conversions"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {spendChart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as {
                      name: string;
                      conversions: number;
                      amountSpent: number;
                    };
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-[12px] shadow-sm max-w-xs">
                        <p className="font-semibold text-gray-900 mb-1 break-words">{row.name}</p>
                        <p>
                          {goalLabel}: {formatCompact(row.conversions, 0)}
                        </p>
                        <p>Spend: {formatCurrency(row.amountSpent)}</p>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value) => shortName(String(value), 22)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 3"
        title="Paid Acquisition Funnel"
        description="Impressions → link clicks → landing page views (when available) by campaign."
        docHref="https://www.facebook.com/business/help/675615555941604"
      >
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelChart} margin={{ left: 4, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => shortName(String(v), 14)}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as {
                    name: string;
                    impressions: number;
                    linkClicks: number;
                    landingPageViews: number;
                  };
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-[12px] shadow-sm max-w-xs">
                      <p className="font-semibold text-gray-900 mb-1 break-words">
                        {row.name || String(label)}
                      </p>
                      {payload.map((p) => (
                        <p key={String(p.dataKey)}>
                          {p.name}: {formatCompact(Number(p.value), 0)}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="impressions" name="Impressions" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="linkClicks" name="Link clicks" fill="#1877f2" radius={[3, 3, 0, 0]} />
              <Bar
                dataKey="landingPageViews"
                name="Landing page views"
                fill="#42b72a"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 4"
        title="Spend vs. Performance Trends"
        description="Budget execution against the selected conversion metric — daily surges or monthly cycles."
        docHref="https://www.facebook.com/business/help/397103717129884"
      >
        <div className="flex justify-end mb-2">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-[12px]">
            {(["daily", "monthly"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setTrendGrain(opt)}
                className={`px-3 py-1.5 font-medium capitalize ${
                  trendGrain === opt
                    ? "bg-[#1877f2] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trends} margin={{ left: 4, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `€${formatCompact(Number(v), 0)}`}
              />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "Spend") return formatCurrency(Number(value));
                  return formatCompact(Number(value), 1);
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="amountSpent"
                name="Spend"
                stroke="#1877f2"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="conversions"
                name={goalLabel}
                stroke="#42b72a"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 5"
        title="Ad Fatigue & Creative Matrix"
        description="Frequency vs cost-per-conversion by ad, with CTR context — spot saturation before CPA rises."
        docHref="https://www.facebook.com/business/help/152001847523944"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[300px]">
            <p className="text-[12px] font-medium text-gray-600 mb-2">Frequency vs CTR over time</p>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={metaDailyTrends(filtered, goal)} margin={{ left: 4, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="frequency"
                  name="Frequency"
                  stroke="#f7b928"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="ctr"
                  name="CTR %"
                  stroke="#1877f2"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-[300px]">
            <p className="text-[12px] font-medium text-gray-600 mb-2">
              Frequency vs CPA by ad
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" dataKey="frequency" name="Frequency" tick={{ fontSize: 11 }} />
                <YAxis
                  type="number"
                  dataKey="cpa"
                  name="CPA"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `€${v}`}
                />
                <ZAxis type="number" dataKey="spend" range={[40, 200]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const p = payload[0].payload as {
                      name: string;
                      frequency: number;
                      cpa: number;
                      ctr: number;
                    };
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-[12px] shadow-sm">
                        <p className="font-semibold text-gray-900 mb-1">{p.name}</p>
                        <p>Frequency: {p.frequency}</p>
                        <p>CPA: {formatCurrency(p.cpa)}</p>
                        <p>CTR: {formatCtr(p.ctr)}</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData} fill="#1877f2" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 6"
        title="Source-of-Truth Table"
        description="Campaign → ad set → ad drill-down. Zero-spend rows hidden by default so inactive Meta export lines don’t drown the signal."
        docHref="https://www.facebook.com/business/help/397103717129884"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-[12px]">
              {(
                [
                  { id: "campaign" as const, label: "Campaign" },
                  { id: "adSet" as const, label: "Ad set" },
                  { id: "ad" as const, label: "Ad" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setDrill(opt.id);
                    setTablePage(0);
                    setSortKey("amountSpent");
                  }}
                  className={`px-3 py-1.5 font-medium ${
                    drill === opt.id
                      ? "bg-[#1877f2] text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setHideZeroSpend((v) => !v);
                setTablePage(0);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border ${
                hideZeroSpend
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              <Filter size={12} />
              {hideZeroSpend ? "Hiding zero-spend" : "Showing zero-spend"}
            </button>
          </div>
          <label className="text-[12px] text-gray-600 flex items-center gap-2">
            Rows
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setTablePage(0);
              }}
              className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-900"
            >
              {[10, 15, 20, 25].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto border border-gray-100 rounded-xl">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                {(
                  [
                    ["dim", drill === "campaign" ? "Campaign" : drill === "adSet" ? "Ad set" : "Ad"],
                    ["amountSpent", "Spend"],
                    ["impressions", "Impr."],
                    ["reach", "Reach"],
                    ["frequency", "Freq."],
                    ["linkClicks", "Clicks"],
                    ["ctr", "CTR"],
                    ["cpc", "CPC"],
                    ["landingPageViews", "LPV"],
                    ["results", "Results"],
                    ["conversions", goalLabel],
                    ["costPerConversion", "CPA"],
                  ] as [string, string][]
                ).map(([key, label]) => (
                  <th key={key} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="hover:text-[#1877f2]"
                    >
                      {label}
                      {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/80">
                  <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[200px]">
                    <div className="truncate" title={row.dim}>
                      {row.dim}
                    </div>
                    {row.sub ? (
                      <div className="text-[10px] text-gray-400 truncate" title={row.sub}>
                        {row.sub}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatCurrency(row.amountSpent)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {formatCompact(row.impressions, 0)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {row.reach > 0 ? formatCompact(row.reach, 0) : "—"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{row.frequency.toFixed(2)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {formatCompact(row.linkClicks, 0)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatCtr(row.ctr)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {row.linkClicks > 0 ? formatCurrency(row.cpc) : "—"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {row.landingPageViews > 0 ? formatCompact(row.landingPageViews, 0) : "—"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {row.results > 0 ? formatCompact(row.results, 0) : "—"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {formatCompact(row.conversions, 0)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {row.conversions > 0 ? formatCurrency(row.costPerConversion) : "—"}
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-gray-500">
                    No rows match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-[12px] text-gray-600">
          <span>
            {sortedTable.length}{" "}
            {drill === "campaign" ? "campaigns" : drill === "adSet" ? "ad sets" : "ads"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={tablePage === 0}
              onClick={() => setTablePage((p) => Math.max(0, p - 1))}
              className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              Prev
            </button>
            <span>
              {tablePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={tablePage >= pageCount - 1}
              onClick={() => setTablePage((p) => Math.min(pageCount - 1, p + 1))}
              className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </SectionShell>
    </div>
  );
}

function canonicalizeLoose(s: string) {
  return s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}
