/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  generateJsonFromGateway,
  generateTextFromGateway,
  hasGatewayCredentials,
} from "@/lib/ai/gateway-json";
import { loadCiBrandText } from "@/lib/content/ci-context";
import { auditArticle } from "@/lib/seo/analyze/article";
import type { SeoIssueDraft } from "@/lib/seo/types";
import type {
  BlogArticle,
  BlogOpportunity,
  BlogSettings,
  BriefPayload,
  CorpusEntry,
  CtaRec,
  LinkRec,
  PlanProposal,
  ResearchDossier,
} from "./types";
import { DEFAULT_PLAN_PROMPT, slugify } from "./types";
import { scrapeLiveBlogIndexes, webSearchSnippets } from "./scrape-live";

type Sb = any;

function clip(text: string, n: number) {
  return text.length > n ? text.slice(0, n) + "…" : text;
}

function normalizeResearch(json: any, fallbackSummary: string): ResearchDossier {
  const summary = String(json?.summary || fallbackSummary);
  const ui =
    Array.isArray(json?.ui_summary) && json.ui_summary.length
      ? json.ui_summary.map(String).slice(0, 5)
      : summary
          .split(/(?<=[.!?])\s+/)
          .map((s: string) => s.trim())
          .filter(Boolean)
          .slice(0, 4);
  return {
    summary,
    ui_summary: ui,
    questions: Array.isArray(json?.questions) ? json.questions.map(String) : [],
    entities: Array.isArray(json?.entities) ? json.entities.map(String) : [],
    competitor_notes: Array.isArray(json?.competitor_notes) ? json.competitor_notes.map(String) : [],
    sources: Array.isArray(json?.sources)
      ? json.sources
          .filter((s: any) => s?.url && String(s.url).startsWith("http"))
          .map((s: any) => ({ title: String(s.title || s.url), url: String(s.url), why: String(s.why || "") }))
      : [],
    stats: Array.isArray(json?.stats) ? json.stats.map(String) : [],
    llm_angles: Array.isArray(json?.llm_angles) ? json.llm_angles.map(String) : [],
    keywords: Array.isArray(json?.keywords)
      ? json.keywords.map((k: any) => ({
          keyword: String(k?.keyword || k || ""),
          role: k?.role === "primary" ? "primary" : "secondary",
          persona: k?.persona ? String(k.persona) : undefined,
          intent: k?.intent ? String(k.intent) : undefined,
          volume_hint: k?.volume_hint ? String(k.volume_hint) : undefined,
          rationale: k?.rationale ? String(k.rationale) : undefined,
        })).filter((k: { keyword: string }) => k.keyword)
      : [],
    search_queries: Array.isArray(json?.search_queries) ? json.search_queries.map(String) : [],
    talk_themes: Array.isArray(json?.talk_themes) ? json.talk_themes.map(String) : [],
    geo_questions: Array.isArray(json?.geo_questions) ? json.geo_questions.map(String) : [],
    switcher_queries: Array.isArray(json?.switcher_queries) ? json.switcher_queries.map(String) : [],
  };
}

export async function brandContext(supabase: Sb, projectId: string, settings: BlogSettings) {
  const ci = await loadCiBrandText(supabase, projectId);
  return clip(
    [settings.brand_notes, ci?.text || ""].filter(Boolean).join("\n\n"),
    4000
  );
}

