import * as cheerio from "cheerio";

const ALLOWED_HOSTS = new Set([
  "wide-communication.com",
  "www.wide-communication.com",
]);

export type PortfolioScrapeResult = {
  ok: boolean;
  title?: string;
  imageCandidates?: string[];
  canonicalUrl?: string;
  error?: string;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function absolutize(src: string, base: string): string | null {
  try {
    const cleaned = decodeEntities(src).trim().replace(/^["']|["']$/g, "");
    const u = new URL(cleaned, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function preferFullRes(url: string): string {
  return url.replace(/-p-\d+(\.(?:jpe?g|png|webp|gif))/i, "$1");
}

function isNoiseImage(url: string): boolean {
  return /logo|favicon|webclip|placeholder|hollow\.svg|cookie|icon/i.test(url);
}

/** Extract url(...) values from inline style, including quoted & HTML-entity forms */
function urlsFromStyle(style: string | undefined): string[] {
  if (!style) return [];
  const decoded = decodeEntities(style);
  const out: string[] = [];
  const re = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(decoded))) {
    if (m[2]) out.push(m[2]);
  }
  return out;
}

export function normalizeWideProjectUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/\//, "")}`;
    const u = new URL(withProto);
    if (!ALLOWED_HOSTS.has(u.hostname)) return null;
    u.pathname = u.pathname.replace(/^\/projects\//i, "/project/");
    if (!/^\/project\/[^/]+\/?$/i.test(u.pathname)) return null;
    u.hash = "";
    u.search = "";
    u.hostname = "www.wide-communication.com";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function scrapeWideProjectPage(
  rawUrl: string
): Promise<PortfolioScrapeResult> {
  const url = normalizeWideProjectUrl(rawUrl);
  if (!url) {
    return {
      ok: false,
      error:
        "Paste a wide-communication.com/project/… URL (singular /project/ slug).",
    };
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; WIDE-OS-SOW/1.0; +https://www.wide-communication.com)",
      Accept: "text/html",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return { ok: false, error: `Could not fetch project page (${res.status})` };
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const ogTitle =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text() ||
    "";
  const h1 = $("h1").first().text().trim();
  let title = h1 || ogTitle.replace(/\s*\|\s*WIDE.*$/i, "").trim();
  title = title.replace(/^Brand Design for\s+/i, "").trim() || title;

  const candidates: string[] = [];
  const push = (src?: string | null) => {
    if (!src) return;
    const abs = absolutize(src.split(/\s+/)[0], url);
    if (!abs) return;
    if (isNoiseImage(abs)) return;
    // Prefer website-files CDN project assets
    const preferred = preferFullRes(abs);
    if (!candidates.includes(preferred)) candidates.push(preferred);
  };

  push($('meta[property="og:image"]').attr("content"));

  // Inline background-image (Webflow CMS often puts hero/mid banners here)
  $("[style*='background'], [style*='Background']").each((_, el) => {
    for (const u of urlsFromStyle($(el).attr("style"))) push(u);
  });

  $("img").each((_, el) => {
    push($(el).attr("src"));
    push($(el).attr("data-src"));
    push($(el).attr("data-bg"));
    const srcset = $(el).attr("srcset");
    if (srcset) {
      const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
      push(first);
    }
  });

  // Raw CDN URLs in HTML (covers escaped style attributes)
  const cdnRe =
    /https:\/\/cdn\.prod\.website-files\.com\/[^"'\\\s<>]+?\.(?:jpe?g|png|webp|gif)/gi;
  const rawMatches = html.match(cdnRe) || [];
  for (const m of rawMatches) {
    push(decodeEntities(m));
  }

  // Prefer larger / non-thumbnail assets first
  candidates.sort((a, b) => {
    const score = (u: string) => {
      let s = 0;
      if (/mid.?banner|hero|banner|cover/i.test(u)) s += 5;
      if (/thumbnail|thumb|poster/i.test(u)) s -= 3;
      if (/-p-500/i.test(u)) s -= 1;
      return s;
    };
    return score(b) - score(a);
  });

  return {
    ok: true,
    title: title || "WIDE project",
    imageCandidates: candidates.slice(0, 16),
    canonicalUrl: url,
  };
}
