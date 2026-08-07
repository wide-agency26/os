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
  Eye,
  Users,
  UserPlus,
  MousePointerClick,
  Percent,
  Activity,
  ExternalLink,
} from "lucide-react";
import { DatasetSourceBadge } from "@/components/reports/DatasetSourceBadge";
import { DateRangeControls, useDateRangeFilter } from "@/components/reports/DateRangeControls";
import {
  type LinkedInBundle,
  type LiHeadline,
  availableLiMonths,
  filterBundleByMonths,
  filterBundleByRange,
  computeLiHeadline,
  previousLiPeriod,
  postsByType,
  liDailyTrends,
  liPostsByPublishMonth,
  formatCompact,
  formatDelta,
  hasLinkedInData,
} from "@/lib/reports/linkedin-organic";
import { customDateRange } from "@/lib/reports/ga4-website";
import { subcategoryLabel } from "@/lib/data-hub/subcategory";
import type { DatasetMeta } from "@/lib/reports/ga4-website";

const COLORS = [
  "#0a66c2",
  "#378fe9",
  "#057642",
  "#b24020",
  "#915907",
  "#5c6f7c",
  "#56687a",
  "#004182",
];

interface LinkedInOrganicDashboardProps {
  bundle: LinkedInBundle;
  /** Prior upload bundle for static demographic compare. */
  previousBundle?: LinkedInBundle;
  datasetMeta?: DatasetMeta;
  notice?: string;
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
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#0a66c2] mb-1">
          {eyebrow}
        </p>
        <h3 className="text-[16px] font-bold text-gray-900">{title}</h3>
        <p className="text-[12px] text-gray-500 mt-1 max-w-3xl leading-relaxed">
          {description}
        </p>
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
}: {
  label: string;
  value: string;
  delta: number | null;
  icon: React.ElementType;
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
        <div className="w-8 h-8 rounded-lg bg-[#0a66c2]/10 text-[#0a66c2] flex items-center justify-center shrink-0">
          <Icon size={14} />
        </div>
      </div>
      <p className="text-[22px] font-bold text-gray-900 tabular-nums leading-none mb-2">
        {value}
      </p>
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${toneClass}`}
      >
        <ToneIcon size={11} />
        {d.text}
      </span>
    </div>
  );
}

function pct(n: number) {
  return `${n.toFixed(2)}%`;
}

function headlineDelta(cur: LiHeadline, prev: LiHeadline): Record<keyof LiHeadline, number | null> {
  const keys: (keyof LiHeadline)[] = [
    "impressions",
    "pageViews",
    "uniqueVisitors",
    "newFollowers",
    "interactions",
    "engagementRate",
  ];
  const out = {} as Record<keyof LiHeadline, number | null>;
  for (const k of keys) {
    const p = prev[k];
    if (p === 0) out[k] = cur[k] === 0 ? 0 : null;
    else out[k] = ((cur[k] - p) / Math.abs(p)) * 100;
  }
  return out;
}

function DemoBar({
  title,
  rows,
  previousRows,
}: {
  title: string;
  rows: { label: string; share: number; views: number }[];
  previousRows?: { label: string; share: number; views: number }[];
}) {
  const prevByLabel = new Map(
    (previousRows || []).map((r) => [r.label.toLowerCase(), r.share])
  );
  const data = rows.slice(0, 8).map((r) => {
    const prev = prevByLabel.get(r.label.toLowerCase());
    return {
      name: r.label.length > 22 ? r.label.slice(0, 20) + "…" : r.label,
      full: r.label,
      share: Number(r.share.toFixed(1)),
      views: r.views,
      prevShare: prev != null ? Number(prev.toFixed(1)) : null,
    };
  });
  if (!data.length) {
    return (
      <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center text-[12px] text-gray-400">
        No {title.toLowerCase()} data uploaded yet
      </div>
    );
  }
  return (
    <div>
      <p className="text-[12px] font-semibold text-gray-800 mb-2">{title}</p>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 10 }} unit="%" />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, name: any, p: any) => {
                const prev = p?.payload?.prevShare;
                const base = `${Number(v ?? 0)}% (${formatCompact(Number(p?.payload?.views ?? 0))} views)`;
                if (name === "share" && prev != null) {
                  const d = Number(v) - Number(prev);
                  const sign = d > 0 ? "+" : "";
                  return [`${base} · prior ${prev}% (${sign}${d.toFixed(1)}pp)`, "Share"];
                }
                return [base, "Share"];
              }}
              labelFormatter={(_: unknown, payload: readonly { payload?: { full?: string } }[]) =>
                payload?.[0]?.payload?.full || ""
              }
            />
            <Bar dataKey="share" fill="#0a66c2" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {previousRows?.length ? (
        <p className="text-[10px] text-gray-400 mt-1">Compared to previous upload</p>
      ) : null}
    </div>
  );
}

export function LinkedInOrganicDashboard({
  bundle: rawBundle,
  previousBundle,
  datasetMeta,
  notice,
}: LinkedInOrganicDashboardProps) {
  const months = useMemo(() => availableLiMonths(rawBundle), [rawBundle]);
  const dateState = useDateRangeFilter();
  const { mode: filterMode, selectedMonths, customStart, customEnd } = dateState;
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const filtered = useMemo(() => {
    if (filterMode === "custom" && customStart && customEnd) {
      return filterBundleByRange(rawBundle, customDateRange(customStart, customEnd));
    }
    if (filterMode === "months" && selectedMonths.length) {
      return filterBundleByMonths(rawBundle, selectedMonths);
    }
    return rawBundle;
  }, [rawBundle, filterMode, selectedMonths, customStart, customEnd]);

  const prevBundle = useMemo(
    () => previousLiPeriod(selectedMonths, filterMode, customStart, customEnd, rawBundle),
    [rawBundle, selectedMonths, filterMode, customStart, customEnd]
  );

  const current = useMemo(() => computeLiHeadline(filtered), [filtered]);
  const previous = useMemo(() => computeLiHeadline(prevBundle), [prevBundle]);
  const deltas = useMemo(() => headlineDelta(current, previous), [current, previous]);
  const byType = useMemo(() => postsByType(filtered.posts), [filtered.posts]);
  const trends = useMemo(() => liDailyTrends(filtered), [filtered]);
  const postsByMonth = useMemo(
    () => liPostsByPublishMonth(filtered.posts),
    [filtered.posts]
  );
  const postsSorted = useMemo(
    () => [...filtered.posts].sort((a, b) => b.impressions - a.impressions),
    [filtered.posts]
  );
  const pageCount = Math.max(1, Math.ceil(postsSorted.length / pageSize));
  const pageRows = postsSorted.slice(page * pageSize, page * pageSize + pageSize);

  const typeImpr = byType.map((t) => ({
    name: t.postType,
    impressions: t.impressions,
  }));
  const typeShare = byType.map((t) => ({
    name: t.postType,
    value: t.interactions,
  }));

  if (!hasLinkedInData(rawBundle)) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
        <h3 className="text-[16px] font-bold text-gray-900 mb-2">No LinkedIn organic data</h3>
        <p className="text-[13px] text-gray-500 max-w-lg mx-auto">
          Upload LinkedIn Page Analytics exports in the Data Hub (metrics, visitors, followers,
          posts, demographics). Excel workbooks with multiple sheets are supported.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(datasetMeta?.name || notice) && (
        <div className="flex flex-wrap items-center gap-3">
          {datasetMeta?.name && (
            <DatasetSourceBadge
              meta={datasetMeta}
              channelLabel="LinkedIn Organic"
              channelClassName="bg-[#0a66c2]/10 text-[#0a66c2]"
            />
          )}
          {notice && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-100">
              {notice}
            </span>
          )}
        </div>
      )}

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
        accent="#0a66c2"
        rowCountHint={`${filtered.posts.length.toLocaleString()} posts in selected range`}
      />

      {/* Section 1 */}
      <SectionShell
        eyebrow="Section 1"
        title="Headline scorecards"
        description="Executive health check of LinkedIn organic reach, page activity, and follower conversion."
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Scorecard
            label="Organic impressions"
            value={formatCompact(current.impressions)}
            delta={deltas.impressions}
            icon={Eye}
          />
          <Scorecard
            label="Page views"
            value={formatCompact(current.pageViews)}
            delta={deltas.pageViews}
            icon={Activity}
          />
          <Scorecard
            label="Unique visitors"
            value={formatCompact(current.uniqueVisitors)}
            delta={deltas.uniqueVisitors}
            icon={Users}
          />
          <Scorecard
            label="New followers"
            value={formatCompact(current.newFollowers)}
            delta={deltas.newFollowers}
            icon={UserPlus}
          />
          <Scorecard
            label="Post interactions"
            value={formatCompact(current.interactions)}
            delta={deltas.interactions}
            icon={MousePointerClick}
          />
          <Scorecard
            label="Avg. engagement rate"
            value={pct(current.engagementRate)}
            delta={deltas.engagementRate}
            icon={Percent}
          />
        </div>
      </SectionShell>

      {/* Section 2 */}
      <SectionShell
        eyebrow="Section 2"
        title="Content format & engagement"
        description="Which post types drive the most reach and interactions."
      >
        {byType.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Upload All Posts export to unlock format breakdown.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[280px]">
              <p className="text-[12px] font-semibold text-gray-700 mb-2">
                Impressions by post type
              </p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={typeImpr} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCompact(Number(v ?? 0))} />
                  <Bar dataKey="impressions" fill="#0a66c2" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[280px]">
              <p className="text-[12px] font-semibold text-gray-700 mb-2">
                Interactions share by post type
              </p>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={typeShare}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {typeShare.map((_, i) => (
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

      {/* Static snapshots — not driven by the month chips above */}
      <SectionShell
        eyebrow="Section 3 · Snapshot"
        title="Visitor demographics"
        description="Company page visitor mix (Location, Seniority, Industry, Job function, Company size). These sheets are period snapshots — not day-by-day — so date chips do not filter them."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DemoBar
            title="Location"
            rows={rawBundle.demographics.location}
            previousRows={previousBundle?.demographics.location}
          />
          <DemoBar
            title="Seniority"
            rows={rawBundle.demographics.seniority}
            previousRows={previousBundle?.demographics.seniority}
          />
          <DemoBar
            title="Industry"
            rows={rawBundle.demographics.industry}
            previousRows={previousBundle?.demographics.industry}
          />
          <DemoBar
            title="Job function"
            rows={rawBundle.demographics.jobFunction}
            previousRows={previousBundle?.demographics.jobFunction}
          />
          <DemoBar
            title="Company size"
            rows={rawBundle.demographics.companySize}
            previousRows={previousBundle?.demographics.companySize}
          />
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 3b · Snapshot"
        title="New follower demographics"
        description="Who followed the page in this export (Location, Seniority, Industry, Job function, Company size). Static snapshots — compare against a prior upload when you re-import."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DemoBar
            title="Location"
            rows={rawBundle.followerDemographics.location}
            previousRows={previousBundle?.followerDemographics.location}
          />
          <DemoBar
            title="Seniority"
            rows={rawBundle.followerDemographics.seniority}
            previousRows={previousBundle?.followerDemographics.seniority}
          />
          <DemoBar
            title="Industry"
            rows={rawBundle.followerDemographics.industry}
            previousRows={previousBundle?.followerDemographics.industry}
          />
          <DemoBar
            title="Job function"
            rows={rawBundle.followerDemographics.jobFunction}
            previousRows={previousBundle?.followerDemographics.jobFunction}
          />
          <DemoBar
            title="Company size"
            rows={rawBundle.followerDemographics.companySize}
            previousRows={previousBundle?.followerDemographics.companySize}
          />
        </div>
      </SectionShell>

      {/* Section 4 */}
      <SectionShell
        eyebrow="Section 4"
        title="Daily growth & page view trends"
        description="Page views and unique visitors vs organic followers gained over time."
      >
        {trends.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Upload visitor and follower daily exports to unlock this chart.
          </p>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="pageViews"
                  name="Page views"
                  stroke="#0a66c2"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="uniqueVisitors"
                  name="Unique visitors"
                  stroke="#378fe9"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="followers"
                  name="Followers gained"
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

      {/* Section 5 */}
      <SectionShell
        eyebrow="Section 5"
        title="Content reach vs interaction"
        description="Daily organic impressions alongside total engagements (reactions + comments + reposts + clicks)."
      >
        {trends.every((t) => t.impressions === 0 && t.engagements === 0) ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Upload daily metrics export to unlock reach vs engagement.
          </p>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="impressions"
                  name="Impressions"
                  stroke="#0a66c2"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="engagements"
                  name="Engagements"
                  stroke="#b24020"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 5b"
        title="Posts by publish date"
        description="All posts plotted by Created date. Month chips filter this chart — static visitor/follower sheets stay in Sections 3–3b."
      >
        {postsByMonth.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Upload Li - All posts with a Created date column to unlock this chart.
          </p>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={postsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  yAxisId="left"
                  dataKey="posts"
                  name="Posts published"
                  fill="#0a66c2"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="impressions"
                  name="Impressions"
                  stroke="#b24020"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionShell>

      {/* Section 6 */}
      <SectionShell
        eyebrow="Section 6"
        title="Top performing posts"
        description="Post-level source of truth sorted by impressions. Click the link to open the live LinkedIn post. Dates follow Created date."
      >
        {postsSorted.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Upload All Posts CSV to populate this table.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-[12px]">
                <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Post</th>
                    <th className="text-left px-3 py-2 font-semibold">Date</th>
                    <th className="text-left px-3 py-2 font-semibold">Type</th>
                    <th className="text-right px-3 py-2 font-semibold">Impr.</th>
                    <th className="text-right px-3 py-2 font-semibold">Clicks</th>
                    <th className="text-right px-3 py-2 font-semibold">CTR</th>
                    <th className="text-right px-3 py-2 font-semibold">Likes</th>
                    <th className="text-right px-3 py-2 font-semibold">Comments</th>
                    <th className="text-right px-3 py-2 font-semibold">Reposts</th>
                    <th className="text-right px-3 py-2 font-semibold">Eng. %</th>
                    <th className="text-center px-3 py-2 font-semibold">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((p, i) => (
                    <tr key={`${p.dateKey}-${i}`} className="border-t border-gray-50 hover:bg-gray-50/80">
                      <td className="px-3 py-2 max-w-[220px]">
                        <span className="truncate block font-medium text-gray-900" title={p.title}>
                          {p.title}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {p.date.getFullYear() > 1970
                          ? p.date.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{p.postType}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(p.impressions)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(p.clicks)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(p.ctr)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCompact(p.likes)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(p.comments)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(p.reposts)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {pct(p.engagementRate)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {p.url ? (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex text-[#0a66c2] hover:underline"
                          >
                            <ExternalLink size={13} />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3 text-[12px] text-gray-500">
              <span>
                {postsSorted.length} posts · page {page + 1} of {pageCount}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </SectionShell>
    </div>
  );
}
