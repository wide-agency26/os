"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StoredPage } from "@/lib/seo/store";
import { Card, Chip, EmptyState, SectionLabel, SourceBadge } from "./primitives";

/**
 * How many of the crawled pages actually survive to be eligible for search.
 * Each step explains what dropped out and why, so the funnel reads without
 * needing to know what "indexable" means.
 */
export function IndexabilityFunnel({
  pages,
  measuredAt,
}: {
  pages: StoredPage[];
  measuredAt?: string | null;
}) {
  if (!pages.length) return <EmptyState message="No pages were crawled." />;

  const crawled = pages.length;
  const reachable = pages.filter(
    (p) => p.status_code !== null && p.status_code >= 200 && p.status_code < 300
  ).length;
  const indexable = pages.filter((p) => p.indexable).length;
  const inSitemap = pages.filter((p) => p.indexable && p.in_sitemap).length;

  const steps = [
    {
      label: "Pages found",
      value: crawled,
      explanation: "Every URL we reached by following links and reading the sitemap.",
    },
    {
      label: "Loaded successfully",
      value: reachable,
      explanation: `${crawled - reachable} returned an error or a redirect instead of a page.`,
    },
    {
      label: "Eligible for search",
      value: indexable,
      explanation: `${reachable - indexable} are blocked from search by a noindex tag or robots.txt.`,
    },
    {
      label: "Listed in the sitemap",
      value: inSitemap,
      explanation: `${indexable - inSitemap} eligible pages are missing from the sitemap, so they are found more slowly.`,
    },
  ];

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel>Indexability funnel</SectionLabel>
          <p className="mt-1 text-[12px] text-gray-600">
            Of everything we found, how much can actually appear in search results.
          </p>
        </div>
        <Chip tone={indexable / Math.max(crawled, 1) > 0.8 ? "good" : "warn"}>
          {Math.round((indexable / Math.max(crawled, 1)) * 100)}% eligible
        </Chip>
      </div>

      <div className="space-y-3">
        {steps.map((step) => {
          const pct = Math.round((step.value / Math.max(crawled, 1)) * 100);
          return (
            <div key={step.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium text-gray-800">{step.label}</span>
                <span className="text-[13px] font-semibold tabular-nums text-gray-900">
                  {step.value.toLocaleString()}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500">{step.explanation}</p>
            </div>
          );
        })}
      </div>

      <SourceBadge source="WIDE crawler" measuredAt={measuredAt} />
    </Card>
  );
}

/** Where internal link equity actually goes — exposes orphans and hubs. */
export function InternalLinkDistribution({ pages }: { pages: StoredPage[] }) {
  const eligible = pages.filter((p) => p.indexable);
  if (!eligible.length) return null;

  const buckets = [
    { label: "0 (orphan)", min: 0, max: 0 },
    { label: "1-2", min: 1, max: 2 },
    { label: "3-5", min: 3, max: 5 },
    { label: "6-10", min: 6, max: 10 },
    { label: "11-25", min: 11, max: 25 },
    { label: "26+", min: 26, max: Infinity },
  ].map((b) => ({
    name: b.label,
    pages: eligible.filter(
      (p) => p.internal_links_in >= b.min && p.internal_links_in <= b.max
    ).length,
    isOrphan: b.max === 0,
  }));

  const orphans = buckets[0].pages;

  return (
    <Card className="space-y-3">
      <div>
        <SectionLabel>Internal links pointing at each page</SectionLabel>
        <p className="mt-1 text-[12px] text-gray-600">
          Search engines treat a heavily linked page as more important. Pages with no
          internal links are effectively invisible.
        </p>
      </div>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "#f9fafb" }}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              formatter={(value) => [`${Number(value)} pages`, "Count"]}
            />
            <Bar dataKey="pages" radius={[4, 4, 0, 0]}>
              {buckets.map((b) => (
                <Cell key={b.name} fill={b.isOrphan ? "#dc2626" : "#3b82f6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {orphans > 0 ? (
        <p className="text-[12px] text-red-700">
          {orphans} {orphans === 1 ? "page has" : "pages have"} no internal links at all.
          These are listed under Priority fixes as orphan pages.
        </p>
      ) : (
        <p className="text-[12px] text-emerald-700">
          Every eligible page has at least one internal link pointing at it.
        </p>
      )}
    </Card>
  );
}