/** Plan from plain-language needs — learning loop uses prior published posts + insights. */
export async function planFromNeeds(input: {
  needs: string;
  cadence?: string;
  ideaPrompt?: string;
  brand: string;
  settings: BlogSettings;
  corpus: CorpusEntry[];
  priorArticles: {
    title: string;
    published_url: string | null;
    published_urls?: Record<string, string>;
    monitor_insights: string;
    research_summary?: string;
    status: string;
  }[];
}): Promise<PlanProposal[]> {
  const langs = input.settings.languages.length ? input.settings.languages : ["de", "en"];
  const ideaPrompt = (input.ideaPrompt || input.settings.plan_prompt || DEFAULT_PLAN_PROMPT).trim();

  const [live, web] = await Promise.all([
    scrapeLiveBlogIndexes(input.settings).catch(() => ({ posts: [] as { title: string; url: string; language: string }[] })),
    webSearchSnippets(input.needs || ideaPrompt.split("\n")[0] || "e-signature API DACH").catch(() => []),
  ]);

  const prior = input.priorArticles
    .slice(0, 12)
    .map((a) => {
      const urls = a.published_urls ? Object.entries(a.published_urls).map(([l, u]) => `${l}:${u}`).join(" ") : a.published_url;
      const bits = [
        a.title,
        a.status,
        urls ? `live=${urls}` : null,
        a.monitor_insights ? `insights=${a.monitor_insights.slice(0, 240)}` : null,
        a.research_summary ? `was about=${a.research_summary.slice(0, 200)}` : null,
      ].filter(Boolean);
      return `- ${bits.join(" · ")}`;
    })
    .join("\n");
  const corpusLines = [
    ...live.posts.map((p) => `- LIVE ${p.language.toUpperCase()}: ${p.title} (${p.url})`),
    ...input.corpus.slice(0, 12).map((c) => `- ${c.title}`),
  ].join("\n");
  const webLines = web.map((w) => `- ${w.title} — ${w.snippet} (${w.url})`).join("\n");

  const fallback: PlanProposal[] = langs.includes("de")
    ? [
        {
          title: "DSGVO vs. US Cloud Act: was Softwarehersteller vor der Signatur-API klären müssen",
          titles: {
            de: "DSGVO vs. US Cloud Act: was Softwarehersteller vor der Signatur-API klären müssen",
            en: "GDPR vs US Cloud Act: what software vendors must settle before an e-sign API",
          },
          angle: "Lead with sovereignty risk, then the EU-hosted answer.",
          why: "Fallback idea while search is unavailable — still bilingual.",
          primary_keyword: "e-signatur api dsgvo",
        },
        {
          title: "White-Label E-Signatur: der Leitfaden für Softwarehersteller",
          titles: {
            de: "White-Label E-Signatur: der Leitfaden für Softwarehersteller",
            en: "White-label e-signature: a guide for software vendors",
          },
          angle: "Integration economics and who owns the customer relationship.",
          why: "Commercial intent without repeating a generic 'what is eIDAS' explainer.",
          primary_keyword: "white label e-signature api",
        },
        {
          title: "Warum ein Wechsel der Signatur-API in 90 Tagen machbar ist",
          titles: {
            de: "Warum ein Wechsel der Signatur-API in 90 Tagen machbar ist",
            en: "Why switching e-signature APIs in 90 days is realistic",
          },
          angle: "Switcher objections, migration steps, no lock-in myth.",
          why: "Captures late-funnel buyers comparing incumbents.",
          primary_keyword: "e-signature api migration",
        },
      ]
    : [
        {
          title: input.needs.slice(0, 80) || "New blog post",
          angle: "Lead with the buyer problem, then your product answer.",
          why: "Directly matches what you asked to cover.",
          primary_keyword: input.needs.slice(0, 60),
        },
        {
          title: "What buyers ask before they pick an API",
          angle: "FAQ structure from real search questions.",
          why: "Second angle so Plan never ships a single idea.",
        },
        {
          title: "How to brief your engineering team on this topic",
          angle: "Internal champion / implementer story.",
          why: "Third angle for cadence.",
        },
      ];

  if (!hasGatewayCredentials()) return fallback.slice(0, 5);

  let json: any = null;
  try {
    json = await generateJsonFromGateway({
      system: `You are WIDE's editorial planner for B2B SaaS blogs (often DACH / Sign2x-style).
Output ONLY JSON: { "posts": [{ "title": "", "titles": { "de": "", "en": "" }, "angle": "", "why": "", "primary_keyword": "" }] }
Propose AT LEAST 3 and at most 5 posts. Every post MUST include titles for: ${langs.join(", ")}.
"title" is the primary language (${langs[0]}) title.
Use live posts so you do not duplicate. Use web snippets as current demand, not as claims to copy.
Titles: commercial + precise, not clickbait.`,
      prompt: `Planner instructions (admin-editable):
${ideaPrompt}

What the user wants covered now:
${input.needs || "(use the planner instructions)"}

Cadence hint: ${input.cadence || "a few posts soon"}

Languages: ${langs.join(", ")}

Brand / CI:
${input.brand}

Live published posts (scraped — source of truth for what is already live):
${corpusLines || "(none scraped)"}

Web search snippets:
${webLines || "(none)"}

Prior drafts + monitor insights:
${prior || "(none yet)"}

Commercial CTA targets:
${JSON.stringify(input.settings.commercial_pages).slice(0, 1500)}`,
      maxOutputTokens: 2800,
    });
  } catch {
    json = null;
  }

  const posts = Array.isArray(json?.posts) ? json.posts : [];
  const mapped: PlanProposal[] = posts.map((p: any) => {
    const titles: Record<string, string> = {};
    const rawTitles = p?.titles && typeof p.titles === "object" ? p.titles : {};
    for (const lang of langs) {
      const t = String(rawTitles[lang] || (lang === langs[0] ? p?.title : "") || "").trim();
      if (t) titles[lang] = t.slice(0, 160);
    }
    const title = titles[langs[0]] || String(p?.title || "Untitled").slice(0, 160);
    return {
      title,
      titles,
      angle: String(p?.angle || "").slice(0, 400),
      why: String(p?.why || "").slice(0, 400),
      primary_keyword: p?.primary_keyword ? String(p.primary_keyword).slice(0, 120) : undefined,
    };
  });
  if (mapped.length >= 3) return mapped.slice(0, 5);
  return [...mapped, ...fallback].slice(0, Math.max(3, mapped.length));
}

