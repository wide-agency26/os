"use client";

import { useMemo, useState } from "react";
import { CWV_THRESHOLDS, rateCwv, type CwvMetric } from "@/lib/seo/constants";
import type { SeoPerfRow } from "@/lib/seo/load-run";
import {
  Card,
  Chip,
  NotConnectedCard,
  SectionLabel,
  SourceBadge,
  formatMs,
  scoreTone,
  type Tone,
} from "./primitives";

const RATING_TONE: Record<string, Tone> = {
  good: "good",
  "needs-improvement": "warn",
  poor: "bad",
};

const RATING_LABEL: Record<string, string> = {
  good: "Good",
  "needs-improvement": "Needs work",
  poor: "Poor",
};

const METRIC_COPY: Record<
  CwvMetric,
  { name: string; short: string; explanation: string }
> = {
  lcp: {
    name: "Largest Contentful Paint",
    short: "LCP",
    explanation:
      "How long until the main content is visible. This is what a visitor experiences as 'the page loaded'.",
  },
  inp: {
    name: "Interaction to Next Paint",
    short: "INP",
    explanation:
      "How quickly the page responds when someone taps or clicks. Slow values feel like a broken page.",
  },
  cls: {
    name: "Cumulative Layout Shift",
    short: "CLS",
    explanation:
      "How much content jumps around while loading. Shifting layouts cause mis-clicks and frustration.",
  },
  fcp: {
    name: "First Contentful Paint",
    short: "FCP",
    explanation: "How long until anything at all appears on screen.",
  },
  ttfb: {
    name: "Time to First Byte",
    short: "TTFB",
    explanation:
      "How long the server takes to start responding, before any rendering can begin.",
  },
};

function formatMetric(metric: CwvMetric, value: number | null): string {
  if (value === null) return "—";
  return metric === "cls" ? value.toFixed(3) : formatMs(value);
}

function thresholdText(metric: CwvMetric): string {
  const t = CWV_THRESHOLDS[metric];
  return metric === "cls"
    ? `Google's targets: good under ${t.good}, poor above ${t.poor}`
    : `Google's targets: good under ${formatMs(t.good)}, poor above ${formatMs(t.poor)}`;
}

function VitalCard({
  metric,
  field,
  lab,
}: {
  metric: CwvMetric;
  field: number | null;
  lab: number | null;
}) {
  const copy = METRIC_COPY[metric];
  // Field data is what Google actually uses for ranking, so it leads.
  const primary = field ?? lab;
  const rating = rateCwv(metric, primary);
  const isCore = metric === "lcp" || metric === "inp" || metric === "cls";

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <SectionLabel>{copy.short}</SectionLabel>
            {isCore ? <Chip tone="info">Ranking factor</Chip> : null}
          </div>
          <div className="mt-0.5 text-[11px] text-gray-500">{copy.name}</div>
        </div>
        {rating ? <Chip tone={RATING_TONE[rating]}>{RATING_LABEL[rating]}</Chip> : null}
      </div>

      <div className="text-2xl font-semibold tabular-nums text-gray-900">
        {formatMetric(metric, primary)}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-gray-500">
        <span>
          Real users:{" "}
          <strong className="font-semibold text-gray-700">
            {formatMetric(metric, field)}
          </strong>
        </span>
        <span>
          Lab test:{" "}
          <strong className="font-semibold text-gray-700">
            {formatMetric(metric, lab)}
          </strong>
        </span>
      </div>

      <div className="text-[11px] text-gray-500">{thresholdText(metric)}</div>
      <p className="text-[12px] leading-relaxed text-gray-600">{copy.explanation}</p>
    </Card>
  );
}

