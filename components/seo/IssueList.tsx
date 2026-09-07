"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";
import type { SeoIssueRow } from "@/lib/seo/load-run";
import { Card, Chip, EmptyState, SeverityChip, type Tone } from "./primitives";

const CATEGORY_LABELS: Record<string, string> = {
  indexability: "Indexability",
  technical: "Technical",
  on_page: "On-page",
  content: "Content",
  performance: "Performance",
  mobile: "Mobile",
  schema: "Structured data",
  links: "Internal links",
  international: "International",
  search_presence: "Search presence",
  competitor: "Competitors",
};

const LEVEL_WORD: Record<number, string> = {
  1: "Very low",
  2: "Low",
  3: "Medium",
  4: "High",
  5: "Very high",
};

function effortWord(effort: number): string {
  if (effort <= 2) return "Quick";
  if (effort === 3) return "Moderate";
  return "Significant";
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      aria-label="Copy URL"
    >
      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
    </button>
  );
}

function StrikingDistanceTable({ evidence }: { evidence: Record<string, unknown> }) {
  const keywords = (evidence.keywords ?? []) as {
    query: string;
    position: number;
    impressions: number;
    clicks: number;
  }[];
  if (!keywords.length) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-[12px]">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Search term</th>
            <th className="px-3 py-2 text-right font-semibold">Position</th>
            <th className="px-3 py-2 text-right font-semibold">Impressions</th>
            <th className="px-3 py-2 text-right font-semibold">Clicks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {keywords.slice(0, 15).map((k) => (
            <tr key={k.query}>
              <td className="px-3 py-2 text-gray-800">{k.query}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                {k.position.toFixed(1)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                {k.impressions.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                {k.clicks.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContentGapList({ evidence }: { evidence: Record<string, unknown> }) {
  const clusters = (evidence.clusters ?? []) as {
    name: string;
    intent: string;
    example_questions: string[];
    suggested_page: string | null;
  }[];
  if (!clusters.length) return null;

  return (
    <div className="space-y-2">
      {clusters.map((c) => (
        <div key={c.name} className="rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-gray-900">{c.name}</span>
            <Chip tone="info">{c.intent}</Chip>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {c.example_questions.slice(0, 4).map((q) => (
              <li key={q} className="text-[12px] text-gray-600">
                “{q}”
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function IssueCard({
  issue,
  defaultOpen = false,
}: {
  issue: SeoIssueRow;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sampleUrls = Array.isArray(issue.sample_urls) ? issue.sample_urls : [];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-gray-50"
      >
        <ChevronDown
          size={16}
          className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityChip severity={issue.severity} />
            <span className="text-[13px] font-semibold text-gray-900">{issue.title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
            <span>{CATEGORY_LABELS[issue.category] ?? issue.category}</span>
            {issue.affected_count > 0 ? (
              <span>
                <strong className="font-semibold text-gray-700">
                  {issue.affected_count}
                </strong>{" "}
                {issue.affected_count === 1 ? "page" : "pages"} affected
              </span>
            ) : null}
            <span>
              Impact:{" "}
              <strong className="font-semibold text-gray-700">
                {LEVEL_WORD[issue.impact] ?? issue.impact}
              </strong>
            </span>
            <span>
              Effort:{" "}
              <strong className="font-semibold text-gray-700">
                {effortWord(issue.effort)}
              </strong>
            </span>
          </div>
        </div>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-gray-100 bg-gray-50/60 px-4 py-4 pl-11">
          {issue.what_it_means ? (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                What this means
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-700">
                {issue.what_it_means}
              </p>
            </div>
          ) : null}

          {issue.why_it_matters ? (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                Why it matters
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-700">
                {issue.why_it_matters}
              </p>
            </div>
          ) : null}

          {issue.how_to_fix ? (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                How to fix it
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-700">
                {issue.how_to_fix}
              </p>
            </div>
          ) : null}

          {issue.code === "striking_distance" ? (
            <StrikingDistanceTable evidence={issue.evidence ?? {}} />
          ) : null}
          {issue.code === "content_gap" ? (
            <ContentGapList evidence={issue.evidence ?? {}} />
          ) : null}

          {sampleUrls.length ? (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                Affected pages
                {issue.affected_count > sampleUrls.length
                  ? ` (showing ${sampleUrls.length} of ${issue.affected_count})`
                  : ""}
              </div>
              <ul className="mt-1.5 space-y-1">
                {sampleUrls.map((url) => (
                  <li key={url} className="flex items-center gap-1.5">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 truncate text-[12px] text-blue-700 hover:underline"
                    >
                      <span className="truncate">{url}</span>
                      <ExternalLink size={11} className="shrink-0 opacity-60" />
                    </a>
                    <CopyButton value={url} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function IssueList({
  issues,
  showFilters = true,
  limit,
}: {
  issues: SeoIssueRow[];
  showFilters?: boolean;
  limit?: number;
}) {
  const [severity, setSeverity] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(
    () => [...new Set(issues.map((i) => i.category))].sort(),
    [issues]
  );

  const filtered = useMemo(() => {
    let list = issues;
    if (severity !== "all") list = list.filter((i) => i.severity === severity);
    if (category !== "all") list = list.filter((i) => i.category === category);
    return limit ? list.slice(0, limit) : list;
  }, [issues, severity, category, limit]);

  if (!issues.length) {
    return <EmptyState message="No issues were found in this category — a good result." />;
  }

  const counts: { key: string; label: string; tone: Tone; n: number }[] = [
    { key: "critical", label: "Critical", tone: "bad", n: issues.filter((i) => i.severity === "critical").length },
    { key: "high", label: "High", tone: "bad", n: issues.filter((i) => i.severity === "high").length },
    { key: "medium", label: "Medium", tone: "warn", n: issues.filter((i) => i.severity === "medium").length },
    { key: "low", label: "Low", tone: "muted", n: issues.filter((i) => i.severity === "low").length },
    { key: "info", label: "Opportunity", tone: "info", n: issues.filter((i) => i.severity === "info").length },
  ];

  return (
    <div className="space-y-4">
      {showFilters ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSeverity("all")}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                severity === "all"
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              All {issues.length}
            </button>
            {counts
              .filter((c) => c.n > 0)
              .map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSeverity(severity === c.key ? "all" : c.key)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                    severity === c.key
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {c.label} {c.n}
                </button>
              ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Area
            </span>
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                category === "all"
                  ? "border-gray-400 bg-gray-100 text-gray-900"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(category === c ? "all" : c)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                  category === c
                    ? "border-gray-400 bg-gray-100 text-gray-900"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {CATEGORY_LABELS[c] ?? c}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {filtered.length ? (
        <div className="space-y-2">
          {filtered.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      ) : (
        <EmptyState message="No issues match the selected filters." />
      )}
    </div>
  );
}
