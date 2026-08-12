import * as cheerio from "cheerio";
import type { SeoAuditReport, SeoCheck } from "./types";

export function normalizeAuditUrl(raw: string): string {
  let u = raw.trim();
  if (!u) throw new Error("URL is required");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  const parsed = new URL(u);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs are supported");
  }
  parsed.hash = "";
  return parsed.toString();
}

function scoreFromChecks(checks: SeoCheck[]): number {
  if (!checks.length) return 0;
  let pts = 0;
  let max = 0;
  for (const c of checks) {
    if (c.status === "info") continue;
    max += 2;
    if (c.status === "pass") pts += 2;
    else if (c.status === "warn") pts += 1;
  }
  if (!max) return 50;
  return Math.round((pts / max) * 100);
}

async function fetchPage(url: string): Promise<{
  html: string;
  status: number;
  headers: Headers;
  ms: number;
}> {
  const started = Date.now();
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "WIDE-SEO-Audit/1.0 (+https://www.wide-communication.com; research)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  return {
    html,
    status: res.status,
    headers: res.headers,
    ms: Date.now() - started,
  };
}

function analyzeHtml(
  url: string,
  html: string,
  status: number,
  headers: Headers,
  ms: number
): { checks: SeoCheck[]; title: string | null; meta: string | null; canonical: string | null } {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || null;
  const meta =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;
  const canonical =
    $('link[rel="canonical"]').attr("href")?.trim() ||
    $('meta[property="og:url"]').attr("content")?.trim() ||
    null;
  const h1s = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const images = $("img").toArray();
  const imagesMissingAlt = images.filter((el) => !($(el).attr("alt") || "").trim()).length;
  const viewport = $('meta[name="viewport"]').attr("content") || null;
  const robots = $('meta[name="robots"]').attr("content") || null;
  const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const https = url.startsWith("https://");
  const htmlBytes = Buffer.byteLength(html, "utf8");
  const hasHreflang = $('link[rel="alternate"][hreflang]').length > 0;
  const lang = $("html").attr("lang") || null;

  const checks: SeoCheck[] = [];

  checks.push({
    id: "http_status",
    category: "technical",
    title: "HTTP status",
    status: status >= 200 && status < 400 ? "pass" : "fail",
    detail: `Responded with ${status}`,
  });

  checks.push({
    id: "https",
    category: "technical",
    title: "HTTPS",
    status: https ? "pass" : "fail",
    detail: https ? "Page is served over HTTPS." : "Page is not HTTPS.",
  });

  checks.push({
    id: "title",
    category: "on_page",
    title: "Title tag",
    status: !title ? "fail" : title.length < 15 || title.length > 65 ? "warn" : "pass",
    detail: title
      ? `Length ${title.length} chars (ideal ~30–60).`
      : "Missing <title>.",
    evidence: title,
  });

  checks.push({
    id: "meta_description",
    category: "on_page",
    title: "Meta description",
    status: !meta ? "fail" : meta.length < 50 || meta.length > 165 ? "warn" : "pass",
    detail: meta
      ? `Length ${meta.length} chars (ideal ~70–160).`
      : "Missing meta description.",
    evidence: meta,
  });

  checks.push({
    id: "h1",
    category: "on_page",
    title: "H1 heading",
    status: h1s.length === 1 ? "pass" : h1s.length === 0 ? "fail" : "warn",
    detail:
      h1s.length === 0
        ? "No H1 found."
        : h1s.length === 1
          ? "Single H1 present."
          : `${h1s.length} H1 tags found — prefer one primary H1.`,
    evidence: h1s.slice(0, 3).join(" | ") || null,
  });

  checks.push({
    id: "image_alt",
    category: "on_page",
    title: "Image alt text",
    status:
      images.length === 0
        ? "info"
        : imagesMissingAlt === 0
          ? "pass"
          : imagesMissingAlt / images.length > 0.3
            ? "fail"
            : "warn",
    detail:
      images.length === 0
        ? "No images detected."
        : `${imagesMissingAlt}/${images.length} images missing alt.`,
  });

  checks.push({
    id: "canonical",
    category: "technical",
    title: "Canonical URL",
    status: canonical ? "pass" : "warn",
    detail: canonical ? "Canonical link present." : "No canonical link found.",
    evidence: canonical,
  });

  checks.push({
    id: "robots_meta",
    category: "technical",
    title: "Robots meta",
    status: robots && /noindex/i.test(robots) ? "warn" : "pass",
    detail: robots
      ? `robots meta: ${robots}`
      : "No restrictive robots meta detected.",
    evidence: robots,
  });

  checks.push({
    id: "viewport",
    category: "mobile",
    title: "Mobile viewport",
    status: viewport ? "pass" : "fail",
    detail: viewport
      ? "Viewport meta present."
      : "Missing viewport meta — likely not mobile-friendly.",
    evidence: viewport,
  });

  checks.push({
    id: "html_lang",
    category: "on_page",
    title: "HTML lang",
    status: lang ? "pass" : "warn",
    detail: lang ? `lang="${lang}"` : "html lang attribute missing.",
  });

  checks.push({
    id: "schema",
    category: "meta_schema",
    title: "JSON-LD schema",
    status: hasJsonLd ? "pass" : "warn",
    detail: hasJsonLd
      ? "JSON-LD structured data found."
      : "No JSON-LD detected — consider Organization/WebSite schema.",
  });

  checks.push({
    id: "open_graph",
    category: "meta_schema",
    title: "Open Graph",
    status: ogTitle ? "pass" : "warn",
    detail: ogTitle ? "og:title present." : "Missing Open Graph title.",
    evidence: ogTitle || null,
  });

  checks.push({
    id: "hreflang",
    category: "technical",
    title: "Hreflang",
    status: hasHreflang ? "pass" : "info",
    detail: hasHreflang
      ? "Hreflang alternates present."
      : "No hreflang — fine for single-locale sites.",
  });

  const ttfb = ms;
  checks.push({
    id: "ttfb_proxy",
    category: "performance",
    title: "Server response time (approx)",
    status: ttfb < 800 ? "pass" : ttfb < 2000 ? "warn" : "fail",
    detail: `Fetched HTML in ${ttfb}ms from this server (not a lab Lighthouse run).`,
  });

  checks.push({
    id: "html_weight",
    category: "performance",
    title: "HTML document size",
    status: htmlBytes < 200_000 ? "pass" : htmlBytes < 500_000 ? "warn" : "fail",
    detail: `${Math.round(htmlBytes / 1024)} KB of HTML.`,
  });

  const cache = headers.get("cache-control");
  checks.push({
    id: "cache_headers",
    category: "performance",
    title: "Cache-Control",
    status: cache ? "pass" : "info",
    detail: cache ? `cache-control: ${cache}` : "No cache-control header on document.",
  });

  checks.push({
    id: "backlinks",
    category: "backlinks",
    title: "Backlink snapshot",
    status: "info",
    detail:
      "Third-party backlink APIs are not wired in this build — use Ahrefs/Semrush for a full link profile. This audit focuses on on-page + technical signals.",
  });

  return { checks, title, meta, canonical };
}

