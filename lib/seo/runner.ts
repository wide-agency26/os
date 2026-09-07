import type { Json } from "@/types/supabase";
import { analyzeSite } from "./analyze/site-checks";
import { ISSUE_CATALOG } from "./analyze/issue-catalog";
import { computeScores } from "./analyze/score";
import { crawlSlice } from "./crawl/crawl";
import { loadRobots, type RobotsRules } from "./crawl/robots";
import { discoverSitemapUrls } from "./crawl/sitemap";
import { crawlCompetitor, ownProfile, topicGaps } from "./competitors";
import { PHASE_LABELS, WORKER_BUDGET_MS } from "./constants";
import { capabilityStatuses } from "./providers";
import {
  hasPsiKey,
  runCrux,
  runPsi,
  selectPerfSample,
  throttle,
  type PerfSample,
} from "./psi";
import {
  classifyIntent,
  deriveSeeds,
  mineAutocomplete,
  mineReddit,
  mineStackExchange,
  popularityProxy,
  type MinedQuery,
} from "./questions";
import { fetchSearchConsoleData, strikingDistance } from "./search-data";
import {
  computeProgress,
  countPages,
  getRun,
  getSite,
  heartbeat,
  loadCrawledUrls,
  loadPages,
  logRunEvent,
  saveIssues,
  savePages,
  seoAdmin,
  updateInboundCounts,
  updateRun,
  type SeoAdminClient,
  type SeoRunRow,
  type SeoSiteRow,
} from "./store";
import { synthesize } from "./synthesize";
import { SEO_PHASES, type PhaseState, type SeoIssueDraft, type SeoPhase } from "./types";
import { canonicalizeUrl, domainOf, originOf } from "./url";

/** Outcome of one worker slice: either the run is finished or it needs another. */
export type SliceOutcome = { done: boolean; phase: SeoPhase | "done"; error?: string };

type Ctx = {
  supabase: SeoAdminClient;
  run: SeoRunRow;
  site: SeoSiteRow;
  deadline: number;
  state: PhaseState;
};

function nextPhase(current: SeoPhase): SeoPhase | "done" {
  const index = SEO_PHASES.indexOf(current);
  return index === -1 || index === SEO_PHASES.length - 1
    ? "done"
    : SEO_PHASES[index + 1];
}

/** Phases the caller switched off are recorded as skipped, not silently absent. */
function shouldSkip(phase: SeoPhase, run: SeoRunRow): boolean {
  const o = run.options;
  if (phase === "performance") return !o.includePerformance;
  if (phase === "search_data") return !o.includeSearchData;
  if (phase === "questions") return !o.includeQuestions;
  if (phase === "competitors") return !o.includeCompetitors || !o.competitors.length;
  return false;
}

export async function runSlice(runId: string): Promise<SliceOutcome> {
  const supabase = seoAdmin();
  const deadline = Date.now() + WORKER_BUDGET_MS;

  const run = await getRun(supabase, runId);
  if (!run) return { done: true, phase: "done", error: "Run not found" };
  if (run.status === "ready" || run.status === "failed" || run.status === "cancelled") {
    return { done: true, phase: run.phase };
  }

  const site = await getSite(supabase, run.site_id);
  if (!site) {
    await failRun(supabase, runId, "Site record is missing");
    return { done: true, phase: "done", error: "Site not found" };
  }

  const ctx: Ctx = { supabase, run, site, deadline, state: run.phase_state ?? {} };

  let phase: SeoPhase | "done" =
    run.phase === "done" ? "done" : (run.phase as SeoPhase);

  while (phase !== "done" && Date.now() < deadline) {
    await heartbeat(supabase, runId);

    if (shouldSkip(phase, run)) {
      await markPhase(ctx, phase, "skipped");
      phase = nextPhase(phase);
      await updateRun(supabase, runId, { phase });
      continue;
    }

    let complete = false;
    try {
      complete = await runPhase(ctx, phase);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Phase failed";
      await logRunEvent(supabase, runId, phase, `${PHASE_LABELS[phase]} failed: ${message}`, "error");
      await markPhase(ctx, phase, "failed");
      // A failed phase degrades the report; it does not kill the run. Only the
      // crawl is load-bearing enough that nothing downstream can proceed.
      if (phase === "crawl" || phase === "discover") {
        await failRun(supabase, runId, message);
        return { done: true, phase, error: message };
      }
      complete = true;
    }

    if (!complete) {
      // Out of time inside the phase; state is persisted, resume next invocation.
      await yieldRun(supabase, runId, phase, ctx.state);
      return { done: false, phase };
    }

    phase = nextPhase(phase);
    await updateRun(supabase, runId, {
      phase,
      phase_state: ctx.state as unknown as Json,
      progress_pct: computeProgress(phase, ctx.run.phase_status),
    });
  }

  if (phase === "done") {
    await finishRun(ctx);
    return { done: true, phase: "done" };
  }

  await yieldRun(supabase, runId, phase, ctx.state);
  return { done: false, phase };
}

