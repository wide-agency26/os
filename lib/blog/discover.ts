/* eslint-disable @typescript-eslint/no-explicit-any */
import { classifyIntent, mineAutocomplete, popularityProxy, type MinedQuery } from "@/lib/seo/questions";
import { seoAdmin } from "@/lib/seo/store";
import type { SeoIntent } from "@/lib/seo/types";
import type { BlogAction, BlogSettings, CorpusEntry, ScoreBreakdown } from "./types";

type Sb = any;

function tokens(text: string) {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9äöüß]+/i)
      .filter((w) => w.length > 3)
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / new Set([...a, ...b]).size;
}

function cannibal(query: string, corpus: CorpusEntry[]): { url: string | null; overlap: number; title: string | null } {
  const q = tokens(query);
  let best = { url: null as string | null, overlap: 0, title: null as string | null };
  for (const c of corpus) {
    const hay = tokens([c.title, c.keywords.join(" "), c.excerpt || ""].join(" "));
    const o = jaccard(q, hay);
    if (o > best.overlap) best = { url: c.url, overlap: o, title: c.title };
  }
  return best;
}

function actionFor(overlap: number, intent: string): BlogAction {
  if (overlap >= 0.72) return "update";
  if (overlap >= 0.55) return "expand";
  if (overlap >= 0.4 && intent === "informational") return "merge";
  return "create";
}

function scoreOpportunity(input: {
  popularity: number;
  gscImpressions: number | null;
  gscPosition: number | null;
  coverage: string | null;
  intent: SeoIntent | string;
  overlap: number;
  lastSiteScore: number | null;
  brandNotes: string;
  query: string;
  hasCommercial: boolean;
}): { score: number; breakdown: ScoreBreakdown; rationale: string } {
  const demand = Math.max(0, Math.min(100, input.popularity));
  const trend =
    input.gscImpressions != null
      ? Math.max(20, Math.min(100, Math.round(Math.log10(input.gscImpressions + 1) * 25)))
      : 50;
  const competition =
    input.gscPosition != null ? Math.max(10, Math.min(90, Math.round(100 - input.gscPosition * 6))) : 55;
  const content_gap =
    input.coverage === "gap" ? 90 : input.coverage === "partial" ? 55 : input.overlap < 0.3 ? 80 : 25;
  const authority = input.lastSiteScore ?? 50;
  const intentScore =
    input.intent === "transactional" ? 90 : input.intent === "commercial" ? 80 : input.intent === "informational" ? 60 : 40;
  const brandTok = tokens(input.brandNotes);
  const business = brandTok.size ? Math.round(jaccard(tokens(input.query), brandTok) * 100) : 55;
  const conversion = input.hasCommercial && intentScore >= 70 ? 80 : intentScore >= 70 ? 55 : 40;
  const freshness = input.overlap < 0.25 ? 80 : 45;
  const cannibalization = Math.round((1 - input.overlap) * 100);

  const breakdown: ScoreBreakdown = {
    demand,
    trend,
    competition,
    content_gap,
    authority,
    intent: intentScore,
    business,
    conversion,
    freshness,
    cannibalization,
  };

  const score = Math.round(
    demand * 0.16 +
      trend * 0.08 +
      competition * 0.08 +
      content_gap * 0.16 +
      authority * 0.06 +
      intentScore * 0.12 +
      business * 0.12 +
      conversion * 0.1 +
      freshness * 0.06 +
      cannibalization * 0.06
  );

  const reasons: string[] = [];
  if (content_gap >= 70) reasons.push("content gap on this query");
  if (demand >= 60) reasons.push("solid relative demand");
  if (intentScore >= 75) reasons.push(`${input.intent} intent`);
  if (input.overlap >= 0.55) reasons.push("overlaps an existing article — refresh instead of a new URL");
  if (business >= 50 && input.brandNotes) reasons.push("matches brand notes");
  if (!reasons.length) reasons.push("moderate opportunity from mined demand");

  return { score: Math.max(0, Math.min(100, score)), breakdown, rationale: reasons.join(". ") + "." };
}

