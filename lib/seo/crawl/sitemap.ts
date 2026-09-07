import { gunzipSync } from "node:zlib";
import { SEO_USER_AGENT } from "../constants";
import { canonicalizeUrl, isSameSite, originOf } from "../url";

const MAX_SITEMAPS = 40;
const MAX_URLS = 5000;

async function fetchSitemapBody(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": SEO_USER_AGENT, Accept: "application/xml,text/xml,*/*" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const isGzip =
      url.endsWith(".gz") ||
      /gzip/i.test(res.headers.get("content-encoding") || "") ||
      (buffer[0] === 0x1f && buffer[1] === 0x8b);

    if (isGzip) {
      try {
        return gunzipSync(buffer).toString("utf8");
      } catch {
        // Some servers gzip-decode transparently despite the .gz extension.
        return buffer.toString("utf8");
      }
    }
    return buffer.toString("utf8");
  } catch {
    return null;
  }
}

function extractTags(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) out.push(match[1]);
  return out;
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

export type SitemapResult = {
  urls: string[];
  sitemapsChecked: string[];
  found: boolean;
};

/**
 * Expands sitemap indexes recursively (including .gz) and returns same-site
 * page URLs. Bounded so a pathological sitemap can't stall the phase.
 */
export async function discoverSitemapUrls(
  siteUrl: string,
  declaredSitemaps: string[] = []
): Promise<SitemapResult> {
  const origin = originOf(siteUrl);
  const queue: string[] = [];
  const seenSitemaps = new Set<string>();

  for (const s of declaredSitemaps) {
    const abs = canonicalizeUrl(s, origin);
    if (abs) queue.push(abs);
  }
  for (const guess of ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml"]) {
    queue.push(`${origin}${guess}`);
  }

  const urls = new Set<string>();
  const checked: string[] = [];
  let found = false;

  while (queue.length && checked.length < MAX_SITEMAPS && urls.size < MAX_URLS) {
    const next = queue.shift();
    if (!next || seenSitemaps.has(next)) continue;
    seenSitemaps.add(next);

    const body = await fetchSitemapBody(next);
    if (!body || !/<(sitemapindex|urlset)/i.test(body)) continue;

    checked.push(next);
    found = true;

    if (/<sitemapindex/i.test(body)) {
      for (const block of extractTags(body, "sitemap")) {
        const loc = extractTags(block, "loc")[0];
        if (!loc) continue;
        const abs = canonicalizeUrl(decodeEntities(loc), origin);
        if (abs && !seenSitemaps.has(abs)) queue.push(abs);
      }
      continue;
    }

    for (const block of extractTags(body, "url")) {
      const loc = extractTags(block, "loc")[0];
      if (!loc) continue;
      const abs = canonicalizeUrl(decodeEntities(loc), origin);
      if (abs && isSameSite(abs, siteUrl)) urls.add(abs);
      if (urls.size >= MAX_URLS) break;
    }
  }

  return { urls: [...urls], sitemapsChecked: checked, found };
}
