/**
 * Detect Data Hub subcategory from sheet/file prefix (Li -, YT -, Web -)
 * or filename / column heuristics.
 */

export type DatasetSubcategory =
  | "meta_ads"
  | "google_ads"
  | "linkedin_ads"
  | "linkedin_metrics"
  | "linkedin_visitors"
  | "linkedin_followers"
  | "linkedin_posts"
  | "linkedin_demo_seniority"
  | "linkedin_demo_industry"
  | "linkedin_demo_job_function"
  | "linkedin_demo_company_size"
  | "instagram_organic"
  | "facebook_organic"
  | "youtube_organic"
  | "youtube_table"
  | "youtube_chart"
  | "ga4"
  | "gsc"
  | "gsc_queries"
  | "gsc_pages"
  | "gsc_dates"
  | "gsc_countries"
  | "gsc_devices"
  | "gsc_search_appearance"
  | "unknown";

const NAME_RULES: { test: RegExp; sub: DatasetSubcategory }[] = [
  { test: /yt[_\s-]?chart|chart\s*data|youtube.*chart/i, sub: "youtube_chart" },
  { test: /yt[_\s-]?table|table\s*data|youtube.*table/i, sub: "youtube_table" },
  { test: /youtube|yt[_\s-]/i, sub: "youtube_organic" },
  { test: /li[_\s-]?all[_\s-]?posts|all[_\s-]?posts|linkedin.*posts/i, sub: "linkedin_posts" },
  { test: /li[_\s-]?new[_\s-]?followers|new[_\s-]?followers|followers/i, sub: "linkedin_followers" },
  {
    test: /visitor[_\s-]?metrics|page[_\s-]?views|li[_\s-]?visitor(?!.*senior|.*industr|.*job|.*size|.*location)/i,
    sub: "linkedin_visitors",
  },
  { test: /seniority/i, sub: "linkedin_demo_seniority" },
  { test: /industry/i, sub: "linkedin_demo_industry" },
  { test: /job[_\s-]?function|function/i, sub: "linkedin_demo_job_function" },
  { test: /company[_\s-]?size/i, sub: "linkedin_demo_company_size" },
  { test: /li[_\s-]?metrics|linkedin.*metrics|engagement/i, sub: "linkedin_metrics" },
  { test: /liads|linkedin.?ads|creative.?performance|campaign.?manager/i, sub: "linkedin_ads" },
  { test: /campaign\s*performance|google.?ads|gads/i, sub: "google_ads" },
  { test: /meta|facebook.?ads|instagram.?ads|amount.?spent/i, sub: "meta_ads" },
  { test: /ga4|session.?source|total.?users|web[_\s-]/i, sub: "ga4" },
  { test: /gsc[_\s-]?quer|search.?console.*quer|top.?quer/i, sub: "gsc_queries" },
  { test: /gsc[_\s-]?page|search.?console.*page|top.?page/i, sub: "gsc_pages" },
  { test: /gsc[_\s-]?date|search.?console.*date/i, sub: "gsc_dates" },
  { test: /gsc[_\s-]?countr|search.?console.*countr/i, sub: "gsc_countries" },
  { test: /gsc[_\s-]?device|search.?console.*device/i, sub: "gsc_devices" },
  {
    test: /gsc[_\s-]?search.?appearance|search.?appearance|rich.?result/i,
    sub: "gsc_search_appearance",
  },
  { test: /search.?console|gsc/i, sub: "gsc" },
];

/** Sheet prefixes the user will use in Excel tab names */
const PREFIX_MAP: { test: RegExp; kind: string }[] = [
  { test: /^(liads|linkedinads)\b/i, kind: "linkedin_ads" },
  { test: /^(li|linkedin)\b/i, kind: "linkedin" },
  { test: /^(yt|youtube)\b/i, kind: "youtube" },
  { test: /^(web|ga4|website)\b/i, kind: "web" },
  { test: /^(gads|google)\b/i, kind: "google" },
  { test: /^(meta|fbads|igads)\b/i, kind: "meta" },
  { test: /^(ads)\b/i, kind: "ads" },
  { test: /^(seo|gsc)\b/i, kind: "seo" },
  { test: /^(ig|instagram)\b/i, kind: "instagram" },
  { test: /^(fb|facebook)\b/i, kind: "facebook" },
];

