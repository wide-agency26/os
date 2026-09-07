import {
  META_MAX,
  META_MIN,
  THIN_CONTENT_WORDS,
  TITLE_MAX,
  TITLE_MIN,
} from "../constants";
import type { SeoIssueDraft } from "../types";
import type { StoredPage } from "../store";
import { ISSUE_CATALOG } from "./issue-catalog";

const SAMPLE_LIMIT = 25;

function draft(
  code: string,
  urls: string[],
  evidence: Record<string, unknown> = {}
): SeoIssueDraft | null {
  const def = ISSUE_CATALOG[code];
  if (!def || !urls.length) return null;
  return {
    code,
    category: def.category,
    severity: def.severity,
    title: def.title,
    whatItMeans: def.whatItMeans,
    whyItMatters: def.whyItMatters,
    howToFix: def.howToFix,
    impact: def.impact,
    effort: def.effort,
    affectedCount: urls.length,
    sampleUrls: urls.slice(0, SAMPLE_LIMIT),
    evidence,
  };
}

function pushTo(map: Map<string, string[]>, key: string, value: string): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

function isValidHreflang(code: string): boolean {
  if (code.toLowerCase() === "x-default") return true;
  return /^[a-z]{2,3}(-[A-Za-z]{2,4})?(-[A-Za-z]{2}|-\d{3})?$/i.test(code);
}

export type SiteAnalysisInput = {
  siteUrl: string;
  pages: StoredPage[];
  sitemapFound: boolean;
  sitemapUrls: string[];
};

export type SiteAnalysisResult = {
  issues: SeoIssueDraft[];
  /** Per-URL issue codes, written back so the Pages table can show them. */
  pageIssueCodes: Record<string, string[]>;
  stats: {
    pages_crawled: number;
    pages_indexable: number;
    pages_in_sitemap: number;
    crawl_errors: number;
  };
};

/**
 * Site-wide analysis — the checks a single-page scan structurally cannot do,
 * because they depend on comparing pages against each other.
 */