export function ContentQualityPanel({ pages }: { pages: StoredPage[] }) {
  const eligible = pages.filter((p) => p.indexable);
  if (!eligible.length) return <EmptyState message="No indexable pages to analyse." />;

  const titleBuckets = [
    { name: "Missing", count: eligible.filter((p) => !p.title).length, tone: "#dc2626" },
    {
      name: "Too short (<30)",
      count: eligible.filter((p) => p.title && p.title.length < 30).length,
      tone: "#d97706",
    },
    {
      name: "Ideal (30-60)",
      count: eligible.filter((p) => p.title && p.title.length >= 30 && p.title.length <= 60)
        .length,
      tone: "#059669",
    },
    {
      name: "Too long (>60)",
      count: eligible.filter((p) => p.title && p.title.length > 60).length,
      tone: "#d97706",
    },
  ];

  const metaBuckets = [
    {
      name: "Missing",
      count: eligible.filter((p) => !p.meta_description).length,
      tone: "#dc2626",
    },
    {
      name: "Too short (<70)",
      count: eligible.filter(
        (p) => p.meta_description && p.meta_description.length < 70
      ).length,
      tone: "#d97706",
    },
    {
      name: "Ideal (70-160)",
      count: eligible.filter(
        (p) =>
          p.meta_description &&
          p.meta_description.length >= 70 &&
          p.meta_description.length <= 160
      ).length,
      tone: "#059669",
    },
    {
      name: "Too long (>160)",
      count: eligible.filter(
        (p) => p.meta_description && p.meta_description.length > 160
      ).length,
      tone: "#d97706",
    },
  ];

  const wordBuckets = [
    { name: "Under 250", min: 0, max: 249 },
    { name: "250-600", min: 250, max: 600 },
    { name: "600-1200", min: 601, max: 1200 },
    { name: "1200+", min: 1201, max: Infinity },
  ].map((b) => ({
    name: b.name,
    count: eligible.filter(
      (p) => (p.word_count ?? 0) >= b.min && (p.word_count ?? 0) <= b.max
    ).length,
  }));

  const schemaCoverage = Math.round(
    (eligible.filter((p) => (p.schema_types ?? []).length > 0).length / eligible.length) * 100
  );

  const schemaTypes = new Map<string, number>();
  for (const page of eligible) {
    for (const type of page.schema_types ?? []) {
      schemaTypes.set(type, (schemaTypes.get(type) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionCard
          label="Title tag length"
          explanation="Titles between 30 and 60 characters display fully in search results without being cut off."
          buckets={titleBuckets}
          total={eligible.length}
        />
        <DistributionCard
          label="Meta description length"
          explanation="Descriptions between 70 and 160 characters give Google a complete snippet to show."
          buckets={metaBuckets}
          total={eligible.length}
        />
      </div>

      <Card className="space-y-3">
        <div>
          <SectionLabel>Content depth</SectionLabel>
          <p className="mt-1 text-[12px] text-gray-600">
            Word count per page. Pages under 250 words rarely answer a question completely
            enough to outrank a competitor, though some pages are legitimately short.
          </p>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wordBuckets} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "#f9fafb" }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                formatter={(value) => [`${Number(value)} pages`, "Count"]}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <SectionLabel>Structured data coverage</SectionLabel>
            <p className="mt-1 text-[12px] text-gray-600">
              Schema markup tells search engines what a page is, which is what earns rich
              results like star ratings, FAQs and breadcrumbs.
            </p>
          </div>
          <Chip tone={schemaCoverage >= 70 ? "good" : schemaCoverage >= 30 ? "warn" : "bad"}>
            {schemaCoverage}% of pages
          </Chip>
        </div>
        {schemaTypes.size ? (
          <div className="flex flex-wrap gap-1.5">
            {[...schemaTypes.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 16)
              .map(([type, count]) => (
                <span
                  key={type}
                  className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700"
                >
                  {type} <span className="text-gray-400">×{count}</span>
                </span>
              ))}
          </div>
        ) : (
          <p className="text-[12px] text-gray-500">
            No structured data was found anywhere on the site.
          </p>
        )}
      </Card>
    </div>
  );
}

function DistributionCard({
  label,
  explanation,
  buckets,
  total,
}: {
  label: string;
  explanation: string;
  buckets: { name: string; count: number; tone: string }[];
  total: number;
}) {
  return (
    <Card className="space-y-3">
      <div>
        <SectionLabel>{label}</SectionLabel>
        <p className="mt-1 text-[12px] text-gray-600">{explanation}</p>
      </div>
      <div className="space-y-2">
        {buckets.map((b) => {
          const pct = Math.round((b.count / Math.max(total, 1)) * 100);
          return (
            <div key={b.name} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-gray-700">{b.name}</span>
                <span className="text-[12px] font-semibold tabular-nums text-gray-900">
                  {b.count} <span className="font-normal text-gray-400">({pct}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: b.tone }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
