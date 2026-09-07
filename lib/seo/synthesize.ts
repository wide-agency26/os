import { generateJsonFromGateway, hasGatewayCredentials } from "@/lib/ai/gateway-json";
import { scoreBand } from "./constants";
import { classifyIntent, heuristicCluster, type MinedQuery } from "./questions";
import type { RoadmapItem, SeoIntent, SeoRunSummary, SeoScores } from "./types";

/**
 * Turns raw findings into the narrative parts of the report: question clusters
 * with intent, an executive summary, and a 30/60/90 roadmap.
 *
 * Mirrors the pattern in lib/sow/propose.ts — try the AI gateway, fall back to
 * a deterministic heuristic when credentials are missing or the call fails, and
 * record which path was used so the UI can be honest about it.
 */

export type ClusterResult = {
  name: string;
  intent: SeoIntent;
  queries: string[];
  /** Page we already have that plausibly answers this cluster, if any. */
  mappedPage: string | null;
  coverage: "covered" | "partial" | "gap";
  suggestedPage: string | null;
};

export type SynthesisInput = {
  siteUrl: string;
  domain: string;
  scores: SeoScores;
  topIssues: { title: string; severity: string; affected: number }[];
  queries: MinedQuery[];
  pages: { url: string; title: string | null }[];
  strikingDistance: { query: string; position: number; impressions: number }[];
  competitorGaps: { domain: string; topics: string[] }[];
  unavailable: { source: string; reason: string }[];
};

export type SynthesisResult = {
  summary: SeoRunSummary;
  clusters: ClusterResult[];
  usedAi: boolean;
  /** Why the AI path was not used, so a degraded run is diagnosable. */
  fallbackReason?: string;
};

type AiShape = {
  headline?: string;
  executive?: string;
  strengths?: string[];
  risks?: string[];
  opportunities?: string[];
  clusters?: {
    name?: string;
    intent?: string;
    queries?: string[];
    suggested_page?: string;
  }[];
  roadmap?: {
    horizon?: string;
    title?: string;
    detail?: string;
    impact?: string;
    effort?: string;
  }[];
};

const VALID_INTENTS: SeoIntent[] = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
];

function coerceIntent(value: string | undefined, fallbackQuery: string): SeoIntent {
  const v = (value ?? "").toLowerCase() as SeoIntent;
  return VALID_INTENTS.includes(v) ? v : classifyIntent(fallbackQuery);
}

function coerceLevel(value: string | undefined): "high" | "medium" | "low" {
  const v = (value ?? "").toLowerCase();
  return v === "high" || v === "medium" || v === "low" ? v : "medium";
}

function coerceHorizon(value: string | undefined): "30" | "60" | "90" {
  const v = (value ?? "").replace(/\D/g, "");
  return v === "30" || v === "60" || v === "90" ? v : "30";
}

/** Rough keyword overlap between a cluster and an existing page title. */
function matchPage(
  clusterQueries: string[],
  pages: { url: string; title: string | null }[]
): { url: string; score: number } | null {
  const terms = new Set(
    clusterQueries
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3)
  );
  if (!terms.size) return null;

  let best: { url: string; score: number } | null = null;
  for (const page of pages) {
    if (!page.title) continue;
    const pageTerms = new Set(
      page.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
    );
    if (!pageTerms.size) continue;
    let hits = 0;
    for (const t of terms) if (pageTerms.has(t)) hits++;
    const score = hits / Math.min(terms.size, 8);
    if (!best || score > best.score) best = { url: page.url, score };
  }
  return best;
}

function assignCoverage(
  clusterQueries: string[],
  pages: { url: string; title: string | null }[]
): { mappedPage: string | null; coverage: "covered" | "partial" | "gap" } {
  const match = matchPage(clusterQueries, pages);
  if (!match || match.score < 0.15) return { mappedPage: null, coverage: "gap" };
  if (match.score < 0.4) return { mappedPage: match.url, coverage: "partial" };
  return { mappedPage: match.url, coverage: "covered" };
}