export function analyzeSite(input: SiteAnalysisInput): SiteAnalysisResult {
  const { pages, siteUrl, sitemapFound, sitemapUrls } = input;
  const issues: SeoIssueDraft[] = [];
  const pageIssueCodes: Record<string, string[]> = {};

  const tag = (url: string, code: string) => {
    (pageIssueCodes[url] ??= []).push(code);
  };

  // Pages that actually returned HTML we could read.
  const ok = pages.filter(
    (p) => p.status_code !== null && p.status_code >= 200 && p.status_code < 300
  );

  // ------------------------------------------------------------ indexability
  const broken = pages.filter(
    (p) => p.status_code !== null && p.status_code >= 400 && p.status_code < 500
  );
  const serverErrors = pages.filter((p) => p.status_code !== null && p.status_code >= 500);
  const noindexed = ok.filter((p) => p.noindex);
  const robotsBlocked = pages.filter((p) => p.robots_blocked);
  const chains = pages.filter((p) => (p.redirect_chain?.length ?? 0) > 1);

  for (const p of broken) tag(p.url, "broken_pages");
  for (const p of serverErrors) tag(p.url, "server_errors");
  for (const p of noindexed) tag(p.url, "noindex_pages");
  for (const p of robotsBlocked) tag(p.url, "robots_blocked_pages");
  for (const p of chains) tag(p.url, "redirect_chains");

  issues.push(
    ...([
      draft("broken_pages", broken.map((p) => p.url)),
      draft("server_errors", serverErrors.map((p) => p.url)),
      draft("noindex_pages", noindexed.map((p) => p.url)),
      draft("robots_blocked_pages", robotsBlocked.map((p) => p.url)),
      draft(
        "redirect_chains",
        chains.map((p) => p.url),
        { longest_chain: Math.max(0, ...chains.map((p) => p.redirect_chain?.length ?? 0)) }
      ),
    ].filter(Boolean) as SeoIssueDraft[])
  );

  // HTTPS
  if (siteUrl.startsWith("http://")) {
    const d = draft("https_missing", [siteUrl]);
    if (d) issues.push(d);
  }

  // Sitemap coverage
  if (!sitemapFound) {
    const d = draft("sitemap_missing", [siteUrl]);
    if (d) issues.push(d);
  } else {
    const sitemapSet = new Set(sitemapUrls);
    const missing = ok.filter((p) => p.indexable && !sitemapSet.has(p.url));
    for (const p of missing) tag(p.url, "crawled_not_in_sitemap");
    const d = draft("crawled_not_in_sitemap", missing.map((p) => p.url), {
      sitemap_url_count: sitemapUrls.length,
    });
    if (d) issues.push(d);
  }

  // Orphans: reachable in the crawl but nothing links to them. The homepage and
  // any sitemap-only discovery are excluded — neither indicates a real orphan.
  const homeUrl = ok.find((p) => p.depth === 0)?.url;
  const orphans = ok.filter(
    (p) => p.url !== homeUrl && p.internal_links_in === 0 && p.indexable
  );
  for (const p of orphans) tag(p.url, "orphan_pages");
  const orphanDraft = draft("orphan_pages", orphans.map((p) => p.url));
  if (orphanDraft) issues.push(orphanDraft);

  // Canonicals
  const noCanonical = ok.filter((p) => p.indexable && !p.canonical);
  const conflicting = ok.filter(
    (p) => p.indexable && p.canonical && p.canonical_self === false
  );
  for (const p of noCanonical) tag(p.url, "canonical_missing");
  for (const p of conflicting) tag(p.url, "canonical_conflict");
  const canonicalDrafts = [
    draft("canonical_missing", noCanonical.map((p) => p.url)),
    draft("canonical_conflict", conflicting.map((p) => p.url), {
      examples: conflicting.slice(0, 10).map((p) => ({ page: p.url, canonical: p.canonical })),
    }),
  ].filter(Boolean) as SeoIssueDraft[];
  issues.push(...canonicalDrafts);

  // ----------------------------------------------------------------- on-page
  const indexable = ok.filter((p) => p.indexable);

  const missingTitle = indexable.filter((p) => !p.title);
  const badTitleLength = indexable.filter(
    (p) => p.title && (p.title.length < TITLE_MIN || p.title.length > TITLE_MAX)
  );
  const missingMeta = indexable.filter((p) => !p.meta_description);
  const badMetaLength = indexable.filter(
    (p) =>
      p.meta_description &&
      (p.meta_description.length < META_MIN || p.meta_description.length > META_MAX)
  );
  const missingH1 = indexable.filter((p) => !p.h1s || p.h1s.length === 0);
  const multipleH1 = indexable.filter((p) => (p.h1s?.length ?? 0) > 1);
  const missingAlt = indexable.filter((p) => p.images_missing_alt > 0);

  for (const p of missingTitle) tag(p.url, "title_missing");
  for (const p of badTitleLength) tag(p.url, "title_length");
  for (const p of missingMeta) tag(p.url, "meta_missing");
  for (const p of badMetaLength) tag(p.url, "meta_length");
  for (const p of missingH1) tag(p.url, "h1_missing");
  for (const p of multipleH1) tag(p.url, "h1_multiple");
  for (const p of missingAlt) tag(p.url, "images_missing_alt");

  issues.push(
    ...([
      draft("title_missing", missingTitle.map((p) => p.url)),
      draft("title_length", badTitleLength.map((p) => p.url), {
        examples: badTitleLength.slice(0, 10).map((p) => ({
          url: p.url, title: p.title, length: p.title?.length ?? 0,
        })),
      }),
      draft("meta_missing", missingMeta.map((p) => p.url)),
      draft("meta_length", badMetaLength.map((p) => p.url)),
      draft("h1_missing", missingH1.map((p) => p.url)),
      draft("h1_multiple", multipleH1.map((p) => p.url)),
      draft("images_missing_alt", missingAlt.map((p) => p.url), {
        total_images_missing_alt: missingAlt.reduce((s, p) => s + p.images_missing_alt, 0),
      }),
    ].filter(Boolean) as SeoIssueDraft[])
  );

  // Duplicate titles / descriptions — cross-page comparison.
  const byTitle = new Map<string, string[]>();
  for (const p of indexable) {
    if (!p.title) continue;
    pushTo(byTitle, p.title.trim().toLowerCase(), p.url);
  }
  const dupTitleGroups = [...byTitle.entries()].filter(([, urls]) => urls.length > 1);
  const dupTitleUrls = dupTitleGroups.flatMap(([, urls]) => urls);
  for (const url of dupTitleUrls) tag(url, "title_duplicate");
  const dupTitleDraft = draft("title_duplicate", dupTitleUrls, {
    groups: dupTitleGroups.slice(0, 10).map(([title, urls]) => ({
      title, count: urls.length, urls: urls.slice(0, 5),
    })),
  });
  if (dupTitleDraft) issues.push(dupTitleDraft);

  const byMeta = new Map<string, string[]>();
  for (const p of indexable) {
    if (!p.meta_description) continue;
    pushTo(byMeta, p.meta_description.trim().toLowerCase(), p.url);
  }
  const dupMetaUrls = [...byMeta.values()].filter((u) => u.length > 1).flat();
  for (const url of dupMetaUrls) tag(url, "meta_duplicate");
  const dupMetaDraft = draft("meta_duplicate", dupMetaUrls);
  if (dupMetaDraft) issues.push(dupMetaDraft);

  // ----------------------------------------------------------------- content
  const thin = indexable.filter(
    (p) => (p.word_count ?? 0) > 0 && (p.word_count ?? 0) < THIN_CONTENT_WORDS
  );
  for (const p of thin) tag(p.url, "thin_content");
  const thinDraft = draft("thin_content", thin.map((p) => p.url), {
    threshold_words: THIN_CONTENT_WORDS,
  });
  if (thinDraft) issues.push(thinDraft);

  const byHash = new Map<string, string[]>();
  for (const p of indexable) {
    if (!p.content_hash || (p.word_count ?? 0) < 50) continue;
    pushTo(byHash, p.content_hash, p.url);
  }
  const dupGroups = [...byHash.values()].filter((u) => u.length > 1);
  const dupUrls = dupGroups.flat();
  for (const url of dupUrls) tag(url, "duplicate_content");
  const dupDraft = draft("duplicate_content", dupUrls, {
    group_count: dupGroups.length,
    groups: dupGroups.slice(0, 10).map((urls) => urls.slice(0, 5)),
  });
  if (dupDraft) issues.push(dupDraft);

  // --------------------------------------------------------------- technical
  const noViewport = ok.filter((p) => p.viewport === false);
  const noLang = ok.filter((p) => !p.lang);
  const noSchema = indexable.filter((p) => !p.schema_types || p.schema_types.length === 0);
  const noOg = indexable.filter((p) => p.og_complete === false);
  const slowTtfb = ok.filter((p) => (p.ttfb_ms ?? 0) > 800);
  const heavy = ok.filter((p) => (p.bytes ?? 0) > 500_000);

  const badHreflang = ok.filter((p) =>
    (p.hreflang ?? []).some((h) => !isValidHreflang(h.lang))
  );

  for (const p of noViewport) tag(p.url, "viewport_missing");
  for (const p of noLang) tag(p.url, "lang_missing");
  for (const p of noSchema) tag(p.url, "schema_missing");
  for (const p of noOg) tag(p.url, "og_incomplete");
  for (const p of slowTtfb) tag(p.url, "slow_ttfb");
  for (const p of heavy) tag(p.url, "heavy_pages");
  for (const p of badHreflang) tag(p.url, "hreflang_invalid");

  issues.push(
    ...([
      draft("viewport_missing", noViewport.map((p) => p.url)),
      draft("lang_missing", noLang.map((p) => p.url)),
      draft("schema_missing", noSchema.map((p) => p.url)),
      draft("og_incomplete", noOg.map((p) => p.url)),
      draft("slow_ttfb", slowTtfb.map((p) => p.url), {
        slowest_ms: Math.max(0, ...slowTtfb.map((p) => p.ttfb_ms ?? 0)),
        median_ms: median(ok.map((p) => p.ttfb_ms ?? 0).filter(Boolean)),
      }),
      draft("heavy_pages", heavy.map((p) => p.url), {
        largest_bytes: Math.max(0, ...heavy.map((p) => p.bytes ?? 0)),
      }),
      draft("hreflang_invalid", badHreflang.map((p) => p.url), {
        invalid_codes: [
          ...new Set(
            badHreflang.flatMap((p) =>
              (p.hreflang ?? []).filter((h) => !isValidHreflang(h.lang)).map((h) => h.lang)
            )
          ),
        ].slice(0, 10),
      }),
    ].filter(Boolean) as SeoIssueDraft[])
  );

  return {
    issues,
    pageIssueCodes,
    stats: {
      pages_crawled: pages.length,
      pages_indexable: indexable.length,
      pages_in_sitemap: ok.filter((p) => p.in_sitemap).length,
      crawl_errors: pages.filter((p) => p.error).length,
    },
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
