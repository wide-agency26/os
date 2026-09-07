import { createAdminClient } from "@/utils/supabase/admin";
import type { Json } from "@/types/supabase";
import type {
  CrawledPage,
  PhaseState,
  PhaseStatusMap,
  SeoIssueDraft,
  SeoPhase,
  SeoRunOptions,
  SeoRunStats,
  SeoRunStatus,
  SeoRunSummary,
  SeoScores,
} from "./types";
import { DEFAULT_RUN_OPTIONS, PHASE_WEIGHTS } from "./constants";
import { SEO_PHASES } from "./types";
import { pathOf } from "./url";

export type SeoAdminClient = ReturnType<typeof createAdminClient>;

export function seoAdmin(): SeoAdminClient {
  return createAdminClient();
}

export type SeoSiteRow = {
  id: string;
  domain: string;
  url: string;
  label: string | null;
  company_id: string | null;
  project_id: string | null;
  bd_record_id: string | null;
  gsc_property: string | null;
  is_client_visible: boolean;
  last_run_at: string | null;
  last_score: number | null;
  created_at: string;
};

export type SeoRunRow = {
  id: string;
  site_id: string;
  public_slug: string;
  status: SeoRunStatus;
  phase: SeoPhase | "done";
  phase_state: PhaseState;
  phase_status: PhaseStatusMap;
  progress_pct: number;
  options: SeoRunOptions;
  scores: SeoScores | Record<string, never>;
  summary: SeoRunSummary;
  stats: SeoRunStats;
  score: number | null;
  attempt: number;
  heartbeat_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function mergeOptions(raw: unknown): SeoRunOptions {
  const input = (raw ?? {}) as Partial<SeoRunOptions>;
  return {
    ...DEFAULT_RUN_OPTIONS,
    ...input,
    competitors: Array.isArray(input.competitors) ? input.competitors : [],
  };
}

/** Progress derived from completed phase weights plus the active phase's share. */
export function computeProgress(
  phase: SeoPhase | "done",
  phaseStatus: PhaseStatusMap,
  withinPhase = 0
): number {
  if (phase === "done") return 100;
  let total = 0;
  for (const p of SEO_PHASES) {
    const outcome = phaseStatus[p];
    if (outcome === "done" || outcome === "skipped" || outcome === "degraded" || outcome === "failed") {
      total += PHASE_WEIGHTS[p];
    } else if (p === phase) {
      total += PHASE_WEIGHTS[p] * Math.min(Math.max(withinPhase, 0), 1);
    }
  }
  return Math.min(99, Math.round(total));
}

export async function logRunEvent(
  supabase: SeoAdminClient,
  runId: string,
  phase: SeoPhase | "done" | null,
  message: string,
  level: "info" | "warn" | "error" = "info",
  meta: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from("seo_run_events").insert({
    run_id: runId,
    phase,
    level,
    message,
    meta: meta as Json,
  });
}

export async function updateRun(
  supabase: SeoAdminClient,
  runId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await supabase
    .from("seo_runs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", runId);
}

export async function heartbeat(
  supabase: SeoAdminClient,
  runId: string
): Promise<void> {
  await supabase
    .from("seo_runs")
    .update({ heartbeat_at: new Date().toISOString() })
    .eq("id", runId);
}

export async function getRun(
  supabase: SeoAdminClient,
  runId: string
): Promise<SeoRunRow | null> {
  const { data } = await supabase
    .from("seo_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  return (data as SeoRunRow | null) ?? null;
}

export async function getSite(
  supabase: SeoAdminClient,
  siteId: string
): Promise<SeoSiteRow | null> {
  const { data } = await supabase
    .from("seo_sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();
  return (data as SeoSiteRow | null) ?? null;
}

export async function savePages(
  supabase: SeoAdminClient,
  runId: string,
  pages: CrawledPage[]
): Promise<void> {
  if (!pages.length) return;
  const rows = pages.map((p) => ({
    run_id: runId,
    url: p.url,
    path: p.path || pathOf(p.url),
    depth: p.depth,
    status_code: p.statusCode,
    content_type: p.contentType,
    ttfb_ms: p.ttfbMs,
    bytes: p.bytes,
    title: p.title,
    title_length: p.title ? p.title.length : null,
    meta_description: p.metaDescription,
    meta_description_length: p.metaDescription ? p.metaDescription.length : null,
    canonical: p.canonical,
    canonical_self: p.canonicalSelf,
    h1s: p.h1s as unknown as Json,
    heading_outline: p.headingOutline as unknown as Json,
    word_count: p.wordCount,
    content_hash: p.contentHash,
    lang: p.lang,
    hreflang: p.hreflang as unknown as Json,
    schema_types: p.schemaTypes,
    og_complete: p.ogComplete,
    viewport: p.viewport,
    noindex: p.noindex,
    robots_blocked: p.robotsBlocked,
    indexable: p.indexable,
    in_sitemap: p.inSitemap,
    redirect_chain: p.redirectChain as unknown as Json,
    images_total: p.imagesTotal,
    images_missing_alt: p.imagesMissingAlt,
    internal_links_out: p.internalLinksOut,
    external_links_out: p.externalLinksOut,
    error: p.error,
    fetched_at: new Date().toISOString(),
  }));

  // Chunked to stay well under statement/payload limits on large crawls.
  for (let i = 0; i < rows.length; i += 100) {
    await supabase
      .from("seo_run_pages")
      .upsert(rows.slice(i, i + 100), { onConflict: "run_id,url_hash" });
  }
}

export type StoredPage = {
  id: string;
  url: string;
  path: string | null;
  depth: number;
  status_code: number | null;
  content_type: string | null;
  ttfb_ms: number | null;
  bytes: number | null;
  title: string | null;
  title_length: number | null;
  meta_description: string | null;
  meta_description_length: number | null;
  canonical: string | null;
  canonical_self: boolean | null;
  h1s: string[];
  heading_outline: { level: number; text: string }[];
  word_count: number | null;
  content_hash: string | null;
  lang: string | null;
  hreflang: { lang: string; href: string }[];
  schema_types: string[];
  og_complete: boolean | null;
  viewport: boolean | null;
  noindex: boolean;
  robots_blocked: boolean;
  indexable: boolean | null;
  in_sitemap: boolean;
  redirect_chain: string[];
  images_total: number;
  images_missing_alt: number;
  internal_links_out: number;
  internal_links_in: number;
  external_links_out: number;
  error: string | null;
};

const PAGE_SELECT =
  "id,url,path,depth,status_code,content_type,ttfb_ms,bytes,title,title_length," +
  "meta_description,meta_description_length,canonical,canonical_self,h1s," +
  "heading_outline,word_count,content_hash,lang,hreflang,schema_types,og_complete," +
  "viewport,noindex,robots_blocked,indexable,in_sitemap,redirect_chain,images_total," +
  "images_missing_alt,internal_links_out,internal_links_in,external_links_out,error";

export async function loadPages(
  supabase: SeoAdminClient,
  runId: string
): Promise<StoredPage[]> {
  const all: StoredPage[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("seo_run_pages")
      .select(PAGE_SELECT)
      .eq("run_id", runId)
      .order("depth", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error || !data || !data.length) break;
    all.push(...(data as unknown as StoredPage[]));
    if (data.length < pageSize) break;
  }
  return all;
}

export async function loadCrawledUrls(
  supabase: SeoAdminClient,
  runId: string
): Promise<Set<string>> {
  const seen = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("seo_run_pages")
      .select("url")
      .eq("run_id", runId)
      .range(from, from + pageSize - 1);
    if (error || !data || !data.length) break;
    for (const row of data as { url: string }[]) seen.add(row.url);
    if (data.length < pageSize) break;
  }
  return seen;
}

export async function countPages(
  supabase: SeoAdminClient,
  runId: string
): Promise<number> {
  const { count } = await supabase
    .from("seo_run_pages")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId);
  return count ?? 0;
}

export async function saveIssues(
  supabase: SeoAdminClient,
  runId: string,
  issues: SeoIssueDraft[]
): Promise<void> {
  if (!issues.length) return;
  const rows = issues.map((i) => ({
    run_id: runId,
    code: i.code,
    category: i.category,
    severity: i.severity,
    title: i.title,
    what_it_means: i.whatItMeans,
    why_it_matters: i.whyItMatters,
    how_to_fix: i.howToFix,
    impact: i.impact,
    effort: i.effort,
    affected_count: i.affectedCount,
    sample_urls: i.sampleUrls as unknown as Json,
    evidence: (i.evidence ?? {}) as Json,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    await supabase
      .from("seo_issues")
      .upsert(rows.slice(i, i + 100), { onConflict: "run_id,code" });
  }
}

export async function updateInboundCounts(
  supabase: SeoAdminClient,
  runId: string,
  counts: Record<string, number>
): Promise<void> {
  const entries = Object.entries(counts);
  if (!entries.length) return;
  // Small batches of individual updates: inbound counts are only computed once,
  // at the end of the crawl, and a bulk upsert would need every other column.
  for (let i = 0; i < entries.length; i += 50) {
    await Promise.all(
      entries.slice(i, i + 50).map(([url, count]) =>
        supabase
          .from("seo_run_pages")
          .update({ internal_links_in: count })
          .eq("run_id", runId)
          .eq("url", url)
      )
    );
  }
}
