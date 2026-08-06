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
  Banknote,
  Eye,
  MousePointerClick,
  Percent,
  Target,
  Coins,
} from "lucide-react";
import { DatasetSourceBadge } from "@/components/reports/DatasetSourceBadge";
import {
  DateRangeControls,
  useDateRangeFilter,
} from "@/components/reports/DateRangeControls";
import {
  type DatasetMeta,
  type GoogleGoalId,
  normalizeGoogleRows,
  detectGoogleGoals,
  googleGoalLabel,
  availableGoogleMonths,
  filterGoogleByMonths,
  filterGoogleByRange,
  customGoogleRange,
  monthsToGoogleRange,
  previousGooglePeriodRange,
  computeGoogleHeadline,
  byCampaignType,
  byGoogleCampaign,
  googleDailyTrends,
  googleMonthlyTrends,
  formatCompact,
  formatCurrency,
  formatCtr,
  formatDelta,
} from "@/lib/reports/google-ads";

const COLORS = ["#4285f4", "#ea4335", "#fbbc04", "#34a853", "#5f6368", "#ab47bc"];

interface GoogleAdsReportDashboardProps {
  rows: Record<string, unknown>[];
  datasetMeta?: DatasetMeta;
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
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#4285f4] mb-1">
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
        <div className="w-8 h-8 rounded-lg bg-[#4285f4]/10 text-[#4285f4] flex items-center justify-center shrink-0">
          <Icon size={14} />
        </div>
      </div>
      <p className="text-[22px] font-bold text-gray-900 tabular-nums leading-none mb-2">{value}</p>
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${toneClass}`}
      >
        <ToneIcon size={11} />
        {d.text}
      </span>
    </div>
  );
}

export function GoogleAdsReportDashboard({
  rows,
  datasetMeta,
}: GoogleAdsReportDashboardProps) {
  const allRows = useMemo(() => normalizeGoogleRows(rows), [rows]);
  const goals = useMemo(() => detectGoogleGoals(rows), [rows]);
  const months = useMemo(() => availableGoogleMonths(allRows), [allRows]);
  const dateState = useDateRangeFilter();

  const [goal, setGoal] = useState<GoogleGoalId>("conversions");
  const [trendGrain, setTrendGrain] = useState<"daily" | "monthly">("daily");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<"cost" | "conversions" | "clicks" | "ctr">("cost");
  const pageSize = 15;

  const { mode: filterMode, selectedMonths, customStart, customEnd } = dateState;

  const filtered = useMemo(() => {
    if (filterMode === "custom" && customStart && customEnd) {
      return filterGoogleByRange(allRows, customGoogleRange(customStart, customEnd));
    }
    if (filterMode === "months" && selectedMonths.length) {
      return filterGoogleByMonths(allRows, selectedMonths);
    }
    return allRows;
  }, [allRows, filterMode, selectedMonths, customStart, customEnd]);

  const activeRange = useMemo(() => {
    if (filterMode === "custom" && customStart && customEnd) {
      return customGoogleRange(customStart, customEnd);
    }
    if (filterMode === "months" && selectedMonths.length) {
      return monthsToGoogleRange(selectedMonths);
    }
    const dated = allRows.filter((r) => r.date.getFullYear() > 1970);
    if (!dated.length) return null;
    const sorted = [...dated].sort((a, b) => a.date.getTime() - b.date.getTime());
    return {
      start: sorted[0].date,
      end: sorted[sorted.length - 1].date,
      preset: "all" as const,
    };
  }, [filterMode, customStart, customEnd, selectedMonths, allRows]);

  const prevRange = useMemo(
    () => (activeRange ? previousGooglePeriodRange(activeRange) : null),
    [activeRange]
  );
  const previous = useMemo(
    () => (prevRange ? filterGoogleByRange(allRows, prevRange) : []),
    [allRows, prevRange]
  );

  const headline = useMemo(
    () => computeGoogleHeadline(filtered, previous, goal),
    [filtered, previous, goal]
  );
  const byType = useMemo(() => byCampaignType(filtered, goal), [filtered, goal]);
  const campaigns = useMemo(() => byGoogleCampaign(filtered, goal), [filtered, goal]);
  const trends = useMemo(
    () =>
      trendGrain === "monthly"
        ? googleMonthlyTrends(filtered, goal)
        : googleDailyTrends(filtered, goal),
    [filtered, goal, trendGrain]
  );

  const spendShare = byType.map((t) => ({
    name: t.campaignType,
    value: t.cost,
  }));
  const convBars = byType.map((t) => ({
    name: t.campaignType,
    conversions: t.conversions,
  }));
  const funnel = campaigns.slice(0, 10).map((c) => ({
    name: c.campaignName.length > 22 ? c.campaignName.slice(0, 20) + "…" : c.campaignName,
    full: c.campaignName,
    impressions: c.impressions,
    clicks: c.clicks,
    conversions: c.conversions,
  }));

  const quality = campaigns
    .filter((c) => c.avgCpc > 0)
    .slice(0, 40)
    .map((c) => {
      const rowsFor = filtered.filter((r) => r.campaignName === c.campaignName);
      const impr =
        rowsFor.reduce((s, r) => s + r.impressions, 0) || 1;
      const top =
        rowsFor.reduce((s, r) => s + r.imprTop * r.impressions, 0) / impr;
      return {
        name: c.campaignName,
        avgCpc: Number(c.avgCpc.toFixed(3)),
        imprTop: Number(top.toFixed(2)),
        cost: c.cost,
      };
    });

  const sortedCampaigns = useMemo(() => {
    const list = [...campaigns];
    list.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
    return list;
  }, [campaigns, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sortedCampaigns.length / pageSize));
  const pageRows = sortedCampaigns.slice(page * pageSize, page * pageSize + pageSize);
  const h = headline.current;
  const d = headline.deltas;

  if (!allRows.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
        <h3 className="text-[16px] font-bold text-gray-900 mb-2">No Google Ads data</h3>
        <p className="text-[13px] text-gray-500 max-w-lg mx-auto">
          Upload a Campaign performance.csv (or Excel sheet{" "}
          <span className="font-medium">GAds - Campaign performance</span>) under Ads. Preamble
          rows are skipped automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {datasetMeta?.name && (
        <DatasetSourceBadge
          meta={datasetMeta}
          channelLabel="Google Ads"
          channelClassName="bg-[#4285f4]/10 text-[#1967d2]"
        />
      )}

      <DateRangeControls
        months={months}
        state={dateState}
        accent="#4285f4"
        rowCountHint={`${filtered.length.toLocaleString()} rows in selected range`}
      />

      <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm flex flex-wrap items-center gap-2">
        <label className="text-[12px] text-gray-500">Conversion goal</label>
        <select
          value={goal}
          onChange={(e) => setGoal(e.target.value as GoogleGoalId)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[13px]"
        >
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <SectionShell
        eyebrow="Section 1"
        title="Headline scorecards"
        description={`Primary goal: ${googleGoalLabel(goal, goals)}. Period-over-period vs prior matching window.`}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Scorecard label="Cost" value={formatCurrency(h.cost)} delta={d.cost} icon={Banknote} invertDelta />
          <Scorecard label="Impressions" value={formatCompact(h.impressions)} delta={d.impressions} icon={Eye} />
          <Scorecard label="Clicks" value={formatCompact(h.clicks)} delta={d.clicks} icon={MousePointerClick} />
          <Scorecard label="CTR" value={formatCtr(h.ctr)} delta={d.ctr} icon={Percent} />
          <Scorecard label="Conversions" value={formatCompact(h.conversions)} delta={d.conversions} icon={Target} />
          <Scorecard label="Cost / conv." value={formatCurrency(h.costPerConv)} delta={d.costPerConv} icon={Coins} invertDelta />
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 2"
        title="Campaign type & format allocation"
        description="Budget share and conversions across Search, Demand Gen, Performance Max, and other types."
      >
        {byType.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">No campaign type data.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[280px]">
              <p className="text-[12px] font-semibold text-gray-700 mb-2">Spend share by type</p>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie data={spendShare} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
                    {spendShare.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[280px]">
              <p className="text-[12px] font-semibold text-gray-700 mb-2">Conversions by type</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={convBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCompact(Number(v ?? 0))} />
                  <Bar dataKey="conversions" fill="#34a853" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 3"
        title="Acquisition funnel efficiency"
        description="Impressions → Clicks → Conversions by campaign."
      >
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel} margin={{ bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full || ""} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="impressions" name="Impr." fill="#94a3b8" />
              <Bar dataKey="clicks" name="Clicks" fill="#4285f4" />
              <Bar dataKey="conversions" name="Conv." fill="#34a853" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 4"
        title="Spend vs performance trends"
        description="Daily or monthly cost against conversions."
      >
        <div className="flex gap-2 mb-3">
          {(["daily", "monthly"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setTrendGrain(g)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium ${
                trendGrain === g ? "bg-[#4285f4] text-white border-[#4285f4]" : "border-gray-200"
              }`}
            >
              {g === "daily" ? "Daily" : "Monthly"}
            </button>
          ))}
        </div>
        {trends.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            No dated rows found — ensure the Day column is present in the export.
          </p>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="cost" name="Cost" stroke="#4285f4" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="conversions" name="Conversions" stroke="#34a853" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 5"
        title="Bidding & top placement quality"
        description="Avg. CPC vs Impr. (Top) % — bubble size reflects spend."
      >
        {quality.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Top impression share columns not present in this export.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" dataKey="avgCpc" name="Avg CPC" tick={{ fontSize: 10 }} />
                  <YAxis type="number" dataKey="imprTop" name="Impr Top %" tick={{ fontSize: 10 }} />
                  <ZAxis type="number" dataKey="cost" range={[40, 300]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={quality} fill="#4285f4" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="avgCpc" name="Avg CPC" stroke="#ea4335" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="imprTop" name="Impr Top %" stroke="#fbbc04" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 6"
        title="Campaign performance table"
        description="Source-of-truth campaign rollup. Click column headers to sort."
      >
        <div className="flex gap-2 mb-3 flex-wrap">
          {(
            [
              ["cost", "Cost"],
              ["conversions", "Conv."],
              ["clicks", "Clicks"],
              ["ctr", "CTR"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setSortKey(k);
                setPage(0);
              }}
              className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium ${
                sortKey === k ? "bg-[#4285f4] text-white border-[#4285f4]" : "border-gray-200"
              }`}
            >
              Sort: {label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
          <table className="w-full text-[12px]">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
              <tr>
                <th className="text-left px-3 py-2">Campaign</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-right px-3 py-2">Cost</th>
                <th className="text-right px-3 py-2">Impr.</th>
                <th className="text-right px-3 py-2">Clicks</th>
                <th className="text-right px-3 py-2">CTR</th>
                <th className="text-right px-3 py-2">Avg CPC</th>
                <th className="text-right px-3 py-2">Conv.</th>
                <th className="text-right px-3 py-2">CPA</th>
                <th className="text-right px-3 py-2">Conv rate</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c) => (
                <tr key={c.campaignName} className="border-t border-gray-50 hover:bg-gray-50/80">
                  <td className="px-3 py-2 font-medium text-gray-900 max-w-[220px] truncate" title={c.campaignName}>
                    {c.campaignName}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{c.campaignType}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.cost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCompact(c.impressions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCompact(c.clicks)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCtr(c.ctr)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.avgCpc)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCompact(c.conversions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.costPerConv)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCtr(c.convRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-3 text-[12px] text-gray-500">
          <span>
            {sortedCampaigns.length} campaigns · page {page + 1} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40">
              Prev
            </button>
            <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      </SectionShell>
    </div>
  );
}
