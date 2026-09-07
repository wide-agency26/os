"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  Share2,
  Megaphone,
  Globe2,
  Search,
  Database,
  Eye,
  MousePointerClick,
  Target,
  Banknote,
  Coins,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCompact, isWebsiteDataset } from "@/lib/reports/ga4-website";
import { formatCurrency } from "@/lib/reports/meta-ads";
import {
  type LoadedDataset,
  computeGeneralFunnel,
} from "@/lib/reports/aggregation";
import {
  DateRangeControls,
  useDateRangeFilter,
  mergeMonthOptions,
} from "@/components/reports/DateRangeControls";
import { HourglassFunnel } from "@/components/reports/HourglassFunnel";
import {
  availableMonths as metaAvailableMonths,
  normalizeMetaRows,
  isMetaAdsDataset,
  looksLikeGoogleAdsRows,
} from "@/lib/reports/meta-ads";
import {
  availableGoogleMonths,
  normalizeGoogleRows,
  isGoogleAdsDataset,
} from "@/lib/reports/google-ads";
import {
  availableLinkedInAdsMonths,
  normalizeLinkedInAdsRows,
  isLinkedInAdsDataset,
  looksLikeLinkedInAdsRows,
} from "@/lib/reports/linkedin-ads";
import { availableLiMonths, buildLinkedInBundle } from "@/lib/reports/linkedin-organic";
import { availableYtMonths, buildYouTubeBundle } from "@/lib/reports/youtube-organic";
import {
  availableIgMonths,
  buildInstagramBundle,
} from "@/lib/reports/instagram-organic";
import { availableGscMonths, buildGscBundle } from "@/lib/reports/gsc";
import {
  pickLinkedInPayloads,
  pickYouTubePayloads,
  pickInstagramPayloads,
  pickGscPayloads,
} from "@/lib/reports/aggregation";
import {
  detectSubcategory,
  isMetaAdsSub,
  isGoogleAdsSub,
  isLinkedInAdsSub,
  isGscSub,
  isLinkedInOrganicSub,
  isYouTubeOrganicSub,
} from "@/lib/data-hub/subcategory";
import {
  DEFAULT_FUNNEL_CONFIG,
  normalizeFunnelConfig,
  funnelMetricSubtitles,
  funnelClientCopy,
  type ProjectFunnelConfig,
} from "@/lib/reports/funnel-config";
import { createClient } from "@/utils/supabase/client";
import { availableMonths as ga4AvailableMonths, normalizeRows as normalizeGa4Rows } from "@/lib/reports/ga4-website";

interface ChannelStatus {
  id: string;
  label: string;
  hint: string;
  icon: typeof Share2;
  hasData: boolean;
  metricHint: string;
}

interface AiInsightCard {
  id: string;
  title: string;
  category: string;
  impact: string;
  observation: string;
  recommended_action: string;
  pinned: boolean;
}

interface GeneralReportViewProps {
  channels: ChannelStatus[];
  datasets?: LoadedDataset[];
  projectId?: string;
  isAdmin?: boolean;
  /** Client executive view — no admin CTAs; insights lead the page */
  clientMode?: boolean;
  onSelectCategory?: (id: string) => void;
}

