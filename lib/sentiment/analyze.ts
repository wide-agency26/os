import * as cheerio from "cheerio";
import type {
  SentimentFinding,
  SentimentPolarity,
  SentimentReportPayload,
} from "./types";

const POSITIVE = [
  "love",
  "great",
  "excellent",
  "amazing",
  "trusted",
  "award",
  "best",
  "recommend",
  "outstanding",
  "innovative",
];
const NEGATIVE = [
  "hate",
  "terrible",
  "worst",
  "scam",
  "complaint",
  "lawsuit",
  "fraud",
  "poor",
  "disappointed",
  "refund",
];

function countHits(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  return words.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0);
}

function polarityFromScores(pos: number, neg: number): SentimentPolarity {
  if (pos === 0 && neg === 0) return "neutral";
  if (pos > 0 && neg > 0) return "mixed";
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

function scoreFromFindings(findings: SentimentFinding[]): number {
  let pts = 50;
  for (const f of findings) {
    if (f.polarity === "positive") pts += 8;
    if (f.polarity === "negative") pts -= 12;
    if (f.polarity === "mixed") pts -= 2;
  }
  return Math.max(0, Math.min(100, pts));
}

export async function runSentimentAnalysis(opts: {
  brandName: string;
  websiteUrl?: string | null;
}): Promise<SentimentReportPayload> {
  const brand = opts.brandName.trim();
  if (!brand) throw new Error("Brand name is required");

  const findings: SentimentFinding[] = [];
  let websiteUrl = opts.websiteUrl?.trim() || null;
  if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
    websiteUrl = `https://${websiteUrl}`;
  }

  if (websiteUrl) {
    try {
      const res = await fetch(websiteUrl, {
        redirect: "follow",
        headers: {
          "User-Agent": "WIDE-Sentiment/1.0 (+https://www.wide-communication.com)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(20000),
      });
      const html = await res.text();
      const $ = cheerio.load(html);
      const text = $("body").text().replace(/\s+/g, " ").slice(0, 40000);
      const pos = countHits(text, POSITIVE);
      const neg = countHits(text, NEGATIVE);

      findings.push({
        id: "site_tone",
        source: "website",
        title: "Own-site language tone",
        polarity: polarityFromScores(pos, neg),
        detail: `Keyword polarity on homepage body: +${pos} / −${neg} (heuristic).`,
      });

      let ratingFound = false;
      $('script[type="application/ld+json"]').each((_, el) => {
        const raw = $(el).html() || "";
        try {
          const data = JSON.parse(raw);
          const nodes = Array.isArray(data) ? data : [data];
          for (const node of nodes) {
            const agg = node?.aggregateRating || node?.AggregateRating;
            if (agg?.ratingValue) {
              ratingFound = true;
              const value = Number(agg.ratingValue);
              const count = Number(agg.reviewCount || agg.ratingCount || 0);
              findings.push({
                id: "schema_rating",
                source: "reviews_schema",
                title: "Structured review rating",
                polarity:
                  value >= 4 ? "positive" : value >= 3 ? "mixed" : "negative",
                detail: `Schema AggregateRating ${value}${count ? ` from ${count} reviews` : ""}.`,
                evidence: JSON.stringify(agg).slice(0, 200),
              });
            }
          }
        } catch {
          /* ignore bad JSON-LD */
        }
      });

      if (!ratingFound) {
        findings.push({
          id: "schema_rating_missing",
          source: "reviews_schema",
          title: "Structured review rating",
          polarity: "neutral",
          detail: "No AggregateRating JSON-LD found on the page.",
        });
      }

      const hasGmb =
        /google\.com\/maps|g\.page|maps\.app\.goo\.gl/i.test(html) ||
        $('a[href*="google.com/maps"]').length > 0;
      findings.push({
        id: "gmb_link",
        source: "google_business",
        title: "Google Business presence (on-site)",
        polarity: hasGmb ? "positive" : "neutral",
        detail: hasGmb
          ? "Google Maps / Business link detected on site."
          : "No Google Business / Maps link detected on the homepage.",
      });

      const pressHints = /press|newsroom|media kit|as seen in/i.test(text);
      findings.push({
        id: "press_surface",
        source: "press",
        title: "Press / newsroom surface",
        polarity: pressHints ? "positive" : "neutral",
        detail: pressHints
          ? "Press or newsroom language found on-site."
          : "No obvious press/newsroom section detected.",
      });
    } catch (e) {
      findings.push({
        id: "site_fetch_failed",
        source: "website",
        title: "Website fetch",
        polarity: "neutral",
        detail: `Could not fetch site: ${e instanceof Error ? e.message : "error"}`,
      });
    }
  } else {
    findings.push({
      id: "no_website",
      source: "website",
      title: "Website",
      polarity: "neutral",
      detail: "No website provided — analysis limited to brand name context.",
    });
  }

  findings.push({
    id: "social_api",
    source: "social",
    title: "Social mentions",
    polarity: "neutral",
    detail:
      "Live social listening APIs are not connected in this build. Use this report as a first-pass brand surface read; attach manual notes in BD after human review.",
  });

  const score = scoreFromFindings(findings);
  const overall: SentimentPolarity =
    score >= 70 ? "positive" : score >= 45 ? "mixed" : "negative";

  const themes = [
    { label: "Trust / reviews", weight: findings.some((f) => f.source === "reviews_schema") ? 0.8 : 0.3 },
    { label: "Brand voice", weight: 0.6 },
    { label: "Local presence", weight: findings.some((f) => f.id === "gmb_link" && f.polarity === "positive") ? 0.7 : 0.2 },
  ];

  return {
    brand_name: brand,
    website_url: websiteUrl,
    fetched_at: new Date().toISOString(),
    score,
    overall,
    findings,
    themes,
    limitations: [
      "Not a full social listening or Google Reviews API pull.",
      "Keyword polarity is a coarse heuristic on fetched HTML.",
      "Press/news third-party coverage requires separate sources.",
    ],
  };
}

export function slugifySentimentPart(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