export async function runSeoAuditAnalysis(opts: {
  url: string;
  competitorUrl?: string | null;
}): Promise<SeoAuditReport> {
  const url = normalizeAuditUrl(opts.url);
  const page = await fetchPage(url);
  const analyzed = analyzeHtml(url, page.html, page.status, page.headers, page.ms);
  const checks = [...analyzed.checks];

  let competitor: SeoAuditReport["competitor"] = null;
  if (opts.competitorUrl?.trim()) {
    try {
      const cUrl = normalizeAuditUrl(opts.competitorUrl);
      const cPage = await fetchPage(cUrl);
      const cAnalyzed = analyzeHtml(
        cUrl,
        cPage.html,
        cPage.status,
        cPage.headers,
        cPage.ms
      );
      const cScore = scoreFromChecks(cAnalyzed.checks);
      competitor = {
        url: cUrl,
        title: cAnalyzed.title,
        score: cScore,
        note: `Competitor on-page/technical score ${cScore} vs primary page (same lightweight checks).`,
      };
      checks.push({
        id: "competitor_compare",
        category: "competitor",
        title: "Competitor snapshot",
        status: "info",
        detail: competitor.note,
        evidence: cAnalyzed.title,
      });
    } catch (e) {
      checks.push({
        id: "competitor_compare",
        category: "competitor",
        title: "Competitor snapshot",
        status: "warn",
        detail: `Could not fetch competitor: ${e instanceof Error ? e.message : "error"}`,
      });
    }
  }

  const score = scoreFromChecks(checks);
  const summary = {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  };

  return {
    url,
    fetched_at: new Date().toISOString(),
    http_status: page.status,
    title: analyzed.title,
    meta_description: analyzed.meta,
    canonical: analyzed.canonical,
    score,
    checks,
    summary,
    competitor,
    limitations: [
      "Not a full Lighthouse / Core Web Vitals lab run.",
      "Backlink and SERP data require third-party APIs (not connected).",
      "JS-rendered-only content may be under-counted.",
    ],
  };
}

export function slugifySeoPart(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
