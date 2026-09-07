"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Circle,
  Loader2,
  MinusCircle,
  RotateCw,
  X,
} from "lucide-react";
import { cancelSeoRun, pollSeoRun, retrySeoRun } from "@/app/actions/seo-run";
import { PHASE_LABELS } from "@/lib/seo/constants";
import { SEO_PHASES, type PhaseOutcome, type SeoPhase } from "@/lib/seo/types";
import type { SeoRunEventRow } from "@/lib/seo/load-run";
import type { PhaseStatusMap, SeoRunStats, SeoRunStatus } from "@/lib/seo/types";
import { Card, Chip, SectionLabel } from "./primitives";

type Progress = {
  status: SeoRunStatus;
  phase: string;
  phase_status: PhaseStatusMap;
  progress_pct: number;
  stats: SeoRunStats;
  error_message: string | null;
  events: SeoRunEventRow[];
};

const PHASE_EXPLANATIONS: Record<SeoPhase, string> = {
  discover: "Reading robots.txt and the sitemap to build a list of pages.",
  crawl: "Visiting each page and recording what is on it.",
  analyze: "Comparing pages against each other to find site-wide problems.",
  performance: "Measuring real load speed through Google's own testing service.",
  search_data: "Pulling actual search performance from Search Console.",
  questions: "Collecting the real questions people search for around this topic.",
  competitors: "Crawling competitor sites for a like-for-like comparison.",
  synthesize: "Grouping findings into topics and writing the action plan.",
  score: "Calculating the final scores.",
};

function PhaseIcon({ outcome }: { outcome: PhaseOutcome }) {
  if (outcome === "running") {
    return <Loader2 size={14} className="animate-spin text-blue-600" />;
  }
  if (outcome === "done") return <Check size={14} className="text-emerald-600" />;
  if (outcome === "degraded") return <AlertTriangle size={14} className="text-amber-600" />;
  if (outcome === "failed") return <X size={14} className="text-red-600" />;
  if (outcome === "skipped") return <MinusCircle size={14} className="text-gray-300" />;
  return <Circle size={14} className="text-gray-300" />;
}

function activeCounter(phase: string, stats: SeoRunStats, maxPages: number): string | null {
  if (phase === "crawl") {
    return `Crawled ${(stats.pages_crawled ?? 0).toLocaleString()} of up to ${maxPages.toLocaleString()} pages`;
  }
  if (phase === "questions" && stats.queries_found) {
    return `Collected ${stats.queries_found.toLocaleString()} searches`;
  }
  if (phase === "performance" && stats.perf_samples) {
    return `${stats.perf_samples} speed measurements taken`;
  }
  return null;
}

export function RunProgress({
  runId,
  initial,
  maxPages,
}: {
  runId: string;
  initial: Progress;
  maxPages: number;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>(initial);
  const [pending, startTransition] = useTransition();
  const wasRunning = useRef(true);

  useEffect(() => {
    if (progress.status !== "queued" && progress.status !== "running") {
      // Pull the finished report in once the run settles.
      if (wasRunning.current) {
        wasRunning.current = false;
        router.refresh();
      }
      return;
    }

    const timer = setInterval(async () => {
      const next = await pollSeoRun(runId);
      if (next) setProgress(next as Progress);
    }, 3000);

    return () => clearInterval(timer);
  }, [runId, progress.status, router]);

  const isActive = progress.status === "queued" || progress.status === "running";
  const counter = activeCounter(progress.phase, progress.stats, maxPages);

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isActive ? <Loader2 size={15} className="animate-spin text-blue-600" /> : null}
              <h3 className="text-[14px] font-semibold text-gray-900">
                {progress.status === "queued"
                  ? "Queued"
                  : progress.status === "running"
                    ? PHASE_LABELS[progress.phase as SeoPhase] ?? "Working"
                    : progress.status === "failed"
                      ? "Audit failed"
                      : progress.status === "cancelled"
                        ? "Audit cancelled"
                        : "Audit complete"}
              </h3>
              <Chip
                tone={
                  progress.status === "ready"
                    ? "good"
                    : progress.status === "failed"
                      ? "bad"
                      : progress.status === "cancelled"
                        ? "muted"
                        : "info"
                }
              >
                {progress.progress_pct}%
              </Chip>
            </div>
            {counter ? <p className="text-[12px] text-gray-600">{counter}</p> : null}
            {isActive ? (
              <p className="text-[12px] text-gray-500">
                This runs in the background — you can close this page and come back to it.
                Sections below unlock as each stage finishes.
              </p>
            ) : null}
          </div>

          <div className="flex gap-2">
            {isActive ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await cancelSeoRun(runId);
                    router.refresh();
                  })
                }
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            ) : null}
            {progress.status === "failed" || progress.status === "cancelled" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await retrySeoRun(runId);
                    router.refresh();
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                <RotateCw size={12} />
                Retry
              </button>
            ) : null}
          </div>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress.progress_pct}%` }}
          />
        </div>

        {progress.error_message ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-[12px] text-red-800">{progress.error_message}</p>
          </div>
        ) : null}

        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {SEO_PHASES.map((phase) => {
            const outcome: PhaseOutcome =
              progress.phase_status[phase] ??
              (progress.phase === phase && progress.status === "running"
                ? "running"
                : "pending");
            const muted = outcome === "pending" || outcome === "skipped";
            return (
              <div key={phase} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  <PhaseIcon outcome={outcome} />
                </span>
                <div className="min-w-0">
                  <div
                    className={`text-[12px] font-medium ${
                      muted ? "text-gray-400" : "text-gray-800"
                    }`}
                  >
                    {PHASE_LABELS[phase]}
                    {outcome === "degraded" ? (
                      <span className="ml-1.5 text-[11px] font-normal text-amber-700">
                        partial
                      </span>
                    ) : null}
                    {outcome === "skipped" ? (
                      <span className="ml-1.5 text-[11px] font-normal text-gray-400">
                        skipped
                      </span>
                    ) : null}
                  </div>
                  {outcome === "running" ? (
                    <p className="text-[11px] text-gray-500">
                      {PHASE_EXPLANATIONS[phase]}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {progress.events.length ? (
        <Card className="space-y-2">
          <SectionLabel>Activity</SectionLabel>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {progress.events.map((event) => (
              <div key={event.id} className="flex items-start gap-2 text-[12px]">
                <span className="shrink-0 tabular-nums text-gray-400">
                  {new Date(event.created_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span
                  className={
                    event.level === "error"
                      ? "text-red-700"
                      : event.level === "warn"
                        ? "text-amber-700"
                        : "text-gray-700"
                  }
                >
                  {event.message}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
