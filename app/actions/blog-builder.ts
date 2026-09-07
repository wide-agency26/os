"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import Papa from "papaparse";
import { extractUploadText } from "@/lib/content/extract-doc";
import { enqueueArticleJob, enqueueOvernightJob, runArticlePipeline, type ArticleJobMode } from "@/lib/blog/kick";
import { kickBlogWorker } from "@/lib/blog/worker-kick";
import { discoverOpportunities } from "@/lib/blog/discover";
import { brandContext, planFromNeeds } from "@/lib/blog/generate";
import { ensureBlogSettings, mapArticle } from "@/lib/blog/load";
import { syncLiveBlogCorpus } from "@/lib/blog/scrape-live";
import type { ArticleStatus, BlogSettings, PlanProposal } from "@/lib/blog/types";
import { DEFAULT_PLAN_PROMPT, slugify } from "@/lib/blog/types";

type Sb = any;

async function requireFounder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not authenticated" as string };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return { supabase, error: "Founders only" as string };
  }
  return { supabase: supabase as Sb, error: null as string | null };
}

function revalidateBlog(projectId: string, articleId?: string) {
  revalidatePath("/app/tools/blog");
  revalidatePath("/app/blog-builder");
  revalidatePath(`/app/projects/${projectId}/blog`);
  if (articleId) {
    revalidatePath(`/app/projects/${projectId}/blog/${articleId}`);
  }
}

export async function saveBlogSettings(projectId: string, patch: Partial<BlogSettings>) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  await ensureBlogSettings(supabase, projectId);
  const next: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const keys: (keyof BlogSettings)[] = [
    "enabled",
    "autonomy",
    "site_url",
    "languages",
    "brand_notes",
    "preferred_external_domains",
    "commercial_pages",
    "webhook_url",
    "max_drafts_per_night",
    "max_opportunities_per_night",
    "max_seo_iterations",
    "seo_min_score",
    "timezone",
    "plan_prompt",
  ];
  for (const k of keys) if (patch[k] !== undefined) next[k] = patch[k];
  const { error: upErr } = await supabase.from("blog_settings").update(next).eq("project_id", projectId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateBlog(projectId);
  return { ok: true as const };
}

export async function importBlogCorpus(projectId: string, formData: FormData) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false as const, error: "Choose a file" };
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false as const, error: "Keep corpus files under 8 MB, or split the CSV." };
  }
  let extracted: { text: string; kind: string };
  try {
    extracted = await extractUploadText(file);
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Could not read that file",
    };
  }
  const text = extracted.text;
  const rows: Record<string, unknown>[] = [];

  if (file.name.toLowerCase().endsWith(".csv") || extracted.kind === "text") {
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const records = parsed.data || [];
    for (const rec of records) {
      const keys = Object.keys(rec);
      const pick = (...needles: string[]) => {
        const k = keys.find((key) => needles.some((n) => key.toLowerCase().includes(n)));
        return (k ? rec[k] : "") || "";
      };
      const title = pick("name of the article", "title", "article", "name");
      if (!title || title.length < 8) continue;
      const kw = pick("keyword");
      rows.push({
        project_id: projectId,
        title,
        excerpt: pick("meta"),
        body_text: pick("body", "content", "objective") || title,
        keywords: kw.split(/[;,]/).map((s) => s.trim()).filter(Boolean),
        kind: "blog",
        source: "import",
        published_at: pick("publish", "date") || null,
      });
    }
  }

  if (!rows.length && text.length > 40) {
    const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    rows.push({
      project_id: projectId,
      title,
      body_text: text.slice(0, 20000),
      excerpt: text.slice(0, 240),
      kind: "blog",
      source: "import",
    });
  }

  if (!rows.length) return { ok: false as const, error: "No posts parsed" };
  const { error: insErr } = await supabase.from("blog_corpus").insert(rows);
  if (insErr) return { ok: false as const, error: insErr.message };
  revalidateBlog(projectId);
  return { ok: true as const, imported: rows.length };
}

export async function runBlogDiscover(projectId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  try {
    const settings = await ensureBlogSettings(supabase, projectId);
    const result = await discoverOpportunities(supabase, projectId, settings);
    revalidateBlog(projectId);
    return { ok: true as const, ...result };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Discover failed",
    };
  }
}

export async function startOvernightRun(projectId: string) {
  const { error } = await requireFounder();
  if (error) return { ok: false as const, error };
  try {
    const jobId = await enqueueOvernightJob(projectId);
    await kickBlogWorker(jobId);
    revalidateBlog(projectId);
    return { ok: true as const, jobId };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Pipeline failed to start",
    };
  }
}

export async function advanceBlogArticle(articleId: string, projectId: string) {
  const { error } = await requireFounder();
  if (error) return { ok: false as const, error };
  await runArticlePipeline(articleId, 1);
  revalidateBlog(projectId, articleId);
  return { ok: true as const };
}

