/**
 * WIDE OS — 13-Step Performance Report Type Definitions
 *
 * Contracts for the report engine: input payloads, generated output,
 * package tier visibility rules, and funnel stage definitions.
 */

// ---------------------------------------------------------------------------
// Package tiers
// ---------------------------------------------------------------------------

export type PackageTier = "mvb" | "launch" | "growth" | "full_partnership";

export const PACKAGE_LABELS: Record<PackageTier, string> = {
  mvb: "MVB",
  launch: "Launch",
  growth: "Growth",
  full_partnership: "Full Partnership",
};

// ---------------------------------------------------------------------------
// Funnel stages
// ---------------------------------------------------------------------------

export type FunnelStage =
  | "awareness"
  | "consideration"
  | "conversion"
  | "loyalty";

export const FUNNEL_LABELS: Record<FunnelStage, string> = {
  awareness: "Awareness",
  consideration: "Consideration",
  conversion: "Conversion",
  loyalty: "Loyalty & Advocacy",
};

// ---------------------------------------------------------------------------
// Package → visible sections / funnel stages
// ---------------------------------------------------------------------------

export type ReportStepNumber =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

/** Which sections and funnel stages each tier can see. */
export const TIER_VISIBILITY: Record<
  PackageTier,
  { sections: ReportStepNumber[]; funnelStages: FunnelStage[] }
> = {
  mvb: {
    // MVB is one-off — no monthly recurring reports
    sections: [],
    funnelStages: [],
  },
  launch: {
    // Marketing Strategy, Website, SEO, Social, Analytics
    // Hide: Paid Ads (11), Video deep-dive, CRM
    sections: [1, 2, 3, 4, 5, 6, 9, 10, 12, 13],
    funnelStages: ["awareness", "consideration"],
  },
  growth: {
    // All Launch + Advanced Analytics, Campaign Planning, Paid Ads, Video
    // Hide: CRM & Advocacy
    sections: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    funnelStages: ["awareness", "consideration", "conversion"],
  },
  full_partnership: {
    // Everything
    sections: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    funnelStages: ["awareness", "consideration", "conversion", "loyalty"],
  },
};

// ---------------------------------------------------------------------------
// Input payload — what the founder pastes
// ---------------------------------------------------------------------------

export type MetaAdsData = {
  impressions?: number;
  reach?: number;
  clicks?: number;
  spend?: number;
  conversions?: number;
  ctr?: number;
  cpc?: number;
  campaigns?: Array<{
    name: string;
    impressions: number;
    clicks: number;
    spend: number;
    conversions?: number;
  }>;
};

export type GoogleAdsData = {
  impressions?: number;
  clicks?: number;
  spend?: number;
  conversions?: number;
  ctr?: number;
  cpc?: number;
  campaigns?: Array<{
    name: string;
    impressions: number;
    clicks: number;
    spend: number;
    conversions?: number;
  }>;
};

export type GA4Data = {
  sessions?: number;
  users?: number;
  newUsers?: number;
  bounceRate?: number;
  avgSessionDuration?: number;
  pageviews?: number;
  topPages?: Array<{
    path: string;
    views: number;
    avgTime?: number;
  }>;
  trafficSources?: Array<{
    source: string;
    medium: string;
    sessions: number;
    conversions?: number;
  }>;
};

export type GSCData = {
  totalClicks?: number;
  totalImpressions?: number;
  averageCtr?: number;
  averagePosition?: number;
  topQueries?: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    positionDelta?: number;
  }>;
  topPages?: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
};

export type TopPerformingAsset = {
  name: string;
  type: "ad" | "post" | "video" | "email" | "page" | "other";
  funnelStage: FunnelStage;
  primaryMetricLabel: string;
  primaryMetricValue: number;
  secondaryMetricLabel?: string;
  secondaryMetricValue?: number;
  thumbnailUrl?: string;
};

export type ReportInputPayload = {
  metaAds?: MetaAdsData;
  googleAds?: GoogleAdsData;
  ga4?: GA4Data;
  gsc?: GSCData;
  emailLogs?: string;
  topPerformingAssets?: TopPerformingAsset[];
  socialMediaMetrics?: {
    postsPublished?: number;
    totalEngagement?: number;
    followerGrowth?: number;
    topPlatform?: string;
  };
  videoProdMetrics?: {
    videosProduced?: number;
    totalViews?: number;
    avgWatchTime?: number;
  };
  crmMetrics?: {
    activeContacts?: number;
    newLeads?: number;
    conversionRate?: number;
    advocacyScore?: number;
  };
};

// ---------------------------------------------------------------------------
// Generated report output — 13-step structure
// ---------------------------------------------------------------------------

export type TitleSlide = {
  step: 1;
  clientName: string;
  reportDuration: string;
  packageReminder: string;
};

export type ExecutiveSummary = {
  step: 2;
  activities: string[];
};

export type FunnelMetrics = {
  step: 3;
  stages: Array<{
    stage: FunnelStage;
    label: string;
    primaryMetric: { label: string; value: string };
    secondaryMetric?: { label: string; value: string };
    delta?: string;
  }>;
};

export type FunnelDeepDive = {
  step: 4 | 5 | 6 | 7 | 8;
  stage: FunnelStage;
  stageLabel: string;
  topAsset: {
    name: string;
    metric: string;
    value: string;
  };
  strategicRationale: string;
};

export type SearchOrganicAnalysis = {
  step: 9;
  rankChanges: Array<{
    query: string;
    previousPosition: number;
    currentPosition: number;
    direction: "up" | "down" | "stable";
  }>;
  organicTrafficQuality: string;
  seoNextSteps: string[];
};

export type ContentAnalysis = {
  step: 10;
  inScope: boolean;
  publishingPlaybook?: string[];
  advisoryNote?: string;
};

export type PaidAnalysis = {
  step: 11;
  totalMediaBudget: string;
  remainingBudget: string;
  cpa: string;
  platformBreakdown?: Array<{
    platform: string;
    spend: string;
    conversions: number;
    cpa: string;
  }>;
};

export type StrategicInsights = {
  step: 12;
  insights: string[];
};

export type NextSteps = {
  step: 13;
  actions: string[];
};

export type ReportSection =
  | TitleSlide
  | ExecutiveSummary
  | FunnelMetrics
  | FunnelDeepDive
  | SearchOrganicAnalysis
  | ContentAnalysis
  | PaidAnalysis
  | StrategicInsights
  | NextSteps;

export type GeneratedReport = {
  titleSlide: TitleSlide;
  executiveSummary: ExecutiveSummary;
  funnelMetrics: FunnelMetrics;
  funnelDeepDives: FunnelDeepDive[];
  searchOrganicAnalysis: SearchOrganicAnalysis;
  contentAnalysis: ContentAnalysis;
  paidAnalysis: PaidAnalysis | null;
  strategicInsights: StrategicInsights;
  nextSteps: NextSteps;
};

// ---------------------------------------------------------------------------
// Database row shape (mirrors Supabase table)
// ---------------------------------------------------------------------------

export type PerformanceReportRow = {
  id: string;
  client_id: string;
  workspace_id: string | null;
  report_period_start: string;
  report_period_end: string;
  package_tier: PackageTier;
  input_payload: ReportInputPayload;
  generated_report: GeneratedReport | null;
  status: "draft" | "generating" | "published" | "failed";
  generated_at: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
