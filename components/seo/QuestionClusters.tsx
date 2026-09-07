"use client";

import { useMemo, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { SeoQueryRow } from "@/lib/seo/load-run";
import { Card, Chip, EmptyState, SectionLabel, SourceBadge, type Tone } from "./primitives";

const SOURCE_LABELS: Record<string, string> = {
  google_suggest: "Google",
  bing_suggest: "Bing",
  youtube_suggest: "YouTube",
  reddit: "Reddit",
  stackexchange: "Stack Exchange",
  gsc: "Search Console",
  seed: "Seed",
  ai: "AI",
};

const INTENT_COPY: Record<string, { label: string; color: string; meaning: string }> = {
  informational: {
    label: "Informational",
    color: "#3b82f6",
    meaning: "Looking to learn something. Best answered with a guide or explainer.",
  },
  commercial: {
    label: "Commercial",
    color: "#8b5cf6",
    meaning: "Comparing options before deciding. Best answered with comparisons and proof.",
  },
  transactional: {
    label: "Transactional",
    color: "#059669",
    meaning: "Ready to act. Best answered with a service, pricing or contact page.",
  },
  navigational: {
    label: "Navigational",
    color: "#6b7280",
    meaning: "Looking for a specific page or brand.",
  },
};

const COVERAGE_TONE: Record<string, Tone> = {
  covered: "good",
  partial: "warn",
  gap: "bad",
};

const COVERAGE_LABEL: Record<string, string> = {
  covered: "Covered",
  partial: "Partly covered",
  gap: "Gap",
};

export function IntentDonut({ queries }: { queries: SeoQueryRow[] }) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of queries) {
      const intent = q.intent ?? "informational";
      counts.set(intent, (counts.get(intent) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([intent, value]) => ({
        name: INTENT_COPY[intent]?.label ?? intent,
        intent,
        value,
        color: INTENT_COPY[intent]?.color ?? "#9ca3af",
      }))
      .sort((a, b) => b.value - a.value);
  }, [queries]);

  if (!data.length) return null;

  return (
    <Card className="space-y-3">
      <div>
        <SectionLabel>What people are trying to do</SectionLabel>
        <p className="mt-1 text-[12px] text-gray-600">
          Every search has an intent behind it. Matching the page type to the intent is what
          makes a page rank.
        </p>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.intent} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              formatter={(value, name) => [`${Number(value)} searches`, String(name)]}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1 border-t border-gray-100 pt-3">
        {data.map((d) => (
          <p key={d.intent} className="text-[11px] text-gray-600">
            <span
              className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
              style={{ backgroundColor: d.color }}
            />
            <strong className="font-semibold text-gray-800">{d.name}:</strong>{" "}
            {INTENT_COPY[d.intent]?.meaning}
          </p>
        ))}
      </div>
    </Card>
  );
}

function ClusterCard({
  name,
  queries,
}: {
  name: string;
  queries: SeoQueryRow[];
}) {
  const [open, setOpen] = useState(false);

  const coverage = queries[0]?.coverage ?? "gap";
  const mappedPage = queries.find((q) => q.mapped_page_url)?.mapped_page_url ?? null;
  const intent = queries[0]?.intent ?? "informational";
  const questions = queries.filter((q) => q.is_question);
  const shown = open ? queries : queries.slice(0, 5);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-[13px] font-semibold capitalize text-gray-900">{name}</h4>
          <Chip tone={COVERAGE_TONE[coverage]}>{COVERAGE_LABEL[coverage]}</Chip>
          <Chip tone="info">{INTENT_COPY[intent]?.label ?? intent}</Chip>
        </div>

        <p className="text-[12px] text-gray-500">
          {queries.length} {queries.length === 1 ? "search" : "searches"}
          {questions.length ? `, ${questions.length} phrased as questions` : ""}
        </p>

        {coverage === "gap" ? (
          <p className="text-[12px] leading-relaxed text-red-700">
            Nothing on the site answers this. Creating one focused page for this cluster is
            the opportunity.
          </p>
        ) : mappedPage ? (
          <p className="flex items-center gap-1 text-[12px] text-gray-600">
            Answered by{" "}
            <a
              href={mappedPage}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 items-center gap-1 truncate text-blue-700 hover:underline"
            >
              <span className="truncate">{mappedPage}</span>
              <ExternalLink size={11} className="shrink-0 opacity-60" />
            </a>
          </p>
        ) : null}

        <ul className="space-y-1 pt-1">
          {shown.map((q) => (
            <li key={q.query} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-gray-700">“{q.query}”</span>
              {(q.sources ?? []).slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="rounded border border-gray-200 bg-gray-50 px-1 py-px text-[10px] text-gray-500"
                >
                  {SOURCE_LABELS[s] ?? s}
                </span>
              ))}
              {q.gsc_position ? (
                <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[10px] text-emerald-700">
                  ranks #{q.gsc_position.toFixed(0)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        {queries.length > 5 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-700 hover:underline"
          >
            <ChevronDown
              size={13}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
            {open ? "Show fewer" : `Show all ${queries.length}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function QuestionClusters({
  queries,
  measuredAt,
}: {
  queries: SeoQueryRow[];
  measuredAt?: string | null;
}) {
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [onlyQuestions, setOnlyQuestions] = useState(false);

  const clusters = useMemo(() => {
    const map = new Map<string, SeoQueryRow[]>();
    for (const q of queries) {
      if (onlyQuestions && !q.is_question) continue;
      const key = q.cluster ?? "Ungrouped searches";
      const bucket = map.get(key);
      if (bucket) bucket.push(q);
      else map.set(key, [q]);
    }
    return [...map.entries()]
      .filter(([, items]) => (onlyGaps ? items[0]?.coverage === "gap" : true))
      .sort((a, b) => b[1].length - a[1].length);
  }, [queries, onlyGaps, onlyQuestions]);

  if (!queries.length) {
    return (
      <EmptyState message="No demand data was collected for this run. The question engine may have been switched off, or no usable seed terms were found." />
    );
  }

  const gapCount = clusters.filter(([, items]) => items[0]?.coverage === "gap").length;

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <SectionLabel>How to read this</SectionLabel>
        <p className="text-[12px] leading-relaxed text-gray-600">
          These are real searches, collected from Google, Bing and YouTube autocomplete plus
          Reddit and Stack Exchange discussions — the actual wording people use, not keywords
          we invented. Clusters marked <strong>Gap</strong> have no page on your site
          answering them.
        </p>
        <p className="text-[12px] leading-relaxed text-gray-500">
          Ordering within autocomplete reflects relative popularity, so it is shown as a
          popularity signal. It is deliberately <strong>not</strong> labelled as monthly
          search volume, which needs a paid data source.
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOnlyGaps((v) => !v)}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
            onlyGaps
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          }`}
        >
          Gaps only {gapCount > 0 ? `(${gapCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setOnlyQuestions((v) => !v)}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
            onlyQuestions
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          }`}
        >
          Questions only
        </button>
        <span className="text-[11px] text-gray-500">
          {clusters.length} {clusters.length === 1 ? "cluster" : "clusters"} ·{" "}
          {queries.length} searches
        </span>
      </div>

      {clusters.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {clusters.map(([name, items]) => (
            <ClusterCard key={name} name={name} queries={items} />
          ))}
        </div>
      ) : (
        <EmptyState message="No clusters match the selected filters." />
      )}

      <SourceBadge
        source="Google, Bing and YouTube autocomplete, Reddit, Stack Exchange"
        measuredAt={measuredAt}
      />
    </div>
  );
}
