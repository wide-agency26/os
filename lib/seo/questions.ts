import { fetchJson, mapWithConcurrency } from "./fetcher";
import type { SeoIntent, SeoQuerySource } from "./types";
import type { StoredPage } from "./store";
import { SEO_USER_AGENT } from "./constants";

/**
 * Demand mining from free sources.
 *
 * Autocomplete endpoints are unauthenticated JSON and are reliable from server
 * IPs — unlike scraping the search results page itself, which is blocked within
 * a few requests. Expanding a handful of seeds across a modifier matrix
 * reproduces what "answer the public" style tools sell.
 *
 * Ordering within an autocomplete response reflects relative popularity, so we
 * store it as `suggest_rank` and derive a 0-100 `popularity` proxy. That is NOT
 * search volume and is never presented as such — real volume needs a paid
 * provider (see ./providers).
 */

const QUESTION_WORDS = ["how", "what", "why", "when", "where", "who", "which", "can", "does", "is", "should", "will"];
const PREPOSITIONS = ["for", "with", "without", "near", "vs", "like", "to", "in"];
const COMPARISONS = ["vs", "alternative", "best", "cheap", "top", "review", "cost", "price"];
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

export type MinedQuery = {
  query: string;
  source: SeoQuerySource;
  sources: Set<string>;
  suggestRank: number | null;
  isQuestion: boolean;
};

export function isQuestionLike(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.endsWith("?")) return true;
  return QUESTION_WORDS.some((w) => t.startsWith(`${w} `));
}

/** Heuristic intent classification, refined later by the AI synthesis phase. */
export function classifyIntent(query: string): SeoIntent {
  const t = query.toLowerCase();
  if (/\b(buy|price|pricing|cost|quote|order|hire|book|for sale|near me|shop)\b/.test(t)) {
    return "transactional";
  }
  if (/\b(best|top|vs|versus|alternative|review|compare|comparison|cheapest|agency|company|service)\b/.test(t)) {
    return "commercial";
  }
  if (/\b(login|log in|sign in|contact|address|hours|careers|about)\b/.test(t)) {
    return "navigational";
  }
  return "informational";
}

type SuggestEngine = {
  id: SeoQuerySource;
  label: string;
  build: (term: string) => string;
};

const ENGINES: SuggestEngine[] = [
  {
    id: "google_suggest",
    label: "Google",
    build: (term) =>
      `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(term)}`,
  },
  {
    id: "bing_suggest",
    label: "Bing",
    build: (term) => `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(term)}`,
  },
  {
    id: "youtube_suggest",
    label: "YouTube",
    build: (term) =>
      `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=en&q=${encodeURIComponent(term)}`,
  },
];

