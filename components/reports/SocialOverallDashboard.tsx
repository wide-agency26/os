"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Eye,
  UserPlus,
  MousePointerClick,
  Activity,
  Images,
  ExternalLink,
} from "lucide-react";
import type { SocialOverallResult } from "@/lib/reports/aggregation";
import { formatCompact } from "@/lib/reports/linkedin-organic";

const COLORS = ["#0a66c2", "#ff0000", "#E1306C", "#6366f1", "#10b981"];

interface SocialOverallDashboardProps {
  result: SocialOverallResult;
}

export function SocialOverallDashboard({ result }: SocialOverallDashboardProps) {
  const li = result.linkedIn;
  const yt = result.youTube;
  const ig = result.instagram;
  const reach = result.blendedReach || 0;

  const reachShare = useMemo(() => {
    const rows: { name: string; value: number }[] = [];
    if (li && (li.impressions || 0) > 0) {
      rows.push({ name: "LinkedIn impressions", value: li.impressions });
    }
    if (yt && (yt.views || 0) > 0) {
      rows.push({ name: "YouTube views", value: yt.views });
    }
    if (ig && (ig.accountsReached || 0) > 0) {
      rows.push({ name: "Instagram accounts reached", value: ig.accountsReached });
    }
    return rows;
  }, [li, yt, ig]);

  const channelRows = useMemo(() => {
    const rows: {
      id: string;
      label: string;
      reach: number;
      engagement: number;
      growth: number;
      engRate: number;
      reachShare: number;
    }[] = [];
    if (li) {
      rows.push({
        id: "linkedin",
        label: "LinkedIn Organic",
        reach: li.impressions,
        engagement: li.interactions,
        growth: li.newFollowers,
        engRate: li.engagementRate,
        reachShare: reach > 0 ? (li.impressions / reach) * 100 : 0,
      });
    }
    if (yt) {
      rows.push({
        id: "youtube",
        label: "YouTube Organic",
        reach: yt.views,
        engagement: yt.impressions,
        growth: yt.subscribers,
        engRate: yt.impressionsCtr,
        reachShare: reach > 0 ? (yt.views / reach) * 100 : 0,
      });
    }
    if (ig) {
      rows.push({
        id: "instagram",
        label: "Instagram Organic",
        reach: ig.accountsReached,
        engagement: ig.contentInteractions,
        growth: ig.profileVisits,
        engRate:
          ig.accountsReached > 0
            ? (ig.contentInteractions / ig.accountsReached) * 100
            : 0,
        reachShare: reach > 0 ? (ig.accountsReached / reach) * 100 : 0,
      });
    }
    return rows;
  }, [li, yt, ig, reach]);

  const growthBars = useMemo(
    () =>
      channelRows.map((r) => ({
        name: r.label.replace(" Organic", ""),
        growth: r.growth,
        reach: r.reach,
      })),
    [channelRows]
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: "Total organic reach", value: formatCompact(reach), icon: Eye },
          {
            label: "Organic impressions",
            value: formatCompact(result.blendedImpressions || 0),
            icon: Activity,
          },
          {
            label: "Instagram reached",
            value: formatCompact(ig?.accountsReached || 0),
            icon: Images,
          },
          {
            label: "Social engagements",
            value: formatCompact(result.blendedEngagements || 0),
            icon: MousePointerClick,
          },
          {
            label: "Profile visits",
            value: formatCompact(result.profileVisits || 0),
            icon: UserPlus,
          },
          {
            label: "Outbound link taps",
            value: formatCompact(result.outboundClicks || 0),
            icon: ExternalLink,
          },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-0"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 truncate">
                  {c.label}
                </p>
                <Icon size={14} className="text-indigo-600 shrink-0" />
              </div>
              <p className="text-[18px] xl:text-[20px] font-bold text-gray-900 tabular-nums leading-tight">
                {c.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-[14px] font-bold text-gray-900 mb-1">Reach by channel</h3>
          <p className="text-[12px] text-gray-500 mb-4">
            Share of blended organic reach (LinkedIn + YouTube + Instagram).
          </p>
          {reachShare.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-16">No reach data yet</p>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reachShare}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {reachShare.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCompact(Number(v ?? 0))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-[14px] font-bold text-gray-900 mb-1">Growth & reach</h3>
          <p className="text-[12px] text-gray-500 mb-4">
            Followers/subs/profile visits and reach by channel.
          </p>
          {growthBars.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-16">No channel data yet</p>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growthBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCompact(Number(v ?? 0))} />
                  <Legend />
                  <Bar
                    dataKey="growth"
                    name="Growth / profile visits"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar dataKey="reach" name="Reach" fill="#0a66c2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-[14px] font-bold text-gray-900">Channel breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
              <tr>
                <th className="text-left px-4 py-2.5">Channel</th>
                <th className="text-right px-4 py-2.5">Reach</th>
                <th className="text-right px-4 py-2.5">Engagements</th>
                <th className="text-right px-4 py-2.5">Growth / visits</th>
                <th className="text-right px-4 py-2.5">Eng. rate / CTR</th>
                <th className="text-right px-4 py-2.5">% Reach share</th>
              </tr>
            </thead>
            <tbody>
              {channelRows.map((r) => (
                <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-2.5 font-semibold text-gray-900">{r.label}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCompact(r.reach)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatCompact(r.engagement)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCompact(r.growth)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.engRate.toFixed(2)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.reachShare.toFixed(1)}%</td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                <td className="px-4 py-2.5">Total (blended)</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCompact(reach)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatCompact(channelRows.reduce((s, r) => s + r.engagement, 0))}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatCompact(channelRows.reduce((s, r) => s + r.growth, 0))}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">—</td>
                <td className="px-4 py-2.5 text-right tabular-nums">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