export async function researchOpportunity(input: {
  opportunity: BlogOpportunity;
  corpus: CorpusEntry[];
  brand: string;
}): Promise<ResearchDossier> {
  const existing = input.corpus
    .slice(0, 20)
    .map((c) => `- ${c.title} (${c.url || "no url"})`)
    .join("\n");

  if (!hasGatewayCredentials()) {
    return normalizeResearch(
      {
        summary: `Heuristic dossier for “${input.opportunity.query}”. Connect AI credentials for full research.`,
        ui_summary: [
          `Topic: ${input.opportunity.query}`,
          "Need AI credentials for full keyword / competitor / GEO research.",
        ],
        questions: [`What is ${input.opportunity.query}?`, `Who needs ${input.opportunity.query}?`],
        llm_angles: [input.opportunity.rationale],
        keywords: [{ keyword: input.opportunity.query, role: "primary" }],
        search_queries: [input.opportunity.query],
        talk_themes: [],
        geo_questions: [],
        switcher_queries: [],
      },
      input.opportunity.rationale
    );
  }

  let json: any = null;
  try {
    json = await generateJsonFromGateway({
      system: `You are WIDE's B2B content researcher. Combine ALL of these into one dossier (output ONLY JSON):
{
  "summary": "5-8 sentences combining demand + talk + AI questions + competitor gaps",
  "ui_summary": ["3-5 short bullets for a busy editor — no jargon dump"],
  "questions": ["buyer questions"],
  "entities": ["..."],
  "competitor_notes": ["what other blogs cover / miss"],
  "sources": [{ "title": "", "url": "https://...", "why": "" }],
  "stats": ["only if known — no invention"],
  "llm_angles": ["how generative engines answer this"],
  "keywords": [{ "keyword": "", "role": "primary|secondary", "persona": "", "intent": "", "volume_hint": "", "rationale": "" }],
  "search_queries": ["what people type in search"],
  "talk_themes": ["what people talk about / objections"],
  "geo_questions": ["questions people ask AI / ChatGPT / Perplexity"],
  "switcher_queries": ["compliance / switcher / CLOUD Act / on-prem / sovereignty style queries"]
}
Prefer primary sources. Do not invent URLs. Write like a Sign2x research memo — not generic SEO fluff.`,
      prompt: `Query / topic: ${input.opportunity.query}
Intent: ${input.opportunity.intent}
Score rationale: ${input.opportunity.rationale}
Cannibal URL: ${input.opportunity.cannibal_url || "none"}
Action: ${input.opportunity.action}

Existing site content:
${existing || "(none imported)"}

Brand / CI:
${input.brand}`,
      maxOutputTokens: 3500,
    });
  } catch {
    json = null;
  }

  return normalizeResearch(json, input.opportunity.rationale || input.opportunity.query);
}

