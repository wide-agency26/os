import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { CrawledPage } from "../types";
import type { FetchResult } from "../fetcher";
import {
  canonicalizeUrl,
  hasSkippedExtension,
  isSameSite,
  pathOf,
} from "../url";

function textOf($: cheerio.CheerioAPI, selector: string): string | null {
  const value = $(selector).first().text().trim();
  return value || null;
}

function collectSchemaTypes($: cheerio.CheerioAPI): string[] {
  const types = new Set<string>();

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const walk = (node: unknown) => {
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (!node || typeof node !== "object") return;
        const obj = node as Record<string, unknown>;
        const t = obj["@type"];
        if (typeof t === "string") types.add(t);
        else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
        if (Array.isArray(obj["@graph"])) walk(obj["@graph"]);
      };
      walk(parsed);
    } catch {
      /* malformed JSON-LD is reported as an issue, not a crash */
    }
  });

  $("[itemtype]").each((_, el) => {
    const raw = $(el).attr("itemtype");
    if (raw) types.add(raw.split("/").pop() || raw);
  });

  return [...types].slice(0, 25);
}

/** Visible body text, with chrome removed so word counts mean something. */
function extractBodyText($: cheerio.CheerioAPI): string {
  const $body = $("body").clone();
  $body.find("script, style, noscript, svg, template, iframe").remove();
  $body.find("nav, header, footer, aside").remove();
  return $body.text().replace(/\s+/g, " ").trim();
}

export function parsePage(
  result: FetchResult,
  siteUrl: string,
  depth: number,
  opts: { inSitemap: boolean; robotsBlocked: boolean }
): CrawledPage {
  const url = result.finalUrl || result.url;
  const base: CrawledPage = {
    url: canonicalizeUrl(url) ?? url,
    path: pathOf(url),
    depth,
    statusCode: result.status,
    contentType: result.contentType,
    ttfbMs: result.ttfbMs,
    bytes: result.bytes,
    title: null,
    metaDescription: null,
    canonical: null,
    canonicalSelf: null,
    h1s: [],
    headingOutline: [],
    wordCount: 0,
    contentHash: null,
    lang: null,
    hreflang: [],
    schemaTypes: [],
    ogComplete: false,
    viewport: false,
    noindex: false,
    robotsBlocked: opts.robotsBlocked,
    indexable: false,
    inSitemap: opts.inSitemap,
    redirectChain: result.redirectChain,
    imagesTotal: 0,
    imagesMissingAlt: 0,
    internalLinksOut: 0,
    externalLinksOut: 0,
    discoveredLinks: [],
    error: result.error,
  };

  if (!result.body) return base;

  const $ = cheerio.load(result.body);

  const title = textOf($, "title");
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;
  const canonicalRaw = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const canonical = canonicalRaw ? canonicalizeUrl(canonicalRaw, url) : null;

  const robotsMeta = ($('meta[name="robots"]').attr("content") || "").toLowerCase();
  const googlebotMeta = ($('meta[name="googlebot"]').attr("content") || "").toLowerCase();
  const xRobots = (result.headers?.get("x-robots-tag") || "").toLowerCase();
  const noindex = /noindex/.test(robotsMeta) || /noindex/.test(googlebotMeta) || /noindex/.test(xRobots);

  const h1s = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const headingOutline = $("h1, h2, h3")
    .map((_, el) => ({
      level: Number(el.tagName.replace("h", "")) || 0,
      text: $(el).text().trim().slice(0, 160),
    }))
    .get()
    .filter((h) => h.text)
    .slice(0, 80);

  const images = $("img").toArray();
  const imagesMissingAlt = images.filter(
    (el) => !($(el).attr("alt") || "").trim()
  ).length;

  const hreflang = $('link[rel="alternate"][hreflang]')
    .map((_, el) => ({
      lang: ($(el).attr("hreflang") || "").trim(),
      href: ($(el).attr("href") || "").trim(),
    }))
    .get()
    .filter((h) => h.lang && h.href)
    .slice(0, 60);

  const discovered = new Set<string>();
  let internalLinksOut = 0;
  let externalLinksOut = 0;

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    if (!href || href.startsWith("#")) return;
    if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) return;

    const abs = canonicalizeUrl(href, url);
    if (!abs) return;

    if (isSameSite(abs, siteUrl)) {
      internalLinksOut++;
      const rel = ($(el).attr("rel") || "").toLowerCase();
      if (!hasSkippedExtension(abs) && !rel.includes("nofollow")) discovered.add(abs);
    } else {
      externalLinksOut++;
    }
  });

  const bodyText = extractBodyText($);
  const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const ogDescription = $('meta[property="og:description"]').attr("content")?.trim();
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim();

  const canonicalSelf = canonical
    ? canonical === (canonicalizeUrl(url) ?? url)
    : null;

  const statusOk = (result.status ?? 0) >= 200 && (result.status ?? 0) < 300;

  return {
    ...base,
    title,
    metaDescription,
    canonical,
    canonicalSelf,
    h1s,
    headingOutline,
    wordCount,
    contentHash: bodyText
      ? createHash("md5").update(bodyText.slice(0, 20000)).digest("hex")
      : null,
    lang: $("html").attr("lang")?.trim() || null,
    hreflang,
    schemaTypes: collectSchemaTypes($),
    ogComplete: Boolean(ogTitle && ogDescription && ogImage),
    viewport: Boolean($('meta[name="viewport"]').attr("content")),
    noindex,
    indexable: statusOk && !noindex && !opts.robotsBlocked,
    imagesTotal: images.length,
    imagesMissingAlt,
    internalLinksOut,
    externalLinksOut,
    discoveredLinks: [...discovered],
  };
}
