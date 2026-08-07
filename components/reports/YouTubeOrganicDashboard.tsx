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
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Clock,
  UserPlus,
  Percent,
  MousePointerClick,
  Activity,
} from "lucide-react";
import { DatasetSourceBadge } from "@/components/reports/DatasetSourceBadge";
import { DateRangeControls, useDateRangeFilter } from "@/components/reports/DateRangeControls";
import {
  type YouTubeBundle,
  type YtHeadline,
  availableYtMonths,
  filterYtBundleByMonths,
  filterYtBundleByRange,
  computeYtHeadline,
  previousYtPeriod,
  ytDailyViews,
  ytPublishMarkers,
  formatCompact,
  formatDelta,
  formatDuration,
  hasYouTubeData,
} from "@/lib/reports/youtube-organic";
import { customDateRange } from "@/lib/reports/ga4-website";
import { subcategoryLabel } from "@/lib/data-hub/subcategory";
import type { DatasetMeta } from "@/lib/reports/ga4-website";

interface YouTubeOrganicDashboardProps {
  bundle: YouTubeBundle;
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
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#ff0000] mb-1">
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
        <div className="w-8 h-8 rounded-lg bg-red-50 text-[#ff0000] flex items-center justify-center shrink-0">
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

function headlineDelta(cur: YtHeadline, prev: YtHeadline): Record<keyof YtHeadline, number | null> {
  const keys: (keyof YtHeadline)[] = [
    "views",
    "watchTimeHours",
    "subscribers",
    "impressions",
    "impressionsCtr",
    "avgViewDurationSec",
  ];
  const out = {} as Record<keyof YtHeadline, number | null>;
  for (const k of keys) {
    const p = prev[k];
    if (p === 0) out[k] = cur[k] === 0 ? 0 : null;
    else out[k] = ((cur[k] - p) / Math.abs(p)) * 100;
  }
  return out;
}

export function YouTubeOrganicDashboard({
  bundle: rawBundle,
  datasetMeta,
  notice,
}: YouTubeOrganicDashboardProps) {
  const months = useMemo(() => availableYtMonths(rawBundle), [rawBundle]);
  const dateState = useDateRangeFilter();
  const { mode: filterMode, selectedMonths, customStart, customEnd } = dateState;
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const filtered = useMemo(() => {
    if (filterMode === "custom" && customStart && customEnd) {
      return filterYtBundleByRange(rawBundle, customDateRange(customStart, customEnd));
    }
    if (filterMode === "months" && selectedMonths.length) {
      return filterYtBundleByMonths(rawBundle, selectedMonths);
    }
    return rawBundle;
  }, [rawBundle, filterMode, selectedMonths, customStart, customEnd]);

  const dateFiltered = filterMode !== "all";
  const current = useMemo(() => {
    if (dateFiltered && filtered.daily.length) {
      const dailyH = computeYtHeadline(filtered, true);
      // Keep table metrics for non-view fields when filtering by chart dates
      const tableH = computeYtHeadline({ ...filtered, daily: [] });
      return {
        views: dailyH.views || tableH.views,
        watchTimeHours: tableH.watchTimeHours,
        subscribers: tableH.subscribers,
        impressions: tableH.impressions,
        impressionsCtr: tableH.impressionsCtr,
        avgViewDurationSec: tableH.avgViewDurationSec,
      };
    }
    return computeYtHeadline(filtered);
  }, [filtered, dateFiltered]);

  const prevBundle = useMemo(
    () => previousYtPeriod(selectedMonths, filterMode, customStart, customEnd, rawBundle),
    [rawBundle, selectedMonths, filterMode, customStart, customEnd]
  );
  const previous = useMemo(() => computeYtHeadline(prevBundle), [prevBundle]);
  const deltas = useMemo(() => headlineDelta(current, previous), [current, previous]);

  const daily = useMemo(() => ytDailyViews(filtered), [filtered]);
  const markers = useMemo(() => ytPublishMarkers(rawBundle), [rawBundle]);

  const funnel = useMemo(() => {
    return [...filtered.videos]
      .sort((a, b) => b.impressionsCtr - a.impressionsCtr)
      .slice(0, 12)
      .map((v) => ({
        name: v.title.length > 28 ? v.title.slice(0, 26) + "…" : v.title,
        full: v.title,
        impressions: v.impressions,
        views: v.views,
        ctr: Number(v.impressionsCtr.toFixed(2)),
      }));
  }, [filtered.videos]);

  const retention = useMemo(() => {
    return filtered.videos
      .filter((v) => v.durationSec > 0)
      .map((v) => ({
        title: v.title,
        durationMin: Number((v.durationSec / 60).toFixed(2)),
        avgViewMin: Number((v.avgViewDurationSec / 60).toFixed(2)),
        watchHours: Number(v.watchTimeHours.toFixed(4)),
        views: v.views,
      }));
  }, [filtered.videos]);

  const videosSorted = useMemo(
    () => [...filtered.videos].sort((a, b) => b.views - a.views),
    [filtered.videos]
  );
  const pageCount = Math.max(1, Math.ceil(videosSorted.length / pageSize));
  const pageRows = videosSorted.slice(page * pageSize, page * pageSize + pageSize);

  const sourceLabel = rawBundle.sources.map((s) => s.name).join(" / ") || "YouTube";

  if (!hasYouTubeData(rawBundle)) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
        <h3 className="text-[16px] font-bold text-gray-900 mb-2">No YouTube organic data</h3>
        <p className="text-[13px] text-gray-500 max-w-lg mx-auto">
          Upload YouTube Studio exports as sheets named{" "}
          <span className="font-medium">YT - Table data</span> and{" "}
          <span className="font-medium">YT - Chart data</span> (or CSVs) under Social.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <DatasetSourceBadge
          meta={
            datasetMeta || {
              name: sourceLabel,
              rowCount: rawBundle.sources.reduce((s, x) => s + x.rowCount, 0),
            }
          }
          channelLabel="YouTube Organic"
          channelClassName="bg-red-50 text-[#cc0000]"
        />
        {notice && (
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-100">
            {notice}
          </span>
        )}
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
        accent="#ff0000"
        rowCountHint={
          months.length
            ? `${filtered.daily.length.toLocaleString()} daily points`
            : "Upload Chart data to unlock month pills"
        }
      />

      <SectionShell
        eyebrow="Section 1"
        title="Headline scorecards"
        description="Channel reach, watch duration, and subscriber growth vs the prior matching period."
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Scorecard
            label="Total views"
            value={formatCompact(current.views)}
            delta={deltas.views}
            icon={Eye}
          />
          <Scorecard
            label="Watch time (hours)"
            value={current.watchTimeHours.toFixed(3)}
            delta={deltas.watchTimeHours}
            icon={Clock}
          />
          <Scorecard
            label="Subscribers gained"
            value={formatCompact(current.subscribers)}
            delta={deltas.subscribers}
            icon={UserPlus}
          />
          <Scorecard
            label="Impressions"
            value={formatCompact(current.impressions)}
            delta={deltas.impressions}
            icon={Activity}
          />
          <Scorecard
            label="Avg. impression CTR"
            value={`${current.impressionsCtr.toFixed(2)}%`}
            delta={deltas.impressionsCtr}
            icon={Percent}
          />
          <Scorecard
            label="Avg. view duration"
            value={formatDuration(current.avgViewDurationSec)}
            delta={deltas.avgViewDurationSec}
            icon={MousePointerClick}
          />
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 2"
        title="Daily view trends"
        description="Daily views across videos. Grey markers show Video publish time from Table data when that day falls in range."
      >
        {daily.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Upload Chart data.csv to unlock the daily views timeline.
          </p>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="views"
                  name="Views"
                  stroke="#ff0000"
                  strokeWidth={2}
                  dot={false}
                />
                {markers.slice(0, 8).map((m) => (
                  <ReferenceLine
                    key={m.dateKey + m.title}
                    x={daily.find((d) => d.dateKey === m.dateKey)?.label}
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    label={{
                      value: "Pub",
                      position: "insideTopRight",
                      fontSize: 9,
                      fill: "#64748b",
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 3"
        title="Thumbnail conversion & impressions funnel"
        description="Impressions vs views by video, sorted by impression CTR."
      >
        {funnel.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Upload Table data.csv to unlock thumbnail CTR comparison.
          </p>
        ) : (
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} margin={{ left: 8, right: 8, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={60} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="%" />
                <Tooltip
                  labelFormatter={(_, p) =>
                    (p?.[0]?.payload as { full?: string })?.full || ""
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="impressions" name="Impressions" fill="#94a3b8" />
                <Bar yAxisId="left" dataKey="views" name="Views" fill="#ff0000" />
                <Bar yAxisId="right" dataKey="ctr" name="CTR %" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 4"
        title="Audience retention & video duration"
        description="Duration (minutes) vs average view duration — short vs long-form retention."
      >
        {retention.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Upload Table data with Duration and Average view duration.
          </p>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  dataKey="durationMin"
                  name="Duration (min)"
                  tick={{ fontSize: 10 }}
                  label={{ value: "Duration (min)", position: "insideBottom", offset: -2, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="avgViewMin"
                  name="Avg view (min)"
                  tick={{ fontSize: 10 }}
                  label={{ value: "Avg view (min)", angle: -90, position: "insideLeft", fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="views" range={[40, 280]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(v: unknown, name: unknown) => [
                    typeof v === "number" ? v.toFixed(2) : String(v),
                    String(name),
                  ]}
                  labelFormatter={(_, p) =>
                    (p?.[0]?.payload as { title?: string })?.title || ""
                  }
                />
                <Scatter name="Videos" data={retention} fill="#ff0000" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 5"
        title="Video performance"
        description="Source-of-truth table sorted by views. Summary Total rows are excluded."
      >
        {videosSorted.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Upload Table data.csv to populate the video table.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-[12px]">
                <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Video</th>
                    <th className="text-left px-3 py-2 font-semibold">Published</th>
                    <th className="text-right px-3 py-2 font-semibold">Duration</th>
                    <th className="text-right px-3 py-2 font-semibold">Views</th>
                    <th className="text-right px-3 py-2 font-semibold">Watch h</th>
                    <th className="text-right px-3 py-2 font-semibold">Subs</th>
                    <th className="text-right px-3 py-2 font-semibold">Avg view</th>
                    <th className="text-right px-3 py-2 font-semibold">Impr.</th>
                    <th className="text-right px-3 py-2 font-semibold">CTR %</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((v) => (
                    <tr key={v.videoId} className="border-t border-gray-50 hover:bg-gray-50/80">
                      <td className="px-3 py-2 max-w-[240px]">
                        <span className="truncate block font-medium text-gray-900" title={v.title}>
                          {v.title}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {v.publishTime
                          ? v.publishTime.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatDuration(v.durationSec)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(v.views)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {v.watchTimeHours.toFixed(3)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(v.subscribers)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatDuration(v.avgViewDurationSec)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(v.impressions)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {v.impressionsCtr.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3 text-[12px] text-gray-500">
              <span>
                {videosSorted.length} videos · page {page + 1} of {pageCount}
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