export async function writeBrief(input: {
  opportunity: BlogOpportunity;
  research: ResearchDossier;
  corpus: CorpusEntry[];
  settings: BlogSettings;
  brand: string;
}): Promise<BriefPayload> {
  const internals = input.corpus
    .filter((c) => c.url)
    .slice(0, 25)
    .map((c) => ({ url: c.url!, title: c.title, kind: c.kind }));

  const fallback: BriefPayload = {
    working_title: input.opportunity.query,
    primary_keyword: input.opportunity.query,
    secondary_keywords: [],
    search_intent: String(input.opportunity.intent || "informational"),
    target_audience: "B2B decision makers",
    recommended_angle: input.opportunity.rationale,
    recommended_format: "guide",
    questions_to_answer: input.research.questions.slice(0, 8),
    competitor_gaps: input.research.competitor_notes,
    important_entities: input.research.entities,
    research_findings: [input.research.summary],
    internal_links: internals.slice(0, 4).map((c) => ({
      url: c.url,
      anchor: c.title,
      reason: "Related existing page",
      kind: c.kind === "commercial" ? "commercial" : "internal",
    })),
    external_sources: input.research.sources.slice(0, 3).map((s) => ({
      url: s.url,
      anchor: s.title,
      reason: s.why,
      kind: "external",
    })),
    cta: pickCta(input.settings, input.corpus, String(input.opportunity.intent)),
    suggested_slug: slugify(input.opportunity.query),
    seo_requirements: [
      "Primary keyword in title and H1",
      "Meta 70–160 characters",
      "3+ H2s answering real questions",
      "2–5 internal links, 1–3 primary sources",
      "One intentional CTA",
    ],
    schema: "Article",
  };

  if (!hasGatewayCredentials()) return fallback;

  let json: any = null;
  try {
    json = await generateJsonFromGateway({
      system: `You write content briefs for WIDE, a Munich branding/growth studio.
Output ONLY JSON matching this shape:
{
  "working_title": "",
  "primary_keyword": "",
  "secondary_keywords": [],
  "search_intent": "",
  "target_audience": "",
  "recommended_angle": "",
  "recommended_format": "guide|explainer|comparison|switcher",
  "questions_to_answer": [],
  "competitor_gaps": [],
  "important_entities": [],
  "research_findings": [],
  "internal_links": [{ "url": "", "anchor": "", "reason": "" }],
  "external_sources": [{ "url": "", "anchor": "", "reason": "" }],
  "cta": { "url": "", "label": "", "reason": "" },
  "suggested_slug": "",
  "seo_requirements": [],
  "schema": "Article"
}
Internal links MUST be chosen from the provided existing URLs. External URLs only from the research sources list. CTA from commercial pages. Brief is separate from the article — do not write the article.`,
      prompt: `Opportunity: ${input.opportunity.query}
Intent: ${input.opportunity.intent}
Action: ${input.opportunity.action} ${input.opportunity.cannibal_url || ""}
Languages: ${input.settings.languages.join(", ")}

Research:
${JSON.stringify(input.research).slice(0, 6000)}

Existing pages:
${JSON.stringify(internals).slice(0, 3000)}

Commercial pages:
${JSON.stringify(input.settings.commercial_pages)}

Brand:
${input.brand}`,
      maxOutputTokens: 2500,
    });
  } catch {
    json = null;
  }
  if (!json || typeof json !== "object") return fallback;

  return {
    working_title: String(json.working_title || fallback.working_title),
    primary_keyword: String(json.primary_keyword || fallback.primary_keyword),
    secondary_keywords: Array.isArray(json.secondary_keywords) ? json.secondary_keywords.map(String) : [],
    search_intent: String(json.search_intent || fallback.search_intent),
    target_audience: String(json.target_audience || fallback.target_audience),
    recommended_angle: String(json.recommended_angle || fallback.recommended_angle),
    recommended_format: String(json.recommended_format || "guide"),
    questions_to_answer: Array.isArray(json.questions_to_answer) ? json.questions_to_answer.map(String) : fallback.questions_to_answer,
    competitor_gaps: Array.isArray(json.competitor_gaps) ? json.competitor_gaps.map(String) : [],
    important_entities: Array.isArray(json.important_entities) ? json.important_entities.map(String) : [],
    research_findings: Array.isArray(json.research_findings) ? json.research_findings.map(String) : [],
    internal_links: Array.isArray(json.internal_links) ? json.internal_links : fallback.internal_links,
    external_sources: Array.isArray(json.external_sources) ? json.external_sources : fallback.external_sources,
    cta: json.cta?.url ? json.cta : fallback.cta,
    suggested_slug: slugify(String(json.suggested_slug || fallback.suggested_slug)),
    seo_requirements: Array.isArray(json.seo_requirements) ? json.seo_requirements.map(String) : fallback.seo_requirements,
    schema: String(json.schema || "Article"),
  };
}