function buildPrompt(input: SynthesisInput): string {
  const topQueries = input.queries
    .slice(0, 120)
    .map((q) => q.query)
    .join("\n");

  return [
    `Site: ${input.siteUrl} (${input.domain})`,
    ``,
    `Scores out of 100 — overall ${input.scores.overall}, technical ${input.scores.technical}, content ${input.scores.content}, performance ${input.scores.performance}, search presence ${input.scores.search_presence}.`,
    ``,
    `Top technical and content issues found:`,
    input.topIssues
      .slice(0, 12)
      .map((i) => `- ${i.title} (${i.severity}, ${i.affected} pages affected)`)
      .join("\n") || "- none",
    ``,
    `Existing pages (url — title):`,
    input.pages
      .slice(0, 60)
      .map((p) => `- ${p.url} — ${p.title ?? "(no title)"}`)
      .join("\n") || "- none",
    ``,
    `Real search queries and questions collected from autocomplete and discussion forums:`,
    topQueries || "- none",
    ``,
    input.strikingDistance.length
      ? `Keywords already ranking in positions 4-15 (from Search Console):\n${input.strikingDistance
          .slice(0, 30)
          .map((s) => `- ${s.query} (position ${s.position.toFixed(1)}, ${s.impressions} impressions)`)
          .join("\n")}`
      : `Search Console data is not connected for this site.`,
    ``,
    input.competitorGaps.length
      ? `Topics competitors cover that this site does not:\n${input.competitorGaps
          .map((c) => `- ${c.domain}: ${c.topics.join(", ")}`)
          .join("\n")}`
      : `No competitor data collected.`,
    ``,
    input.unavailable.length
      ? `Data sources NOT available for this audit (do not invent figures for these): ${input.unavailable
          .map((u) => u.source)
          .join(", ")}.`
      : ``,
  ].join("\n");
}

const SYSTEM_PROMPT = `You are a senior SEO consultant writing the analysis section of a client-facing audit.

Rules:
- Write for an intelligent non-specialist. No jargon without a plain-English explanation.
- Never invent metrics. If search volume, backlinks or rankings were not provided, do not reference them.
- Group the supplied queries into 4-10 topic clusters. Every cluster must use the user's actual phrasing, not invented keywords.
- The roadmap must be specific to this site and reference real pages or real issues from the input.

Return ONLY a JSON object with this exact shape:
{
  "headline": "one sentence verdict, max 100 characters",
  "executive": "2-4 sentence plain-language summary of the site's SEO position",
  "strengths": ["..."],
  "risks": ["..."],
  "opportunities": ["..."],
  "clusters": [
    { "name": "short topic name", "intent": "informational|commercial|transactional|navigational", "queries": ["..."], "suggested_page": "the page title or URL that should answer this" }
  ],
  "roadmap": [
    { "horizon": "30|60|90", "title": "action title", "detail": "what to do and why", "impact": "high|medium|low", "effort": "high|medium|low" }
  ]
}`;

export async function synthesize(input: SynthesisInput): Promise<SynthesisResult> {
  let reason = "no AI gateway credentials are configured";
  if (!input.queries.length) reason = "no queries were available to cluster";

  if (hasGatewayCredentials() && input.queries.length) {
    try {
      const raw = (await generateJsonFromGateway({
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(input),
        maxOutputTokens: 6000,
      })) as AiShape | null;

      if (raw && (raw.clusters?.length || raw.executive)) {
        const queryLookup = new Map(
          input.queries.map((q) => [q.query.toLowerCase(), q.query])
        );

        const clusters: ClusterResult[] = (raw.clusters ?? [])
          .filter((c) => c.name && Array.isArray(c.queries) && c.queries.length)
          .slice(0, 12)
          .map((c) => {
            // Only keep queries we actually mined, so the AI cannot introduce
            // keywords that no real person searched for.
            const queries = (c.queries ?? [])
              .map((q) => queryLookup.get(q.trim().toLowerCase()) ?? null)
              .filter((q): q is string => Boolean(q));
            const finalQueries = queries.length ? queries : (c.queries ?? []).slice(0, 12);
            const { mappedPage, coverage } = assignCoverage(finalQueries, input.pages);
            return {
              name: c.name!.slice(0, 80),
              intent: coerceIntent(c.intent, finalQueries[0] ?? ""),
              queries: finalQueries.slice(0, 40),
              mappedPage,
              coverage,
              suggestedPage: c.suggested_page?.slice(0, 160) ?? null,
            };
          })
          .filter((c) => c.queries.length);

        if (clusters.length) {
          return {
            usedAi: true,
            clusters,
            summary: {
              headline: raw.headline?.slice(0, 160),
              executive: raw.executive,
              strengths: (raw.strengths ?? []).slice(0, 6),
              risks: (raw.risks ?? []).slice(0, 6),
              opportunities: (raw.opportunities ?? []).slice(0, 6),
              roadmap: (raw.roadmap ?? []).slice(0, 12).map<RoadmapItem>((r) => ({
                horizon: coerceHorizon(r.horizon),
                title: r.title?.slice(0, 120) ?? "Action",
                detail: r.detail?.slice(0, 600) ?? "",
                impact: coerceLevel(r.impact),
                effort: coerceLevel(r.effort),
              })),
              used_ai: true,
              unavailable: input.unavailable,
            },
          };
        }
        reason = "the model returned no usable question clusters";
      } else {
        reason = "the model returned an empty response";
      }
    } catch (e) {
      reason = e instanceof Error ? e.message : "the AI gateway call failed";
    }
  }

  return { ...heuristicSynthesis(input), fallbackReason: reason };
}

