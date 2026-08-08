/**
 * Parse Instagram Meta HTML account exports into tabular rows for Data Hub.
 * Targets Profiles Reached, Content Interactions, Posts, Live videos HTML dumps.
 */

import type { Element } from "domhandler";
import { load, type CheerioAPI } from "cheerio";
import type { ParsedSheet } from "@/lib/data-hub/parse-workbook";

export type IgHtmlKind =
  | "profiles_reached"
  | "content_interactions"
  | "posts"
  | "live_videos"
  | "unknown";

const METRIC_ALIASES: { field: string; patterns: RegExp[] }[] = [
  {
    field: "accounts_reached",
    patterns: [/accounts?\s*reached/i, /konten\s*erreicht/i, /reichweite/i],
  },
  {
    field: "impressions",
    patterns: [/impressions?/i, /aufrufe/i, /ansichten/i],
  },
  {
    field: "profile_visits",
    patterns: [/profile\s*visits?/i, /profilbesuche/i, /profilaufrufe/i],
  },
  {
    field: "external_link_taps",
    patterns: [
      /external\s*link\s*taps?/i,
      /link\s*taps?/i,
      /website\s*taps?/i,
      /link\s*klicks?/i,
      /externe\s*link/i,
    ],
  },
  {
    field: "content_interactions",
    patterns: [/content\s*interactions?/i, /inhaltsinteraktionen/i, /interaktionen/i],
  },
  {
    field: "accounts_engaged",
    patterns: [/accounts?\s*engaged/i, /konten\s*mit\s*interaktion/i],
  },
  {
    field: "follows",
    patterns: [/^follows?$/i, /neue\s*follower/i, /followers?\s*gained/i],
  },
  {
    field: "likes",
    patterns: [/^likes?$/i, /gefällt\s*mir/i],
  },
  {
    field: "comments",
    patterns: [/^comments?$/i, /kommentare/i],
  },
  {
    field: "shares",
    patterns: [/^shares?$/i, /geteilt/i, /shares?/i],
  },
  {
    field: "saves",
    patterns: [/^saves?$/i, /gespeichert/i, /saved/i],
  },
  {
    field: "post_interactions",
    patterns: [/post\s*interactions?/i, /beitragsinteraktionen/i],
  },
  {
    field: "reels_interactions",
    patterns: [/reels?\s*interactions?/i, /reel[-\s]*interaktionen/i],
  },
  {
    field: "story_interactions",
    patterns: [/stor(?:y|ies)\s*interactions?/i, /story[-\s]*interaktionen/i],
  },
  {
    field: "followers_pct",
    patterns: [/followers?/i, /follower/i],
  },
  {
    field: "non_followers_pct",
    patterns: [/non[-\s]*followers?/i, /nicht[-\s]*follower/i],
  },
];

