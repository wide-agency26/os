import { createAdminClient } from "@/utils/supabase/admin";
import { HEARTBEAT_STALE_MS } from "./constants";
import { capabilityStatuses, type CapabilityStatus } from "./providers";
import type { StoredPage } from "./store";
import type {
  PhaseStatusMap,
  SeoCoverage,
  SeoIntent,
  SeoRunStats,
  SeoRunStatus,
  SeoRunSummary,
  SeoScores,
} from "./types";

export type SeoIssueRow = {
  id: string;
  code: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  what_it_means: string | null;
  why_it_matters: string | null;
  how_to_fix: string | null;
  impact: number;
  effort: number;
  priority: number;
  affected_count: number;
  sample_urls: string[];
  evidence: Record<string, unknown>;
};

export type SeoQueryRow = {
  query: string;
  source: string;
  sources: string[];
  is_question: boolean;
  intent: SeoIntent | null;
  cluster: string | null;
  suggest_rank: number | null;
  popularity: number | null;
  gsc_clicks: number | null;
  gsc_impressions: number | null;
  gsc_position: number | null;
  coverage: SeoCoverage | null;
  mapped_page_url: string | null;
};

export type SeoPerfRow = {
  url: string;
  strategy: "mobile" | "desktop";
  scope: "page" | "origin";
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  seo_score: number | null;
  lab_lcp_ms: number | null;
  lab_cls: number | null;
  lab_tbt_ms: number | null;
  lab_fcp_ms: number | null;
  lab_ttfb_ms: number | null;
  field_lcp_ms: number | null;
  field_inp_ms: number | null;
  field_cls: number | null;
  field_ttfb_ms: number | null;
  has_field_data: boolean;
  opportunities: { id: string; title: string; savingsMs: number; description: string }[];
  error: string | null;
};

export type SeoCompetitorRow = {
  domain: string;
  url: string;
  status: string;
  pages_crawled: number;
  metrics: Record<string, number>;
  topics: { term: string; count: number }[];
  overlap: { gaps?: string[] };
  error: string | null;
};

export type SeoRunEventRow = {
  id: number;
  phase: string | null;
  level: "info" | "warn" | "error";
  message: string;
  created_at: string;
};

export type SeoRunBundle = {
  run: {
    id: string;
    site_id: string;
    public_slug: string;
    status: SeoRunStatus;
    phase: string;
    phase_status: PhaseStatusMap;
    progress_pct: number;
    score: number | null;
    scores: SeoScores | null;
    summary: SeoRunSummary;
    stats: SeoRunStats;
    options: { maxPages: number; competitors: string[] };
    error_message: string | null;
    created_at: string;
    finished_at: string | null;
  };
  site: {
    id: string;
    domain: string;
    url: string;
    label: string | null;
    gsc_property: string | null;
    is_client_visible: boolean;
    company_id: string | null;
  };
  issues: SeoIssueRow[];
  pages: StoredPage[];
  queries: SeoQueryRow[];
  perf: SeoPerfRow[];
  competitors: SeoCompetitorRow[];
  events: SeoRunEventRow[];
  capabilities: CapabilityStatus[];
  /** Score of the previous completed run for this site, for delta display. */
  previousScore: number | null;
};

const PAGE_SELECT =
  "id,url,path,depth,status_code,content_type,ttfb_ms,bytes,title,title_length," +
  "meta_description,meta_description_length,canonical,canonical_self,h1s," +
  "heading_outline,word_count,content_hash,lang,hreflang,schema_types,og_complete," +
  "viewport,noindex,robots_blocked,indexable,in_sitemap,redirect_chain,images_total," +
  "images_missing_alt,internal_links_out,internal_links_in,external_links_out,error,issue_codes";

async function loadAllPages(
  supabase: ReturnType<typeof createAdminClient>,
  runId: string
): Promise<StoredPage[]> {
  const out: StoredPage[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from("seo_run_pages")
      .select(PAGE_SELECT)
      .eq("run_id", runId)
      .order("depth", { ascending: true })
      .range(from, from + size - 1);
    if (error || !data || !data.length) break;
    out.push(...(data as unknown as StoredPage[]));
    if (data.length < size) break;
  }
  return out;
}