export function GeneralReportView({
  channels,
  datasets = [],
  projectId,
  isAdmin,
  clientMode = false,
  onSelectCategory,
}: GeneralReportViewProps) {
  const connected = channels.filter((c) => c.hasData).length;
  const dateState = useDateRangeFilter();
  const [funnelConfig, setFunnelConfig] = useState<ProjectFunnelConfig>(DEFAULT_FUNNEL_CONFIG);
  const [insights, setInsights] = useState<AiInsightCard[]>([]);

  useEffect(() => {
    if (!projectId) return;
    const supabase = createClient();
    void (async () => {
      const { data } = await (supabase as any)
        .from("project_funnel_configs")
        .select("config")
        .eq("project_id", projectId)
        .maybeSingle();
      if (data?.config) setFunnelConfig(normalizeFunnelConfig(data.config));

      const { data: cards } = await (supabase as any)
        .from("project_ai_insights")
        .select("id, title, category, impact, observation, recommended_action, pinned, visible")
        .eq("project_id", projectId)
        .eq("visible", true)
        .order("pinned", { ascending: false })
        .order("sort_order", { ascending: true })
        .limit(6);
      setInsights((cards as AiInsightCard[]) || []);
    })();
  }, [projectId]);

  const months = useMemo(() => {
    const metaMs = datasets
      .filter((d) => {
        const sub = d.subcategory || detectSubcategory(d.name, d.columns);
        if (
          isGoogleAdsSub(sub) ||
          isLinkedInAdsSub(sub) ||
          isGscSub(sub) ||
          isLinkedInOrganicSub(sub) ||
          isYouTubeOrganicSub(sub) ||
          sub === "ga4"
        ) {
          return false;
        }
        if (looksLikeGoogleAdsRows(d.rows) || looksLikeLinkedInAdsRows(d.rows)) return false;
        return isMetaAdsSub(sub) || isMetaAdsDataset(d.columns, d.rows);
      })
      .flatMap((d) => metaAvailableMonths(normalizeMetaRows(d.rows)));

    const gMs = datasets
      .filter((d) => {
        const sub = d.subcategory || detectSubcategory(d.name, d.columns);
        return isGoogleAdsSub(sub) || isGoogleAdsDataset(d.columns, d.rows);
      })
      .flatMap((d) => availableGoogleMonths(normalizeGoogleRows(d.rows)));

    const liAdsMs = datasets
      .filter((d) => {
        const sub = d.subcategory || detectSubcategory(d.name, d.columns);
        return (
          isLinkedInAdsSub(sub) ||
          isLinkedInAdsDataset(d.columns, d.rows) ||
          looksLikeLinkedInAdsRows(d.rows)
        );
      })
      .flatMap((d) => availableLinkedInAdsMonths(normalizeLinkedInAdsRows(d.rows)));

    const webMs = datasets
      .filter((d) => isWebsiteDataset(d.columns, d.rows))
      .flatMap((d) => ga4AvailableMonths(normalizeGa4Rows(d.rows)));

    const liOrg = availableLiMonths(buildLinkedInBundle(pickLinkedInPayloads(datasets)));
    const yt = availableYtMonths(buildYouTubeBundle(pickYouTubePayloads(datasets)));
    const ig = availableIgMonths(buildInstagramBundle(pickInstagramPayloads(datasets)));
    const gsc = availableGscMonths(buildGscBundle(pickGscPayloads(datasets)));
    return mergeMonthOptions(metaMs, gMs, liAdsMs, webMs, liOrg, yt, ig, gsc);
  }, [datasets]);

  const funnel = useMemo(
    () => computeGeneralFunnel(datasets, dateState.periodOpts, funnelConfig),
    [datasets, dateState.periodOpts, funnelConfig]
  );

  const pinned = insights.filter((i) => i.pinned).slice(0, 3);
  const visibleInsights = pinned.length ? pinned : insights.slice(0, 3);
  const showAdminChrome = Boolean(isAdmin) && !clientMode;
  const metricSubs = funnelMetricSubtitles(funnelConfig);
  const clientCopy = funnelClientCopy(funnelConfig);
  const stageCopy = clientMode ? clientCopy : null;

  const insightsBlock =
    visibleInsights.length > 0 || showAdminChrome ? (
      <section className="bg-surface border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary">
              {clientMode ? "Executive summary" : "Strategic insights"}
            </h3>
          </div>
          {showAdminChrome && projectId && (
            <Link
              href={`/app/projects/insights?project=${projectId}`}
              className="text-[12px] font-medium text-text-secondary hover:text-text-primary underline no-print"
            >
              Open AI Insight Center →
            </Link>
          )}
        </div>
        {clientMode && visibleInsights.length > 0 && (
          <p className="text-[12px] text-gray-500">
            Published by your agency for this project and period.
          </p>
        )}
        {visibleInsights.length === 0 ? (
          showAdminChrome ? (
            <p className="text-[13px] text-gray-500">
              No pinned insights yet. Generate commentary in the AI Insight Center.
            </p>
          ) : null
        ) : (
          <div className={`grid grid-cols-1 ${clientMode ? "md:grid-cols-1" : "md:grid-cols-3"} gap-3`}>
            {visibleInsights.map((card) => (
              <div
                key={card.id}
                className={`rounded-lg border border-border bg-surface p-4 ${
                  clientMode ? "md:flex md:gap-4 md:items-start" : ""
                }`}
              >
                <div className={clientMode ? "md:min-w-[200px]" : ""}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary bg-surface-raised px-1.5 py-0.5 rounded">
                      {card.impact}
                    </span>
                    <span className="text-[10px] text-gray-500">{card.category}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-gray-900 mb-1">{card.title}</p>
                </div>
                <p
                  className={`text-[12px] text-gray-600 leading-relaxed ${
                    clientMode ? "" : "line-clamp-3"
                  }`}
                >
                  {card.observation}
                  {clientMode && card.recommended_action ? (
                    <>
                      {" "}
                      <span className="text-gray-800 font-medium">
                        Recommended: {card.recommended_action}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <DateRangeControls
          months={months}
          state={dateState}
          accent="#171717"
          rowCountHint="Filters the executive funnel across all channels"
        />
      </div>

      {clientMode && insightsBlock}

      {/* Admin-only intro / funnel mapping status — hidden on client executive view */}
      {!clientMode && (
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent text-white flex items-center justify-center shrink-0">
              <LayoutGrid size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[17px] font-semibold text-text-primary">Executive funnel overview</h3>
              <p className="text-[13px] text-text-secondary mt-1 max-w-2xl leading-relaxed">
                Stage metrics follow this project&apos;s Funnel Config. Missing channels are skipped —
                one active source is enough.
              </p>
            </div>
            {showAdminChrome && projectId && (
              <Link
                href={`/app/projects/funnel?project=${projectId}`}
                className="text-[12px] font-medium text-text-secondary hover:text-text-primary underline shrink-0 no-print"
              >
                Edit funnel mapping →
              </Link>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-surface-raised text-text-secondary border border-border">
              {connected} of {channels.length} channel sources connected
            </span>
            {funnel?.notice && (
              <span className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-100">
                {funnel.notice}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Section 1 — Top-line scorecards */}
      {funnel && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {[
            {
              label: clientMode ? "Times the brand showed up" : "Marketing footprint",
              value: formatCompact(funnel.stages.awareness),
              metric: stageCopy ? stageCopy.awareness : metricSubs.awareness,
              icon: Eye,
            },
            {
              label: clientMode ? "People who visited the site" : "Inbound interest",
              value: formatCompact(funnel.stages.consideration),
              metric: stageCopy ? stageCopy.consideration : metricSubs.consideration,
              icon: MousePointerClick,
            },
            {
              label: clientMode ? "People who took an action" : "Verified conversions",
              value: formatCompact(funnel.stages.conversion),
              metric: stageCopy
                ? stageCopy.conversion
                : metricSubs.conversion,
              icon: Target,
            },
            {
              label: "Total ad spend",
              value: funnel.conversions.adSpendLabel || formatCurrency(funnel.conversions.adSpend),
              metric: stageCopy ? stageCopy.spend : metricSubs.spend,
              icon: Banknote,
            },
            {
              label: clientMode ? "Cost per action" : "Blended CPA",
              value:
                funnel.conversions.cpa != null
                  ? formatCurrency(funnel.conversions.cpa)
                  : "—",
              metric: stageCopy ? stageCopy.cpa : metricSubs.cpa,
              icon: Coins,
            },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {m.label}
                  </p>
                  <Icon size={13} className="text-text-muted" />
                </div>
                <p className="text-[20px] font-bold text-gray-900 tabular-nums">{m.value}</p>
                <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">{m.metric}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Section 2 — Hourglass */}
      {funnel && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
              Section 2
            </p>
            <h3 className="text-[16px] font-bold text-gray-900">
              {clientMode ? "From seeing the brand to taking an action" : "Hourglass marketing funnel"}
            </h3>
            <p className="text-[12px] text-gray-500 mt-1">
              {clientMode ? (
                <>
                  Awareness is how often the brand showed up. Consideration is people who visited
                  the website. Conversion is people who subscribed, sent a message, or reached a
                  thank-you page.
                  {funnel.rates.totalFunnelEfficiency != null && (
                    <>
                      {" "}
                      Overall,{" "}
                      <strong className="text-gray-800">
                        {funnel.rates.totalFunnelEfficiency.toFixed(2)}%
                      </strong>{" "}
                      of impressions became an action.
                    </>
                  )}
                </>
              ) : (
                <>
                  Awareness → Consideration → Conversion, with stage-over-stage rates and drop-offs.
                  {funnel.rates.totalFunnelEfficiency != null && (
                    <>
                      {" "}
                      Total funnel efficiency:{" "}
                      <strong className="text-gray-800">
                        {funnel.rates.totalFunnelEfficiency.toFixed(2)}%
                      </strong>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <HourglassFunnel
            plainLanguage={clientMode}
            stages={[
              {
                id: "awareness",
                label: "Awareness",
                value: funnel.stages.awareness,
                metricHint: stageCopy ? stageCopy.awareness : metricSubs.awareness,
                detail: stageCopy?.awarenessDetail,
              },
              {
                id: "consideration",
                label: "Consideration",
                value: funnel.stages.consideration,
                metricHint: stageCopy ? stageCopy.consideration : metricSubs.consideration,
                detail: stageCopy?.considerationDetail,
              },
              {
                id: "conversion",
                label: "Conversion",
                value: funnel.stages.conversion,
                metricHint: stageCopy ? stageCopy.conversion : metricSubs.conversion,
                detail: stageCopy?.conversionDetail,
              },
              {
                id: "loyalty",
                label: "Loyalty",
                value: 0,
                locked: true,
                lockedHint: "Connect CRM / HubSpot / Shopify — Coming Soon",
              },
              {
                id: "advocacy",
                label: "Advocacy",
                value: 0,
                locked: true,
                lockedHint: "Connect review / referral engine — Coming Soon",
              },
            ]}
          />
        </section>
      )}

      {/* Section 3 — Attribution */}
      {funnel && funnel.attribution.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
              Section 3
            </p>
            <h3 className="text-[16px] font-bold text-gray-900">
              Cross-channel acquisition vs conversion
            </h3>
            <p className="text-[12px] text-gray-500 mt-1">
              How Paid Media, Organic Search, Social Organic, and Direct Web contribute to each
              funnel stage.
            </p>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel.attribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(v)} />
                <Tooltip formatter={(v) => formatCompact(Number(v) || 0)} />
                <Legend />
                <Bar dataKey="awareness" name="Awareness" stackId="a" fill="#171717" />
                <Bar dataKey="consideration" name="Consideration" stackId="a" fill="#525252" />
                <Bar dataKey="conversion" name="Conversion" stackId="a" fill="#a3a3a3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {!clientMode && insightsBlock}

      {showAdminChrome && connected < channels.length && (
        <div className="border border-dashed border-gray-300 rounded-2xl bg-gray-50 p-6 text-center no-print">
          <Database className="mx-auto mb-2 text-gray-400" size={22} />
          <p className="text-[13px] text-gray-600 mb-2">
            Connect missing channels in Sources, or upload a file for platforms that need one.
          </p>
          <Link
            href={
              projectId
                ? `/app/projects/report-data?project=${projectId}`
                : "/app/projects/report-data"
            }
            className="text-[13px] text-text-secondary hover:text-text-primary underline font-medium"
          >
            Open Sources →
          </Link>
        </div>
      )}
    </div>
  );
}

export const GENERAL_CHANNEL_ICONS = {
  Social: Share2,
  Ads: Megaphone,
  Website: Globe2,
  SEO: Search,
} as const;
