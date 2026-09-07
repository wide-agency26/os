"use client";

import type { SeoCompetitorRow } from "@/lib/seo/load-run";
import type { StoredPage } from "@/lib/seo/store";
import { Card, Chip, EmptyState, SectionLabel, formatMs } from "./primitives";

type Row = {
  domain: string;
  isUs: boolean;
  pages: number;
  avgWords: number;
  avgTitle: number;
  schemaPct: number;
  metaPct: number;
  ttfb: number;
  topics: { term: string; count: number }[];
  gaps: string[];
  error: string | null;
};

const COLUMNS: { key: keyof Row; label: string; explanation: string; format: (r: Row) => string }[] = [
  {
    key: "pages",
    label: "Pages found",
    explanation: "How much indexable content each site publishes.",
    format: (r) => r.pages.toLocaleString(),
  },
  {
    key: "avgWords",
    label: "Avg. words per page",
    explanation: "Depth of content. Consistently thin pages struggle against fuller ones.",
    format: (r) => r.avgWords.toLocaleString(),
  },
  {
    key: "avgTitle",
    label: "Avg. title length",
    explanation: "Titles near 50-60 characters use the space search results give them.",
    format: (r) => `${r.avgTitle} chars`,
  },
  {
    key: "schemaPct",
    label: "Structured data",
    explanation: "Share of pages with schema markup, which earns rich results.",
    format: (r) => `${r.schemaPct}%`,
  },
  {
    key: "metaPct",
    label: "Meta descriptions",
    explanation: "Share of pages that control their own search snippet.",
    format: (r) => `${r.metaPct}%`,
  },
  {
    key: "ttfb",
    label: "Server response",
    explanation: "How quickly the server starts replying. Lower is better.",
    format: (r) => formatMs(r.ttfb),
  },
];

function buildOwnRow(pages: StoredPage[], domain: string): Row {
  const ok = pages.filter(
    (p) => p.status_code !== null && p.status_code >= 200 && p.status_code < 300
  );
  const avg = (values: number[]) => {
    const valid = values.filter((v) => v > 0);
    return valid.length ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length) : 0;
  };
  const pct = (n: number) => (ok.length ? Math.round((n / ok.length) * 100) : 0);

  return {
    domain,
    isUs: true,
    pages: ok.length,
    avgWords: avg(ok.map((p) => p.word_count ?? 0)),
    avgTitle: avg(ok.map((p) => p.title?.length ?? 0)),
    schemaPct: pct(ok.filter((p) => (p.schema_types ?? []).length > 0).length),
    metaPct: pct(ok.filter((p) => p.meta_description).length),
    ttfb: avg(ok.map((p) => p.ttfb_ms ?? 0)),
    topics: [],
    gaps: [],
    error: null,
  };
}

export function CompetitorMatrix({
  competitors,
  pages,
  ownDomain,
}: {
  competitors: SeoCompetitorRow[];
  pages: StoredPage[];
  ownDomain: string;
}) {
  if (!competitors.length) {
    return (
      <EmptyState message="No competitors were included in this run. Add competitor domains under Advanced options when starting an audit to see a side-by-side comparison." />
    );
  }

  const ready = competitors.filter((c) => c.status === "ready");
  const failed = competitors.filter((c) => c.status !== "ready");

  const rows: Row[] = [
    buildOwnRow(pages, ownDomain),
    ...ready.map((c) => ({
      domain: c.domain,
      isUs: false,
      pages: Number(c.metrics?.pages_crawled ?? 0),
      avgWords: Number(c.metrics?.avg_word_count ?? 0),
      avgTitle: Number(c.metrics?.avg_title_length ?? 0),
      schemaPct: Number(c.metrics?.schema_coverage_pct ?? 0),
      metaPct: Number(c.metrics?.meta_coverage_pct ?? 0),
      ttfb: Number(c.metrics?.avg_ttfb_ms ?? 0),
      topics: c.topics ?? [],
      gaps: c.overlap?.gaps ?? [],
      error: c.error,
    })),
  ];

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <SectionLabel>Side-by-side comparison</SectionLabel>
          <p className="mt-1 text-[12px] text-gray-600">
            Each competitor was crawled the same way your site was, so these numbers are
            directly comparable. Your row is highlighted.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-3 text-left font-semibold">Metric</th>
                {rows.map((r) => (
                  <th
                    key={r.domain}
                    className={`px-3 py-2 text-right font-semibold ${
                      r.isUs ? "text-gray-900" : ""
                    }`}
                  >
                    {r.domain}
                    {r.isUs ? (
                      <span className="ml-1 text-[10px] font-normal text-blue-600">you</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {COLUMNS.map((col) => (
                <tr key={col.key as string}>
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-gray-800">{col.label}</div>
                    <div className="text-[11px] text-gray-500">{col.explanation}</div>
                  </td>
                  {rows.map((r) => (
                    <td
                      key={r.domain}
                      className={`px-3 py-2.5 text-right tabular-nums ${
                        r.isUs ? "bg-blue-50/50 font-semibold text-gray-900" : "text-gray-700"
                      }`}
                    >
                      {col.format(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {ready.some((c) => (c.overlap?.gaps ?? []).length) ? (
        <Card className="space-y-3">
          <div>
            <SectionLabel>Topics they cover and you do not</SectionLabel>
            <p className="mt-1 text-[12px] text-gray-600">
              Terms that appear repeatedly across a competitor&apos;s page titles and
              headings but nowhere in yours. Each one is a candidate for a new page.
            </p>
          </div>
          <div className="space-y-3">
            {ready
              .filter((c) => (c.overlap?.gaps ?? []).length)
              .map((c) => (
                <div key={c.domain} className="space-y-1.5">
                  <div className="text-[12px] font-semibold text-gray-800">{c.domain}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(c.overlap?.gaps ?? []).map((term) => (
                      <span
                        key={term}
                        className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      ) : null}

      {failed.length ? (
        <Card className="space-y-2">
          <SectionLabel>Could not be crawled</SectionLabel>
          {failed.map((c) => (
            <div key={c.domain} className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-gray-800">{c.domain}</span>
              <Chip tone="muted">{c.status}</Chip>
              <span className="text-[12px] text-gray-500">
                {c.error ?? "No pages could be read."}
              </span>
            </div>
          ))}
          <p className="text-[11px] text-gray-500">
            Sites behind a bot filter or a strict robots.txt cannot be audited from here.
            That is a limitation of the comparison, not a finding about their SEO.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
