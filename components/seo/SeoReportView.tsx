"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Lock, Printer } from "lucide-react";
import type { SeoRunBundle } from "@/lib/seo/load-run";
import { PillarBars, ScoreGauge } from "./ScoreGauge";
import { IssueList } from "./IssueList";
import {
  ContentQualityPanel,
  IndexabilityFunnel,
  InternalLinkDistribution,
} from "./TechnicalPanels";
import { CoreWebVitalsPanel } from "./CoreWebVitalsPanel";
import { IntentDonut, QuestionClusters } from "./QuestionClusters";
import { CompetitorMatrix } from "./CompetitorMatrix";
import { PagesTable } from "./PagesTable";
import { RoadmapBoard } from "./RoadmapBoard";
import {
  Card,
  Chip,
  DegradedNote,
  NotConnectedCard,
  SectionLabel,
  formatNumber,
} from "./primitives";

type TabKey =
  | "overview"
  | "fixes"
  | "technical"
  | "content"
  | "performance"
  | "questions"
  | "competitors"
  | "pages"
  | "roadmap";

/**
 * Which phase each tab depends on. Tabs unlock as their phase completes, so a
 * long run is readable while it is still working rather than being a spinner.
 */
const TAB_PHASE: Partial<Record<TabKey, string>> = {
  fixes: "analyze",
  technical: "analyze",
  content: "analyze",
  performance: "performance",
  questions: "questions",
  competitors: "competitors",
  pages: "crawl",
  roadmap: "synthesize",
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "fixes", label: "Priority fixes" },
  { key: "technical", label: "Technical" },
  { key: "content", label: "Content" },
  { key: "performance", label: "Performance" },
  { key: "questions", label: "Questions & topics" },
  { key: "competitors", label: "Competitors" },
  { key: "pages", label: "Pages" },
  { key: "roadmap", label: "Roadmap" },
];

