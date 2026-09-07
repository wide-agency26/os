/* eslint-disable @typescript-eslint/no-explicit-any */
import { defaultSettings, type BlogArticle, type BlogOpportunity, type BlogSettings, type CorpusEntry } from "./types";

type Sb = any;

export function mapSettings(row: any, projectId: string): BlogSettings {
  if (!row) return defaultSettings(projectId);
  return {
    project_id: projectId,
    enabled: Boolean(row.enabled),
    autonomy: row.autonomy === "autonomous" ? "autonomous" : "assisted",
    site_url: row.site_url || null,
    languages: Array.isArray(row.languages) && row.languages.length ? row.languages : ["de", "en"],
    brand_notes: row.brand_notes || "",
    preferred_external_domains: row.preferred_external_domains || [],
    commercial_pages: Array.isArray(row.commercial_pages) ? row.commercial_pages : [],
    webhook_url: row.webhook_url || null,
    max_drafts_per_night: Number(row.max_drafts_per_night || 3),
    max_opportunities_per_night: Number(row.max_opportunities_per_night || 8),
    max_seo_iterations: Number(row.max_seo_iterations || 2),
    seo_min_score: Number(row.seo_min_score || 70),
    timezone: row.timezone || "Europe/Berlin",
    plan_prompt: row.plan_prompt || "",
    last_scrape_at: row.last_scrape_at || null,
  };
}

export function mapArticle(row: any): BlogArticle {
  return {
    id: row.id,
    project_id: row.project_id,
    opportunity_id: row.opportunity_id,
    pipeline_stage: row.pipeline_stage,
    status: row.status,
    title: row.title || "",
    slug: row.slug,
    language: row.language || "de",
    body_md: row.body_md || "",
    meta_title: row.meta_title,
    meta_description: row.meta_description,
    translations: row.translations || {},
    brief: row.brief || {},
    research: row.research || {},
    seo_score: row.seo_score,
    seo_issues: Array.isArray(row.seo_issues) ? row.seo_issues : [],
    seo_scores: row.seo_scores || {},
    internal_links: row.internal_links || [],
    external_links: row.external_links || [],
    cta: row.cta || null,
    schema_json: row.schema_json,
    version_history: Array.isArray(row.version_history) ? row.version_history : [],
    audit_history: Array.isArray(row.audit_history) ? row.audit_history : [],
    scheduled_for: row.scheduled_for,
    published_at: row.published_at,
    published_url: row.published_url || null,
    published_urls: row.published_urls && typeof row.published_urls === "object" ? row.published_urls : {},
    monitor_insights: row.monitor_insights || "",
    client_visible: row.client_visible !== false,
    error: row.error,
    seo_iterations: Number(row.seo_iterations || 0),
  };
}

export async function ensureBlogSettings(supabase: Sb, projectId: string): Promise<BlogSettings> {
  const { data } = await supabase
    .from("blog_settings")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (data) return mapSettings(data, projectId);
  const seed = defaultSettings(projectId);
  await supabase.from("blog_settings").insert([
    {
      project_id: projectId,
      enabled: false,
      autonomy: "assisted",
      languages: seed.languages,
    },
  ]);
  return seed;
}

export async function loadBlogWorkspace(supabase: Sb, projectId: string) {
  const settings = await ensureBlogSettings(supabase, projectId);
  if (!settings.site_url) {
    const { data: project } = await supabase
      .from("projects")
      .select("client:client_id ( website )")
      .eq("id", projectId)
      .maybeSingle();
    const client = Array.isArray(project?.client) ? project?.client[0] : project?.client;
    const website = typeof client?.website === "string" ? client.website.trim() : "";
    if (website) {
      const site = website.startsWith("http") ? website : `https://${website}`;
      await supabase
        .from("blog_settings")
        .update({ site_url: site, updated_at: new Date().toISOString() })
        .eq("project_id", projectId);
      settings.site_url = site;
    }
  }
  const [{ data: opps }, { data: articles }, { data: corpus }, { data: runs }, { data: jobs }] =
    await Promise.all([
      supabase
        .from("blog_opportunities")
        .select("*")
        .eq("project_id", projectId)
        .order("score", { ascending: false })
        .limit(80),
      supabase
        .from("blog_articles")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false })
        .limit(80),
      supabase.from("blog_corpus").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase
        .from("blog_runs")
        .select("*")
        .eq("project_id", projectId)
        .order("started_at", { ascending: false })
        .limit(8),
      supabase
        .from("blog_jobs")
        .select("*")
        .eq("project_id", projectId)
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false })
        .limit(3),
    ]);
  return {
    settings,
    opportunities: (opps || []) as BlogOpportunity[],
    articles: (articles || []).map(mapArticle),
    corpus: (corpus || []) as CorpusEntry[],
    runs: runs || [],
    activeJob: jobs?.[0] || null,
  };
}

export async function loadArticle(supabase: Sb, id: string): Promise<BlogArticle | null> {
  const { data } = await supabase.from("blog_articles").select("*").eq("id", id).maybeSingle();
  return data ? mapArticle(data) : null;
}
