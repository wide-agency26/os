import { fetchText } from "../fetcher";
import { originOf } from "../url";

export type RobotsRules = {
  found: boolean;
  disallow: string[];
  allow: string[];
  crawlDelayMs: number;
  sitemaps: string[];
  raw: string | null;
};

const EMPTY: RobotsRules = {
  found: false,
  disallow: [],
  allow: [],
  crawlDelayMs: 0,
  sitemaps: [],
  raw: null,
};

/**
 * Minimal robots.txt parser covering the directives that matter for a crawl:
 * the rules for our own user-agent (falling back to `*`), Crawl-delay, and
 * Sitemap declarations. We honour these strictly — we crawl live client and
 * prospect sites and must not behave like a hostile bot.
 */
export function parseRobots(text: string): Omit<RobotsRules, "found" | "raw"> {
  const lines = text.split(/\r?\n/);
  const groups: { agents: string[]; disallow: string[]; allow: string[]; delay: number | null }[] = [];
  const sitemaps: string[] = [];

  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [], delay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }

    lastWasAgent = false;
    if (!current) continue;

    if (field === "disallow") current.disallow.push(value);
    else if (field === "allow") current.allow.push(value);
    else if (field === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n)) current.delay = n;
    }
  }

  const ours = groups.find((g) =>
    g.agents.some((a) => a.includes("wide-seo-audit"))
  );
  const star = groups.find((g) => g.agents.includes("*"));
  const picked = ours ?? star;

  return {
    disallow: (picked?.disallow ?? []).filter(Boolean),
    allow: picked?.allow ?? [],
    // Cap the delay: a site declaring 30s would make a 500-page crawl impossible.
    crawlDelayMs: Math.min(Math.max((picked?.delay ?? 0) * 1000, 0), 5000),
    sitemaps,
  };
}

export async function loadRobots(siteUrl: string): Promise<RobotsRules> {
  const origin = originOf(siteUrl);
  const res = await fetchText(`${origin}/robots.txt`);
  if (!res.ok || !res.text) return EMPTY;
  // Some hosts return an HTML 404 page with a 200 status.
  if (/^\s*</.test(res.text)) return EMPTY;
  return { found: true, raw: res.text.slice(0, 20000), ...parseRobots(res.text) };
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\$$/, "\\$?$");
  return new RegExp(`^${escaped}`);
}

/** Longest-match wins, with Allow beating Disallow at equal length (Google's rule). */
export function isAllowedByRobots(rules: RobotsRules, url: string): boolean {
  if (!rules.found || !rules.disallow.length) return true;
  let path: string;
  try {
    const p = new URL(url);
    path = `${p.pathname}${p.search}`;
  } catch {
    return true;
  }

  let bestDisallow = -1;
  for (const rule of rules.disallow) {
    if (rule === "") continue;
    if (patternToRegex(rule).test(path)) bestDisallow = Math.max(bestDisallow, rule.length);
  }
  if (bestDisallow === -1) return true;

  let bestAllow = -1;
  for (const rule of rules.allow) {
    if (rule === "") continue;
    if (patternToRegex(rule).test(path)) bestAllow = Math.max(bestAllow, rule.length);
  }

  return bestAllow >= bestDisallow;
}
