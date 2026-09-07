import { generateJsonFromGateway } from "@/lib/ai/gateway-json";
import type { DiscoveryConfig, DiscoverySignalSource } from "@/lib/bd/opportunity-finder";
import type { FeedItem } from "./feeds";

const SOURCES: DiscoverySignalSource[] = [
  "funding",
  "rebrand",
  "job_posting",
  "directory",
  "rfp",
];

export type ExtractedDeal = {
  company_name: string;
  contact_name: string | null;
  role: string | null;
  website: string | null;
  source: DiscoverySignalSource;
  signal_summary: string;
  signal_url: string | null;
  geography: string | null;
  industry: string | null;
};

function asSource(value: unknown): DiscoverySignalSource {
  const raw = String(value || "");
  if (SOURCES.includes(raw as DiscoverySignalSource)) return raw as DiscoverySignalSource;
  if (raw === "news") return "funding";
  return "funding";
}

function heuristicFromFeeds(
  items: FeedItem[],
  config: DiscoveryConfig
): ExtractedDeal[] {
  const deals: ExtractedDeal[] = [];
  const geoHit = (text: string) =>
    config.geographies.some((g) => text.toLowerCase().includes(g.toLowerCase()));

  for (const item of items) {
    const title = item.title.replace(/\s+-\s+[^-]+$/, "").trim();
    const raise = title.match(
      /^(.{2,60}?)\s+(raises|raised|closes|closed|secures|launches|unveils|rebrands)\b/i
    );
    if (!raise) continue;
    const company = raise[1].replace(/[:|].*$/, "").trim();
    if (company.length < 2 || company.length > 60) continue;
    const blob = `${title} ${item.query}`;
    if (config.geographies.length && !geoHit(blob) && !geoHit(item.query)) {
      // keep EU-Startups / Tech.eu even without geo in the title
      if (item.sourceLabel === "Google News") continue;
    }
    const lower = blob.toLowerCase();
    const source: DiscoverySignalSource = lower.includes("rebrand")
      ? "rebrand"
      : lower.includes("hiring") || lower.includes("designer")
        ? "job_posting"
        : lower.includes("rfp") || lower.includes("tender")
          ? "rfp"
          : "funding";
    if (!config.sources.includes(source) && source !== "funding") continue;
    deals.push({
      company_name: company,
      contact_name: null,
      role: null,
      website: null,
      source,
      signal_summary: title,
      signal_url: item.url || null,
      geography: config.geographies[0] || null,
      industry: null,
    });
    if (deals.length >= 8) break;
  }
  return deals;
}

export async function extractDealsFromFeeds(
  items: FeedItem[],
  config: DiscoveryConfig
): Promise<ExtractedDeal[]> {
  if (!items.length) return [];

  const headlines = items
    .slice(0, 40)
    .map((item, i) => `${i + 1}. ${item.title}${item.url ? ` | ${item.url}` : ""}`)
    .join("\n");

  const drafted = await generateJsonFromGateway({
    system: `You are WIDE's deal finder. WIDE is a Munich branding and growth agency.
Pick companies that could become clients: DACH / EU startups and mid-market firms showing funding, rebrand, marketing hire, website rebuild, or RFP signals.
Skip giants (Google, Amazon, Meta, Apple, Microsoft, SAP unless a named subunit), agencies, and anything already sounding like a press-release mill.
Output ONLY JSON: {"deals":[{"company_name":string,"contact_name":string|null,"role":string|null,"website":string|null,"source":"funding"|"rebrand"|"job_posting"|"directory"|"rfp","signal_summary":string,"signal_url":string|null,"geography":string|null,"industry":string|null}]}
Max 8 deals. Prefer ${config.geographies.join(", ") || "DACH"}. Industries of interest: ${config.industries.join(", ") || "any"}.`,
    prompt: `Headlines:\n${headlines}\n\nKeywords: ${config.keywords.join(", ")}`,
    maxOutputTokens: 2500,
  });

  const fromAi: ExtractedDeal[] = [];
  const list =
    drafted && typeof drafted === "object" && Array.isArray((drafted as { deals?: unknown }).deals)
      ? ((drafted as { deals: unknown[] }).deals)
      : [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const company = String(r.company_name || "").trim();
    if (company.length < 2) continue;
    const source = asSource(r.source);
    if (!config.sources.includes(source) && source !== "funding") continue;
    fromAi.push({
      company_name: company,
      contact_name: r.contact_name ? String(r.contact_name) : null,
      role: r.role ? String(r.role) : null,
      website: r.website ? String(r.website) : null,
      source,
      signal_summary: String(r.signal_summary || "").trim() || company,
      signal_url: r.signal_url ? String(r.signal_url) : null,
      geography: r.geography ? String(r.geography) : null,
      industry: r.industry ? String(r.industry) : null,
    });
  }

  if (fromAi.length) return fromAi.slice(0, 8);
  return heuristicFromFeeds(items, config);
}