export async function saveBlogArticle(
  articleId: string,
  projectId: string,
  patch: Record<string, unknown>
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { error: upErr } = await supabase
    .from("blog_articles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", articleId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateBlog(projectId, articleId);
  return { ok: true as const };
}

export async function setArticleStatus(
  articleId: string,
  projectId: string,
  status: ArticleStatus,
  extra: Record<string, unknown> = {}
) {
  return saveBlogArticle(articleId, projectId, { status, ...extra });
}

export async function dismissOpportunity(id: string, projectId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  await supabase
    .from("blog_opportunities")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateBlog(projectId);
  return { ok: true as const };
}

export async function queueOpportunity(id: string, projectId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  await supabase
    .from("blog_opportunities")
    .update({ status: "queued", updated_at: new Date().toISOString() })
    .eq("id", id);
  const { data: opp } = await supabase.from("blog_opportunities").select("*").eq("id", id).maybeSingle();
  let articleId: string | null = null;
  if (opp) {
    const { data: existing } = await supabase
      .from("blog_articles")
      .select("id")
      .eq("opportunity_id", id)
      .maybeSingle();
    if (!existing) {
      const { data: art } = await supabase
        .from("blog_articles")
        .insert([
          {
            project_id: projectId,
            opportunity_id: id,
            pipeline_stage: "research",
            status: "researching",
            title: opp.query,
          },
        ])
        .select("id")
        .single();
      articleId = art?.id || null;
    } else {
      articleId = existing.id;
    }
  }
  if (articleId) {
    try {
      const jobId = await enqueueArticleJob(projectId, articleId, "full");
      await kickBlogWorker(jobId);
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Failed to start article job",
      };
    }
  }
  revalidateBlog(projectId);
  return { ok: true as const, articleId };
}

export async function planBlogFromNeeds(
  projectId: string,
  needs: string,
  cadence?: string,
  ideaPrompt?: string
): Promise<{ ok: true; proposals: PlanProposal[] } | { ok: false; error: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const trimmed = needs.trim();
  const prompt = (ideaPrompt || "").trim();
  if (trimmed.length < 8 && prompt.length < 12) {
    return { ok: false, error: "Add a focus, or edit the idea prompt." };
  }
  try {
    const settings = await ensureBlogSettings(supabase, projectId);
    if (prompt && prompt !== settings.plan_prompt) {
      await supabase
        .from("blog_settings")
        .update({ plan_prompt: prompt, updated_at: new Date().toISOString() })
        .eq("project_id", projectId);
      settings.plan_prompt = prompt;
    }
    const brand = await brandContext(supabase, projectId, settings);
    const [{ data: corpus }, { data: articles }] = await Promise.all([
      supabase.from("blog_corpus").select("*").eq("project_id", projectId).limit(40),
      supabase
        .from("blog_articles")
        .select("title, status, published_url, published_urls, monitor_insights, research")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);
    const proposals = await planFromNeeds({
      needs: trimmed,
      cadence,
      ideaPrompt: prompt || settings.plan_prompt || DEFAULT_PLAN_PROMPT,
      brand,
      settings,
      corpus: (corpus || []) as any,
      priorArticles: (articles || []).map((a: any) => ({
        title: a.title || "",
        published_url: a.published_url || null,
        published_urls: a.published_urls || {},
        monitor_insights: a.monitor_insights || "",
        research_summary: a.research?.summary || a.research?.ui_summary?.[0] || "",
        status: a.status || "",
      })),
    });
    return { ok: true, proposals };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Plan failed" };
  }
}

export async function approvePlanProposals(
  projectId: string,
  proposals: PlanProposal[]
): Promise<{ ok: true; articleIds: string[] } | { ok: false; error: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  if (!proposals.length) return { ok: false, error: "Nothing to approve" };
  const settings = await ensureBlogSettings(supabase, projectId);
  const articleIds: string[] = [];
  for (const p of proposals.slice(0, 8)) {
    const baseQuery = (p.primary_keyword || p.title).trim().slice(0, 180);
    let query = baseQuery;
    const { data: existingOpp } = await supabase
      .from("blog_opportunities")
      .select("id")
      .eq("project_id", projectId)
      .eq("query", query)
      .maybeSingle();
    if (existingOpp) {
      query = `${baseQuery} · ${Date.now().toString(36).slice(-4)}`;
    }
    const { data: opp, error: oppErr } = await supabase
      .from("blog_opportunities")
      .insert([
        {
          project_id: projectId,
          query,
          intent: "informational",
          score: 85,
          score_breakdown: {
            demand: 80,
            trend: 70,
            competition: 50,
            content_gap: 80,
            authority: 60,
            intent: 70,
            business: 85,
            conversion: 70,
            freshness: 80,
            cannibalization: 90,
          },
          rationale: [p.angle, p.why].filter(Boolean).join(" — "),
          action: "create",
          status: "queued",
          source: "plan",
        },
      ])
      .select("id")
      .single();
    if (oppErr || !opp) return { ok: false, error: oppErr?.message || "Could not create plan item" };
    const { data: art, error: artErr } = await supabase
      .from("blog_articles")
      .insert([
        {
          project_id: projectId,
          opportunity_id: opp.id,
          pipeline_stage: "research",
          status: "researching",
          title: p.title,
          language: settings.languages[0] || "de",
          slug: slugify(`${p.title}-${Date.now().toString(36).slice(-4)}`) || null,
        },
      ])
      .select("id")
      .single();
    if (artErr || !art) return { ok: false, error: artErr?.message || "Could not create article stub" };
    articleIds.push(art.id);
  }
  revalidateBlog(projectId);
  return { ok: true, articleIds };
}

async function startArticleMode(projectId: string, articleId: string, mode: ArticleJobMode) {
  const { error } = await requireFounder();
  if (error) return { ok: false as const, error };
  try {
    const jobId = await enqueueArticleJob(projectId, articleId, mode);
    await kickBlogWorker(jobId);
    revalidateBlog(projectId, articleId);
    return { ok: true as const, jobId };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to start job",
    };
  }
}