async function fetchSuggestions(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": SEO_USER_AGENT, Accept: "*/*" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 2) return [];
    const list = parsed[1];
    if (!Array.isArray(list)) return [];
    return list.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function buildModifiers(seed: string, depth: "full" | "light"): string[] {
  const terms = new Set<string>([seed]);
  for (const w of QUESTION_WORDS) terms.add(`${w} ${seed}`);
  for (const c of COMPARISONS) terms.add(`${seed} ${c}`);
  if (depth === "full") {
    for (const p of PREPOSITIONS) terms.add(`${seed} ${p}`);
    for (const letter of ALPHABET) terms.add(`${seed} ${letter}`);
  }
  return [...terms];
}

export type MiningResult = {
  queries: MinedQuery[];
  sourcesUsed: string[];
  sourcesFailed: string[];
};

/**
 * Expands seeds across the modifier matrix on every autocomplete engine.
 * Engines that fail are recorded rather than thrown — a blocked engine degrades
 * the phase, it does not fail the run.
 */
export async function mineAutocomplete(
  seeds: string[],
  opts: { depth?: "full" | "light"; maxSeeds?: number } = {}
): Promise<MiningResult> {
  const depth = opts.depth ?? "full";
  const usedSeeds = seeds.slice(0, opts.maxSeeds ?? 6);

  const jobs: { term: string; engine: SuggestEngine }[] = [];
  for (const seed of usedSeeds) {
    // Alphabet soup only on the primary engine: it is the expensive dimension
    // and Google's suggestions are the ones users actually see.
    for (const engine of ENGINES) {
      const terms = buildModifiers(seed, engine.id === "google_suggest" ? depth : "light");
      for (const term of terms) jobs.push({ term, engine });
    }
  }

  const collected = new Map<string, MinedQuery>();
  const engineHits = new Map<string, number>();

  await mapWithConcurrency(jobs, 8, async (job) => {
    const suggestions = await fetchSuggestions(job.engine.build(job.term));
    if (suggestions.length) {
      engineHits.set(job.engine.id, (engineHits.get(job.engine.id) ?? 0) + 1);
    }
    suggestions.forEach((suggestion, index) => {
      const normalized = suggestion.trim().toLowerCase();
      if (!normalized || normalized.length < 3 || normalized.length > 120) return;

      const existing = collected.get(normalized);
      if (existing) {
        existing.sources.add(job.engine.id);
        if (existing.suggestRank === null || index < existing.suggestRank) {
          existing.suggestRank = index;
        }
        return;
      }
      collected.set(normalized, {
        query: suggestion.trim(),
        source: job.engine.id,
        sources: new Set([job.engine.id]),
        suggestRank: index,
        isQuestion: isQuestionLike(suggestion),
      });
    });
  });

  const sourcesUsed: string[] = [];
  const sourcesFailed: string[] = [];
  for (const engine of ENGINES) {
    if ((engineHits.get(engine.id) ?? 0) > 0) sourcesUsed.push(engine.id);
    else sourcesFailed.push(engine.id);
  }

  return { queries: [...collected.values()], sourcesUsed, sourcesFailed };
}

type RedditResponse = {
  data?: { children?: { data?: { title?: string; score?: number } }[] };
};

/** Real phrasing from discussion threads, which autocomplete rarely surfaces. */
export async function mineReddit(seeds: string[]): Promise<MinedQuery[]> {
  const out = new Map<string, MinedQuery>();

  await mapWithConcurrency(seeds.slice(0, 4), 2, async (seed) => {
    const url =
      `https://www.reddit.com/search.json?q=${encodeURIComponent(seed)}` +
      `&limit=50&sort=relevance&t=year`;
    const data = await fetchJson<RedditResponse>(url, { timeoutMs: 12000 });
    const children = data?.data?.children ?? [];
    for (const child of children) {
      const title = child.data?.title?.trim();
      if (!title || title.length < 12 || title.length > 160) continue;
      if (!isQuestionLike(title)) continue;
      const key = title.toLowerCase();
      if (out.has(key)) {
        out.get(key)!.sources.add("reddit");
        continue;
      }
      out.set(key, {
        query: title,
        source: "reddit",
        sources: new Set(["reddit"]),
        suggestRank: null,
        isQuestion: true,
      });
    }
  });

  return [...out.values()];
}

type StackExchangeResponse = {
  items?: { title?: string; score?: number; is_answered?: boolean }[];
};

export async function mineStackExchange(seeds: string[]): Promise<MinedQuery[]> {
  const out = new Map<string, MinedQuery>();

  await mapWithConcurrency(seeds.slice(0, 3), 2, async (seed) => {
    const url =
      `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=votes` +
      `&q=${encodeURIComponent(seed)}&site=stackoverflow&pagesize=30&filter=default`;
    const data = await fetchJson<StackExchangeResponse>(url, { timeoutMs: 12000 });
    for (const item of data?.items ?? []) {
      const title = item.title?.trim();
      if (!title || title.length < 12 || title.length > 160) continue;
      const key = title.toLowerCase();
      if (out.has(key)) {
        out.get(key)!.sources.add("stackexchange");
        continue;
      }
      out.set(key, {
        query: title,
        source: "stackexchange",
        sources: new Set(["stackexchange"]),
        suggestRank: null,
        isQuestion: true,
      });
    }
  });

  return [...out.values()];
}

/**
 * Seeds are derived from the site itself: brand name plus the most common
 * meaningful terms across page titles and H1s.
 */
export function deriveSeeds(siteDomain: string, pages: StoredPage[]): string[] {
  const brand = siteDomain.split(".")[0].replace(/[-_]/g, " ").trim();
  const seeds: string[] = [];
  if (brand && brand.length > 2) seeds.push(brand);

  const stop = new Set([
    "the", "and", "for", "with", "your", "our", "you", "are", "from", "that", "this",
    "how", "why", "what", "all", "new", "get", "can", "has", "have", "was", "were",
    "home", "page", "about", "contact", "welcome", "index", "more", "best", "top",
    brand.toLowerCase(),
  ]);

  const counts = new Map<string, number>();
  for (const page of pages) {
    const text = [page.title ?? "", ...(page.h1s ?? [])].join(" ").toLowerCase();
    for (const word of text.split(/[^a-z0-9]+/)) {
      if (word.length < 4 || word.length > 22 || stop.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  seeds.push(...top);
  return [...new Set(seeds)].filter(Boolean).slice(0, 6);
}

/**
 * Popularity proxy on a 0-100 scale, derived from autocomplete rank and how
 * many independent engines surfaced the same query. Explicitly not volume.
 */
export function popularityProxy(query: MinedQuery): number {
  const rankScore =
    query.suggestRank === null ? 40 : Math.max(0, 100 - query.suggestRank * 9);
  const sourceBonus = Math.min((query.sources.size - 1) * 12, 36);
  return Math.max(1, Math.min(100, Math.round(rankScore * 0.75 + sourceBonus)));
}

/**
 * Cheap lexical clustering used as the fallback when the AI gateway is
 * unavailable. Groups queries by their most distinctive shared term.
 */
export function heuristicCluster(queries: MinedQuery[]): Map<string, string[]> {
  const stop = new Set([
    "how", "what", "why", "when", "where", "who", "which", "can", "does", "is",
    "should", "will", "the", "and", "for", "with", "without", "near", "vs", "to",
    "in", "of", "a", "an", "my", "your", "best", "top", "do", "are", "it", "on",
  ]);

  const byTerm = new Map<string, string[]>();
  for (const q of queries) {
    const words = q.query.toLowerCase().split(/[^a-z0-9]+/).filter(
      (w) => w.length > 3 && !stop.has(w)
    );
    const key = words[0] ?? "general";
    const bucket = byTerm.get(key);
    if (bucket) bucket.push(q.query);
    else byTerm.set(key, [q.query]);
  }

  // Fold single-item buckets into a catch-all so the UI is not flooded.
  const clusters = new Map<string, string[]>();
  const leftovers: string[] = [];
  for (const [term, items] of byTerm) {
    if (items.length >= 3) clusters.set(term, items);
    else leftovers.push(...items);
  }
  if (leftovers.length) clusters.set("other questions", leftovers);
  return clusters;
}
