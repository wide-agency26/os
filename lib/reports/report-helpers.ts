/**
 * WIDE OS — Report Helpers
 *
 * Utility functions for formatting, filtering, and calculating
 * report data.
 */

import {
  type GeneratedReport,
  type PackageTier,
  TIER_VISIBILITY,
} from "./report-types";

/**
 * Filters a generated report to only include sections visible
 * for the given tier. Returns a shallow-cloned report.
 */
export function filterSectionsForTier(
  report: GeneratedReport,
  tier: PackageTier
): GeneratedReport {
  const vis = TIER_VISIBILITY[tier];
  const allowed = new Set(vis.sections);
  const allowedStages = new Set(vis.funnelStages);

  return {
    titleSlide: allowed.has(1) ? report.titleSlide : report.titleSlide, // always show title
    executiveSummary: allowed.has(2)
      ? report.executiveSummary
      : { step: 2, activities: [] },
    funnelMetrics: allowed.has(3)
      ? {
          ...report.funnelMetrics,
          stages: report.funnelMetrics.stages.filter((s) =>
            allowedStages.has(s.stage)
          ),
        }
      : { step: 3, stages: [] },
    funnelDeepDives: report.funnelDeepDives.filter(
      (d) => allowed.has(d.step) && allowedStages.has(d.stage)
    ),
    searchOrganicAnalysis: allowed.has(9)
      ? report.searchOrganicAnalysis
      : {
          step: 9 as const,
          rankChanges: [],
          organicTrafficQuality: "",
          seoNextSteps: [],
        },
    contentAnalysis: allowed.has(10)
      ? report.contentAnalysis
      : { step: 10 as const, inScope: false, advisoryNote: "" },
    paidAnalysis:
      allowed.has(11) && report.paidAnalysis ? report.paidAnalysis : null,
    strategicInsights: allowed.has(12)
      ? report.strategicInsights
      : { step: 12 as const, insights: [] },
    nextSteps: allowed.has(13)
      ? report.nextSteps
      : { step: 13 as const, actions: [] },
  };
}

/** Format a number as Euro currency. */
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Calculate Cost Per Acquisition. */
export function calculateCPA(spend: number, conversions: number): string {
  if (conversions === 0) return "—";
  return formatCurrency(spend / conversions);
}

/** Format a date range as a human-readable period label. */
export function parsePeriodLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${fmt.format(s)} – ${fmt.format(e)}`;
}

/** Format large numbers with K/M suffixes for compact display. */
export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