function average(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

export function CoreWebVitalsPanel({
  perf,
  measuredAt,
  psiConfigured,
}: {
  perf: SeoPerfRow[];
  measuredAt?: string | null;
  psiConfigured: boolean;
}) {
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");

  const scoped = useMemo(
    () => perf.filter((p) => p.strategy === strategy),
    [perf, strategy]
  );
  const pageSamples = scoped.filter((p) => p.scope === "page");
  const originSample = scoped.find((p) => p.scope === "origin") ?? null;

  const opportunities = useMemo(() => {
    const totals = new Map<string, { title: string; savings: number; pages: number; description: string }>();
    for (const sample of pageSamples) {
      for (const opp of sample.opportunities ?? []) {
        const existing = totals.get(opp.id);
        if (existing) {
          existing.savings += opp.savingsMs;
          existing.pages += 1;
        } else {
          totals.set(opp.id, {
            title: opp.title,
            savings: opp.savingsMs,
            pages: 1,
            description: opp.description,
          });
        }
      }
    }
    return [...totals.values()].sort((a, b) => b.savings - a.savings).slice(0, 10);
  }, [pageSamples]);

  if (!psiConfigured) {
    return (
      <NotConnectedCard
        title="Speed and Core Web Vitals"
        reason="The PageSpeed Insights API key is not configured, so no performance data was collected for this run."
        wouldGive="Google's own Lighthouse scores plus real-user Core Web Vitals for a representative sample of pages, on both mobile and desktop, with a ranked list of the specific fixes that would save the most load time."
        action="Add PAGESPEED_API_KEY to the environment. The API is free for up to 25,000 requests per day."
      />
    );
  }

  if (!perf.length) {
    return (
      <NotConnectedCard
        title="Speed and Core Web Vitals"
        reason="The performance phase did not return any measurements for this run."
        wouldGive="Lighthouse scores and real-user Core Web Vitals for the site's main page templates."
        action="Re-run the audit to try again."
      />
    );
  }

  const perfScore = average(pageSamples.map((p) => p.performance_score));
  const hasFieldData = scoped.some((p) => p.has_field_data);

  const fieldLcp = originSample?.field_lcp_ms ?? average(pageSamples.map((p) => p.field_lcp_ms));
  const fieldInp = originSample?.field_inp_ms ?? average(pageSamples.map((p) => p.field_inp_ms));
  const fieldCls = originSample?.field_cls ?? average(pageSamples.map((p) => p.field_cls));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          {(["mobile", "desktop"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStrategy(s)}
              className={`rounded-md px-3 py-1 text-[12px] font-medium capitalize transition-colors ${
                strategy === s
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {perfScore !== null ? (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-gray-500">Lighthouse performance score</span>
            <span className="text-lg font-semibold tabular-nums text-gray-900">
              {Math.round(perfScore)}
            </span>
            <Chip tone={scoreTone(perfScore)}>
              {perfScore >= 90 ? "Fast" : perfScore >= 50 ? "Needs work" : "Slow"}
            </Chip>
          </div>
        ) : null}
      </div>

      {!hasFieldData ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="text-[12px] leading-relaxed text-blue-900">
            <strong className="font-semibold">Lab data only.</strong> Google has not
            collected enough real visitor data for this site to report field measurements,
            which usually means lower traffic. The numbers below come from a simulated test
            on Google&apos;s servers — directionally right, but a real visitor&apos;s
            experience may differ.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <VitalCard
          metric="lcp"
          field={fieldLcp}
          lab={average(pageSamples.map((p) => p.lab_lcp_ms))}
        />
        <VitalCard metric="inp" field={fieldInp} lab={null} />
        <VitalCard
          metric="cls"
          field={fieldCls}
          lab={average(pageSamples.map((p) => p.lab_cls))}
        />
        <VitalCard
          metric="fcp"
          field={null}
          lab={average(pageSamples.map((p) => p.lab_fcp_ms))}
        />
        <VitalCard
          metric="ttfb"
          field={originSample?.field_ttfb_ms ?? null}
          lab={average(pageSamples.map((p) => p.lab_ttfb_ms))}
        />
      </div>

      {opportunities.length ? (
        <Card className="space-y-3">
          <div>
            <SectionLabel>Biggest speed wins</SectionLabel>
            <p className="mt-1 text-[12px] text-gray-600">
              Ranked by the total load time saved across the pages we tested. Start at the
              top.
            </p>
          </div>
          <div className="space-y-2">
            {opportunities.map((opp) => (
              <div
                key={opp.title}
                className="rounded-lg border border-gray-200 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[13px] font-medium text-gray-900">{opp.title}</span>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-emerald-700">
                    saves ~{formatMs(opp.savings)}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-gray-600">
                  {opp.description}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  Found on {opp.pages} of {pageSamples.length} tested pages
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {pageSamples.length ? (
        <Card className="space-y-3">
          <SectionLabel>Pages tested</SectionLabel>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="text-gray-500">
                <tr className="border-b border-gray-100">
                  <th className="py-2 pr-3 text-left font-semibold">Page</th>
                  <th className="px-2 py-2 text-right font-semibold">Score</th>
                  <th className="px-2 py-2 text-right font-semibold">LCP</th>
                  <th className="px-2 py-2 text-right font-semibold">CLS</th>
                  <th className="py-2 pl-2 text-right font-semibold">Blocking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageSamples.map((p) => (
                  <tr key={p.url}>
                    <td className="max-w-[280px] truncate py-2 pr-3 text-gray-800">
                      {p.url}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      <span
                        className={
                          (p.performance_score ?? 0) >= 90
                            ? "text-emerald-700"
                            : (p.performance_score ?? 0) >= 50
                              ? "text-amber-700"
                              : "text-red-700"
                        }
                      >
                        {p.performance_score ?? "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-700">
                      {formatMs(p.lab_lcp_ms)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-700">
                      {p.lab_cls === null ? "—" : p.lab_cls.toFixed(3)}
                    </td>
                    <td className="py-2 pl-2 text-right tabular-nums text-gray-700">
                      {formatMs(p.lab_tbt_ms)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <SourceBadge
        source="Google PageSpeed Insights (lab) and Chrome UX Report (real users)"
        measuredAt={measuredAt}
        note={`${strategy} results`}
      />
    </div>
  );
}
