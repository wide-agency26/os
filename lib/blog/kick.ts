/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from "@/utils/supabase/admin";
import { discoverOpportunities } from "./discover";
import {
  brandContext,
  expandArticle,
  extractLinksFromMarkdown,
  nextScheduleDate,
  optimizeArticle,
  pickCta,
  researchOpportunity,
  runArticleAudit,
  translateArticle,
  writeArticle,
  writeBrief,
} from "./generate";
import { ensureBlogSettings, mapArticle } from "./load";
import { syncLiveBlogCorpus } from "./scrape-live";
import type { BlogArticle, BlogOpportunity, BlogRunSummary, CorpusEntry, PipelineStage } from "./types";
import { slugify } from "./types";

type Sb = any;

const MAX_ATTEMPTS = 4;
const BUDGET_MS = 200_000;

function snapshot(article: BlogArticle, stage: string) {
  return {
    at: new Date().toISOString(),
    stage,
    title: article.title,
    body_md: article.body_md?.slice(0, 20000),
  };
}

export async function enqueueOvernightJob(projectId: string) {
  const supabase = createAdminClient() as Sb;
  const { data: active } = await supabase
    .from("blog_jobs")
    .select("id")
    .eq("project_id", projectId)
    .eq("kind", "overnight")
    .in("status", ["queued", "running"])
    .limit(1)
    .maybeSingle();
  if (active) return active.id as string;

  const { data, error } = await supabase
    .from("blog_jobs")
    .insert([{ project_id: projectId, kind: "overnight", status: "queued", cursor: {} }])
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export type ArticleJobMode = "research" | "create" | "translate" | "expand" | "full";

/** Single-article journey job. Allows parallel overnight + article jobs per project. */
export async function enqueueArticleJob(
  projectId: string,
  articleId: string,
  mode: ArticleJobMode
) {
  const supabase = createAdminClient() as Sb;
  const { data: actives } = await supabase
    .from("blog_jobs")
    .select("id, cursor")
    .eq("project_id", projectId)
    .eq("kind", "article")
    .in("status", ["queued", "running"])
    .limit(10);
  const existing = (actives || []).find((j: any) => j?.cursor?.articleId === articleId);
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("blog_jobs")
    .insert([
      {
        project_id: projectId,
        kind: "article",
        status: "queued",
        cursor: { articleId, mode },
      },
    ])
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function runJobSlice(jobId: string): Promise<{ done: boolean; error?: string }> {
  const supabase = createAdminClient() as Sb;
  const staleBefore = new Date(Date.now() - 8 * 60_000).toISOString();
  const { data: claimed } = await supabase
    .from("blog_jobs")
    .update({
      status: "running",
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .in("status", ["queued", "running"])
    .or(`heartbeat_at.is.null,heartbeat_at.lt.${staleBefore},status.eq.queued`)
    .select("*")
    .maybeSingle();

  if (!claimed) return { done: true };

  if ((claimed.attempt || 0) >= MAX_ATTEMPTS) {
    await supabase
      .from("blog_jobs")
      .update({
        status: "failed",
        error: `Gave up after ${MAX_ATTEMPTS} attempts`,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return { done: true, error: "too many attempts" };
  }

  await supabase.from("blog_jobs").update({ attempt: (claimed.attempt || 0) + 1 }).eq("id", jobId);

  try {
    const outcome =
      claimed.kind === "article"
        ? await processArticleJob(supabase, claimed)
        : await processOvernight(supabase, claimed);
    if (outcome.done) {
      await supabase
        .from("blog_jobs")
        .update({
          status: outcome.error ? "failed" : "done",
          error: outcome.error || null,
          finished_at: new Date().toISOString(),
          heartbeat_at: new Date().toISOString(),
          cursor: outcome.cursor || claimed.cursor,
        })
        .eq("id", jobId);
    } else {
      await supabase
        .from("blog_jobs")
        .update({
          status: "running",
          attempt: 0,
          heartbeat_at: new Date().toISOString(),
          cursor: outcome.cursor,
        })
        .eq("id", jobId);
    }
    return { done: outcome.done, error: outcome.error };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job failed";
    await supabase
      .from("blog_jobs")
      .update({ error: message, heartbeat_at: new Date().toISOString() })
      .eq("id", jobId);
    return { done: false, error: message };
  }
}

async function processArticleJob(
  supabase: Sb,
  job: { id: string; project_id: string; cursor: any }
): Promise<{ done: boolean; cursor: any; error?: string }> {
  const deadline = Date.now() + BUDGET_MS;
  const projectId = job.project_id;
  const cursor = { ...(job.cursor || {}) };
  const articleId = cursor.articleId as string | undefined;
  const mode = (cursor.mode || "full") as ArticleJobMode;
  if (!articleId) return { done: true, cursor, error: "Missing articleId" };

  const settings = await ensureBlogSettings(supabase, projectId);
  const { data: corpusRows } = await supabase.from("blog_corpus").select("*").eq("project_id", projectId);
  const corpus = (corpusRows || []) as CorpusEntry[];
  const brand = await brandContext(supabase, projectId, settings);
  const summary: BlogRunSummary = {
    opportunities_discovered: 0,
    high_priority: 0,
    research_done: 0,
    drafts: 0,
    seo_optimized: 0,
    refresh_recommended: 0,
    failed: 0,
    attention: [],
  };

  while (Date.now() < deadline) {
    const { data: row } = await supabase.from("blog_articles").select("*").eq("id", articleId).maybeSingle();
    if (!row) return { done: true, cursor, error: "Article not found" };
    const article = mapArticle(row);

    if (mode === "translate") {
      await runTranslateOnly({ supabase, article, settings, brand });
      return { done: true, cursor };
    }

    if (mode === "expand") {
      if (!article.body_md) throw new Error("Create the article before expanding");
      const expanded = await expandArticle({
        title: article.title,
        body_md: article.body_md,
        language: article.language || settings.languages[0] || "de",
        brand,
      });
      const history = [...(article.version_history || []), snapshot(article, "expand")].slice(-12);
      await supabase
        .from("blog_articles")
        .update({
          title: expanded.title,
          body_md: expanded.body_md,
          version_history: history,
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      return { done: true, cursor };
    }

    if (mode === "research") {
      if (article.pipeline_stage !== "research" && hasResearch(article)) {
        return { done: true, cursor };
      }
      if (article.pipeline_stage !== "research") {
        await supabase
          .from("blog_articles")
          .update({ pipeline_stage: "research", status: "researching", updated_at: new Date().toISOString() })
          .eq("id", articleId);
        continue;
      }
      const opp = await ensureOpportunity(supabase, article, settings);
      await advanceStage({
        supabase,
        article,
        opp,
        corpus,
        settings,
        brand,
        summary,
        stopAfter: "research",
        skipTranslate: true,
      });
      return { done: true, cursor };
    }

    if (mode === "create") {
      if (["ready", "scheduled", "published"].includes(article.status) && article.body_md) {
        return { done: true, cursor };
      }
      if (article.pipeline_stage === "done" || article.pipeline_stage === "failed") {
        return { done: true, cursor };
      }
      // Ensure research exists first
      if (article.pipeline_stage === "research" || !hasResearch(article)) {
        const opp = await ensureOpportunity(supabase, article, settings);
        const fresh = mapArticle(
          (
            await supabase
              .from("blog_articles")
              .update(
                !hasResearch(article)
                  ? { pipeline_stage: "research", status: "researching", updated_at: new Date().toISOString() }
                  : { updated_at: new Date().toISOString() }
              )
              .eq("id", articleId)
              .select("*")
              .single()
          ).data || row
        );
        await advanceStage({
          supabase,
          article: fresh.pipeline_stage === "research" ? fresh : article,
          opp,
          corpus,
          settings,
          brand,
          summary,
          stopAfter: article.pipeline_stage === "research" || !hasResearch(article) ? "research" : undefined,
          skipTranslate: true,
        });
        continue;
      }
      const opp = await ensureOpportunity(supabase, article, settings);
      const result = await advanceStage({
        supabase,
        article,
        opp,
        corpus,
        settings,
        brand,
        summary,
        stopAfter: "ready",
        skipTranslate: true,
      });
      if (result.finished) return { done: true, cursor };
      continue;
    }

    // full: research → ready (no translate)
    if (article.pipeline_stage === "done" || article.pipeline_stage === "failed") {
      return { done: true, cursor };
    }
    if (["ready", "scheduled", "published"].includes(article.status) && article.body_md) {
      return { done: true, cursor };
    }
    const opp = await ensureOpportunity(supabase, article, settings);
    const result = await advanceStage({
      supabase,
      article,
      opp,
      corpus,
      settings,
      brand,
      summary,
      stopAfter: "ready",
      skipTranslate: true,
    });
    if (result.finished) return { done: true, cursor };
  }

  return { done: false, cursor };
}

function hasResearch(article: BlogArticle) {
  const r = article.research as Record<string, unknown>;
  return Boolean(r && (r.summary || (Array.isArray(r.ui_summary) && r.ui_summary.length)));
}

async function ensureOpportunity(
  supabase: Sb,
  article: BlogArticle,
  settings: Awaited<ReturnType<typeof ensureBlogSettings>>
): Promise<BlogOpportunity> {
  if (article.opportunity_id) {
    const { data } = await supabase
      .from("blog_opportunities")
      .select("*")
      .eq("id", article.opportunity_id)
      .maybeSingle();
    if (data) return data as BlogOpportunity;
  }
  const { data: created, error } = await supabase
    .from("blog_opportunities")
    .insert([
      {
        project_id: article.project_id,
        query: article.title || "Untitled topic",
        intent: "informational",
        score: 80,
        score_breakdown: {},
        rationale: "Created from Plan journey",
        action: "create",
        status: "in_progress",
        source: "plan",
      },
    ])
    .select("*")
    .single();
  if (error || !created) throw new Error(error?.message || "Could not create opportunity");
  await supabase
    .from("blog_articles")
    .update({
      opportunity_id: created.id,
      language: settings.languages[0] || "de",
      updated_at: new Date().toISOString(),
    })
    .eq("id", article.id);
  return created as BlogOpportunity;
}

async function runTranslateOnly(input: {
  supabase: Sb;
  article: BlogArticle;
  settings: Awaited<ReturnType<typeof ensureBlogSettings>>;
  brand: string;
}) {
  const { supabase, article, settings, brand } = input;
  if (!article.body_md) throw new Error("Create the article before translating");
  const primary = article.language || settings.languages[0] || "de";
  const targets = settings.languages.filter((l) => l !== primary);
  const translations = { ...(article.translations || {}) };
  for (const lang of targets) {
    const written = await translateArticle({
      title: article.title,
      body_md: article.body_md,
      meta_description: article.meta_description,
      sourceLanguage: primary,
      targetLanguage: lang,
      brand,
    });
    translations[lang] = {
      title: written.title,
      body_md: written.body_md,
      meta_title: written.meta_title,
      meta_description: written.meta_description,
    };
  }
  await supabase
    .from("blog_articles")
    .update({
      translations,
      updated_at: new Date().toISOString(),
    })
    .eq("id", article.id);
}

async function processOvernight(
  supabase: Sb,
  job: { id: string; project_id: string; cursor: any }
): Promise<{ done: boolean; cursor: any; error?: string }> {
  const deadline = Date.now() + BUDGET_MS;
  const projectId = job.project_id;
  const settings = await ensureBlogSettings(supabase, projectId);
  const cursor = { ...(job.cursor || {}) };
  const summary: BlogRunSummary = cursor.summary || {
    opportunities_discovered: 0,
    high_priority: 0,
    research_done: 0,
    drafts: 0,
    seo_optimized: 0,
    refresh_recommended: 0,
    failed: 0,
    attention: [],
  };

  if (!cursor.runId) {
    const { data: run } = await supabase
      .from("blog_runs")
      .insert([{ project_id: projectId, job_id: job.id, status: "running", summary }])
      .select("id")
      .single();
    cursor.runId = run?.id;
  }

  if (!cursor.scraped) {
    const { data: artRows } = await supabase.from("blog_articles").select("*").eq("project_id", projectId);
    await syncLiveBlogCorpus(supabase, projectId, settings, (artRows || []).map(mapArticle));
    cursor.scraped = true;
    return { done: false, cursor: { ...cursor, summary } };
  }

  if (!cursor.discovered) {
    const disc = await discoverOpportunities(supabase, projectId, settings);
    cursor.discovered = true;
    summary.opportunities_discovered = disc.upserted;
    summary.high_priority = disc.highPriority;
    summary.refresh_recommended = disc.refresh;
    await persistRun(supabase, cursor.runId, summary);
    return { done: false, cursor: { ...cursor, summary } };
  }

  const { data: corpusRows } = await supabase.from("blog_corpus").select("*").eq("project_id", projectId);
  const corpus = (corpusRows || []) as CorpusEntry[];

  if (!cursor.queuedIds) {
    const { data: createOpps } = await supabase
      .from("blog_opportunities")
      .select("*")
      .eq("project_id", projectId)
      .eq("action", "create")
      .in("status", ["new", "queued"])
      .order("score", { ascending: false })
      .limit(settings.max_drafts_per_night);

    const ids: string[] = [];
    for (const opp of createOpps || []) {
      const existing = await supabase
        .from("blog_articles")
        .select("id")
        .eq("opportunity_id", opp.id)
        .maybeSingle();
      if (existing.data) {
        ids.push(existing.data.id);
        continue;
      }
      const { data: art, error } = await supabase
        .from("blog_articles")
        .insert([
          {
            project_id: projectId,
            opportunity_id: opp.id,
            pipeline_stage: "research",
            status: "researching",
            title: opp.query,
            language: settings.languages[0] || "de",
            slug: slugify(opp.query) || null,
          },
        ])
        .select("id")
        .single();
      if (!error && art) {
        ids.push(art.id);
        await supabase
          .from("blog_opportunities")
          .update({ status: "in_progress", updated_at: new Date().toISOString() })
          .eq("id", opp.id);
      }
    }
    cursor.queuedIds = ids;
    cursor.index = 0;
    return { done: false, cursor: { ...cursor, summary } };
  }

  const ids: string[] = cursor.queuedIds || [];
  let index = Number(cursor.index || 0);

  while (index < ids.length && Date.now() < deadline) {
    const articleId = ids[index];
    const { data: row } = await supabase.from("blog_articles").select("*").eq("id", articleId).maybeSingle();
    if (!row) {
      index++;
      continue;
    }
    const article = mapArticle(row);
    const { data: oppRow } = article.opportunity_id
      ? await supabase.from("blog_opportunities").select("*").eq("id", article.opportunity_id).maybeSingle()
      : { data: null };
    const opp = oppRow as BlogOpportunity | null;
    if (!opp) {
      index++;
      continue;
    }

    const brand = await brandContext(supabase, projectId, settings);
    const next = await advanceStage({ supabase, article, opp, corpus, settings, brand, summary });
    if (next.finished) index++;
    cursor.index = index;
    cursor.summary = summary;
    await persistRun(supabase, cursor.runId, summary);
    if (Date.now() >= deadline) return { done: false, cursor };
  }

  const done = index >= ids.length;
  if (done) {
    await supabase
      .from("blog_runs")
      .update({ status: "done", summary, finished_at: new Date().toISOString() })
      .eq("id", cursor.runId);
  }
  return { done, cursor: { ...cursor, summary, index } };
}

async function persistRun(supabase: Sb, runId: string | undefined, summary: BlogRunSummary) {
  if (!runId) return;
  await supabase.from("blog_runs").update({ summary }).eq("id", runId);
}

export async function advanceStage(input: {
  supabase: Sb;
  article: BlogArticle;
  opp: BlogOpportunity;
  corpus: CorpusEntry[];
  settings: Awaited<ReturnType<typeof ensureBlogSettings>>;
  brand: string;
  summary: BlogRunSummary;
  /** Stop after completing this stage (inclusive). "ready" = stop when status is ready. */
  stopAfter?: "research" | "ready";
  skipTranslate?: boolean;
}): Promise<{ finished: boolean }> {
  const { supabase, article, opp, corpus, settings, brand, summary, stopAfter, skipTranslate } = input;
  const stage: PipelineStage = article.pipeline_stage;

  try {
    if (stage === "research") {
      const dossier = await researchOpportunity({ opportunity: opp, corpus, brand });
      await supabase
        .from("blog_articles")
        .update({
          research: dossier,
          pipeline_stage: "brief",
          status: "brief",
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      summary.research_done += 1;
      return { finished: stopAfter === "research" };
    }

    if (stage === "brief") {
      const brief = await writeBrief({
        opportunity: opp,
        research: article.research as any,
        corpus,
        settings,
        brand,
      });
      await supabase
        .from("blog_articles")
        .update({
          brief,
          pipeline_stage: "draft",
          title: brief.working_title,
          slug: brief.suggested_slug,
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      await supabase
        .from("blog_opportunities")
        .update({ status: "briefed", updated_at: new Date().toISOString() })
        .eq("id", opp.id);
      return { finished: false };
    }

    if (stage === "draft") {
      const primaryLang = settings.languages[0] || "de";
      const written = await writeArticle({
        brief: article.brief as any,
        research: article.research as any,
        settings,
        brand,
        language: primaryLang,
      });
      // Translations are a separate journey step (Translate tab) unless overnight wants them.
      const translations: Record<string, { title: string; body_md: string; meta_description?: string }> =
        skipTranslate ? { ...(article.translations || {}) } : { ...(article.translations || {}) };
      if (!skipTranslate) {
        for (const lang of settings.languages.slice(1, 2)) {
          translations[lang] = await writeArticle({
            brief: article.brief as any,
            research: article.research as any,
            settings,
            brand,
            language: lang,
          });
        }
      }
      const history = [...article.version_history, snapshot(article, "draft")];
      await supabase
        .from("blog_articles")
        .update({
          title: written.title,
          body_md: written.body_md,
          meta_title: written.meta_title,
          meta_description: written.meta_description,
          language: primaryLang,
          translations,
          pipeline_stage: "seo_audit",
          status: "optimizing",
          version_history: history,
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      summary.drafts += 1;
      return { finished: false };
    }

    if (stage === "seo_audit") {
      const audit = runArticleAudit(article);
      const audits = [
        ...article.audit_history,
        { at: new Date().toISOString(), score: audit.scores.overall, issues: audit.issues },
      ];
      const nextStage: PipelineStage =
        audit.scores.overall >= settings.seo_min_score || article.seo_iterations >= settings.max_seo_iterations
          ? "links"
          : "optimize";
      await supabase
        .from("blog_articles")
        .update({
          seo_score: audit.scores.overall,
          seo_scores: audit.scores,
          seo_issues: audit.issues,
          audit_history: audits,
          pipeline_stage: nextStage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      return { finished: false };
    }

    if (stage === "optimize") {
      const improved = await optimizeArticle({
        article,
        issues: article.seo_issues,
        settings,
      });
      const history = [...article.version_history, snapshot({ ...article, ...improved } as BlogArticle, "optimize")];
      await supabase
        .from("blog_articles")
        .update({
          title: improved.title,
          body_md: improved.body_md,
          meta_description: improved.meta_description,
          seo_iterations: article.seo_iterations + 1,
          pipeline_stage: "seo_audit",
          version_history: history,
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      summary.seo_optimized += 1;
      return { finished: false };
    }

    if (stage === "links") {
      const links = extractLinksFromMarkdown(article.body_md, corpus, settings);
      const cta = article.cta || pickCta(settings, corpus, String(opp.intent || "informational"));
      await supabase
        .from("blog_articles")
        .update({
          internal_links: links.internal,
          external_links: links.external,
          cta,
          pipeline_stage: "quality",
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      return { finished: false };
    }

    if (stage === "quality") {
      const audit = runArticleAudit({ ...article, cta: article.cta });
      const pass = audit.scores.overall >= Math.min(60, settings.seo_min_score - 10);
      await supabase
        .from("blog_articles")
        .update({
          seo_score: audit.scores.overall,
          seo_issues: audit.issues,
          seo_scores: audit.scores,
          pipeline_stage: pass ? "calendar" : "done",
          status: "ready",
          error: pass ? null : "Quality check below bar — left for human review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      if (stopAfter === "ready" && !pass) return { finished: true };
      return { finished: false };
    }

    if (stage === "calendar") {
      const { data: scheduled } = await supabase
        .from("blog_articles")
        .select("scheduled_for")
        .eq("project_id", article.project_id)
        .not("scheduled_for", "is", null);
      const date = article.scheduled_for || nextScheduleDate(scheduled || []);
      const autonomous = settings.autonomy === "autonomous";
      await supabase
        .from("blog_articles")
        .update({
          scheduled_for: date,
          pipeline_stage: "done",
          status: autonomous ? "scheduled" : "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      await supabase
        .from("blog_opportunities")
        .update({ status: "drafted", updated_at: new Date().toISOString() })
        .eq("id", opp.id);
      summary.attention.push({
        id: article.id,
        title: article.title,
        reason: autonomous ? `Scheduled ${date}` : "Needs approval",
      });
      return { finished: true };
    }

    return { finished: true };
  } catch (err) {
    summary.failed += 1;
    await supabase
      .from("blog_articles")
      .update({
        status: "failed",
        pipeline_stage: "failed",
        error: err instanceof Error ? err.message : "Stage failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id);
    return { finished: true };
  }
}

/** Advance a single article one or more stages (manual kick). */
export async function runArticlePipeline(articleId: string, steps = 1) {
  const supabase = createAdminClient() as Sb;
  const { data: row } = await supabase.from("blog_articles").select("*").eq("id", articleId).maybeSingle();
  if (!row) throw new Error("Article not found");
  const article = mapArticle(row);
  const settings = await ensureBlogSettings(supabase, article.project_id);
  const { data: corpusRows } = await supabase.from("blog_corpus").select("*").eq("project_id", article.project_id);
  const { data: opp } = article.opportunity_id
    ? await supabase.from("blog_opportunities").select("*").eq("id", article.opportunity_id).maybeSingle()
    : { data: null };
  if (!opp) throw new Error("Opportunity missing");
  const brand = await brandContext(supabase, article.project_id, settings);
  const summary: BlogRunSummary = {
    opportunities_discovered: 0,
    high_priority: 0,
    research_done: 0,
    drafts: 0,
    seo_optimized: 0,
    refresh_recommended: 0,
    failed: 0,
    attention: [],
  };
  let current = article;
  for (let i = 0; i < steps; i++) {
    const { data: fresh } = await supabase.from("blog_articles").select("*").eq("id", articleId).single();
    current = mapArticle(fresh);
    if (current.pipeline_stage === "done" || current.pipeline_stage === "failed") break;
    await advanceStage({
      supabase,
      article: current,
      opp: opp as BlogOpportunity,
      corpus: (corpusRows || []) as CorpusEntry[],
      settings,
      brand,
      summary,
    });
  }
}
