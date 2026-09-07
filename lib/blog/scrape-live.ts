/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from "cheerio";
import type { BlogArticle, BlogSettings } from "./types";
import { slugify } from "./types";

export type LivePost = {
  url: string;
  title: string;
  slug: string;
  language: string;
};

const UA =
  "Mozilla/5.0 (compatible; WIDE-OS/1.0; +https://os.wide-communication.com)";

export function blogIndexUrls(siteUrl: string | null, languages: string[]): string[] {
  if (!siteUrl) return [];
  let origin: string;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return [];
  }
  const langs = languages.length ? languages : ["de", "en"];
  const urls = new Set<string>();
  urls.add(`${origin}/blog`);
  for (const lang of langs) {
    urls.add(`${origin}/${lang}/blog`);
  }
  return [...urls];
}

function langFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/^\/([a-z]{2})(?:\/|$)/i);
    if (m && m[1].toLowerCase() !== "blog") return m[1].toLowerCase();
  } catch {
    /* ignore */
  }
  return fallback;
}

function slugFromUrl(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return slugify(parts[parts.length - 1] || "") || "";
  } catch {
    return "";
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html" },
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export function parseBlogIndex(html: string, pageUrl: string, defaultLang: string): LivePost[] {
  const $ = cheerio.load(html);
  const origin = new URL(pageUrl).origin;
  const seen = new Set<string>();
  const posts: LivePost[] = [];

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    if (!href) return;
    let abs: URL;
    try {
      abs = new URL(href, pageUrl);
    } catch {
      return;
    }
    if (abs.origin !== origin) return;
    const path = abs.pathname.replace(/\/$/, "");
    if (!/\/blog\/[^/]+/i.test(path)) return;
    if (/\/blog\/?(page|category|tag|author)?$/i.test(path)) return;
    const url = `${abs.origin}${path}`;
    if (seen.has(url)) return;
    seen.add(url);
    const title =
      $(el).text().replace(/\s+/g, " ").trim() ||
      $(el).attr("title") ||
      slugFromUrl(url).replace(/-/g, " ");
    if (!title || title.length < 8) return;
    posts.push({
      url,
      title: title.slice(0, 180),
      slug: slugFromUrl(url),
      language: langFromUrl(url, defaultLang),
    });
  });

  return posts;
}

export async function scrapeLiveBlogIndexes(
  settings: BlogSettings
): Promise<{ posts: LivePost[]; indexes: string[] }> {
  const indexes = blogIndexUrls(settings.site_url, settings.languages);
  const defaultLang = settings.languages[0] || "de";
  const all: LivePost[] = [];
  const seen = new Set<string>();
  for (const index of indexes) {
    const html = await fetchHtml(index);
    if (!html) continue;
    for (const post of parseBlogIndex(html, index, defaultLang)) {
      if (seen.has(post.url)) continue;
      seen.add(post.url);
      all.push(post);
    }
  }
  return { posts: all, indexes };
}

function tokens(text: string) {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9äöüß]+/i)
      .filter((w) => w.length > 3)
  );
}

function overlap(a: string, b: string) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let n = 0;
  for (const x of ta) if (tb.has(x)) n++;
  return n / new Set([...ta, ...tb]).size;
}

export function matchLivePost(
  article: Pick<BlogArticle, "title" | "slug" | "translations" | "published_url" | "published_urls">,
  posts: LivePost[]
): Record<string, string> {
  const found: Record<string, string> = { ...(article.published_urls || {}) };
  if (article.published_url) {
    const lang = langFromUrl(article.published_url, "de");
    found[lang] ||= article.published_url;
  }
  for (const post of posts) {
    if (found[post.language]) continue;
    const transTitle = article.translations?.[post.language]?.title || "";
    const slugHit = article.slug && post.slug && (article.slug === post.slug || post.slug.includes(article.slug) || article.slug.includes(post.slug));
    const titleHit =
      overlap(article.title, post.title) >= 0.45 ||
      (transTitle && overlap(transTitle, post.title) >= 0.45);
    if (slugHit || titleHit) found[post.language] = post.url;
  }
  return found;
}

export async function syncLiveBlogCorpus(
  supabase: any,
  projectId: string,
  settings: BlogSettings,
  articles: BlogArticle[]
): Promise<{ liveCount: number; matched: number }> {
  const { posts } = await scrapeLiveBlogIndexes(settings);
  if (!posts.length) {
    await supabase
      .from("blog_settings")
      .update({ last_scrape_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("project_id", projectId);
    return { liveCount: 0, matched: 0 };
  }

  await supabase.from("blog_corpus").delete().eq("project_id", projectId).eq("source", "crawl").eq("kind", "blog");
  await supabase.from("blog_corpus").insert(
    posts.map((p) => ({
      project_id: projectId,
      url: p.url,
      title: p.title,
      slug: p.slug || null,
      excerpt: null,
      body_text: p.title,
      kind: "blog",
      source: "crawl",
      language: p.language,
    }))
  );

  let matched = 0;
  for (const article of articles) {
    const urls = matchLivePost(article, posts);
    const langs = Object.keys(urls);
    if (!langs.length) continue;
    matched += 1;
    const primary = urls[article.language] || urls.de || urls.en || Object.values(urls)[0];
    const allLive = settings.languages.every((l) => urls[l]);
    await supabase
      .from("blog_articles")
      .update({
        published_urls: urls,
        published_url: primary,
        published_at: article.published_at || new Date().toISOString(),
        status: allLive || article.status === "published" ? "published" : article.status,
        pipeline_stage: allLive ? "done" : article.pipeline_stage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id);
  }

  await supabase
    .from("blog_settings")
    .update({ last_scrape_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("project_id", projectId);

  return { liveCount: posts.length, matched };
}

export async function webSearchSnippets(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const q = query.trim().slice(0, 180);
  if (q.length < 4) return [];
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const html = await fetchHtml(url);
    if (!html) return [];
    const $ = cheerio.load(html);
    const out: { title: string; url: string; snippet: string }[] = [];
    $(".result, .web-result, .results_links").each((_, el) => {
      if (out.length >= 6) return;
      const a = $(el).find("a.result__a, a[href]").first();
      const title = a.text().replace(/\s+/g, " ").trim();
      let href = a.attr("href") || "";
      const snippet = $(el).find(".result__snippet, .result__body").text().replace(/\s+/g, " ").trim();
      if (href.includes("uddg=")) {
        try {
          href = decodeURIComponent(new URL(href, "https://duckduckgo.com").searchParams.get("uddg") || href);
        } catch {
          /* keep */
        }
      }
      if (!title || !href.startsWith("http")) return;
      out.push({ title: title.slice(0, 160), url: href, snippet: snippet.slice(0, 280) });
    });
    return out;
  } catch {
    return [];
  }
}
