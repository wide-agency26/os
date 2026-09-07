import { crawlSlice } from "./crawl/crawl";
import { loadRobots } from "./crawl/robots";
import { discoverSitemapUrls } from "./crawl/sitemap";
import type { CrawledPage } from "./types";
import type { StoredPage } from "./store";
import { canonicalizeUrl, domainOf, normalizeSiteUrl, originOf } from "./url";

export type CompetitorMetrics = {
  pages_crawled: number;
  avg_word_count: number;
  avg_title_length: number;
  schema_coverage_pct: number;
  meta_coverage_pct: number;
  h1_coverage_pct: number;
  avg_ttfb_ms: number;
  indexable_pages: number;
};

export type CompetitorSnapshot = {
  domain: string;
  url: string;
  status: "ready" | "failed";
  pagesCrawled: number;
  metrics: CompetitorMetrics;
  topics: { term: string; count: number }[];
  error: string | null;
};

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "your", "our", "you", "are", "from", "that", "this",
  "how", "why", "what", "all", "new", "get", "can", "has", "have", "was", "were",
  "home", "page", "about", "contact", "welcome", "index", "more", "best", "top",
  "services", "service", "solutions", "company", "gmbh", "ltd", "inc",
]);

function extractTopics(
  entries: { title: string | null; headings: string[] }[],
  limit = 25
): { term: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const text = [entry.title ?? "", ...entry.headings].join(" ").toLowerCase();
    for (const word of text.split(/[^a-z0-9]+/)) {
      if (word.length < 4 || word.length > 22 || STOP_WORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function average(values: number[]): number {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
}

function percentage(matching: number, total: number): number {
  if (!total) return 0;
  return Math.round((matching / total) * 100);
}

/**
 * A reduced-depth crawl of a competitor. We are only after a content and
 * technical profile to compare against, so 50 pages is plenty — and it keeps us
 * polite on a site that has not asked to be audited.
 */
export async function crawlCompetitor(
  rawUrl: string,
  maxPages: number,
  deadline: number
): Promise<CompetitorSnapshot> {
  let siteUrl: string;
  try {
    siteUrl = normalizeSiteUrl(rawUrl);
  } catch {
    return {
      domain: rawUrl,
      url: rawUrl,
      status: "failed",
      pagesCrawled: 0,
      metrics: emptyMetrics(),
      topics: [],
      error: "Invalid URL",
    };
  }

  const domain = domainOf(siteUrl);

  try {
    const robots = await loadRobots(siteUrl);
    const sitemap = await discoverSitemapUrls(siteUrl, robots.sitemaps);

    const home = canonicalizeUrl(siteUrl) ?? siteUrl;
    const seeded = [
      { url: home, depth: 0 },
      ...sitemap.urls.slice(0, maxPages).map((u) => ({ url: u, depth: 1 })),
    ];

    const collected: CrawledPage[] = [];
    const result = await crawlSlice({
      siteUrl,
      frontier: seeded,
      visited: new Set<string>(),
      sitemapSet: new Set(sitemap.urls),
      robots,
      maxPages,
      maxDepth: 3,
      deadline,
      crawlDelayMs: robots.crawlDelayMs,
      inboundCounts: {},
      onBatch: async (pages) => {
        collected.push(...pages);
      },
    });

    const ok = collected.filter(
      (p) => p.statusCode !== null && p.statusCode >= 200 && p.statusCode < 300
    );

    if (!ok.length) {
      return {
        domain,
        url: siteUrl,
        status: "failed",
        pagesCrawled: 0,
        metrics: emptyMetrics(),
        topics: [],
        error: "No pages could be crawled — the site may block automated requests.",
      };
    }

    const metrics: CompetitorMetrics = {
      pages_crawled: ok.length,
      avg_word_count: average(ok.map((p) => p.wordCount)),
      avg_title_length: average(ok.map((p) => p.title?.length ?? 0)),
      schema_coverage_pct: percentage(ok.filter((p) => p.schemaTypes.length > 0).length, ok.length),
      meta_coverage_pct: percentage(ok.filter((p) => p.metaDescription).length, ok.length),
      h1_coverage_pct: percentage(ok.filter((p) => p.h1s.length > 0).length, ok.length),
      avg_ttfb_ms: average(ok.map((p) => p.ttfbMs ?? 0)),
      indexable_pages: ok.filter((p) => p.indexable).length,
    };

    return {
      domain,
      url: siteUrl,
      status: "ready",
      pagesCrawled: result.crawled,
      metrics,
      topics: extractTopics(
        ok.map((p) => ({ title: p.title, headings: p.headingOutline.map((h) => h.text) }))
      ),
      error: null,
    };
  } catch (e) {
    return {
      domain,
      url: siteUrl,
      status: "failed",
      pagesCrawled: 0,
      metrics: emptyMetrics(),
      topics: [],
      error: e instanceof Error ? e.message : "Competitor crawl failed",
    };
  }
}

function emptyMetrics(): CompetitorMetrics {
  return {
    pages_crawled: 0,
    avg_word_count: 0,
    avg_title_length: 0,
    schema_coverage_pct: 0,
    meta_coverage_pct: 0,
    h1_coverage_pct: 0,
    avg_ttfb_ms: 0,
    indexable_pages: 0,
  };
}

/** Our own profile, computed the same way so the comparison is like-for-like. */
export function ownProfile(pages: StoredPage[], siteUrl: string): CompetitorSnapshot {
  const ok = pages.filter(
    (p) => p.status_code !== null && p.status_code >= 200 && p.status_code < 300
  );

  return {
    domain: domainOf(siteUrl),
    url: originOf(siteUrl),
    status: "ready",
    pagesCrawled: ok.length,
    metrics: {
      pages_crawled: ok.length,
      avg_word_count: average(ok.map((p) => p.word_count ?? 0)),
      avg_title_length: average(ok.map((p) => p.title?.length ?? 0)),
      schema_coverage_pct: percentage(
        ok.filter((p) => (p.schema_types ?? []).length > 0).length,
        ok.length
      ),
      meta_coverage_pct: percentage(ok.filter((p) => p.meta_description).length, ok.length),
      h1_coverage_pct: percentage(ok.filter((p) => (p.h1s ?? []).length > 0).length, ok.length),
      avg_ttfb_ms: average(ok.map((p) => p.ttfb_ms ?? 0)),
      indexable_pages: ok.filter((p) => p.indexable).length,
    },
    topics: extractTopics(
      ok.map((p) => ({
        title: p.title,
        headings: (p.heading_outline ?? []).map((h) => h.text),
      }))
    ),
    error: null,
  };
}

/** Topics a competitor covers meaningfully that we barely touch. */
export function topicGaps(
  own: { term: string; count: number }[],
  competitor: { term: string; count: number }[]
): string[] {
  const ownTerms = new Map(own.map((t) => [t.term, t.count]));
  return competitor
    .filter((t) => t.count >= 2 && (ownTerms.get(t.term) ?? 0) === 0)
    .slice(0, 15)
    .map((t) => t.term);
}
