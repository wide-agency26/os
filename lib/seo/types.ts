/**
 * Shared types for the SEO Auditor.
 *
 * Distinct from `lib/seo-audit/*` (the legacy single-page quick scan) and from
 * `lib/reports/gsc.ts` (the CSV-driven SEO Report). This module owns the deep,
 * background, multi-phase site audit.
 */

export const SEO_PHASES = [
  "discover",
  "crawl",
  "analyze",
  "performance",
  "search_data",
  "questions",
  "competitors",
  "synthesize",
  "score",
] as const;

export type SeoPhase = (typeof SEO_PHASES)[number];

export type SeoRunStatus = "queued" | "running" | "ready" | "failed" | "cancelled";

/** Per-phase outcome. `degraded` means the phase ran but a source was unavailable. */
export type PhaseOutcome =
  | "pending"
  | "running"
  | "done"
  | "skipped"
  | "degraded"
  | "failed";

export type PhaseStatusMap = Partial<Record<SeoPhase, PhaseOutcome>>;

export type SeoSeverity = "critical" | "high" | "medium" | "low" | "info";

export type SeoIssueCategory =
  | "indexability"
  | "technical"
  | "on_page"
  | "content"
  | "performance"
  | "mobile"
  | "schema"
  | "links"
  | "international"
  | "search_presence"
  | "competitor";

export type SeoQuerySource =
  | "seed"
  | "google_suggest"
  | "bing_suggest"
  | "youtube_suggest"
  | "reddit"
  | "stackexchange"
  | "gsc"
  | "ai";

export type SeoIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational";

export type SeoCoverage = "covered" | "partial" | "gap";

export type SeoRunOptions = {
  maxPages: number;
  maxDepth: number;
  competitors: string[];
  includePerformance: boolean;
  includeSearchData: boolean;
  includeQuestions: boolean;
  includeCompetitors: boolean;
  includeAi: boolean;
  perfSampleSize: number;
  competitorMaxPages: number;
};

/**
 * Resume cursor for the active phase. Persisted to `seo_runs.phase_state` at the
 * end of every worker slice so the next invocation picks up exactly where the
 * previous one ran out of time.
 */
export type PhaseState = {
  /** Pending crawl frontier, BFS-ordered. */
  frontier?: { url: string; depth: number }[];
  /** URLs listed in the site's sitemap(s), used for the sitemap-vs-crawl diff. */
  sitemapUrls?: string[];
  sitemapCount?: number;
  robotsTxtFound?: boolean;
  crawlDelayMs?: number;
  disallow?: string[];
  /** Internal inbound link tallies accumulated during the crawl. */
  inboundCounts?: Record<string, number>;
  /** URLs still to be measured by PageSpeed Insights. */
  perfQueue?: { url: string; strategy: "mobile" | "desktop" }[];
  /** Seed terms for the question engine. */
  questionSeeds?: string[];
  /** Index of the next competitor to crawl. */
  competitorIndex?: number;
  /** Free-form notes surfaced in the UI when a phase degrades. */
  notes?: string[];
};

export type SeoScores = {
  overall: number;
  technical: number;
  content: number;
  performance: number;
  search_presence: number;
  /** Pillars with no data are listed here so the UI never shows a fake zero. */
  unavailable: string[];
};

export type SeoRunStats = {
  pages_crawled?: number;
  pages_indexable?: number;
  pages_in_sitemap?: number;
  issues_total?: number;
  issues_critical?: number;
  issues_high?: number;
  queries_found?: number;
  questions_found?: number;
  clusters_found?: number;
  competitors_crawled?: number;
  perf_samples?: number;
  crawl_errors?: number;
};

export type RoadmapItem = {
  horizon: "30" | "60" | "90";
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
};

export type SeoRunSummary = {
  headline?: string;
  executive?: string;
  strengths?: string[];
  risks?: string[];
  opportunities?: string[];
  roadmap?: RoadmapItem[];
  /** True when the AI gateway produced the narrative; false = heuristic fallback. */
  used_ai?: boolean;
  /** Data sources that could not be reached, shown as "Not connected" in the UI. */
  unavailable?: { source: string; reason: string }[];
};

/** A page as captured by the crawler, before persistence. */
export type CrawledPage = {
  url: string;
  path: string;
  depth: number;
  statusCode: number | null;
  contentType: string | null;
  ttfbMs: number | null;
  bytes: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  canonicalSelf: boolean | null;
  h1s: string[];
  headingOutline: { level: number; text: string }[];
  wordCount: number;
  contentHash: string | null;
  lang: string | null;
  hreflang: { lang: string; href: string }[];
  schemaTypes: string[];
  ogComplete: boolean;
  viewport: boolean;
  noindex: boolean;
  robotsBlocked: boolean;
  indexable: boolean;
  inSitemap: boolean;
  redirectChain: string[];
  imagesTotal: number;
  imagesMissingAlt: number;
  internalLinksOut: number;
  externalLinksOut: number;
  /** Same-origin links discovered on this page, used to extend the frontier. */
  discoveredLinks: string[];
  error: string | null;
};

/** A finding, ready to be written to `seo_issues`. */
export type SeoIssueDraft = {
  code: string;
  category: SeoIssueCategory;
  severity: SeoSeverity;
  title: string;
  whatItMeans: string;
  whyItMatters: string;
  howToFix: string;
  impact: number;
  effort: number;
  affectedCount: number;
  sampleUrls: string[];
  evidence?: Record<string, unknown>;
};
