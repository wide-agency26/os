import type { DiscoveryConfig, DiscoverySignalSource } from "@/lib/bd/opportunity-finder";

export type FeedItem = {
  title: string;
  url: string;
  publishedAt: string | null;
  sourceLabel: string;
  query: string;
};

const UA =
  "WIDE-OS-DealFinder/1.0 (+https://os.wide-communication.com; agency research)";

function googleNewsUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=DE&ceid=DE:en`;
}

function queriesFor(config: DiscoveryConfig): { query: string; source: DiscoverySignalSource | "news" }[] {
  const geo = config.geographies.slice(0, 4).join(" OR ") || "Germany";
  const out: { query: string; source: DiscoverySignalSource | "news" }[] = [];
  const has = (s: DiscoverySignalSource) => config.sources.includes(s);

  if (has("funding")) {
    out.push({
      source: "funding",
      query: `("Series A" OR "seed round" OR "raises" OR Finanzierung) (${geo}) startup`,
    });
  }
  if (has("rebrand")) {
    out.push({
      source: "rebrand",
      query: `(rebrand OR "new brand identity" OR "visual identity" OR Markenrelaunch) (${geo})`,
    });
  }
  if (has("job_posting")) {
    out.push({
      source: "job_posting",
      query: `("Brand Designer" OR "Head of Marketing" OR "Creative Director" OR "Brand Manager") (hiring OR Stellenangebot) (${geo})`,
    });
  }
  if (has("rfp")) {
    out.push({
      source: "rfp",
      query: `(RFP OR tender OR Ausschreibung) (brand OR website OR "digital agency") (${geo})`,
    });
  }

  const extra = config.keywords.slice(0, 3).join(" OR ");
  if (extra) {
    out.push({
      source: "news",
      query: `(${extra}) (${geo}) (brand OR marketing OR startup)`,
    });
  }

  return out.slice(0, 5);
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRss(xml: string, query: string, sourceLabel: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks) {
    const title = decodeXml((block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const url = decodeXml(
      (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] ||
        (block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] ||
        ""
    );
    const publishedAt =
      decodeXml((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || "") || null;
    if (!title) continue;
    items.push({ title, url, publishedAt, sourceLabel, query });
  }
  return items;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const STATIC_FEEDS: { url: string; label: string }[] = [
  { url: "https://www.eu-startups.com/feed/", label: "EU-Startups" },
  { url: "https://tech.eu/feed/", label: "Tech.eu" },
];

export async function collectDiscoveryFeeds(config: DiscoveryConfig): Promise<{
  items: FeedItem[];
  feedCount: number;
}> {
  const items: FeedItem[] = [];
  let feedCount = 0;

  for (const feed of STATIC_FEEDS) {
    const xml = await fetchText(feed.url);
    if (!xml) continue;
    feedCount += 1;
    items.push(...parseRss(xml, feed.label, feed.label));
  }

  for (const q of queriesFor(config)) {
    const xml = await fetchText(googleNewsUrl(q.query));
    if (!xml) continue;
    feedCount += 1;
    items.push(...parseRss(xml, q.query, "Google News"));
  }

  const seen = new Set<string>();
  const unique: FeedItem[] = [];
  for (const item of items) {
    const key = (item.url || item.title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const weekAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recent = unique.filter((item) => {
    if (!item.publishedAt) return true;
    const t = Date.parse(item.publishedAt);
    if (!Number.isFinite(t)) return true;
    return t >= weekAgo;
  });

  return { items: recent.slice(0, 60), feedCount };
}
