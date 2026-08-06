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
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Banknote,
  Eye,
  Percent,
  Coins,
  Play,
  ExternalLink,
} from "lucide-react";
import { DateRangeControls, useDateRangeFilter } from "@/components/reports/DateRangeControls";
import { DatasetSourceBadge } from "@/components/reports/DatasetSourceBadge";
import {
  type LinkedInAdsGoalId,
  type DatasetMeta,
  normalizeLinkedInAdsRows,
  detectLinkedInAdsGoals,
  computeLinkedInAdsHeadline,
  availableLinkedInAdsMonths,
  filterLinkedInAdsByMonths,
  filterLinkedInAdsByRange,
  customLinkedInAdsRange,
  monthsToLinkedInAdsRange,
  previousLinkedInAdsPeriodRange,
  byLinkedInCreative,
  linkedInAdsDailyTrends,
  formatCompact,
  formatDelta,
  formatCurrencyAmount,
  linkedInAdsExportTotalSpend,
} from "@/lib/reports/linkedin-ads";

const LI_BLUE = "#0a66c2";
const COLORS = ["#0a66c2", "#004182", "#378fe9", "#5e9fd8", "#70b5f9", "#057642", "#915907"];

interface LinkedInAdsReportDashboardProps {
  rows: Record<string, unknown>[];
  datasetMeta?: DatasetMeta;
}