async function loadSeoContext(projectId: string, siteUrl: string | null) {
  const admin = seoAdmin();
  const { data: byProject } = await admin
    .from("seo_sites")
    .select("id, url, last_score")
    .eq("project_id", projectId)
    .maybeSingle();
  const { data: latestSite } = byProject
    ? { data: byProject }
    : await admin
        .from("seo_sites")
        .select("id, url, last_score")
        .order("last_run_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
  const site = latestSite;
  if (!site) return { queries: [] as any[], pages: [] as any[], lastScore: null as number | null, siteUrl };

  const { data: run } = await admin
    .from("seo_runs")
    .select("id, score")
    .eq("site_id", (site as any).id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run) {
    return { queries: [], pages: [], lastScore: (site as any).last_score, siteUrl: (site as any).url };
  }

  const [{ data: queries }, { data: pages }] = await Promise.all([
    admin
      .from("seo_queries")
      .select("query, intent, popularity, coverage, gsc_impressions, gsc_position, mapped_page_url, is_question")
      .eq("run_id", (run as any).id)
      .order("popularity", { ascending: false, nullsFirst: false })
      .limit(80),
    admin
      .from("seo_run_pages")
      .select("url, title, meta_description, word_count, path, indexable")
      .eq("run_id", (run as any).id)
      .eq("indexable", true)
      .limit(400),
  ]);

  return {
    queries: queries || [],
    pages: pages || [],
    lastScore: (run as any).score ?? (site as any).last_score,
    siteUrl: (site as any).url,
  };
}

export async function syncCorpusFromSeo(supabase: Sb, projectId: string, pages: { url: string; title: string | null; meta_description: string | null; path?: string }[]) {
  if (!pages.length) return 0;
  const rows = pages
    .filter((p) => p.title)
    .slice(0, 250)
    .map((p) => ({
      project_id: projectId,
      url: p.url,
      title: p.title,
      slug: (p.path || "").replace(/^\//, "") || null,
      excerpt: p.meta_description,
      body_text: p.meta_description || p.title,
      kind: /blog|wissen|magazin|artikel/i.test(p.url) ? "blog" : /pricing|product|demo|quiz|use-case|developer/i.test(p.url) ? "commercial" : "other",
      source: "crawl",
    }));
  if (!rows.length) return 0;
  await supabase.from("blog_corpus").delete().eq("project_id", projectId).eq("source", "crawl");
  await supabase.from("blog_corpus").insert(rows);
  return rows.length;
}

export async function discoverOpportunities(
  supabase: Sb,
  projectId: string,
  settings: BlogSettings
): Promise<{ upserted: number; highPriority: number; refresh: number }> {
  const { data: corpusRows } = await supabase.from("blog_corpus").select("*").eq("project_id", projectId);
  const corpus = (corpusRows || []) as CorpusEntry[];

  const seo = await loadSeoContext(projectId, settings.site_url);
  if (seo.pages.length) await syncCorpusFromSeo(supabase, projectId, seo.pages);

  const seeds: string[] = [];
  if (settings.brand_notes) {
    seeds.push(
      ...settings.brand_notes
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 3)
        .slice(0, 6)
    );
  }
  if (seo.siteUrl) {
    try {
      seeds.push(new URL(seo.siteUrl).hostname.replace(/^www\./, "").split(".")[0]);
    } catch {
      /* ignore */
    }
  }
  for (const c of corpus.slice(0, 8)) {
    if (c.title) seeds.push(c.title.split(/\s+/).slice(0, 4).join(" "));
  }
  if (!seeds.length) seeds.push("blog", "guide");

  let mined: MinedQuery[] = [];
  try {
    const minedRes = await mineAutocomplete(seeds.slice(0, 6), { depth: "light", maxSeeds: 6 });
    mined = minedRes.queries || [];
  } catch {
    mined = [];
  }

  type Cand = {
    query: string;
    intent: SeoIntent | string;
    popularity: number;
    gscImpressions: number | null;
    gscPosition: number | null;
    coverage: string | null;
    source: string;
  };

  const map = new Map<string, Cand>();
  const add = (c: Cand) => {
    const key = c.query.trim().toLowerCase();
    if (key.length < 8) return;
    const prev = map.get(key);
    if (!prev || c.popularity > prev.popularity) map.set(key, c);
  };

  for (const q of seo.queries) {
    add({
      query: q.query,
      intent: q.intent || classifyIntent(q.query),
      popularity: q.popularity ?? 40,
      gscImpressions: q.gsc_impressions,
      gscPosition: q.gsc_position,
      coverage: q.coverage,
      source: "seo_audit",
    });
  }
  for (const m of mined) {
    add({
      query: m.query,
      intent: classifyIntent(m.query),
      popularity: popularityProxy(m),
      gscImpressions: null,
      gscPosition: null,
      coverage: null,
      source: "suggest",
    });
  }

  const hasCommercial = settings.commercial_pages.length > 0 || corpus.some((c) => c.kind === "commercial");
  const ranked = [...map.values()]
    .map((c) => {
      const can = cannibal(c.query, corpus);
      const scored = scoreOpportunity({
        popularity: c.popularity,
        gscImpressions: c.gscImpressions,
        gscPosition: c.gscPosition,
        coverage: c.coverage,
        intent: c.intent,
        overlap: can.overlap,
        lastSiteScore: seo.lastScore,
        brandNotes: settings.brand_notes,
        query: c.query,
        hasCommercial,
      });
      const act = actionFor(can.overlap, String(c.intent));
      return {
        ...c,
        ...scored,
        action: act,
        cannibal_url: can.url,
        status: act === "update" || act === "expand" ? "refresh" : "new",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(12, settings.max_opportunities_per_night * 2));

  if (!ranked.length) return { upserted: 0, highPriority: 0, refresh: 0 };

  const rows = ranked.map((r) => ({
    project_id: projectId,
    query: r.query,
    intent: r.intent,
    score: r.score,
    score_breakdown: r.breakdown,
    rationale: r.rationale,
    action: r.action,
    cannibal_url: r.cannibal_url,
    status: r.status,
    source: r.source,
    updated_at: new Date().toISOString(),
  }));

  await supabase.from("blog_opportunities").upsert(rows, { onConflict: "project_id,query" });

  return {
    upserted: rows.length,
    highPriority: rows.filter((r) => r.score >= 70 && r.action === "create").length,
    refresh: rows.filter((r) => r.status === "refresh").length,
  };
}
