/**
 * ReportRenderer — the main client-facing report rendering component.
 *
 * Takes a GeneratedReport and PackageTier, filters sections by tier
 * visibility, and renders each of the 13 steps as styled blocks
 * consistent with the WIDE portal dark theme.
 */

import type { GeneratedReport, PackageTier } from "@/lib/reports/report-types";
import { PACKAGE_LABELS } from "@/lib/reports/report-types";
import { filterSectionsForTier } from "@/lib/reports/report-helpers";
import { ReportSectionCard } from "./ReportSectionCard";
import { FunnelMetricCard } from "./FunnelMetricCard";

type Props = {
  report: GeneratedReport;
  tier: PackageTier;
  /** Skip tier filtering (for founder preview of full report). */
  showAll?: boolean;
};

export function ReportRenderer({ report, tier, showAll = false }: Props) {
  const r = showAll ? report : filterSectionsForTier(report, tier);
  const tierLabel = PACKAGE_LABELS[tier];

  return (
    <div className="space-y-6">
      {/* Step 1: Title Slide */}
      <section className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/15 via-surface to-surface p-8 lg:p-12">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
            {tierLabel} Package
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-text-primary lg:text-4xl">
            {r.titleSlide.clientName}
          </h1>
          <p className="mt-2 text-lg text-text-secondary">
            {r.titleSlide.reportDuration}
          </p>
          <p className="mt-3 text-sm text-text-muted">
            {r.titleSlide.packageReminder}
          </p>
        </div>
      </section>

      {/* Step 2: Executive Summary */}
      {r.executiveSummary.activities.length > 0 && (
        <ReportSectionCard stepNumber={2} title="Executive Summary">
          <ul className="space-y-2">
            {r.executiveSummary.activities.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span className="text-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </ReportSectionCard>
      )}

      {/* Step 3: Funnel Metrics */}
      {r.funnelMetrics.stages.length > 0 && (
        <ReportSectionCard stepNumber={3} title="Funnel Metrics">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {r.funnelMetrics.stages.map((stage) => (
              <FunnelMetricCard
                key={stage.stage}
                stage={stage.stage}
                label={stage.label}
                primaryMetric={stage.primaryMetric}
                secondaryMetric={stage.secondaryMetric}
                delta={stage.delta}
              />
            ))}
          </div>
        </ReportSectionCard>
      )}

      {/* Steps 4-8: Funnel Deep Dives */}
      {r.funnelDeepDives.length > 0 && (
        <ReportSectionCard stepNumber={4} title="Funnel Deep Dives">
          <div className="space-y-4">
            {r.funnelDeepDives.map((dive) => (
              <div
                key={`${dive.step}-${dive.stage}`}
                className="rounded-xl border border-border-subtle bg-surface-raised p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    {dive.stageLabel}
                  </span>
                  <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                    Step {dive.step}
                  </span>
                </div>
                <div className="mb-3">
                  <p className="text-sm font-semibold text-text-primary">
                    {dive.topAsset.name}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    <span className="font-medium text-text-primary">
                      {dive.topAsset.value}
                    </span>{" "}
                    {dive.topAsset.metric}
                  </p>
                </div>
                <p className="text-sm italic text-text-secondary">
                  {dive.strategicRationale}
                </p>
              </div>
            ))}
          </div>
        </ReportSectionCard>
      )}

      {/* Step 9: Search & Organic Analysis */}
      {(r.searchOrganicAnalysis.rankChanges.length > 0 ||
        r.searchOrganicAnalysis.seoNextSteps.length > 0) && (
        <ReportSectionCard stepNumber={9} title="Search & Organic Analysis">
          {r.searchOrganicAnalysis.rankChanges.length > 0 && (
            <div className="mb-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wider text-text-muted">
                    <th className="pb-3 pr-4">Query</th>
                    <th className="pb-3 pr-4">Previous</th>
                    <th className="pb-3 pr-4">Current</th>
                    <th className="pb-3">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {r.searchOrganicAnalysis.rankChanges.map((rc, i) => (
                    <tr key={i}>
                      <td className="py-3 pr-4 font-medium text-text-primary">
                        {rc.query}
                      </td>
                      <td className="py-3 pr-4 text-text-secondary">
                        #{rc.previousPosition}
                      </td>
                      <td className="py-3 pr-4 text-text-secondary">
                        #{rc.currentPosition}
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-xs font-semibold ${
                            rc.direction === "up"
                              ? "text-success"
                              : rc.direction === "down"
                                ? "text-danger"
                                : "text-text-muted"
                          }`}
                        >
                          {rc.direction === "up"
                            ? `▲ ${rc.previousPosition - rc.currentPosition}`
                            : rc.direction === "down"
                              ? `▼ ${rc.currentPosition - rc.previousPosition}`
                              : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {r.searchOrganicAnalysis.organicTrafficQuality && (
            <p className="mb-4 text-sm text-text-secondary">
              {r.searchOrganicAnalysis.organicTrafficQuality}
            </p>
          )}

          {r.searchOrganicAnalysis.seoNextSteps.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                SEO Next Steps
              </p>
              <ul className="space-y-1.5">
                {r.searchOrganicAnalysis.seoNextSteps.map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-text-primary"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ReportSectionCard>
      )}

      {/* Step 10: Content Analysis */}
      {(r.contentAnalysis.inScope ||
        r.contentAnalysis.advisoryNote) && (
        <ReportSectionCard stepNumber={10} title="Content Analysis">
          {r.contentAnalysis.inScope &&
          r.contentAnalysis.publishingPlaybook?.length ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Publishing Playbook — Next Sprint
              </p>
              <ol className="space-y-2">
                {r.contentAnalysis.publishingPlaybook.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-text-primary"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent/15 text-[10px] font-bold text-accent">
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          ) : r.contentAnalysis.advisoryNote ? (
            <p className="text-sm text-text-secondary">
              {r.contentAnalysis.advisoryNote}
            </p>
          ) : null}
        </ReportSectionCard>
      )}

      {/* Step 11: Paid Analysis (Growth & Full Partnership only) */}
      {r.paidAnalysis && (
        <ReportSectionCard stepNumber={11} title="Paid Media Analysis">
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Total Media Budget",
                value: r.paidAnalysis.totalMediaBudget,
              },
              {
                label: "Remaining Budget",
                value: r.paidAnalysis.remainingBudget,
              },
              { label: "Cost Per Acquisition", value: r.paidAnalysis.cpa },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border-subtle bg-surface-raised p-4"
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  {stat.label}
                </p>
                <p className="mt-1 text-xl font-bold text-text-primary">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {r.paidAnalysis.platformBreakdown?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wider text-text-muted">
                    <th className="pb-3 pr-4">Platform</th>
                    <th className="pb-3 pr-4">Spend</th>
                    <th className="pb-3 pr-4">Conversions</th>
                    <th className="pb-3">CPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {r.paidAnalysis.platformBreakdown.map((p, i) => (
                    <tr key={i}>
                      <td className="py-3 pr-4 font-medium text-text-primary">
                        {p.platform}
                      </td>
                      <td className="py-3 pr-4 text-text-secondary">
                        {p.spend}
                      </td>
                      <td className="py-3 pr-4 text-text-secondary">
                        {p.conversions}
                      </td>
                      <td className="py-3 text-text-secondary">{p.cpa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </ReportSectionCard>
      )}

      {/* Step 12: Strategic Insights */}
      {r.strategicInsights.insights.length > 0 && (
        <ReportSectionCard stepNumber={12} title="Strategic Insights">
          <div className="space-y-3">
            {r.strategicInsights.insights.map((insight, i) => (
              <div
                key={i}
                className="rounded-xl border-l-2 border-accent bg-accent/5 px-4 py-3"
              >
                <p className="text-sm text-text-primary">{insight}</p>
              </div>
            ))}
          </div>
        </ReportSectionCard>
      )}

      {/* Step 13: Ruthless Next Steps */}
      {r.nextSteps.actions.length > 0 && (
        <ReportSectionCard stepNumber={13} title="Ruthless Next Steps">
          <ol className="space-y-3">
            {r.nextSteps.actions.map((action, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-success/15 text-[11px] font-bold text-success">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-text-primary">{action}</span>
              </li>
            ))}
          </ol>
        </ReportSectionCard>
      )}
    </div>
  );
}