/**
 * Persists resume state and releases the run for the next worker.
 *
 * Setting the status back to `queued` is what makes the handoff immediate: the
 * claim in /api/seo/worker only takes a `running` run once its heartbeat has
 * gone stale, so a slice that stayed `running` could not be picked up by its
 * own continuation for five minutes. `queued` keeps the same single-claim
 * guarantee — only one worker can flip it back to `running`.
 */
async function yieldRun(
  supabase: SeoAdminClient,
  runId: string,
  phase: SeoPhase,
  state: PhaseState
): Promise<void> {
  // Scoped to `running` so a run cancelled while this slice was working is not
  // resurrected by its own handoff.
  await supabase
    .from("seo_runs")
    .update({
      status: "queued",
      phase,
      phase_state: state as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("status", "running");
}

async function markPhase(
  ctx: Ctx,
  phase: SeoPhase,
  outcome: "done" | "skipped" | "degraded" | "failed"
): Promise<void> {
  ctx.run.phase_status = { ...ctx.run.phase_status, [phase]: outcome };
  await updateRun(ctx.supabase, ctx.run.id, {
    phase_status: ctx.run.phase_status as unknown as Json,
  });
}

async function failRun(
  supabase: SeoAdminClient,
  runId: string,
  message: string
): Promise<void> {
  await updateRun(supabase, runId, {
    status: "failed",
    error_message: message,
    finished_at: new Date().toISOString(),
  });
  await logRunEvent(supabase, runId, null, `Run failed: ${message}`, "error");
}

/** Returns true when the phase finished, false when it ran out of time. */
async function runPhase(ctx: Ctx, phase: SeoPhase): Promise<boolean> {
  switch (phase) {
    case "discover":
      return phaseDiscover(ctx);
    case "crawl":
      return phaseCrawl(ctx);
    case "analyze":
      return phaseAnalyze(ctx);
    case "performance":
      return phasePerformance(ctx);
    case "search_data":
      return phaseSearchData(ctx);
    case "questions":
      return phaseQuestions(ctx);
    case "competitors":
      return phaseCompetitors(ctx);
    case "synthesize":
      return phaseSynthesize(ctx);
    case "score":
      return phaseScore(ctx);
    default:
      return true;
  }
}

// ---------------------------------------------------------------- 1. discover
async function phaseDiscover(ctx: Ctx): Promise<boolean> {
  const { supabase, run, site } = ctx;
  await logRunEvent(supabase, run.id, "discover", `Reading robots.txt and sitemaps for ${site.domain}`);

  const robots = await loadRobots(site.url);
  const sitemap = await discoverSitemapUrls(site.url, robots.sitemaps);

  const home = canonicalizeUrl(site.url) ?? site.url;
  const frontier = [
    { url: home, depth: 0 },
    ...sitemap.urls.slice(0, run.options.maxPages).map((u) => ({ url: u, depth: 1 })),
  ];

  ctx.state = {
    ...ctx.state,
    frontier,
    sitemapUrls: sitemap.urls.slice(0, 5000),
    sitemapCount: sitemap.urls.length,
    robotsTxtFound: robots.found,
    crawlDelayMs: robots.crawlDelayMs,
    disallow: robots.disallow,
    inboundCounts: {},
  };

  await logRunEvent(
    supabase,
    run.id,
    "discover",
    sitemap.found
      ? `Found ${sitemap.urls.length} URLs across ${sitemap.sitemapsChecked.length} sitemap file(s)`
      : "No sitemap found — discovery will rely on following links",
    sitemap.found ? "info" : "warn"
  );

  await markPhase(ctx, "discover", "done");
  return true;
}

// ------------------------------------------------------------------- 2. crawl
function rebuildRobots(state: PhaseState): RobotsRules {
  return {
    found: Boolean(state.robotsTxtFound),
    disallow: state.disallow ?? [],
    allow: [],
    crawlDelayMs: state.crawlDelayMs ?? 0,
    sitemaps: [],
    raw: null,
  };
}

async function phaseCrawl(ctx: Ctx): Promise<boolean> {
  const { supabase, run, site } = ctx;
  const visited = await loadCrawledUrls(supabase, run.id);
  const frontier = ctx.state.frontier ?? [];

  if (!frontier.length && visited.size > 0) {
    await markPhase(ctx, "crawl", "done");
    return true;
  }

  let lastLogged = visited.size;

  const result = await crawlSlice({
    siteUrl: site.url,
    frontier,
    visited,
    sitemapSet: new Set(ctx.state.sitemapUrls ?? []),
    robots: rebuildRobots(ctx.state),
    maxPages: run.options.maxPages,
    maxDepth: run.options.maxDepth,
    deadline: ctx.deadline - 15_000,
    crawlDelayMs: ctx.state.crawlDelayMs ?? 0,
    inboundCounts: ctx.state.inboundCounts ?? {},
    onBatch: async (pages) => {
      await savePages(supabase, run.id, pages);
      if (visited.size - lastLogged >= 25) {
        lastLogged = visited.size;
        await heartbeat(supabase, run.id);
        await logRunEvent(
          supabase,
          run.id,
          "crawl",
          `Crawled ${visited.size} of up to ${run.options.maxPages} pages`
        );
        await updateRun(supabase, run.id, {
          progress_pct: computeProgress(
            "crawl",
            ctx.run.phase_status,
            visited.size / run.options.maxPages
          ),
          stats: { ...ctx.run.stats, pages_crawled: visited.size } as unknown as Json,
        });
      }
    },
  });

  ctx.state = {
    ...ctx.state,
    frontier: result.frontier,
    inboundCounts: result.inboundCounts,
  };

  if (!result.complete) return false;

  await updateInboundCounts(supabase, run.id, result.inboundCounts);
  const total = await countPages(supabase, run.id);
  await logRunEvent(supabase, run.id, "crawl", `Crawl finished — ${total} pages captured`);
  ctx.run.stats = { ...ctx.run.stats, pages_crawled: total };
  await markPhase(ctx, "crawl", "done");
  return true;
}

// ----------------------------------------------------------------- 3. analyze
async function phaseAnalyze(ctx: Ctx): Promise<boolean> {
  const { supabase, run, site } = ctx;
  const pages = await loadPages(supabase, run.id);

  const analysis = analyzeSite({
    siteUrl: site.url,
    pages,
    sitemapFound: Boolean(ctx.state.robotsTxtFound || (ctx.state.sitemapCount ?? 0) > 0),
    sitemapUrls: ctx.state.sitemapUrls ?? [],
  });

  await saveIssues(supabase, run.id, analysis.issues);

  // Write per-page issue codes so the Pages table can show them inline.
  const entries = Object.entries(analysis.pageIssueCodes);
  for (let i = 0; i < entries.length; i += 50) {
    await Promise.all(
      entries.slice(i, i + 50).map(([url, codes]) =>
        supabase
          .from("seo_run_pages")
          .update({ issue_codes: codes })
          .eq("run_id", run.id)
          .eq("url", url)
      )
    );
  }

  ctx.run.stats = { ...ctx.run.stats, ...analysis.stats };
  await updateRun(supabase, run.id, { stats: ctx.run.stats as unknown as Json });
  await logRunEvent(
    supabase,
    run.id,
    "analyze",
    `Found ${analysis.issues.length} distinct issues across ${pages.length} pages`
  );
  await markPhase(ctx, "analyze", "done");
  return true;
}

// ------------------------------------------------------------- 4. performance
async function phasePerformance(ctx: Ctx): Promise<boolean> {
  const { supabase, run, site } = ctx;

  if (!hasPsiKey()) {
    await logRunEvent(
      supabase,
      run.id,
      "performance",
      "Skipped — PAGESPEED_API_KEY is not configured",
      "warn"
    );
    await markPhase(ctx, "performance", "degraded");
    return true;
  }

  let queue = ctx.state.perfQueue;
  if (!queue) {
    const pages = await loadPages(supabase, run.id);
    const sample = selectPerfSample(pages, run.options.perfSampleSize);
    queue = sample.flatMap((url) => [
      { url, strategy: "mobile" as const },
      { url, strategy: "desktop" as const },
    ]);
    await logRunEvent(
      supabase,
      run.id,
      "performance",
      `Measuring ${sample.length} representative pages on mobile and desktop`
    );

    const origin = originOf(site.url);
    for (const formFactor of ["PHONE", "DESKTOP"] as const) {
      const crux = await runCrux(origin, formFactor);
      if (crux) await savePerfSample(supabase, run.id, crux);
    }
  }

  while (queue.length) {
    if (Date.now() >= ctx.deadline - 20_000) {
      ctx.state = { ...ctx.state, perfQueue: queue };
      return false;
    }
    const item = queue.shift()!;
    const sample = await runPsi(item.url, item.strategy);
    await savePerfSample(supabase, run.id, sample);
    await throttle();
    await heartbeat(supabase, run.id);
  }

  ctx.state = { ...ctx.state, perfQueue: [] };

  const { count } = await supabase
    .from("seo_perf_samples")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run.id);

  ctx.run.stats = { ...ctx.run.stats, perf_samples: count ?? 0 };
  await addPerformanceIssues(ctx);
  await markPhase(ctx, "performance", "done");
  return true;
}

async function savePerfSample(
  supabase: SeoAdminClient,
  runId: string,
  sample: PerfSample
): Promise<void> {
  await supabase.from("seo_perf_samples").upsert(
    {
      run_id: runId,
      url: sample.url,
      strategy: sample.strategy,
      scope: sample.scope,
      performance_score: sample.performanceScore,
      accessibility_score: sample.accessibilityScore,
      best_practices_score: sample.bestPracticesScore,
      seo_score: sample.seoScore,
      lab_lcp_ms: sample.labLcpMs,
      lab_cls: sample.labCls,
      lab_tbt_ms: sample.labTbtMs,
      lab_fcp_ms: sample.labFcpMs,
      lab_speed_index_ms: sample.labSpeedIndexMs,
      lab_ttfb_ms: sample.labTtfbMs,
      field_lcp_ms: sample.fieldLcpMs,
      field_inp_ms: sample.fieldInpMs,
      field_cls: sample.fieldCls,
      field_ttfb_ms: sample.fieldTtfbMs,
      field_lcp_rating: sample.fieldLcpRating,
      field_inp_rating: sample.fieldInpRating,
      field_cls_rating: sample.fieldClsRating,
      has_field_data: sample.hasFieldData,
      opportunities: sample.opportunities as unknown as Json,
      error: sample.error,
    },
    { onConflict: "run_id,url_hash,strategy,scope" }
  );
}

/** Turns the measured vitals into the same normalized issue rows as everything else. */
async function addPerformanceIssues(ctx: Ctx): Promise<void> {
  const { supabase, run } = ctx;
  const { data } = await supabase
    .from("seo_perf_samples")
    .select("url,strategy,scope,performance_score,lab_lcp_ms,lab_cls,field_lcp_ms,field_inp_ms,field_cls")
    .eq("run_id", run.id);

  const samples = (data ?? []) as {
    url: string;
    strategy: string;
    scope: string;
    performance_score: number | null;
    lab_lcp_ms: number | null;
    lab_cls: number | null;
    field_lcp_ms: number | null;
    field_inp_ms: number | null;
    field_cls: number | null;
  }[];
  if (!samples.length) return;

  const mobile = samples.filter((s) => s.strategy === "mobile" && s.scope === "page");
  const issues: SeoIssueDraft[] = [];

  const build = (code: string, urls: string[], evidence: Record<string, unknown>) => {
    const def = ISSUE_CATALOG[code];
    if (!def || !urls.length) return;
    issues.push({
      code,
      category: def.category,
      severity: def.severity,
      title: def.title,
      whatItMeans: def.whatItMeans,
      whyItMatters: def.whyItMatters,
      howToFix: def.howToFix,
      impact: def.impact,
      effort: def.effort,
      affectedCount: urls.length,
      sampleUrls: urls.slice(0, 25),
      evidence,
    });
  };

  // Prefer real-user data where it exists; fall back to the lab measurement.
  const poorLcp = samples.filter((s) => (s.field_lcp_ms ?? s.lab_lcp_ms ?? 0) > 4000);
  const poorInp = samples.filter((s) => (s.field_inp_ms ?? 0) > 500);
  const poorCls = samples.filter((s) => (s.field_cls ?? s.lab_cls ?? 0) > 0.25);
  const lowScore = mobile.filter((s) => (s.performance_score ?? 100) < 50);

  build("cwv_lcp_poor", [...new Set(poorLcp.map((s) => s.url))], {
    worst_ms: Math.max(0, ...poorLcp.map((s) => s.field_lcp_ms ?? s.lab_lcp_ms ?? 0)),
    threshold_ms: 2500,
  });
  build("cwv_inp_poor", [...new Set(poorInp.map((s) => s.url))], {
    worst_ms: Math.max(0, ...poorInp.map((s) => s.field_inp_ms ?? 0)),
    threshold_ms: 200,
  });
  build("cwv_cls_poor", [...new Set(poorCls.map((s) => s.url))], {
    worst: Math.max(0, ...poorCls.map((s) => s.field_cls ?? s.lab_cls ?? 0)),
    threshold: 0.1,
  });
  build("perf_score_low", [...new Set(lowScore.map((s) => s.url))], {
    lowest_score: Math.min(100, ...lowScore.map((s) => s.performance_score ?? 100)),
  });

  await saveIssues(supabase, run.id, issues);
}

// ------------------------------------------------------------- 5. search data
async function phaseSearchData(ctx: Ctx): Promise<boolean> {
  const { supabase, run, site } = ctx;
  const result = await fetchSearchConsoleData(site.gsc_property, 90);

  if (!result.available) {
    await logRunEvent(supabase, run.id, "search_data", result.reason, "warn");
    ctx.state = {
      ...ctx.state,
      notes: [...(ctx.state.notes ?? []), `search_data:${result.reason}`],
    };
    await markPhase(ctx, "search_data", "degraded");
    return true;
  }

  const rows = result.queries.slice(0, 500).map((q) => ({
    run_id: run.id,
    query: q.query,
    source: "gsc" as const,
    sources: ["gsc"],
    is_question: /^(how|what|why|when|where|who|which|can|does|is)\b/i.test(q.query),
    intent: classifyIntent(q.query),
    gsc_clicks: q.clicks,
    gsc_impressions: q.impressions,
    gsc_ctr: q.ctr,
    gsc_position: q.position,
  }));

  for (let i = 0; i < rows.length; i += 100) {
    await supabase
      .from("seo_queries")
      .upsert(rows.slice(i, i + 100), { onConflict: "run_id,query_hash" });
  }

  const striking = strikingDistance(result.queries);
  if (striking.length) {
    const def = ISSUE_CATALOG.striking_distance;
    await saveIssues(supabase, run.id, [
      {
        code: "striking_distance",
        category: def.category,
        severity: def.severity,
        title: def.title,
        whatItMeans: def.whatItMeans,
        whyItMatters: def.whyItMatters,
        howToFix: def.howToFix,
        impact: def.impact,
        effort: def.effort,
        affectedCount: striking.length,
        sampleUrls: [],
        evidence: {
          keywords: striking.slice(0, 25).map((s) => ({
            query: s.query,
            position: Number(s.position.toFixed(1)),
            impressions: s.impressions,
            clicks: s.clicks,
          })),
        },
      },
    ]);
  }

  ctx.run.stats = {
    ...ctx.run.stats,
    queries_found: (ctx.run.stats.queries_found ?? 0) + rows.length,
  };
  await logRunEvent(
    supabase,
    run.id,
    "search_data",
    `Search Console connected — ${rows.length} queries, ${striking.length} within striking distance of page one`
  );
  await markPhase(ctx, "search_data", "done");
  return true;
}

// --------------------------------------------------------------- 6. questions
async function phaseQuestions(ctx: Ctx): Promise<boolean> {
  const { supabase, run, site } = ctx;

  const pages = await loadPages(supabase, run.id);
  const seeds = ctx.state.questionSeeds ?? deriveSeeds(site.domain, pages);
  ctx.state = { ...ctx.state, questionSeeds: seeds };

  if (!seeds.length) {
    await logRunEvent(supabase, run.id, "questions", "No usable seed terms found", "warn");
    await markPhase(ctx, "questions", "degraded");
    return true;
  }

  await logRunEvent(
    supabase,
    run.id,
    "questions",
    `Expanding ${seeds.length} seed terms across autocomplete and discussion sources`
  );

  const autocomplete = await mineAutocomplete(seeds, { depth: "full" });
  await heartbeat(supabase, run.id);

  const [reddit, stack] = await Promise.all([mineReddit(seeds), mineStackExchange(seeds)]);

  const merged = new Map<string, MinedQuery>();
  for (const q of [...autocomplete.queries, ...reddit, ...stack]) {
    const key = q.query.toLowerCase();
    const existing = merged.get(key);
    if (existing) {
      for (const s of q.sources) existing.sources.add(s);
      if (
        q.suggestRank !== null &&
        (existing.suggestRank === null || q.suggestRank < existing.suggestRank)
      ) {
        existing.suggestRank = q.suggestRank;
      }
    } else {
      merged.set(key, { ...q, sources: new Set(q.sources) });
    }
  }

  const all = [...merged.values()];
  const rows = all.slice(0, 1500).map((q) => ({
    run_id: run.id,
    query: q.query,
    source: q.source,
    sources: [...q.sources],
    is_question: q.isQuestion,
    intent: classifyIntent(q.query),
    suggest_rank: q.suggestRank,
    popularity: popularityProxy(q),
  }));

  for (let i = 0; i < rows.length; i += 100) {
    await supabase
      .from("seo_queries")
      .upsert(rows.slice(i, i + 100), { onConflict: "run_id,query_hash" });
  }

  const failed = autocomplete.sourcesFailed;
  if (failed.length) {
    await logRunEvent(
      supabase,
      run.id,
      "questions",
      `Some sources returned nothing: ${failed.join(", ")}`,
      "warn"
    );
  }

  ctx.run.stats = {
    ...ctx.run.stats,
    queries_found: (ctx.run.stats.queries_found ?? 0) + rows.length,
    questions_found: rows.filter((r) => r.is_question).length,
  };

  await logRunEvent(
    supabase,
    run.id,
    "questions",
    `Collected ${rows.length} real searches, ${rows.filter((r) => r.is_question).length} of them phrased as questions`
  );
  await markPhase(ctx, "questions", failed.length ? "degraded" : "done");
  return true;
}

// ------------------------------------------------------------- 7. competitors
async function phaseCompetitors(ctx: Ctx): Promise<boolean> {
  const { supabase, run, site } = ctx;
  const competitors = run.options.competitors;
  let index = ctx.state.competitorIndex ?? 0;

  const pages = await loadPages(supabase, run.id);
  const own = ownProfile(pages, site.url);

  while (index < competitors.length) {
    if (Date.now() >= ctx.deadline - 30_000) {
      ctx.state = { ...ctx.state, competitorIndex: index };
      return false;
    }

    const target = competitors[index];
    await logRunEvent(supabase, run.id, "competitors", `Crawling competitor ${target}`);

    const snapshot = await crawlCompetitor(
      target,
      run.options.competitorMaxPages,
      Math.min(ctx.deadline - 20_000, Date.now() + 90_000)
    );

    await supabase.from("seo_competitors").upsert(
      {
        run_id: run.id,
        domain: snapshot.domain,
        url: snapshot.url,
        status: snapshot.status,
        pages_crawled: snapshot.pagesCrawled,
        metrics: snapshot.metrics as unknown as Json,
        topics: snapshot.topics as unknown as Json,
        overlap: { gaps: topicGaps(own.topics, snapshot.topics) } as unknown as Json,
        error: snapshot.error,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "run_id,domain" }
    );

    index++;
    ctx.state = { ...ctx.state, competitorIndex: index };
    await heartbeat(supabase, run.id);
  }

  ctx.run.stats = { ...ctx.run.stats, competitors_crawled: competitors.length };
  await markPhase(ctx, "competitors", "done");
  return true;
}

// -------------------------------------------------------------- 8. synthesize
async function phaseSynthesize(ctx: Ctx): Promise<boolean> {
  const { supabase, run, site } = ctx;

  const pages = await loadPages(supabase, run.id);
  const { data: issueRows } = await supabase
    .from("seo_issues")
    .select("title,severity,affected_count,category,evidence,code")
    .eq("run_id", run.id)
    .order("priority", { ascending: false });

  const issues = (issueRows ?? []) as {
    title: string;
    severity: string;
    affected_count: number;
    category: string;
    code: string;
    evidence: Record<string, unknown>;
  }[];

  const { data: queryRows } = await supabase
    .from("seo_queries")
    .select("query,source,sources,is_question,suggest_rank,popularity,gsc_position,gsc_impressions")
    .eq("run_id", run.id)
    .order("popularity", { ascending: false, nullsFirst: false })
    .limit(600);

  const queries: MinedQuery[] = (queryRows ?? []).map((q) => {
    const row = q as {
      query: string;
      source: string;
      sources: string[] | null;
      is_question: boolean;
      suggest_rank: number | null;
    };
    return {
      query: row.query,
      source: row.source as MinedQuery["source"],
      sources: new Set(row.sources ?? [row.source]),
      suggestRank: row.suggest_rank,
      isQuestion: row.is_question,
    };
  });

  const { data: competitorRows } = await supabase
    .from("seo_competitors")
    .select("domain,overlap")
    .eq("run_id", run.id)
    .eq("status", "ready");

  const competitorGaps = (competitorRows ?? []).map((c) => {
    const row = c as { domain: string; overlap: { gaps?: string[] } | null };
    return { domain: row.domain, topics: row.overlap?.gaps ?? [] };
  });

  const striking =
    (issues.find((i) => i.code === "striking_distance")?.evidence?.keywords as
      | { query: string; position: number; impressions: number }[]
      | undefined) ?? [];

  const capabilities = capabilityStatuses().filter((c) => !c.available);
  const unavailable = capabilities.map((c) => ({ source: c.label, reason: c.reason }));
  for (const note of ctx.state.notes ?? []) {
    if (note.startsWith("search_data:")) {
      unavailable.push({ source: "Search Console", reason: note.slice("search_data:".length) });
    }
  }

  const scores = currentScores(ctx, issues, pages.length);

  const result = await synthesize({
    siteUrl: site.url,
    domain: site.domain,
    scores,
    topIssues: issues.slice(0, 15).map((i) => ({
      title: i.title,
      severity: i.severity,
      affected: i.affected_count,
    })),
    queries,
    pages: pages.map((p) => ({ url: p.url, title: p.title })),
    strikingDistance: striking,
    competitorGaps,
    unavailable,
  });

  // Write cluster membership back onto the query rows.
  for (const cluster of result.clusters) {
    for (let i = 0; i < cluster.queries.length; i += 100) {
      const chunk = cluster.queries.slice(i, i + 100);
      await supabase
        .from("seo_queries")
        .update({
          cluster: cluster.name,
          intent: cluster.intent,
          coverage: cluster.coverage,
          mapped_page_url: cluster.mappedPage,
        })
        .eq("run_id", run.id)
        .in("query", chunk);
    }
  }

  const gaps = result.clusters.filter((c) => c.coverage === "gap");
  if (gaps.length) {
    const def = ISSUE_CATALOG.content_gap;
    await saveIssues(supabase, run.id, [
      {
        code: "content_gap",
        category: def.category,
        severity: def.severity,
        title: def.title,
        whatItMeans: def.whatItMeans,
        whyItMatters: def.whyItMatters,
        howToFix: def.howToFix,
        impact: def.impact,
        effort: def.effort,
        affectedCount: gaps.length,
        sampleUrls: [],
        evidence: {
          clusters: gaps.slice(0, 10).map((g) => ({
            name: g.name,
            intent: g.intent,
            example_questions: g.queries.slice(0, 5),
            suggested_page: g.suggestedPage,
          })),
        },
      },
    ]);
  }

  ctx.run.summary = result.summary;
  ctx.run.stats = { ...ctx.run.stats, clusters_found: result.clusters.length };
  await updateRun(supabase, run.id, {
    summary: result.summary as unknown as Json,
    stats: ctx.run.stats as unknown as Json,
  });

  await logRunEvent(
    supabase,
    run.id,
    "synthesize",
    result.usedAi
      ? `Grouped questions into ${result.clusters.length} topic clusters and drafted the roadmap`
      : `Grouped questions into ${result.clusters.length} clusters using the built-in analyser — ` +
        `AI was not used because ${result.fallbackReason ?? "the gateway was unavailable"}`,
    result.usedAi ? "info" : "warn"
  );
  await markPhase(ctx, "synthesize", result.usedAi ? "done" : "degraded");
  return true;
}

function currentScores(
  ctx: Ctx,
  issues: { category: string; severity: string; affected_count: number }[],
  totalPages: number
) {
  const unavailable: string[] = [];
  if (ctx.run.phase_status.performance === "degraded" || ctx.run.phase_status.performance === "skipped") {
    unavailable.push("performance");
  }
  if (ctx.run.phase_status.search_data === "degraded" || ctx.run.phase_status.search_data === "skipped") {
    unavailable.push("search_presence");
  }

  return computeScores({
    issues: issues.map((i) => ({
      category: i.category as SeoIssueDraft["category"],
      severity: i.severity as SeoIssueDraft["severity"],
      affected_count: i.affected_count,
    })),
    totalPages,
    unavailable,
  });
}

// ------------------------------------------------------------------- 9. score
async function phaseScore(ctx: Ctx): Promise<boolean> {
  const { supabase, run } = ctx;

  const { data } = await supabase
    .from("seo_issues")
    .select("category,severity,affected_count")
    .eq("run_id", run.id);

  const issues = (data ?? []) as {
    category: string;
    severity: string;
    affected_count: number;
  }[];

  const totalPages = ctx.run.stats.pages_crawled ?? (await countPages(supabase, run.id));
  const scores = currentScores(ctx, issues, totalPages);

  ctx.run.stats = {
    ...ctx.run.stats,
    issues_total: issues.length,
    issues_critical: issues.filter((i) => i.severity === "critical").length,
    issues_high: issues.filter((i) => i.severity === "high").length,
  };

  await updateRun(supabase, run.id, {
    scores: scores as unknown as Json,
    score: scores.overall,
    stats: ctx.run.stats as unknown as Json,
  });

  ctx.run.scores = scores;
  await markPhase(ctx, "score", "done");
  return true;
}

async function finishRun(ctx: Ctx): Promise<void> {
  const { supabase, run, site } = ctx;
  const score = (ctx.run.scores as { overall?: number }).overall ?? null;

  await updateRun(supabase, run.id, {
    status: "ready",
    phase: "done",
    progress_pct: 100,
    finished_at: new Date().toISOString(),
    phase_state: ctx.state as unknown as Json,
  });

  await supabase
    .from("seo_sites")
    .update({
      last_run_at: new Date().toISOString(),
      last_score: score,
      updated_at: new Date().toISOString(),
    })
    .eq("id", site.id);

  await logRunEvent(
    supabase,
    run.id,
    "done",
    `Audit complete — overall score ${score ?? "not scored"}`
  );
}

export { domainOf };