function canonLabel(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function parseNumberLoose(raw: string): number {
  const t = String(raw ?? "")
    .replace(/[^\d.,\-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function matchMetricField(label: string): string | null {
  const L = canonLabel(label);
  for (const m of METRIC_ALIASES) {
    if (m.patterns.some((p) => p.test(L))) return m.field;
  }
  return null;
}

export function classifyIgHtml(filename: string, html: string, $?: CheerioAPI): IgHtmlKind {
  const name = filename.toLowerCase();
  if (/profiles?\s*reached|reichweite|accounts?\s*reached/i.test(name)) {
    return "profiles_reached";
  }
  if (/content\s*interactions?|inhaltsinteraktionen/i.test(name)) {
    return "content_interactions";
  }
  if (/live\s*videos?/i.test(name)) return "live_videos";
  if (/^posts?\.html|\/posts|beiträge|posts\.html/i.test(name) || /posts/i.test(name)) {
    return "posts";
  }

  const title = ($ ? $("h1").first().text() : "") || "";
  const blob = `${title}\n${html.slice(0, 4000)}`.toLowerCase();
  if (/profiles?\s*reached|accounts?\s*reached/.test(blob)) return "profiles_reached";
  if (/content\s*interactions?/.test(blob)) return "content_interactions";
  if (/live\s*video/.test(blob)) return "live_videos";
  if (/posts?|creation\s*time|caption/.test(blob)) return "posts";
  return "unknown";
}

function extractKeyValuePairs($: CheerioAPI): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const seen = new Set<string>();

  const push = (label: string, value: string) => {
    const L = canonLabel(label);
    const V = canonLabel(value);
    if (!L || !V || L.length > 80) return;
    if (!/[\d%]/.test(V) && !/^\d/.test(V)) return;
    const key = `${L}::${V}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label: L, value: V });
  };

  // Table rows
  $("tr").each((_, tr) => {
    const cells = $(tr)
      .find("td, th")
      .toArray()
      .map((td) => canonLabel($(td).text()));
    if (cells.length >= 2) push(cells[0], cells[cells.length - 1]);
  });

  // Meta-ish class hooks from the brief
  $("._a6_q, ._2pin, [class*='_a6'], [class*='uiBox']").each((_, el) => {
    const text = canonLabel($(el).text());
    // "Accounts reached731" or "Accounts reached\n731"
    const m = text.match(/^(.{3,60}?)[\s:\n]+([\d.,%]+)\s*$/);
    if (m) push(m[1], m[2]);
  });

  // Sibling label/value pattern: strong/span pairs
  $("td, div, span, li").each((_, el) => {
    const $el = $(el);
    if ($el.children().length > 3) return;
    const kids = $el.children().toArray();
    if (kids.length === 2) {
      push($el.children().eq(0).text(), $el.children().eq(1).text());
    }
  });

  // Regex scan of body text blocks
  const bodyText = $("body").text().replace(/\s+/g, " ");
  for (const m of METRIC_ALIASES) {
    for (const p of m.patterns) {
      const re = new RegExp(
        `(${p.source})\\s*[:\\-]?\\s*([\\d.,]+\\s*%?)`,
        "ig"
      );
      let hit: RegExpExecArray | null;
      while ((hit = re.exec(bodyText))) {
        push(hit[1], hit[2]);
      }
    }
  }

  return out;
}

function summaryRowsFromPairs(
  kind: IgHtmlKind,
  pairs: { label: string; value: string }[],
  period: string,
  title: string
): Record<string, string>[] {
  const flat: Record<string, string> = {
    _ig_kind: kind === "unknown" ? "summary" : kind,
    title,
    period,
  };

  let followersPct = "";
  let nonFollowersPct = "";
  let engagedFollowersPct = "";
  let engagedNonFollowersPct = "";

  for (const { label, value } of pairs) {
    const field = matchMetricField(label);
    if (!field) continue;
    const lower = label.toLowerCase();
    if (field === "followers_pct") {
      if (/non|nicht/.test(lower)) nonFollowersPct = value;
      else if (/engaged|interaktion/.test(lower)) engagedFollowersPct = value;
      else followersPct = value;
      continue;
    }
    if (field === "non_followers_pct") {
      if (/engaged|interaktion/.test(lower)) engagedNonFollowersPct = value;
      else nonFollowersPct = value;
      continue;
    }
    if (!flat[field]) flat[field] = String(parseNumberLoose(value) || value);
  }

  if (followersPct) flat.followers_pct = String(parseNumberLoose(followersPct));
  if (nonFollowersPct) flat.non_followers_pct = String(parseNumberLoose(nonFollowersPct));
  if (engagedFollowersPct) {
    flat.engaged_followers_pct = String(parseNumberLoose(engagedFollowersPct));
  }
  if (engagedNonFollowersPct) {
    flat.engaged_non_followers_pct = String(parseNumberLoose(engagedNonFollowersPct));
  }

  return [flat];
}

function parseIgDate(raw: string): Date | null {
  const t = canonLabel(raw);
  if (!t) return null;
  // Aug 07, 2026 4:58 am / 07.08.2026 / 2026-08-07
  const d = new Date(t);
  if (!Number.isNaN(d.getTime()) && d.getFullYear() > 2000) return d;
  const m = t.match(
    /([A-Za-zäöüÄÖÜ]{3,9})\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i
  );
  if (m) {
    const isoTry = `${m[1]} ${m[2]}, ${m[3]} ${m[4]}:${m[5]} ${m[6] || ""}`.trim();
    const d2 = new Date(isoTry);
    if (!Number.isNaN(d2.getTime())) return d2;
  }
  return null;
}

function extractPostCards($: CheerioAPI): Record<string, string>[] {
  const posts: Record<string, string>[] = [];
  const containers = $(
    "div.uiBoxWhite, div._a6-p, article, section, div[role='article']"
  ).toArray();

  const candidates: Element[] =
    containers.length > 0
      ? containers
      : $("div")
          .toArray()
          .filter((el) => {
            const text = $(el).text();
            return (
              /impressions?|accounts?\s*reached|likes?|shares?/i.test(text) &&
              (/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}/i.test(text) ||
                $(el).find("img").length > 0)
            );
          })
          .slice(0, 200);

  for (const el of candidates) {
    const $el = $(el);
    // Skip huge wrappers
    if ($el.find("img").length > 8) continue;
    const text = $el.text();
    if (!/impressions?|accounts?\s*reached|likes?|profile\s*visits?/i.test(text)) {
      continue;
    }

    const img = $el.find("img").first();
    const thumbnail = img.attr("src") || img.attr("data-src") || "";
    const links = $el
      .find("a[href*='instagram.com'], a[href*='instagr.am']")
      .first()
      .attr("href");

    // Caption: prefer short text block near image
    let caption = "";
    $el.find("div, p, span").each((_, node) => {
      if (caption) return;
      const t = canonLabel($(node).text());
      if (t.length < 20 || t.length > 500) return;
      if (/impressions?|accounts?\s*reached|likes?|shares?|saves?/i.test(t)) return;
      if (/^\d/.test(t)) return;
      caption = t;
    });

    // Timestamp
    let createdRaw = "";
    const timeEl = $el.find("time").first();
    if (timeEl.length) {
      createdRaw = timeEl.attr("datetime") || timeEl.text();
    }
    if (!createdRaw) {
      const tm = text.match(
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:am|pm)?)?)/i
      );
      if (tm) createdRaw = tm[1];
    }

    const pairs = extractKeyValuePairs(load(`<div>${$el.html() || ""}</div>`));
    const metrics: Record<string, string> = {};
    for (const { label, value } of pairs) {
      const field = matchMetricField(label);
      if (!field || field.endsWith("_pct")) continue;
      if (!metrics[field]) metrics[field] = String(parseNumberLoose(value));
    }

    if (!Object.keys(metrics).length && !thumbnail && !caption) continue;

    const created = parseIgDate(createdRaw);
    posts.push({
      _ig_kind: "post",
      caption: caption.slice(0, 2000),
      created_at: created ? created.toISOString() : createdRaw,
      created_label: createdRaw,
      thumbnail_url: thumbnail,
      post_url: links || "",
      accounts_reached: metrics.accounts_reached || "0",
      impressions: metrics.impressions || "0",
      profile_visits: metrics.profile_visits || "0",
      follows: metrics.follows || "0",
      saves: metrics.saves || "0",
      likes: metrics.likes || "0",
      comments: metrics.comments || "0",
      shares: metrics.shares || "0",
      external_link_taps: metrics.external_link_taps || "0",
    });
  }

  // Deduplicate near-identical captions
  const dedup: Record<string, string>[] = [];
  const seen = new Set<string>();
  for (const p of posts) {
    const key = `${p.created_at}|${(p.caption || "").slice(0, 40)}|${p.impressions}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(p);
  }
  return dedup;
}

/**
 * Convert an Instagram HTML export into one Data Hub sheet (tabular rows).
 */
export async function parseInstagramHtml(
  filename: string,
  html: string
): Promise<ParsedSheet> {
  const $ = load(html);
  const kind = classifyIgHtml(filename, html, $);
  const title = canonLabel($("h1").first().text()) || filename.replace(/\.(html|htm)$/i, "");
  const periodMatch = $.text().match(
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\s*[–—\-]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i
  );
  const period = periodMatch ? `${periodMatch[1]} – ${periodMatch[2]}` : "";

  const baseName = filename.replace(/\.(html|htm)$/i, "");

  if (kind === "posts" || kind === "live_videos") {
    const rows = extractPostCards($);
    if (!rows.length) {
      // Fallback: treat as summary key-values
      const pairs = extractKeyValuePairs($);
      return {
        name: baseName,
        rows: summaryRowsFromPairs(kind, pairs, period, title),
      };
    }
    return { name: baseName, rows };
  }

  const pairs = extractKeyValuePairs($);
  return {
    name: baseName,
    rows: summaryRowsFromPairs(
      kind === "unknown" ? "profiles_reached" : kind,
      pairs,
      period,
      title
    ),
  };
}

export function isInstagramHtmlFilename(name: string): boolean {
  return /\.(html|htm)$/i.test(name);
}
