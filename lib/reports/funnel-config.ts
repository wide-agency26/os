/**
 * Project-scoped hourglass funnel configuration.
 * Maps Data Hub streams → Awareness / Consideration / Conversion stages.
 */

export type AwarenessMode = "impressions" | "reach";

export type FunnelStreamId =
  | "meta_impressions"
  | "meta_reach"
  | "meta_clicks"
  | "meta_conversions"
  | "google_impressions"
  | "google_clicks"
  | "google_conversions"
  | "linkedin_ads_impressions"
  | "linkedin_ads_clicks"
  | "linkedin_ads_conversions"
  | "gsc_impressions"
  | "gsc_clicks"
  | "social_impressions"
  | "social_engagements"
  | "ig_profile_visits"
  | "ig_external_link_taps"
  | "youtube_views"
  | "ga4_sessions"
  | "ad_spend";

export interface FunnelStreamOption {
  id: FunnelStreamId;
  label: string;
  stage: "awareness" | "consideration" | "conversion" | "spend";
  description: string;
}

export const FUNNEL_STREAM_OPTIONS: FunnelStreamOption[] = [
  {
    id: "meta_impressions",
    label: "Meta Ads Impressions",
    stage: "awareness",
    description: "Paid Meta impressions",
  },
  {
    id: "meta_reach",
    label: "Meta Ads Reach",
    stage: "awareness",
    description: "Unique Meta reach (when available)",
  },
  {
    id: "google_impressions",
    label: "Google Ads Impressions",
    stage: "awareness",
    description: "Paid Google impressions",
  },
  {
    id: "linkedin_ads_impressions",
    label: "LinkedIn Ads Impressions",
    stage: "awareness",
    description: "Paid LinkedIn impressions",
  },
  {
    id: "gsc_impressions",
    label: "GSC Organic Impressions",
    stage: "awareness",
    description: "Search Console SERP impressions",
  },
  {
    id: "social_impressions",
    label: "Organic Social Reach / Impressions",
    stage: "awareness",
    description: "LinkedIn + YouTube + Instagram organic footprint",
  },
  {
    id: "social_engagements",
    label: "Organic Social Engagements",
    stage: "consideration",
    description: "LinkedIn interactions + Instagram content interactions",
  },
  {
    id: "ig_profile_visits",
    label: "Instagram Profile Visits",
    stage: "consideration",
    description: "Brand interest from Instagram organic",
  },
  {
    id: "ga4_sessions",
    label: "GA4 Web Sessions",
    stage: "consideration",
    description: "Website sessions (recommended primary)",
  },
  {
    id: "meta_clicks",
    label: "Meta Link Clicks",
    stage: "consideration",
    description: "Outbound Meta clicks",
  },
  {
    id: "google_clicks",
    label: "Google Ads Clicks",
    stage: "consideration",
    description: "Paid Google clicks",
  },
  {
    id: "linkedin_ads_clicks",
    label: "LinkedIn Ads Landing Clicks",
    stage: "consideration",
    description: "LinkedIn landing-page clicks",
  },
  {
    id: "gsc_clicks",
    label: "GSC Organic Clicks",
    stage: "consideration",
    description: "Organic search clicks",
  },
  {
    id: "youtube_views",
    label: "YouTube Video Views",
    stage: "consideration",
    description: "Organic YouTube views",
  },
  {
    id: "meta_conversions",
    label: "Meta Results / Conversions",
    stage: "conversion",
    description: "Meta Ads results",
  },
  {
    id: "google_conversions",
    label: "Google Ads Conversions",
    stage: "conversion",
    description: "Google conversion actions",
  },
  {
    id: "linkedin_ads_conversions",
    label: "LinkedIn Ads Conversions / LP Clicks",
    stage: "conversion",
    description: "LinkedIn conversion proxy",
  },
  {
    id: "ig_external_link_taps",
    label: "Instagram External Link Taps",
    stage: "conversion",
    description: "High-intent outbound taps from Instagram bio / posts",
  },
  {
    id: "ad_spend",
    label: "Total Ad Spend",
    stage: "spend",
    description: "Blended paid media spend (EUR)",
  },
];