function shortLabel(name: string, max = 18) {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

function formatCtr(pct: number): string {
  return `${pct.toFixed(2)}%`;
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
        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: LI_BLUE }}>
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
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${LI_BLUE}18`, color: LI_BLUE }}
        >
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

export function LinkedInAdsReportDashboard({
  rows,
  datasetMeta,
}: LinkedInAdsReportDashboardProps) {
  const allRows = useMemo(() => normalizeLinkedInAdsRows(rows), [rows]);
  const exportTotal = useMemo(() => linkedInAdsExportTotalSpend(rows), [rows]);
  const months = useMemo(() => availableLinkedInAdsMonths(allRows), [allRows]);
  const goals = useMemo(() => detectLinkedInAdsGoals(allRows), [allRows]);
  const dateState = useDateRangeFilter();

  const [goal, setGoal] = useState<LinkedInAdsGoalId>("landing_clicks");
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const filtered = useMemo(() => {
    const { mode, months: selectedMonths, customStart, customEnd } = dateState.periodOpts;
    if (mode === "custom" && customStart && customEnd) {
      return filterLinkedInAdsByRange(allRows, customLinkedInAdsRange(customStart, customEnd));
    }
    if (mode === "months" && selectedMonths.length) {
      return filterLinkedInAdsByMonths(allRows, selectedMonths);
    }
    return allRows;
  }, [allRows, dateState.periodOpts]);

  const useExportTotal =
    dateState.periodOpts.mode === "all" && exportTotal != null;

  const activeRange = useMemo(() => {
    const { mode, months: selectedMonths, customStart, customEnd } = dateState.periodOpts;
    if (mode === "custom" && customStart && customEnd) {
      return customLinkedInAdsRange(customStart, customEnd);
    }
    if (mode === "months" && selectedMonths.length) {
      return monthsToLinkedInAdsRange(selectedMonths);
    }
    const dated = allRows.filter((r) => r.date.getFullYear() > 1970);
    if (!dated.length) return null;
    const sorted = [...dated].sort((a, b) => a.date.getTime() - b.date.getTime());
    return {
      start: sorted[0].date,
      end: sorted[sorted.length - 1].date,
      preset: "all" as const,
    };
  }, [dateState.periodOpts, allRows]);

  const prevRange = useMemo(
    () => (activeRange ? previousLinkedInAdsPeriodRange(activeRange) : null),
    [activeRange]
  );

  const previous = useMemo(
    () => (prevRange ? filterLinkedInAdsByRange(allRows, prevRange) : []),
    [allRows, prevRange]
  );

  const headline = useMemo(
    () =>
      computeLinkedInAdsHeadline(
        filtered,
        previous,
        goal,
        useExportTotal ? exportTotal : null
      ),
    [filtered, previous, goal, useExportTotal, exportTotal]
  );

  const creatives = useMemo(() => byLinkedInCreative(filtered, goal), [filtered, goal]);
  const trends = useMemo(() => linkedInAdsDailyTrends(filtered, goal), [filtered, goal]);

  const spendBars = creatives.slice(0, 10).map((c) => ({
    name: shortLabel(c.adName),
    full: c.adName,
    spend: c.spend,
  }));

  const clickShare = creatives
    .filter((c) => (c.landingPageClicks || c.clicks) > 0)
    .slice(0, 8)
    .map((c) => ({
      name: shortLabel(c.adName, 14),
      full: c.adName,
      value: c.landingPageClicks || c.clicks,
    }));

  const funnel = creatives.slice(0, 8).map((c) => ({
    name: shortLabel(c.adName),
    full: c.adName,
    impressions: c.impressions,
    videoViews: c.videoViews,
    videoViews50: c.videoViews50,
    landingPageClicks: c.landingPageClicks || c.clicks,
  }));

  const videoRetention = creatives.slice(0, 8).map((c) => ({
    name: shortLabel(c.adName),
    full: c.adName,
    v25: c.videoViews25,
    v50: c.videoViews50,
    v75: c.videoViews75,
    completions: c.videoCompletions,
  }));

  const sortedCreatives = useMemo(() => {
    const list = [...creatives];
    list.sort((a, b) => b.spend - a.spend);
    return list;
  }, [creatives]);

  const pageCount = Math.max(1, Math.ceil(sortedCreatives.length / pageSize));
  const pageRows = sortedCreatives.slice(page * pageSize, page * pageSize + pageSize);

  const h = headline.current;
  const d = headline.deltas;
  const currency = h.currency;
  const goalLabel = goals.find((g) => g.id === goal)?.label ?? "Landing page clicks";

  if (!allRows.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
        <h3 className="text-[16px] font-bold text-gray-900 mb-2">No LinkedIn Ads data</h3>
        <p className="text-[13px] text-gray-500 max-w-lg mx-auto">
          Upload a LinkedIn Campaign Manager Creative Performance export (TSV / Excel) under Ads.
          Preamble metadata rows are skipped automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {datasetMeta?.name && (
        <DatasetSourceBadge
          meta={datasetMeta}
          channelLabel="LinkedIn Ads"
          channelClassName="bg-[#0a66c2]/10 text-[#0a66c2]"
        />
      )}

      <DateRangeControls
        months={months}
        state={dateState}
        accent={LI_BLUE}
        rowCountHint={`${filtered.length} rows`}
      />

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[12px] text-gray-500 font-medium">Goal</label>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as LinkedInAdsGoalId)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-[12px]"
          >
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <SectionShell
        eyebrow="Section 1"
        title="Headline scorecards"
        description={`Primary goal: ${goalLabel}. Period-over-period vs prior matching window.`}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Scorecard
            label="Spend"
            value={formatCurrencyAmount(h.spend, currency)}
            delta={d.spend}
            icon={Banknote}
            invertDelta
          />
          <Scorecard
            label="Impressions"
            value={formatCompact(h.impressions)}
            delta={d.impressions}
            icon={Eye}
          />
          <Scorecard
            label="Landing page clicks"
            value={formatCompact(h.landingPageClicks)}
            delta={d.landingPageClicks}
            icon={ExternalLink}
          />
          <Scorecard label="CTR" value={formatCtr(h.ctr)} delta={d.ctr} icon={Percent} />
          <Scorecard
            label="CPC"
            value={formatCurrencyAmount(h.cpc, currency, 3)}
            delta={d.cpc}
            icon={Coins}
            invertDelta
          />
          <Scorecard
            label="Video views"
            value={formatCompact(h.videoViews)}
            delta={d.videoViews}
            icon={Play}
          />
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 2"
        title="Creative spend & click share"
        description="Budget allocation and landing-page click share across top creatives."
      >
        {creatives.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">No creative data.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[280px]">
              <p className="text-[12px] font-semibold text-gray-700 mb-2">Spend by creative</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={spendBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => formatCurrencyAmount(Number(v ?? 0), currency)}
                    labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full || ""}
                  />
                  <Bar dataKey="spend" fill={LI_BLUE} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[280px]">
              <p className="text-[12px] font-semibold text-gray-700 mb-2">Click share by creative</p>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={clickShare}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                  >
                    {clickShare.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCompact(Number(v ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 3"
        title="Creative funnel"
        description="Impressions → Video views → Video 50% → Landing clicks for top 8 creatives."
      >
        {funnel.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">No funnel data.</p>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} margin={{ bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full || ""} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="impressions" name="Impr." fill="#94a3b8" />
                <Bar dataKey="videoViews" name="Video views" fill="#378fe9" />
                <Bar dataKey="videoViews50" name="Video 50%" fill={LI_BLUE} />
                <Bar dataKey="landingPageClicks" name="LP clicks" fill="#057642" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 4"
        title="Daily spend vs clicks"
        description="Dual-axis trend of spend and landing-page clicks over time."
      >
        {trends.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            No dated rows found — ensure Start Date (in UTC) is present in the export.
          </p>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v, name) =>
                    name === "Spend"
                      ? formatCurrencyAmount(Number(v ?? 0), currency)
                      : formatCompact(Number(v ?? 0))
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="spend"
                  name="Spend"
                  stroke={LI_BLUE}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="clicks"
                  name="Clicks"
                  stroke="#057642"
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
        eyebrow="Section 5"
        title="Video retention by creative"
        description="25% / 50% / 75% / completion milestones for top creatives."
      >
        {videoRetention.every((v) => v.v25 + v.v50 + v.v75 + v.completions === 0) ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Video retention columns not present in this export.
          </p>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={videoRetention} margin={{ bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full || ""} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="v25" name="25%" fill="#94a3b8" />
                <Bar dataKey="v50" name="50%" fill="#378fe9" />
                <Bar dataKey="v75" name="75%" fill={LI_BLUE} />
                <Bar dataKey="completions" name="Completions" fill="#057642" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 6"
        title="Creative performance table"
        description="Source-of-truth creative rollup sorted by spend."
      >
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
          <table className="w-full text-[12px]">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
              <tr>
                <th className="text-left px-3 py-2">Ad Name</th>
                <th className="text-left px-3 py-2">Campaign</th>
                <th className="text-left px-3 py-2">Ad Set</th>
                <th className="text-right px-3 py-2">Spend</th>
                <th className="text-right px-3 py-2">Impr.</th>
                <th className="text-right px-3 py-2">Clicks</th>
                <th className="text-right px-3 py-2">CTR</th>
                <th className="text-right px-3 py-2">CPC</th>
                <th className="text-right px-3 py-2">Video Views</th>
                <th className="text-right px-3 py-2">Engagements</th>
                <th className="text-right px-3 py-2">LP Clicks</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c) => (
                <tr key={c.adName} className="border-t border-gray-50 hover:bg-gray-50/80">
                  <td className="px-3 py-2 font-medium text-gray-900 max-w-[200px] truncate" title={c.adName}>
                    {c.adName}
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate" title={c.campaignName}>
                    {c.campaignName || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate" title={c.adSetName}>
                    {c.adSetName || "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrencyAmount(c.spend, c.currency || currency)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCompact(c.impressions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCompact(c.clicks)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCtr(c.ctr)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrencyAmount(c.cpc, c.currency || currency, 3)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCompact(c.videoViews)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCompact(c.engagements)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCompact(c.landingPageClicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-3 text-[12px] text-gray-500">
          <span>
            {sortedCreatives.length} creatives · page {page + 1} of {pageCount}
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
