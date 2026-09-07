import type { SeoPhase, SeoRunOptions, SeoSeverity } from "./types";

export const SEO_USER_AGENT =
  "WIDE-SEO-Audit/2.0 (+https://www.wide-communication.com; site audit)";

/** Hard ceiling regardless of what a caller asks for. */
export const MAX_PAGES_LIMIT = 2000;

export const DEFAULT_RUN_OPTIONS: SeoRunOptions = {
  maxPages: 500,
  maxDepth: 6,
  competitors: [],
  includePerformance: true,
  includeSearchData: true,
  includeQuestions: true,
  includeCompetitors: true,
  includeAi: true,
  perfSampleSize: 10,
  competitorMaxPages: 50,
};

/** Politeness: concurrent requests against a single origin. */
export const CRAWL_CONCURRENCY = 6;
export const CRAWL_TIMEOUT_MS = 20000;
export const DEFAULT_CRAWL_DELAY_MS = 0;

/**
 * A worker invocation runs for at most this long before persisting state and
 * re-invoking itself. Sits comfortably under the 300s function limit.
 */
export const WORKER_BUDGET_MS = 210_000;

/** A run whose heartbeat is older than this is considered dead and requeued. */
export const HEARTBEAT_STALE_MS = 5 * 60 * 1000;
export const MAX_RUN_ATTEMPTS = 4;

/** Rough share of total progress each phase represents, for the progress bar. */
export const PHASE_WEIGHTS: Record<SeoPhase, number> = {
  discover: 5,
  crawl: 35,
  analyze: 10,
  performance: 15,
  search_data: 5,
  questions: 12,
  competitors: 10,
  synthesize: 6,
  score: 2,
};

export const PHASE_LABELS: Record<SeoPhase, string> = {
  discover: "Discovering pages",
  crawl: "Crawling site",
  analyze: "Analysing findings",
  performance: "Measuring speed",
  search_data: "Search Console data",
  questions: "Mining real questions",
  competitors: "Reviewing competitors",
  synthesize: "Writing the roadmap",
  score: "Scoring",
};

export const SEVERITY_ORDER: Record<SeoSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/** Content thresholds used by the on-page and site-wide checks. */
export const TITLE_MIN = 30;
export const TITLE_MAX = 60;
export const META_MIN = 70;
export const META_MAX = 160;
export const THIN_CONTENT_WORDS = 250;

/**
 * Google's official Core Web Vitals thresholds. Used verbatim so the report
 * never invents its own grading.
 * https://web.dev/articles/defining-core-web-vitals-thresholds
 */
export const CWV_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000, unit: "ms" },
  inp: { good: 200, poor: 500, unit: "ms" },
  cls: { good: 0.1, poor: 0.25, unit: "" },
  fcp: { good: 1800, poor: 3000, unit: "ms" },
  ttfb: { good: 800, poor: 1800, unit: "ms" },
} as const;

export type CwvMetric = keyof typeof CWV_THRESHOLDS;

export function rateCwv(
  metric: CwvMetric,
  value: number | null | undefined
): "good" | "needs-improvement" | "poor" | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const t = CWV_THRESHOLDS[metric];
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs-improvement";
  return "poor";
}

/** Qualitative band for a 0-100 score, so no bare number is ever shown alone. */
export function scoreBand(score: number | null | undefined): {
  label: string;
  tone: "good" | "warn" | "bad" | "muted";
} {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return { label: "Not measured", tone: "muted" };
  }
  if (score >= 90) return { label: "Excellent", tone: "good" };
  if (score >= 75) return { label: "Good", tone: "good" };
  if (score >= 50) return { label: "Needs work", tone: "warn" };
  return { label: "Critical", tone: "bad" };
}

/** File extensions we never enqueue during a crawl. */
export const SKIP_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".avif", ".ico", ".bmp",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".rar", ".gz", ".tar", ".7z",
  ".mp4", ".webm", ".mov", ".avi", ".mp3", ".wav", ".ogg",
  ".css", ".js", ".json", ".xml", ".rss", ".txt",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
];