export async function runArticleResearch(articleId: string, projectId: string) {
  return startArticleMode(projectId, articleId, "research");
}

export async function createArticleDraft(articleId: string, projectId: string) {
  return startArticleMode(projectId, articleId, "create");
}

export async function translateBlogArticle(articleId: string, projectId: string) {
  return startArticleMode(projectId, articleId, "translate");
}

export async function expandBlogArticle(articleId: string, projectId: string) {
  return startArticleMode(projectId, articleId, "expand");
}

export async function scrapeLiveBlog(projectId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const settings = await ensureBlogSettings(supabase, projectId);
  const { data: rows } = await supabase.from("blog_articles").select("*").eq("project_id", projectId);
  const articles = (rows || []).map(mapArticle);
  try {
    const result = await syncLiveBlogCorpus(supabase, projectId, settings, articles);
    revalidateBlog(projectId);
    return { ok: true as const, ...result };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Scrape failed" };
  }
}

export async function buildArticleNow(articleId: string, projectId: string) {
  return startArticleMode(projectId, articleId, "full");
}

export async function setPublishedUrl(
  articleId: string,
  projectId: string,
  publishedUrl: string,
  insights?: string
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const url = publishedUrl.trim();
  if (url && !/^https?:\/\//i.test(url)) {
    return { ok: false as const, error: "URL must start with http:// or https://" };
  }
  const patch: Record<string, unknown> = {
    published_url: url || null,
    monitor_insights: (insights || "").trim(),
    updated_at: new Date().toISOString(),
  };
  if (url) {
    patch.status = "published";
    patch.published_at = new Date().toISOString();
    patch.pipeline_stage = "done";
  }
  const { error: upErr } = await supabase.from("blog_articles").update(patch).eq("id", articleId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateBlog(projectId, articleId);
  return { ok: true as const };
}

export async function scheduleBlogArticle(
  articleId: string,
  projectId: string,
  scheduledFor: string | null
) {
  const patch: Record<string, unknown> = {
    scheduled_for: scheduledFor || null,
  };
  if (scheduledFor) patch.status = "scheduled";
  return saveBlogArticle(articleId, projectId, patch);
}

export async function publishArticle(articleId: string, projectId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const settings = await ensureBlogSettings(supabase, projectId);
  const { data: article } = await supabase.from("blog_articles").select("*").eq("id", articleId).maybeSingle();
  if (!article) return { ok: false as const, error: "Not found" };
  if (settings.webhook_url) {
    try {
      await fetch(settings.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "blog.publish",
          article: {
            title: article.title,
            slug: article.slug,
            body_md: article.body_md,
            meta_description: article.meta_description,
            translations: article.translations,
            scheduled_for: article.scheduled_for,
          },
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Publish webhook failed" };
    }
  }
  await supabase
    .from("blog_articles")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      pipeline_stage: "done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId);
  revalidateBlog(projectId, articleId);
  return { ok: true as const };
}

export async function setBlogArticleClientVisible(
  projectId: string,
  articleId: string,
  visible: boolean
) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { error: upErr } = await supabase
    .from("blog_articles")
    .update({ client_visible: visible, updated_at: new Date().toISOString() })
    .eq("id", articleId)
    .eq("project_id", projectId);
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateBlog(projectId, articleId);
  revalidatePath("/app/client-blog");
  return { ok: true as const };
}