export async function loadSeoRun(
  runIdOrSlug: string,
  opts: { bySlug?: boolean; includePages?: boolean } = {}
): Promise<SeoRunBundle | null> {
  const supabase = createAdminClient();

  const { data: runData } = await supabase
    .from("seo_runs")
    .select("*")
    .eq(opts.bySlug ? "public_slug" : "id", runIdOrSlug)
    .maybeSingle();

  if (!runData) return null;
  const run = runData as Record<string, unknown>;
  const runId = run.id as string;

  const { data: siteData } = await supabase
    .from("seo_sites")
    .select("id,domain,url,label,gsc_property,is_client_visible,company_id")
    .eq("id", run.site_id as string)
    .maybeSingle();

  if (!siteData) return null;

  const [issuesRes, queriesRes, perfRes, competitorsRes, eventsRes, previousRes] =
    await Promise.all([
      supabase
        .from("seo_issues")
        .select("*")
        .eq("run_id", runId)
        .order("priority", { ascending: false }),
      supabase
        .from("seo_queries")
        .select(
          "query,source,sources,is_question,intent,cluster,suggest_rank,popularity," +
            "gsc_clicks,gsc_impressions,gsc_position,coverage,mapped_page_url"
        )
        .eq("run_id", runId)
        .order("popularity", { ascending: false, nullsFirst: false })
        .limit(2000),
      supabase.from("seo_perf_samples").select("*").eq("run_id", runId),
      supabase.from("seo_competitors").select("*").eq("run_id", runId),
      supabase
        .from("seo_run_events")
        .select("id,phase,level,message,created_at")
        .eq("run_id", runId)
        .order("id", { ascending: false })
        .limit(60),
      supabase
        .from("seo_runs")
        .select("score")
        .eq("site_id", run.site_id as string)
        .eq("status", "ready")
        .neq("id", runId)
        .not("score", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const pages = opts.includePages === false ? [] : await loadAllPages(supabase, runId);

  return {
    run: {
      id: runId,
      site_id: run.site_id as string,
      public_slug: run.public_slug as string,
      status: run.status as SeoRunStatus,
      phase: run.phase as string,
      phase_status: (run.phase_status ?? {}) as PhaseStatusMap,
      progress_pct: (run.progress_pct as number) ?? 0,
      score: (run.score as number | null) ?? null,
      scores: (run.scores as SeoScores | null) ?? null,
      summary: (run.summary ?? {}) as SeoRunSummary,
      stats: (run.stats ?? {}) as SeoRunStats,
      options: (run.options ?? { maxPages: 0, competitors: [] }) as {
        maxPages: number;
        competitors: string[];
      },
      error_message: (run.error_message as string | null) ?? null,
      created_at: run.created_at as string,
      finished_at: (run.finished_at as string | null) ?? null,
    },
    site: siteData as SeoRunBundle["site"],
    issues: (issuesRes.data ?? []) as unknown as SeoIssueRow[],
    pages,
    queries: (queriesRes.data ?? []) as unknown as SeoQueryRow[],
    perf: (perfRes.data ?? []) as unknown as SeoPerfRow[],
    competitors: (competitorsRes.data ?? []) as unknown as SeoCompetitorRow[],
    events: (eventsRes.data ?? []) as unknown as SeoRunEventRow[],
    capabilities: capabilityStatuses(),
    previousScore: (previousRes.data as { score: number } | null)?.score ?? null,
  };
}

export type SeoSiteListItem = {
  id: string;
  domain: string;
  url: string;
  label: string | null;
  last_run_at: string | null;
  last_score: number | null;
  is_client_visible: boolean;
  monthly_rerun: boolean;
  gsc_property: string | null;
};

export type SeoRunListItem = {
  id: string;
  site_id: string;
  domain: string;
  status: SeoRunStatus;
  phase: string;
  progress_pct: number;
  score: number | null;
  created_at: string;
  finished_at: string | null;
  error_message: string | null;
  pages_crawled: number;
};

export async function listSeoSitesAndRuns(): Promise<{
  sites: SeoSiteListItem[];
  runs: SeoRunListItem[];
}> {
  const supabase = createAdminClient();

  const [sitesRes, runsRes] = await Promise.all([
    supabase
      .from("seo_sites")
      .select(
        "id,domain,url,label,last_run_at,last_score,is_client_visible,monthly_rerun,gsc_property"
      )
      .order("last_run_at", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("seo_runs")
      .select("id,site_id,status,phase,progress_pct,score,created_at,finished_at,error_message,stats")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const sites = (sitesRes.data ?? []) as SeoSiteListItem[];
  const siteById = new Map(sites.map((s) => [s.id, s]));

  const runs: SeoRunListItem[] = ((runsRes.data ?? []) as Record<string, unknown>[]).map(
    (r) => ({
      id: r.id as string,
      site_id: r.site_id as string,
      domain: siteById.get(r.site_id as string)?.domain ?? "—",
      status: r.status as SeoRunStatus,
      phase: r.phase as string,
      progress_pct: (r.progress_pct as number) ?? 0,
      score: (r.score as number | null) ?? null,
      created_at: r.created_at as string,
      finished_at: (r.finished_at as string | null) ?? null,
      error_message: (r.error_message as string | null) ?? null,
      pages_crawled: ((r.stats ?? {}) as SeoRunStats).pages_crawled ?? 0,
    })
  );

  // Domains that have a run but no site row yet cannot happen, but a run whose
  // site was deleted would show "—" rather than crashing the list.
  return { sites, runs };
}

/** Lightweight poll payload for the live progress view. */
export async function getRunProgress(runId: string): Promise<{
  status: SeoRunStatus;
  phase: string;
  phase_status: PhaseStatusMap;
  progress_pct: number;
  stats: SeoRunStats;
  error_message: string | null;
  events: SeoRunEventRow[];
  /** True when the worker has gone quiet and the run needs another nudge. */
  stalled: boolean;
} | null> {
  const supabase = createAdminClient();
  const [runRes, eventsRes] = await Promise.all([
    supabase
      .from("seo_runs")
      .select("status,phase,phase_status,progress_pct,stats,error_message,heartbeat_at")
      .eq("id", runId)
      .maybeSingle(),
    supabase
      .from("seo_run_events")
      .select("id,phase,level,message,created_at")
      .eq("run_id", runId)
      .order("id", { ascending: false })
      .limit(25),
  ]);

  if (!runRes.data) return null;
  const r = runRes.data as Record<string, unknown>;

  const status = r.status as SeoRunStatus;
  const heartbeat = r.heartbeat_at as string | null;
  const stalled =
    (status === "queued" || status === "running") &&
    Date.now() - new Date(heartbeat ?? 0).getTime() > HEARTBEAT_STALE_MS;

  return {
    status,
    phase: r.phase as string,
    phase_status: (r.phase_status ?? {}) as PhaseStatusMap,
    progress_pct: (r.progress_pct as number) ?? 0,
    stats: (r.stats ?? {}) as SeoRunStats,
    error_message: (r.error_message as string | null) ?? null,
    events: (eventsRes.data ?? []) as unknown as SeoRunEventRow[],
    stalled,
  };
}
