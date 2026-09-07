import { CRAWL_CONCURRENCY } from "../constants";
import { fetchPage, mapWithConcurrency, sleep } from "../fetcher";
import type { CrawledPage } from "../types";
import { canonicalizeUrl, hasSkippedExtension, isSameSite } from "../url";
import { isAllowedByRobots, type RobotsRules } from "./robots";
import { parsePage } from "./parse-page";

export type FrontierItem = { url: string; depth: number };

export type CrawlSliceInput = {
  siteUrl: string;
  frontier: FrontierItem[];
  visited: Set<string>;
  sitemapSet: Set<string>;
  robots: RobotsRules;
  maxPages: number;
  maxDepth: number;
  /** Absolute timestamp at which this slice must stop and hand back state. */
  deadline: number;
  crawlDelayMs: number;
  inboundCounts: Record<string, number>;
  onBatch: (pages: CrawledPage[]) => Promise<void>;
};

export type CrawlSliceResult = {
  frontier: FrontierItem[];
  crawled: number;
  errors: number;
  inboundCounts: Record<string, number>;
  complete: boolean;
  backedOff: boolean;
};

/**
 * One time-budgeted slice of a breadth-first crawl. Returns the remaining
 * frontier so the next worker invocation can resume exactly where this left off.
 */
export async function crawlSlice(input: CrawlSliceInput): Promise<CrawlSliceResult> {
  const {
    siteUrl, visited, sitemapSet, robots, maxPages, maxDepth,
    deadline, crawlDelayMs, onBatch,
  } = input;

  const frontier = [...input.frontier];
  const inboundCounts = { ...input.inboundCounts };
  let crawled = 0;
  let errors = 0;
  let backedOff = false;

  while (frontier.length && visited.size < maxPages) {
    if (Date.now() >= deadline) {
      return { frontier, crawled, errors, inboundCounts, complete: false, backedOff };
    }

    const remaining = maxPages - visited.size;
    const batch: FrontierItem[] = [];

    while (frontier.length && batch.length < Math.min(CRAWL_CONCURRENCY, remaining)) {
      const item = frontier.shift()!;
      const canonical = canonicalizeUrl(item.url);
      if (!canonical || visited.has(canonical)) continue;
      if (item.depth > maxDepth) continue;
      visited.add(canonical);
      batch.push({ url: canonical, depth: item.depth });
    }

    if (!batch.length) continue;

    const pages = await mapWithConcurrency(batch, CRAWL_CONCURRENCY, async (item) => {
      const allowed = isAllowedByRobots(robots, item.url);
      if (!allowed) {
        // Recorded rather than skipped: "blocked by robots.txt" is a finding.
        return parsePage(
          {
            ok: false, status: null, url: item.url, finalUrl: item.url,
            redirectChain: [], headers: null, body: null, bytes: null,
            ttfbMs: null, contentType: null, error: "Blocked by robots.txt",
            rateLimited: false, retryAfterMs: null,
          },
          siteUrl,
          item.depth,
          { inSitemap: sitemapSet.has(item.url), robotsBlocked: true }
        );
      }

      const result = await fetchPage(item.url);
      if (result.rateLimited) backedOff = true;

      return parsePage(result, siteUrl, item.depth, {
        inSitemap: sitemapSet.has(item.url),
        robotsBlocked: false,
      });
    });

    for (const page of pages) {
      if (page.error) errors++;
      crawled++;

      for (const link of page.discoveredLinks) {
        if (!isSameSite(link, siteUrl) || hasSkippedExtension(link)) continue;
        inboundCounts[link] = (inboundCounts[link] ?? 0) + 1;
        if (!visited.has(link) && page.depth + 1 <= maxDepth) {
          if (visited.size + frontier.length < maxPages * 3) {
            frontier.push({ url: link, depth: page.depth + 1 });
          }
        }
      }
    }

    await onBatch(pages);

    if (backedOff) {
      // The origin asked us to slow down; wait once and continue politely.
      await sleep(5000);
      backedOff = false;
    } else if (crawlDelayMs > 0) {
      await sleep(crawlDelayMs);
    }
  }

  return {
    frontier,
    crawled,
    errors,
    inboundCounts,
    complete: frontier.length === 0 || visited.size >= maxPages,
    backedOff,
  };
}
