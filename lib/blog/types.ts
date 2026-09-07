import type { SeoIssueDraft, SeoIntent, SeoScores } from "@/lib/seo/types";

export type BlogAutonomy = "assisted" | "autonomous";
export type BlogAction = "create" | "update" | "expand" | "merge" | "skip";
export type OpportunityStatus =
  | "new"
  | "queued"
  | "in_progress"
  | "briefed"
  | "drafted"
  | "dismissed"
  | "refresh";
export type ArticleStatus =
  | "researching"
  | "brief"
  | "draft"
  | "optimizing"
  | "ready"
  | "scheduled"
  | "published"
  | "failed"
  | "refresh";
export type PipelineStage =
  | "research"
  | "brief"
  | "draft"
  | "seo_audit"
  | "optimize"
  | "links"
  | "quality"
  | "calendar"
  | "done"
  | "failed";

export type CommercialPage = { url: string; label: string; intent?: string };

export type BlogSettings = {
  project_id: string;
  enabled: boolean;
  autonomy: BlogAutonomy;
  site_url: string | null;
  languages: string[];
  brand_notes: string;
  preferred_external_domains: string[];
  commercial_pages: CommercialPage[];
  webhook_url: string | null;
  max_drafts_per_night: number;
  max_opportunities_per_night: number;
  max_seo_iterations: number;
  seo_min_score: number;
  timezone: string;
  plan_prompt: string;
  last_scrape_at: string | null;
};

export type CorpusEntry = {
  id: string;
  project_id: string;
  url: string | null;
  title: string;
  slug: string | null;
  excerpt: string | null;
  body_text: string;
  keywords: string[];
  category: string | null;
  kind: "blog" | "commercial" | "other";
  language: string | null;
  published_at: string | null;
  source: "import" | "crawl" | "article";
};

export type ScoreBreakdown = {
  demand: number;
  trend: number;
  competition: number;
  content_gap: number;
  authority: number;
  intent: number;
  business: number;
  conversion: number;
  freshness: number;
  cannibalization: number;
};

export type BlogOpportunity = {
  id: string;
  project_id: string;
  query: string;
  intent: SeoIntent | string | null;
  score: number;
  score_breakdown: ScoreBreakdown;
  rationale: string;
  action: BlogAction;
  cannibal_url: string | null;
  status: OpportunityStatus;
  source: string;
};

export type LinkRec = {
  url: string;
  anchor: string;
  reason: string;
  kind?: "internal" | "commercial" | "external";
};

export type CtaRec = {
  url: string;
  label: string;
  reason: string;
};

export type BriefPayload = {
  working_title: string;
  primary_keyword: string;
  secondary_keywords: string[];
  search_intent: string;
  target_audience: string;
  recommended_angle: string;
  recommended_format: string;
  questions_to_answer: string[];
  competitor_gaps: string[];
  important_entities: string[];
  research_findings: string[];
  internal_links: LinkRec[];
  external_sources: LinkRec[];
  cta: CtaRec | null;
  suggested_slug: string;
  seo_requirements: string[];
  schema: string;
};

export type KeywordSignal = {
  keyword: string;
  role: "primary" | "secondary";
  persona?: string;
  intent?: string;
  volume_hint?: string;
  rationale?: string;
};

export type ResearchDossier = {
  summary: string;
  /** 3–5 bullets for the thin UI — never dump the full dossier on the user */
  ui_summary: string[];
  questions: string[];
  entities: string[];
  competitor_notes: string[];
  sources: { title: string; url: string; why: string }[];
  stats: string[];
  llm_angles: string[];
  keywords: KeywordSignal[];
  search_queries: string[];
  talk_themes: string[];
  geo_questions: string[];
  switcher_queries: string[];
};

export type PlanProposal = {
  title: string;
  angle: string;
  why: string;
  primary_keyword?: string;
  titles?: Record<string, string>;
};

export type TranslationBlock = {
  title: string;
  body_md: string;
  meta_title?: string;
  meta_description?: string;
};

export type BlogArticle = {
  id: string;
  project_id: string;
  opportunity_id: string | null;
  pipeline_stage: PipelineStage;
  status: ArticleStatus;
  title: string;
  slug: string | null;
  language: string;
  body_md: string;
  meta_title: string | null;
  meta_description: string | null;
  translations: Record<string, TranslationBlock>;
  brief: BriefPayload | Record<string, unknown>;
  research: ResearchDossier | Record<string, unknown>;
  seo_score: number | null;
  seo_issues: SeoIssueDraft[];
  seo_scores: Partial<SeoScores>;
  internal_links: LinkRec[];
  external_links: LinkRec[];
  cta: CtaRec | null;
  schema_json: Record<string, unknown> | null;
  version_history: { at: string; stage: string; title?: string; body_md?: string }[];
  audit_history: { at: string; score: number | null; issues: SeoIssueDraft[] }[];
  scheduled_for: string | null;
  published_at: string | null;
  published_url: string | null;
  published_urls: Record<string, string>;
  monitor_insights: string;
  client_visible?: boolean;
  error: string | null;
  seo_iterations: number;
};

export type BlogRunSummary = {
  opportunities_discovered: number;
  high_priority: number;
  research_done: number;
  drafts: number;
  seo_optimized: number;
  refresh_recommended: number;
  failed: number;
  attention: { id: string; title: string; reason: string }[];
};

export const DEFAULT_PLAN_PROMPT = `Propose at least 3 bilingual posts (German + English titles) for this brand.
Use live published posts so we do not repeat them.
Search the web for current buyer questions, competitor angles, and DACH / EU context.
Titles should be commercial and precise, not clickbait.
Each idea: one clear angle, why it matters now, primary keyword.`;

export const STAGE_ORDER: PipelineStage[] = [
  "research",
  "brief",
  "draft",
  "seo_audit",
  "optimize",
  "links",
  "quality",
  "calendar",
  "done",
];

export function defaultSettings(projectId: string): BlogSettings {
  return {
    project_id: projectId,
    enabled: false,
    autonomy: "assisted",
    site_url: null,
    languages: ["de", "en"],
    brand_notes: "",
    preferred_external_domains: [],
    commercial_pages: [],
    webhook_url: null,
    max_drafts_per_night: 3,
    max_opportunities_per_night: 8,
    max_seo_iterations: 2,
    seo_min_score: 70,
    timezone: "Europe/Berlin",
    plan_prompt: DEFAULT_PLAN_PROMPT,
    last_scrape_at: null,
  };
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
