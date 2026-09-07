import {
  META_MAX,
  META_MIN,
  THIN_CONTENT_WORDS,
  TITLE_MAX,
  TITLE_MIN,
} from "../constants";
import type { SeoIssueDraft, SeoScores } from "../types";
import { ISSUE_CATALOG } from "./issue-catalog";
import { computeScores } from "./score";

export type ArticleAuditInput = {
  url?: string;
  title: string;
  metaDescription: string;
  bodyMarkdown: string;
  primaryKeyword?: string | null;
  lang?: string | null;
  hasSchema?: boolean;
  hasOg?: boolean;
  internalLinkCount?: number;
  externalLinkCount?: number;
  hasCta?: boolean;
};

function draft(
  code: string,
  evidence: Record<string, unknown> = {}
): SeoIssueDraft | null {
  const def = ISSUE_CATALOG[code];
  if (!def) return null;
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
    affectedCount: 1,
    sampleUrls: [evidence.url ? String(evidence.url) : "/"],
    evidence,
  };
}

function stripMd(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/[#>*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(md: string) {
  const t = stripMd(md);
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function headings(md: string, level: number) {
  const re = new RegExp(`^#{${level}}\\s+(.+)$`, "gm");
  return [...md.matchAll(re)].map((m) => m[1].trim());
}

function containsKeyword(hay: string, keyword: string | null | undefined) {
  if (!keyword?.trim()) return true;
  const h = hay.toLowerCase();
  const parts = keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (!parts.length) return h.includes(keyword.toLowerCase());
  return parts.filter((p) => h.includes(p)).length >= Math.ceil(parts.length * 0.7);
}

/**
 * Programmatic on-page audit for a single draft article.
 *
 * Reuses the site auditor's issue catalog and scoring so Blog Builder does not
 * invent a second SEO system. Site-wide crawl checks (duplicates, sitemap,
 * Core Web Vitals) are skipped — they cannot be measured on an unpublished draft.
 */
export function auditArticle(input: ArticleAuditInput): {
  issues: SeoIssueDraft[];
  scores: SeoScores;
  wordCount: number;
} {
  const url = input.url || "/draft";
  const issues: SeoIssueDraft[] = [];
  const push = (code: string, evidence: Record<string, unknown> = {}) => {
    const d = draft(code, { url, ...evidence });
    if (d) issues.push(d);
  };

  const title = (input.title || "").trim();
  const meta = (input.metaDescription || "").trim();
  const body = input.bodyMarkdown || "";
  const words = wordCount(body);
  const h1s = headings(body, 1);
  const h2s = headings(body, 2);
  const mdTitleAsH1 = title && !h1s.length;

  if (!title) push("title_missing");
  else if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    push("title_length", { length: title.length, title });
  }

  if (!meta) push("meta_missing");
  else if (meta.length < META_MIN || meta.length > META_MAX) {
    push("meta_length", { length: meta.length });
  }

  if (!h1s.length && !mdTitleAsH1) push("h1_missing");
  if (h1s.length > 1) push("h1_multiple", { headings: h1s });
  if (words > 0 && words < THIN_CONTENT_WORDS) {
    push("thin_content", { word_count: words, threshold_words: THIN_CONTENT_WORDS });
  }
  if (h2s.length < 3 && words > 200) push("headings_shallow", { h2_count: h2s.length });

  const kw = input.primaryKeyword || "";
  if (kw && title && !containsKeyword(title, kw)) {
    push("keyword_missing_title", { keyword: kw });
  }
  const h1text = h1s[0] || title;
  if (kw && h1text && !containsKeyword(h1text, kw)) {
    push("keyword_missing_h1", { keyword: kw });
  }

  if (input.hasSchema === false) push("schema_missing");
  if (input.hasOg === false) push("og_incomplete");
  if (input.lang === "") push("lang_missing");

  const mdLinks = [...body.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((m) => m[2]);
  const internal = input.internalLinkCount ?? mdLinks.filter((h) => h.startsWith("/") || h.includes(url)).length;
  const external = input.externalLinkCount ?? mdLinks.filter((h) => /^https?:\/\//i.test(h)).length;
  if (internal < 1) push("internal_links_missing");
  if (input.hasCta === false) push("cta_missing");
  if (external < 1 && words > 400) push("external_sources_missing");

  const scores = computeScores({
    issues: issues.map((i) => ({
      category: i.category,
      severity: i.severity,
      affected_count: 1,
    })),
    totalPages: 1,
    unavailable: ["performance", "search_presence"],
  });

  return { issues, scores, wordCount: words };
}