export interface ProjectFunnelConfig {
  awarenessStreams: FunnelStreamId[];
  awarenessMode: AwarenessMode;
  considerationPrimary: FunnelStreamId;
  considerationFallback: FunnelStreamId[];
  conversionPrimary: FunnelStreamId[];
  conversionSecondary: FunnelStreamId[];
  loyaltyEnabled: boolean;
  advocacyEnabled: boolean;
}

export const DEFAULT_FUNNEL_CONFIG: ProjectFunnelConfig = {
  awarenessStreams: [
    "meta_impressions",
    "google_impressions",
    "linkedin_ads_impressions",
    "gsc_impressions",
    "social_impressions",
  ],
  awarenessMode: "impressions",
  considerationPrimary: "ga4_sessions",
  considerationFallback: [
    "meta_clicks",
    "google_clicks",
    "linkedin_ads_clicks",
    "gsc_clicks",
    "youtube_views",
    "social_engagements",
    "ig_profile_visits",
  ],
  conversionPrimary: [
    "meta_conversions",
    "google_conversions",
    "linkedin_ads_conversions",
  ],
  conversionSecondary: ["ig_external_link_taps"],
  loyaltyEnabled: false,
  advocacyEnabled: false,
};

export function normalizeFunnelConfig(raw: unknown): ProjectFunnelConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FUNNEL_CONFIG };
  const c = raw as Partial<ProjectFunnelConfig>;
  return {
    awarenessStreams: Array.isArray(c.awarenessStreams)
      ? (c.awarenessStreams as FunnelStreamId[])
      : DEFAULT_FUNNEL_CONFIG.awarenessStreams,
    awarenessMode: c.awarenessMode === "reach" ? "reach" : "impressions",
    considerationPrimary:
      (c.considerationPrimary as FunnelStreamId) ||
      DEFAULT_FUNNEL_CONFIG.considerationPrimary,
    considerationFallback: Array.isArray(c.considerationFallback)
      ? (c.considerationFallback as FunnelStreamId[])
      : DEFAULT_FUNNEL_CONFIG.considerationFallback,
    conversionPrimary: Array.isArray(c.conversionPrimary)
      ? (c.conversionPrimary as FunnelStreamId[])
      : DEFAULT_FUNNEL_CONFIG.conversionPrimary,
    conversionSecondary: Array.isArray(c.conversionSecondary)
      ? (c.conversionSecondary as FunnelStreamId[])
      : DEFAULT_FUNNEL_CONFIG.conversionSecondary,
    loyaltyEnabled: false,
    advocacyEnabled: false,
  };
}

export function streamsForStage(
  stage: FunnelStreamOption["stage"]
): FunnelStreamOption[] {
  return FUNNEL_STREAM_OPTIONS.filter((s) => s.stage === stage);
}

function streamLabel(id: FunnelStreamId): string {
  return FUNNEL_STREAM_OPTIONS.find((s) => s.id === id)?.label || id;
}

/** Short human metric name for scorecards / funnel annotations */
export function funnelMetricSubtitles(config: ProjectFunnelConfig): {
  awareness: string;
  consideration: string;
  conversion: string;
  spend: string;
  cpa: string;
} {
  const awareness =
    config.awarenessMode === "reach"
      ? "Reach / impressions (funnel config)"
      : "Impressions (paid + organic)";
  const considerationPrimary = streamLabel(config.considerationPrimary);
  const consideration =
    config.considerationFallback.length > 0
      ? `${considerationPrimary} (+ fallbacks)`
      : considerationPrimary;
  const conversionIds = [
    ...config.conversionPrimary,
    ...config.conversionSecondary,
  ];
  const conversion =
    conversionIds.length === 0
      ? "Conversions"
      : conversionIds.length <= 2
        ? conversionIds.map(streamLabel).join(" + ")
        : "Conversions / results (mapped streams)";
  return {
    awareness,
    consideration,
    conversion,
    spend: "Blended ad spend (source currencies)",
    cpa: "Total spend ÷ verified conversions",
  };
}