function normalizeHeader(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function parseSheetPrefix(name: string): {
  kind: string | null;
  rest: string;
} {
  const trimmed = name.trim();
  // "Li - Metrics", "YT — Chart data", "Web: GA4"
  const m = trimmed.match(
    /^([A-Za-z0-9]+)\s*[-–—:|]\s*(.+)$/
  );
  if (m) {
    const head = m[1];
    const rest = m[2].trim();
    for (const p of PREFIX_MAP) {
      if (p.test.test(head)) return { kind: p.kind, rest };
    }
  }
  // Also match leading token without separator: "Li Metrics"
  for (const p of PREFIX_MAP) {
    if (p.test.test(trimmed)) {
      return { kind: p.kind, rest: trimmed.replace(p.test, "").replace(/^[\s\-–—:|]+/, "") };
    }
  }
  return { kind: null, rest: trimmed };
}

export function detectSubcategoryFromName(name: string): DatasetSubcategory | null {
  for (const rule of NAME_RULES) {
    if (rule.test.test(name)) return rule.sub;
  }
  return null;
}

export function detectSubcategoryFromColumns(
  columns: { key: string }[] | undefined
): DatasetSubcategory | null {
  const keys = new Set((columns || []).map((c) => normalizeHeader(c.key)));

  // YouTube Studio
  if (
    (keys.has("videotitle") || keys.has("content")) &&
    keys.has("views") &&
    (keys.has("watchtimehours") || keys.has("impressions") || keys.has("date"))
  ) {
    if (keys.has("date") && !keys.has("watchtimehours") && !keys.has("impressionsclickthroughrate")) {
      return "youtube_chart";
    }
    if (keys.has("watchtimehours") || keys.has("impressionsclickthroughrate") || keys.has("averageviewduration")) {
      return "youtube_table";
    }
    return "youtube_organic";
  }

  // Google Ads (Cost + Impr. / Campaign type — before Meta Amount spent)
  if (
    (keys.has("cost") || keys.has("costeur")) &&
    (keys.has("impr") || keys.has("impressions")) &&
    (keys.has("campaigntype") || keys.has("campaign") || keys.has("conversions"))
  ) {
    if (!keys.has("amountspent") && !keys.has("amountspenteur") && !keys.has("linkclicks")) {
      return "google_ads";
    }
  }

  // LinkedIn Ads creative performance
  if (
    (keys.has("startdateinutc") || [...keys].some((k) => k.includes("startdate"))) &&
    (keys.has("totalspent") || keys.has("amountspent")) &&
    (keys.has("adname") || keys.has("clickstolandingpage") || keys.has("videoviews"))
  ) {
    return "linkedin_ads";
  }

  if (
    keys.has("posttitle") ||
    keys.has("posttype") ||
    (keys.has("createddate") && keys.has("impressions") && keys.has("likes"))
  ) {
    return "linkedin_posts";
  }
  if (
    keys.has("organicfollowers") ||
    keys.has("newfollowers") ||
    (keys.has("followersgained") && !keys.has("impressionsorganic"))
  ) {
    return "linkedin_followers";
  }
  if (
    keys.has("overviewpageviewstotal") ||
    keys.has("overviewuniquevisitorstotal") ||
    keys.has("totalpageviews") ||
    keys.has("uniquevisitors")
  ) {
    return "linkedin_visitors";
  }
  if (keys.has("seniority") && (keys.has("totalviews") || keys.has("views"))) {
    return "linkedin_demo_seniority";
  }
  if (keys.has("industry") && (keys.has("totalviews") || keys.has("views"))) {
    return "linkedin_demo_industry";
  }
  if (
    (keys.has("jobfunction") || keys.has("function")) &&
    (keys.has("totalviews") || keys.has("views"))
  ) {
    return "linkedin_demo_job_function";
  }
  if (
    (keys.has("companysize") || keys.has("companysize")) &&
    (keys.has("totalviews") || keys.has("views"))
  ) {
    return "linkedin_demo_company_size";
  }
  if (
    keys.has("impressionsorganic") ||
    keys.has("reactionsorganic") ||
    keys.has("commentsorganic")
  ) {
    return "linkedin_metrics";
  }
  if (
    keys.has("amountspent") ||
    keys.has("amountspenteur") ||
    (keys.has("campaignname") && keys.has("impressions"))
  ) {
    return "meta_ads";
  }
  if (keys.has("sessionsource") && keys.has("sessions")) return "ga4";

  // Google Search Console
  if (keys.has("position") && (keys.has("clicks") || keys.has("impressions"))) {
    if (keys.has("date") || keys.has("day")) return "gsc_dates";
    if (keys.has("query") || keys.has("topqueries") || keys.has("keyword")) return "gsc_queries";
    if (keys.has("page") || keys.has("toppages") || keys.has("landingpage") || keys.has("url"))
      return "gsc_pages";
    if (keys.has("country") || keys.has("countrycode") || keys.has("countryname"))
      return "gsc_countries";
    if (keys.has("device") || keys.has("devicecategory")) return "gsc_devices";
    if (keys.has("searchappearance") || keys.has("appearance")) return "gsc_search_appearance";
    return "gsc";
  }

  return null;
}

function refineLinkedIn(rest: string, columns?: { key: string }[]): DatasetSubcategory {
  return (
    detectSubcategoryFromName(rest) ||
    detectSubcategoryFromColumns(columns) ||
    "linkedin_metrics"
  );
}

function refineYouTube(rest: string, columns?: { key: string }[]): DatasetSubcategory {
  if (/chart/i.test(rest)) return "youtube_chart";
  if (/table/i.test(rest)) return "youtube_table";
  const fromCols = detectSubcategoryFromColumns(columns);
  if (fromCols && fromCols.startsWith("youtube")) return fromCols;
  return "youtube_organic";
}

function refineGsc(rest: string, columns?: { key: string }[]): DatasetSubcategory {
  if (/quer|keyword/i.test(rest)) return "gsc_queries";
  if (/page|url|landing/i.test(rest)) return "gsc_pages";
  if (/date|daily|day/i.test(rest)) return "gsc_dates";
  if (/countr/i.test(rest)) return "gsc_countries";
  if (/device/i.test(rest)) return "gsc_devices";
  if (/appearance|snippet|rich/i.test(rest)) return "gsc_search_appearance";
  const fromCols = detectSubcategoryFromColumns(columns);
  if (fromCols && (fromCols === "gsc" || fromCols.startsWith("gsc_"))) return fromCols;
  return "gsc";
}

export function detectSubcategory(
  name: string,
  columns?: { key: string }[]
): DatasetSubcategory {
  const { kind, rest } = parseSheetPrefix(name);

  if (kind === "linkedin_ads") return "linkedin_ads";
  if (kind === "linkedin") {
    if (/ads|campaign|creative|performance/i.test(rest)) return "linkedin_ads";
    return refineLinkedIn(rest || name, columns);
  }
  if (kind === "youtube") return refineYouTube(rest || name, columns);
  if (kind === "web") return "ga4";
  if (kind === "google") return "google_ads";
  if (kind === "meta") return "meta_ads";
  if (kind === "ads") {
    return detectSubcategoryFromName(rest) || detectSubcategoryFromColumns(columns) || "meta_ads";
  }
  if (kind === "seo") return refineGsc(rest || name, columns);
  if (kind === "instagram") return "instagram_organic";
  if (kind === "facebook") return "facebook_organic";

  return (
    detectSubcategoryFromName(name) ||
    detectSubcategoryFromColumns(columns) ||
    "unknown"
  );
}

export function subcategoryLabel(sub: string | null | undefined): string {
  const map: Record<string, string> = {
    meta_ads: "Meta Ads",
    google_ads: "Google Ads",
    linkedin_ads: "LinkedIn Ads",
    linkedin_metrics: "LinkedIn Metrics",
    linkedin_visitors: "LinkedIn Visitors",
    linkedin_followers: "LinkedIn Followers",
    linkedin_posts: "LinkedIn Posts",
    linkedin_demo_seniority: "LinkedIn · Seniority",
    linkedin_demo_industry: "LinkedIn · Industry",
    linkedin_demo_job_function: "LinkedIn · Job function",
    linkedin_demo_company_size: "LinkedIn · Company size",
    instagram_organic: "Instagram Organic",
    facebook_organic: "Facebook Organic",
    youtube_organic: "YouTube Organic",
    youtube_table: "YouTube · Table data",
    youtube_chart: "YouTube · Chart data",
    ga4: "GA4 Website",
    gsc: "Search Console",
    gsc_queries: "GSC · Queries",
    gsc_pages: "GSC · Pages",
    gsc_dates: "GSC · Dates",
    gsc_countries: "GSC · Countries",
    gsc_devices: "GSC · Devices",
    gsc_search_appearance: "GSC · Search Appearance",
    unknown: "Untagged",
  };
  return map[sub || "unknown"] || sub || "Untagged";
}

export function suggestedUploadCategory(sub: DatasetSubcategory): string {
  if (sub.startsWith("linkedin_") && sub !== "linkedin_ads") return "Social";
  if (sub.startsWith("youtube") || sub === "instagram_organic" || sub === "facebook_organic")
    return "Social";
  if (sub === "meta_ads" || sub === "google_ads" || sub === "linkedin_ads") return "Ads";
  if (sub === "ga4") return "Website";
  if (sub === "gsc" || sub.startsWith("gsc_")) return "SEO";
  return "Website";
}

export function isLinkedInOrganicSub(sub: string | null | undefined): boolean {
  return !!sub && sub.startsWith("linkedin_") && sub !== "linkedin_ads";
}

export function isYouTubeOrganicSub(sub: string | null | undefined): boolean {
  return (
    sub === "youtube_organic" ||
    sub === "youtube_table" ||
    sub === "youtube_chart"
  );
}

export function isGscSub(sub: string | null | undefined): boolean {
  return !!sub && (sub === "gsc" || sub.startsWith("gsc_"));
}

export function isMetaAdsSub(sub: string | null | undefined): boolean {
  return sub === "meta_ads";
}

export function isGoogleAdsSub(sub: string | null | undefined): boolean {
  return sub === "google_ads";
}

export function isLinkedInAdsSub(sub: string | null | undefined): boolean {
  return sub === "linkedin_ads";
}