/** Deterministic fallback so a run always produces a readable report. */
export function heuristicSynthesis(input: SynthesisInput): SynthesisResult {
  const grouped = heuristicCluster(input.queries);

  const clusters: ClusterResult[] = [...grouped.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([term, queries]) => {
      const { mappedPage, coverage } = assignCoverage(queries, input.pages);
      return {
        name: term,
        intent: classifyIntent(queries[0] ?? term),
        queries: queries.slice(0, 40),
        mappedPage,
        coverage,
        suggestedPage: coverage === "gap" ? `A page answering "${queries[0]}"` : null,
      };
    });

  const band = scoreBand(input.scores.overall);
  const critical = input.topIssues.filter((i) => i.severity === "critical");
  const high = input.topIssues.filter((i) => i.severity === "high");

  const strengths: string[] = [];
  if (input.scores.technical >= 75) strengths.push("Technical foundations are broadly sound.");
  if (input.scores.content >= 75) strengths.push("On-page content is well structured.");
  if (input.scores.performance >= 75) strengths.push("Page speed is in good shape.");
  if (!strengths.length) strengths.push("The site is crawlable, which is the base requirement for everything else.");

  const risks = [
    ...critical.slice(0, 3).map((i) => `${i.title} (${i.affected} pages).`),
    ...high.slice(0, 2).map((i) => `${i.title} (${i.affected} pages).`),
  ];

  const gaps = clusters.filter((c) => c.coverage === "gap");
  const opportunities: string[] = [];
  if (input.strikingDistance.length) {
    opportunities.push(
      `${input.strikingDistance.length} keywords already rank in positions 4-15 and could reach the first page with focused work on existing pages.`
    );
  }
  if (gaps.length) {
    opportunities.push(
      `${gaps.length} topic clusters people actively search for have no matching page on the site.`
    );
  }
  for (const gap of input.competitorGaps.slice(0, 2)) {
    if (gap.topics.length) {
      opportunities.push(`${gap.domain} covers ${gap.topics.slice(0, 4).join(", ")} — this site does not.`);
    }
  }

  const roadmap: RoadmapItem[] = [];
  for (const issue of [...critical, ...high].slice(0, 3)) {
    roadmap.push({
      horizon: "30",
      title: `Fix: ${issue.title}`,
      detail: `Affects ${issue.affected} pages. Resolving this removes a direct blocker to ranking.`,
      impact: issue.severity === "critical" ? "high" : "medium",
      effort: "medium",
    });
  }
  if (input.strikingDistance.length) {
    roadmap.push({
      horizon: "60",
      title: "Push near-miss keywords onto page one",
      detail: `Strengthen the pages already ranking for ${input.strikingDistance
        .slice(0, 3)
        .map((s) => `"${s.query}"`)
        .join(", ")} by working that phrasing into titles, headings and internal links.`,
      impact: "high",
      effort: "low",
    });
  }
  for (const cluster of gaps.slice(0, 3)) {
    roadmap.push({
      horizon: "90",
      title: `Create a page covering "${cluster.name}"`,
      detail: `${cluster.queries.length} real searches were found in this cluster with no page answering them, including "${cluster.queries[0]}".`,
      impact: "medium",
      effort: "medium",
    });
  }

  return {
    usedAi: false,
    clusters,
    summary: {
      headline: `${band.label} — overall SEO health scores ${input.scores.overall} out of 100.`,
      executive:
        `We crawled ${input.pages.length} pages on ${input.domain} and found ` +
        `${critical.length} critical and ${high.length} high-priority issues. ` +
        (clusters.length
          ? `We also collected ${input.queries.length} real searches people make around this topic, grouped into ${clusters.length} clusters, of which ${gaps.length} have no page answering them.`
          : `No demand data was collected for this run.`),
      strengths,
      risks: risks.length ? risks : ["No critical or high-severity issues were found."],
      opportunities: opportunities.length
        ? opportunities
        : ["No immediate opportunities were identified from the available data."],
      roadmap,
      used_ai: false,
      unavailable: input.unavailable,
    },
  };
}