export function pickCta(
  settings: BlogSettings,
  corpus: CorpusEntry[],
  intent: string
): CtaRec | null {
  const commercial = [
    ...settings.commercial_pages.map((p) => ({ url: p.url, label: p.label, intent: p.intent || "" })),
    ...corpus
      .filter((c) => c.kind === "commercial" && c.url)
      .map((c) => ({ url: c.url!, label: c.title, intent: "" })),
  ];
  if (!commercial.length) return null;
  const intentLc = intent.toLowerCase();
  const match =
    commercial.find((c) => c.intent && intentLc.includes(c.intent.toLowerCase())) ||
    commercial.find((c) => /quiz|demo|trial|contact/i.test(c.url + c.label)) ||
    commercial[0];
  return {
    url: match.url,
    label: match.label,
    reason: `CTA for ${intent} intent — ${match.label}`,
  };
}

export async function writeArticle(input: {
  brief: BriefPayload;
  research: ResearchDossier;
  settings: BlogSettings;
  brand: string;
  language: string;
}): Promise<{ title: string; body_md: string; meta_title: string; meta_description: string }> {
  const lang = input.language;
  const commercial = JSON.stringify(input.settings.commercial_pages || []).slice(0, 1200);
  const system = `You are a senior B2B editor at WIDE (Munich). Write a Sign2x-style package article — not generic AI SEO prose.
Rules:
- Language: ${lang}
- Density: specific claims, named regulations, concrete architecture — no filler intros.
- Do not keyword-stuff. Do not invent statistics. If a number is not in the research, omit it.
- Structure (required H2 arc):
  1. Hook H2 — problem / blind spot
  2. Tension H2 — compliance trap / market failure
  3. Solution H2 — product positioning with bold bullet claims
  4. Trust H2 — eIDAS / QES / GWG / QTSP or equivalent trust proof from brand notes
  5. Multiplier H2 — white-label, AI, TCO (if relevant)
  6. Close + CTAs — next steps with markdown links to commercial pages
- Title is NOT repeated as H1 in the body if supplied separately — still start Markdown with # title.
- Meta description 70–160 chars: question + value props.
- Weave 2–5 internal links as [anchor](url) from the brief. Cite 1–3 external primary sources the same way.
- Target 800–1400 words.
Commercial pages for CTAs: ${commercial}`;

  const prompt = `Write the ${lang} article.

Brief:
${JSON.stringify(input.brief).slice(0, 5000)}

Research (do not dump this into the article; use keywords, search queries, GEO questions, talk themes, switchers):
${JSON.stringify(input.research).slice(0, 5000)}

Brand:
${input.brand}

Return Markdown only, starting with:
# {title}

<!-- meta: {meta description} -->

then the body with the H2 arc above.`;

  const text = hasGatewayCredentials()
    ? await generateTextFromGateway({
        system,
        prompt,
        maxOutputTokens: 4500,
        temperature: 0.4,
      })
    : null;

  if (!text) {
    const title = input.brief.working_title;
    const research = input.research as ResearchDossier;
    const body = [
      `# ${title}`,
      `<!-- meta: ${input.brief.primary_keyword} -->`,
      "",
      `## ${research.talk_themes?.[0] || "The blind spot"}`,
      "",
      research.summary || "",
      "",
      `## ${research.switcher_queries?.[0] || "Where compliance breaks"}`,
      "",
      ...(research.competitor_notes || []).slice(0, 3).map((n) => `- ${n}`),
      "",
      "## The practical answer",
      "",
      ...(input.brief.questions_to_answer || []).slice(0, 4).map((q) => `### ${q}\n`),
      "",
      "## Trust and proof",
      "",
      "## Why this compounds",
      "",
      input.brief.cta
        ? `\n> **${input.brief.cta.label}**\n>\n> [${input.brief.cta.label}](${input.brief.cta.url})`
        : "",
    ].join("\n");
    return {
      title,
      body_md: body,
      meta_title: title.slice(0, 60),
      meta_description: (input.brief.research_findings[0] || title).slice(0, 155),
    };
  }

  const titleMatch = text.match(/^#\s+(.+)$/m);
  const metaMatch = text.match(/<!--\s*meta:\s*(.+?)\s*-->/i);
  const title = titleMatch?.[1]?.trim() || input.brief.working_title;
  const meta = metaMatch?.[1]?.trim() || "";
  return {
    title,
    body_md: text,
    meta_title: title.slice(0, 60),
    meta_description: meta.slice(0, 160),
  };
}

/** Translate an existing primary article into another language (separate journey step). */
export async function translateArticle(input: {
  title: string;
  body_md: string;
  meta_description: string | null;
  sourceLanguage: string;
  targetLanguage: string;
  brand: string;
}): Promise<{ title: string; body_md: string; meta_title: string; meta_description: string }> {
  if (!hasGatewayCredentials()) {
    return {
      title: `${input.title} (${input.targetLanguage})`,
      body_md: input.body_md,
      meta_title: input.title.slice(0, 60),
      meta_description: input.meta_description || "",
    };
  }
  const text = await generateTextFromGateway({
    system: `You translate and localize B2B blog articles for WIDE.
Preserve structure (H2 arc, bullets, CTAs, markdown links). Localize idioms for ${input.targetLanguage}; do not invent new claims.
Return Markdown only: # title, <!-- meta: ... -->, body.`,
    prompt: `Source language: ${input.sourceLanguage}
Target language: ${input.targetLanguage}

Brand notes (keep product names accurate):
${clip(input.brand, 2000)}

Source article:
${clip(input.body_md, 10000)}`,
    maxOutputTokens: 4500,
    temperature: 0.25,
  });
  if (!text) {
    return {
      title: input.title,
      body_md: input.body_md,
      meta_title: input.title.slice(0, 60),
      meta_description: input.meta_description || "",
    };
  }
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const metaMatch = text.match(/<!--\s*meta:\s*(.+?)\s*-->/i);
  const title = titleMatch?.[1]?.trim() || input.title;
  return {
    title,
    body_md: text,
    meta_title: title.slice(0, 60),
    meta_description: metaMatch?.[1]?.trim() || input.meta_description || "",
  };
}

/** Lengthen / deepen an existing draft without changing its claim set. */
export async function expandArticle(input: {
  title: string;
  body_md: string;
  language: string;
  brand: string;
}): Promise<{ title: string; body_md: string }> {
  if (!hasGatewayCredentials()) {
    return { title: input.title, body_md: input.body_md };
  }
  const text = await generateTextFromGateway({
    system: `You expand B2B blog drafts for WIDE. Keep the same thesis and language (${input.language}).
Add concrete examples, objections, and a tighter close. Do not invent stats or customer names.
Return Markdown only: # title, then body. No preamble.`,
    prompt: `Brand notes:
${clip(input.brand, 2000)}

Current draft:
${clip(input.body_md, 12000)}`,
    maxOutputTokens: 5000,
    temperature: 0.35,
  });
  if (!text) return { title: input.title, body_md: input.body_md };
  const titleMatch = text.match(/^#\s+(.+)$/m);
  return {
    title: titleMatch?.[1]?.trim() || input.title,
    body_md: text,
  };
}

export function runArticleAudit(article: {
  title: string;
  meta_description: string | null;
  body_md: string;
  brief?: BriefPayload | Record<string, unknown>;
  language?: string;
  internal_links?: LinkRec[];
  external_links?: LinkRec[];
  cta?: CtaRec | null;
}) {
  const brief = article.brief as BriefPayload | undefined;
  const mdLinks = [...(article.body_md || "").matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
  const internals = mdLinks.filter((m) => !/^https?:\/\//i.test(m[2]) || article.internal_links?.some((l) => m[2].includes(l.url)));
  const externals = mdLinks.filter((m) => /^https?:\/\//i.test(m[2]));
  return auditArticle({
    title: article.title,
    metaDescription: article.meta_description || "",
    bodyMarkdown: article.body_md,
    primaryKeyword: brief?.primary_keyword,
    lang: article.language || "de",
    hasSchema: true,
    hasOg: true,
    internalLinkCount: article.internal_links?.length || internals.length,
    externalLinkCount: article.external_links?.length || externals.length,
    hasCta: Boolean(article.cta || /https?:\/\//.test(article.body_md) && />\s*\*\*/.test(article.body_md)),
  });
}

export async function optimizeArticle(input: {
  article: BlogArticle;
  issues: SeoIssueDraft[];
  settings: BlogSettings;
}): Promise<{ title: string; body_md: string; meta_description: string }> {
  if (!hasGatewayCredentials()) {
    return {
      title: input.article.title,
      body_md: input.article.body_md,
      meta_description: input.article.meta_description || "",
    };
  }
  const issues = input.issues
    .filter((i) => i.severity !== "info")
    .map((i) => `- ${i.code}: ${i.howToFix}`)
    .join("\n");
  const text = await generateTextFromGateway({
    system: `You improve an existing article against SEO auditor findings. Keep the voice. Do not add fluff or stuff keywords. Return Markdown only, same format (# title, <!-- meta: ... -->, body).`,
    prompt: `Language: ${input.article.language}
Primary keyword: ${(input.article.brief as BriefPayload)?.primary_keyword || ""}

Issues to fix:
${issues}

Current article:
${clip(input.article.body_md, 9000)}`,
    maxOutputTokens: 4000,
    temperature: 0.3,
  });
  if (!text) {
    return {
      title: input.article.title,
      body_md: input.article.body_md,
      meta_description: input.article.meta_description || "",
    };
  }
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const metaMatch = text.match(/<!--\s*meta:\s*(.+?)\s*-->/i);
  return {
    title: titleMatch?.[1]?.trim() || input.article.title,
    body_md: text,
    meta_description: metaMatch?.[1]?.trim() || input.article.meta_description || "",
  };
}

export function extractLinksFromMarkdown(
  body: string,
  corpus: CorpusEntry[],
  settings: BlogSettings
): { internal: LinkRec[]; external: LinkRec[] } {
  const internal: LinkRec[] = [];
  const external: LinkRec[] = [];
  const origin = settings.site_url ? safeOrigin(settings.site_url) : "";
  for (const m of body.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    const anchor = m[1];
    const href = m[2];
    if (/^https?:\/\//i.test(href) && origin && !href.startsWith(origin)) {
      external.push({ url: href, anchor, reason: "Cited in body", kind: "external" });
    } else {
      const hit = corpus.find((c) => c.url && (href === c.url || href.endsWith(c.url)));
      internal.push({
        url: href,
        anchor,
        reason: hit ? `Existing ${hit.kind} page` : "On-site link",
        kind: hit?.kind === "commercial" ? "commercial" : "internal",
      });
    }
  }
  return { internal, external };
}

function safeOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export function nextScheduleDate(existing: { scheduled_for: string | null }[], timezone = "Europe/Berlin") {
  const taken = new Set(existing.map((a) => a.scheduled_for).filter(Boolean));
  const d = new Date();
  // Next Wednesday-ish cadence like Sign2x weekly posts, skip weekends.
  for (let i = 1; i < 60; i++) {
    const n = new Date(d);
    n.setDate(d.getDate() + i);
    const dow = n.getDay();
    if (dow === 0 || dow === 6) continue;
    const iso = n.toISOString().slice(0, 10);
    if (!taken.has(iso)) return iso;
  }
  return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  void timezone;
}
