"use client";

import React, { useMemo, useState } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  Eye,
  Users,
  MousePointerClick,
  ExternalLink,
  Heart,
  Activity,
} from "lucide-react";
import { DatasetSourceBadge } from "@/components/reports/DatasetSourceBadge";
import {
  type IgBundle,
  computeIgHeadline,
  hasInstagramData,
  igPublishScatter,
  igCaptionKeywords,
  formatCompact,
} from "@/lib/reports/instagram-organic";
import type { DatasetMeta } from "@/lib/reports/ga4-website";

const PINK = "#E1306C";
const PURPLE = "#833AB4";
const ORANGE = "#F77737";
const COLORS = [PINK, PURPLE, ORANGE, "#405DE6", "#C13584", "#5851DB"];

interface InstagramOrganicDashboardProps {
  bundle: IgBundle;
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
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#E1306C] mb-1">
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
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 truncate">
          {label}
        </p>
        <Icon className="w-4 h-4 text-[#E1306C] shrink-0" />
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}

function Donut({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) {
    return (
      <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center text-[12px] text-gray-400">
        No {title.toLowerCase()} data yet
      </div>
    );
  }
  return (
    <div>
      <p className="text-[12px] font-semibold text-gray-800 mb-2">{title}</p>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {filtered.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatCompact(Number(v ?? 0))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function InstagramOrganicDashboard({
  bundle: rawBundle,
  datasetMeta,
  notice,
}: InstagramOrganicDashboardProps) {
  const [page, setPage] = useState(0);
  const [expandedCaption, setExpandedCaption] = useState<string | null>(null);
  const pageSize = 15;

  const headline = useMemo(() => computeIgHeadline(rawBundle), [rawBundle]);
  const scatter = useMemo(() => igPublishScatter(rawBundle.posts), [rawBundle.posts]);
  const keywords = useMemo(() => igCaptionKeywords(rawBundle.posts), [rawBundle.posts]);

  const topPosts = useMemo(() => {
    return [...rawBundle.posts]
      .sort(
        (a, b) =>
          b.externalLinkTaps - a.externalLinkTaps ||
          b.accountsReached - a.accountsReached ||
          b.impressions - a.impressions
      )
      .slice(0, 6);
  }, [rawBundle.posts]);

  const tableRows = useMemo(() => {
    return [...rawBundle.posts].sort(
      (a, b) =>
        b.externalLinkTaps - a.externalLinkTaps || b.impressions - a.impressions
    );
  }, [rawBundle.posts]);

  const pageCount = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const pageRows = tableRows.slice(page * pageSize, page * pageSize + pageSize);

  const reachSplit = useMemo(() => {
    const f = rawBundle.reachFollowersPct;
    const n = rawBundle.reachNonFollowersPct || (f ? Math.max(0, 100 - f) : 0);
    return [
      { name: "Followers", value: f },
      { name: "Non-followers", value: n },
    ];
  }, [rawBundle]);

  const interactionSplit = useMemo(
    () => [
      { name: "Posts", value: rawBundle.postInteractions },
      { name: "Reels", value: rawBundle.reelsInteractions },
      { name: "Stories", value: rawBundle.storyInteractions },
    ],
    [rawBundle]
  );

  const engagedSplit = useMemo(() => {
    const f = rawBundle.engagedFollowersPct;
    const n =
      rawBundle.engagedNonFollowersPct || (f ? Math.max(0, 100 - f) : 0);
    return [
      { name: "Followers", value: f },
      { name: "Non-followers", value: n },
    ];
  }, [rawBundle]);

  if (!hasInstagramData(rawBundle)) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-sm font-medium text-gray-800">No Instagram organic data yet</p>
        <p className="text-[13px] text-gray-500 mt-2 max-w-lg mx-auto">
          Upload Meta HTML exports from Data Hub —{" "}
          <span className="font-medium">Profiles Reached.html</span>,{" "}
          <span className="font-medium">Content Interactions.html</span>, and{" "}
          <span className="font-medium">Posts.html</span> — tagged Social → Instagram.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {notice ? (
        <div className="text-[12px] font-medium px-3 py-2 rounded-xl bg-pink-50 text-pink-900 border border-pink-100">
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Instagram Organic</h2>
          <p className="text-[12px] text-gray-500">
            {rawBundle.period
              ? `Period ${rawBundle.period}`
              : "Period summary + post snapshots (no daily time series in Meta HTML exports)"}
          </p>
        </div>
        {datasetMeta ? <DatasetSourceBadge meta={datasetMeta} /> : null}
      </div>

      <SectionShell
        eyebrow="Section 1"
        title="Headline scorecards"
        description="Executive overview of Instagram organic footprint and engagement for this export window."
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Scorecard
            label="Accounts reached"
            value={formatCompact(headline.accountsReached)}
            icon={Users}
          />
          <Scorecard
            label="Total impressions"
            value={formatCompact(headline.impressions)}
            icon={Eye}
          />
          <Scorecard
            label="Profile visits"
            value={formatCompact(headline.profileVisits)}
            icon={MousePointerClick}
          />
          <Scorecard
            label="External link taps"
            value={formatCompact(headline.externalLinkTaps)}
            icon={ExternalLink}
          />
          <Scorecard
            label="Content interactions"
            value={formatCompact(headline.contentInteractions)}
            icon={Heart}
          />
          <Scorecard
            label="Accounts engaged"
            value={formatCompact(headline.accountsEngaged)}
            icon={Activity}
          />
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 2"
        title="Audience reach & interaction split"
        description="Follower vs non-follower reach, content format interactions, and engaged-account mix."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Donut title="Reach by follower type" data={reachSplit} />
          <Donut title="Content interactions breakdown" data={interactionSplit} />
          <Donut title="Engaged accounts follower split" data={engagedSplit} />
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Section 3"
        title="Publishing schedule vs attention"
        description="Creation timestamp vs accounts reached. Bubble size reflects impressions — reveals which posting windows earned attention."
      >
        {scatter.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Upload Posts.html with creation timestamps to unlock this chart.
          </p>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  dataKey="hour"
                  name="Hour"
                  domain={[0, 24]}
                  tick={{ fontSize: 10 }}
                  label={{ value: "Hour of day", position: "insideBottom", offset: -2, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="reach"
                  name="Reach"
                  tick={{ fontSize: 10 }}
                  label={{ value: "Accounts reached", angle: -90, position: "insideLeft", fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="impressions" range={[40, 280]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, n: any) => [formatCompact(Number(v ?? 0)), String(n)]}
                  labelFormatter={(_, p) =>
                    (p?.[0]?.payload as { label?: string; caption?: string })?.label || ""
                  }
                />
                <Scatter name="Posts" data={scatter} fill={PINK} fillOpacity={0.75} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 4"
        title="Best performing posts"
        description="Top creatives by external link taps, then accounts reached — with live Instagram links when available."
      >
        {topPosts.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Upload Posts.html to showcase top posts.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {topPosts.map((p, i) => {
              const id = `${i}-${p.createdLabel}`;
              const expanded = expandedCaption === id;
              const short =
                p.caption.length > 120 && !expanded
                  ? p.caption.slice(0, 118) + "…"
                  : p.caption;
              return (
                <article
                  key={id}
                  className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col"
                >
                  <div className="aspect-square bg-gray-100 relative">
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        No preview
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex-1 flex flex-col gap-2">
                    <p className="text-[11px] text-gray-400">
                      {p.createdLabel ||
                        (p.createdAt
                          ? p.createdAt.toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—")}
                    </p>
                    <p className="text-[13px] text-gray-800 leading-snug">{short || "Untitled"}</p>
                    {p.caption.length > 120 ? (
                      <button
                        type="button"
                        className="text-[11px] text-[#E1306C] self-start"
                        onClick={() =>
                          setExpandedCaption(expanded ? null : id)
                        }
                      >
                        {expanded ? "Show less" : "Read more"}
                      </button>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 text-pink-800">
                        Reach {formatCompact(p.accountsReached)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        Likes {formatCompact(p.likes)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        Shares {formatCompact(p.shares)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-800">
                        Link taps {formatCompact(p.externalLinkTaps)}
                      </span>
                    </div>
                    {p.postUrl ? (
                      <a
                        href={p.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-medium text-[#E1306C] hover:underline inline-flex items-center gap-1"
                      >
                        Open on Instagram <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 5"
        title="Caption keyword impact"
        description="Words and hashtags sized by frequency, tinted by conversion impact (external link taps + shares)."
      >
        {keywords.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">
            Need post captions to build the keyword cloud.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 justify-center py-4">
            {keywords.map((k) => {
              const size = 11 + Math.min(18, Math.round(Math.log2(k.count + 1) * 4));
              const hot = k.taps > 0 || k.shares > 1;
              return (
                <span
                  key={k.word}
                  title={`${k.count} posts · ${k.taps} link taps · ${k.shares} shares`}
                  className={`inline-block px-2 py-1 rounded-lg ${
                    hot
                      ? "bg-gradient-to-r from-pink-50 to-orange-50 text-[#C13584] font-semibold"
                      : "bg-gray-50 text-gray-600"
                  }`}
                  style={{ fontSize: size }}
                >
                  {k.word}
                </span>
              );
            })}
          </div>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="Section 6"
        title="Post performance table"
        description="Source-of-truth post list sorted by external link taps, then impressions."
      >
        {tableRows.length === 0 ? (
          <p className="text-[13px] text-gray-500 text-center py-8">No posts parsed.</p>
        ) : (
          <>
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="min-w-full text-[12px]">
                <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Media</th>
                    <th className="text-left px-3 py-2 font-semibold">Caption</th>
                    <th className="text-left px-3 py-2 font-semibold">Created</th>
                    <th className="text-right px-3 py-2 font-semibold">Reached</th>
                    <th className="text-right px-3 py-2 font-semibold">Impr.</th>
                    <th className="text-right px-3 py-2 font-semibold">Likes</th>
                    <th className="text-right px-3 py-2 font-semibold">Shares</th>
                    <th className="text-right px-3 py-2 font-semibold">Saves</th>
                    <th className="text-right px-3 py-2 font-semibold">Profile</th>
                    <th className="text-right px-3 py-2 font-semibold">Link taps</th>
                    <th className="text-left px-3 py-2 font-semibold">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageRows.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50/80">
                      <td className="px-3 py-2">
                        {p.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.thumbnailUrl}
                            alt=""
                            className="w-10 h-10 rounded object-cover bg-gray-100"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100" />
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-[14rem] truncate text-gray-800">
                        {p.caption || "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {p.createdLabel || "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(p.accountsReached)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(p.impressions)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(p.likes)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(p.shares)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(p.saves)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCompact(p.profileVisits)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatCompact(p.externalLinkTaps)}
                      </td>
                      <td className="px-3 py-2">
                        {p.postUrl ? (
                          <a
                            href={p.postUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#E1306C] hover:underline"
                          >
                            Open
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
                {tableRows.length} posts · page {page + 1} of {pageCount}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40"
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