export function SeoReportView({ bundle }: { bundle: SeoRunBundle }) {
  const [tab, setTab] = useState<TabKey>("overview");
  const { run, site, issues, pages, queries, perf, competitors, capabilities } = bundle;

  const psiConfigured = perf.length > 0 || run.phase_status.performance === "done";

  const unlocked = useMemo(() => {
    const set = new Set<TabKey>(["overview"]);
    for (const [key, phase] of Object.entries(TAB_PHASE) as [TabKey, string][]) {
      const outcome = run.phase_status[phase as keyof typeof run.phase_status];
      if (outcome && outcome !== "pending" && outcome !== "running") set.add(key);
    }
    if (run.status === "ready") for (const t of TABS) set.add(t.key);
    return set;
  }, [run.phase_status, run.status]);

  const topIssues = issues.slice(0, 10);
  const measuredAt = run.finished_at ?? run.created_at;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-px print:hidden">
        {TABS.map((t) => {
          const isUnlocked = unlocked.has(t.key);
          return (
            <button
              key={t.key}
              type="button"
              disabled={!isUnlocked}
              onClick={() => setTab(t.key)}
              className={`relative shrink-0 whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors ${
                tab === t.key
                  ? "text-gray-900"
                  : isUnlocked
                    ? "text-gray-500 hover:text-gray-800"
                    : "cursor-not-allowed text-gray-300"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {t.label}
                {!isUnlocked ? <Lock size={11} /> : null}
              </span>
              {tab === t.key ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gray-900" />
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
            <Card className="flex items-center justify-center">
              <ScoreGauge score={run.score} previousScore={bundle.previousScore} />
            </Card>

            <Card className="space-y-3">
              <SectionLabel>What we found</SectionLabel>
              {run.summary.headline ? (
                <p className="text-[15px] font-medium leading-snug text-gray-900">
                  {run.summary.headline}
                </p>
              ) : null}
              {run.summary.executive ? (
                <p className="text-[13px] leading-relaxed text-gray-700">
                  {run.summary.executive}
                </p>
              ) : (
                <p className="text-[13px] text-gray-500">
                  The written summary is produced in the final stage of the audit.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-4">
                <Stat label="Pages crawled" value={formatNumber(run.stats.pages_crawled)} />
                <Stat
                  label="Issues found"
                  value={formatNumber(run.stats.issues_total ?? issues.length)}
                />
                <Stat
                  label="Critical"
                  value={formatNumber(
                    run.stats.issues_critical ??
                      issues.filter((i) => i.severity === "critical").length
                  )}
                  tone={
                    (run.stats.issues_critical ?? 0) > 0 ? "text-red-600" : "text-emerald-600"
                  }
                />
                <Stat
                  label="Searches found"
                  value={formatNumber(run.stats.queries_found ?? queries.length)}
                />
              </div>
            </Card>
          </div>

          <PillarBars scores={run.scores} />

          {run.summary.strengths?.length || run.summary.risks?.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {run.summary.strengths?.length ? (
                <Card className="space-y-2">
                  <SectionLabel>Working well</SectionLabel>
                  <ul className="space-y-1.5">
                    {run.summary.strengths.map((s) => (
                      <li key={s} className="text-[13px] leading-relaxed text-gray-700">
                        • {s}
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
              {run.summary.risks?.length ? (
                <Card className="space-y-2">
                  <SectionLabel>Needs attention</SectionLabel>
                  <ul className="space-y-1.5">
                    {run.summary.risks.map((r) => (
                      <li key={r} className="text-[13px] leading-relaxed text-gray-700">
                        • {r}
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </div>
          ) : null}

          {run.summary.opportunities?.length ? (
            <Card className="space-y-2">
              <SectionLabel>The opportunity</SectionLabel>
              <ul className="space-y-1.5">
                {run.summary.opportunities.map((o) => (
                  <li key={o} className="text-[13px] leading-relaxed text-gray-700">
                    • {o}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {topIssues.length ? (
            <div className="space-y-3">
              <div>
                <SectionLabel>Top 10 fixes, in order</SectionLabel>
                <p className="mt-1 text-[12px] text-gray-600">
                  Ranked by how much difference each would make against how much work it is.
                </p>
              </div>
              <IssueList issues={topIssues} showFilters={false} />
            </div>
          ) : null}

          {capabilities.some((c) => !c.available) ? (
            <div className="space-y-3">
              <div>
                <SectionLabel>Not included in this audit</SectionLabel>
                <p className="mt-1 text-[12px] text-gray-600">
                  Everything above comes from free, official sources. These four need a paid
                  data provider, so they are stated as missing rather than guessed at.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {capabilities
                  .filter((c) => !c.available)
                  .map((c) => (
                    <NotConnectedCard
                      key={c.key}
                      title={c.label}
                      reason={c.reason}
                      action={c.upgradeHint}
                    />
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "fixes" ? <IssueList issues={issues} /> : null}

      {tab === "technical" ? (
        <div className="space-y-4">
          <IndexabilityFunnel pages={pages} measuredAt={measuredAt} />
          <InternalLinkDistribution pages={pages} />
          <IssueList
            issues={issues.filter((i) =>
              ["indexability", "technical", "links", "international", "mobile"].includes(
                i.category
              )
            )}
            showFilters={false}
          />
        </div>
      ) : null}

      {tab === "content" ? (
        <div className="space-y-4">
          <ContentQualityPanel pages={pages} />
          <IssueList
            issues={issues.filter((i) =>
              ["on_page", "content", "schema"].includes(i.category)
            )}
            showFilters={false}
          />
        </div>
      ) : null}

      {tab === "performance" ? (
        <CoreWebVitalsPanel
          perf={perf}
          measuredAt={measuredAt}
          psiConfigured={psiConfigured}
        />
      ) : null}

      {tab === "questions" ? (
        <div className="space-y-4">
          {run.phase_status.search_data === "degraded" ? (
            <DegradedNote>
              Search Console was not connected for this site, so nothing here reflects your
              actual rankings or impressions. The searches below are real, but we cannot show
              how you currently perform against them.
            </DegradedNote>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <IntentDonut queries={queries} />
            <div className="space-y-4">
              <QuestionClusters queries={queries} measuredAt={measuredAt} />
            </div>
          </div>
        </div>
      ) : null}

      {tab === "competitors" ? (
        <CompetitorMatrix
          competitors={competitors}
          pages={pages}
          ownDomain={site.domain}
        />
      ) : null}

      {tab === "pages" ? <PagesTable pages={pages} domain={site.domain} /> : null}

      {tab === "roadmap" ? <RoadmapBoard summary={run.summary} /> : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-gray-900",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium text-gray-500">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

export function ReportHeader({
  bundle,
  shareUrl,
}: {
  bundle: SeoRunBundle;
  shareUrl: string;
}) {
  const { run, site } = bundle;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[18px] font-semibold text-gray-900">{site.domain}</h1>
          <Chip
            tone={
              run.status === "ready"
                ? "good"
                : run.status === "failed"
                  ? "bad"
                  : run.status === "cancelled"
                    ? "muted"
                    : "info"
            }
          >
            {run.status === "ready" ? "Complete" : run.status}
          </Chip>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-gray-500">
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-700 hover:underline"
          >
            {site.url}
            <ExternalLink size={10} className="opacity-60" />
          </a>
          <span className="text-gray-300">|</span>
          <span>
            Audited{" "}
            {new Date(run.finished_at ?? run.created_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </p>
      </div>

      {run.status === "ready" ? (
        <div className="flex gap-2 print:hidden">
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ExternalLink size={12} />
            Client view
          </a>
          <a
            href={`${shareUrl}?print=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Printer size={12} />
            PDF
          </a>
        </div>
      ) : null}
    </div>
  );
}
