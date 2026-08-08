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
  | "linkedin_demo_location"
  | "linkedin_demo_follower_seniority"
  | "linkedin_demo_follower_industry"
  | "linkedin_demo_follower_job_function"
  | "linkedin_demo_follower_company_size"
  | "linkedin_demo_follower_location"
  | "instagram_organic"
  | "instagram_profiles_reached"
  | "instagram_content_interactions"
  | "instagram_posts"
  | "instagram_live"
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

/**
 * Snapshots / dimension sheets — not day-by-day time series.
 * Date-range chips must not invent months from these; charts live in their own sections.
 */
export const STATIC_REPORT_SUBCATEGORIES: ReadonlySet<string> = new Set([
  "linkedin_demo_seniority",
  "linkedin_demo_industry",
  "linkedin_demo_job_function",
  "linkedin_demo_company_size",
  "linkedin_demo_location",
  "linkedin_demo_follower_seniority",
  "linkedin_demo_follower_industry",
  "linkedin_demo_follower_job_function",
  "linkedin_demo_follower_company_size",
  "linkedin_demo_follower_location",
  "gsc_queries",
  "gsc_pages",
  "gsc_countries",
  "gsc_devices",
  "gsc_search_appearance",
]);

export function isStaticReportSubcategory(sub: string | null | undefined): boolean {
  return !!sub && STATIC_REPORT_SUBCATEGORIES.has(sub);
}

/** Demo sheets must match before generic "followers" / "visitors" rules. */
const NAME_RULES: { test: RegExp; sub: DatasetSubcategory }[] = [
  { test: /yt[_\s-]?chart|chart\s*data|youtube.*chart/i, sub: "youtube_chart" },
  { test: /yt[_\s-]?table|table\s*data|youtube.*table/i, sub: "youtube_table" },
  { test: /youtube|yt[_\s-]/i, sub: "youtube_organic" },
  { test: /profiles?\s*reached|accounts?\s*reached/i, sub: "instagram_profiles_reached" },
  { test: /content\s*interactions?/i, sub: "instagram_content_interactions" },
  { test: /live\s*videos?/i, sub: "instagram_live" },
  { test: /(?:^|[\s_-])posts?(?:\.html|$|[\s_-])/i, sub: "instagram_posts" },
  { test: /instagram|\big\b/i, sub: "instagram_organic" },
  { test: /li[_\s-]?all[_\s-]?posts|all[_\s-]?posts|linkedin.*posts/i, sub: "linkedin_posts" },
  {
    test: /(?:new[_\s-]?followers?|followers?).*(?:location)/i,
    sub: "linkedin_demo_follower_location",
  },
  {
    test: /(?:new[_\s-]?followers?|followers?).*(?:seniority)/i,
    sub: "linkedin_demo_follower_seniority",
  },
  {
    test: /(?:new[_\s-]?followers?|followers?).*(?:industry)/i,
    sub: "linkedin_demo_follower_industry",
  },
  {
    test: /(?:new[_\s-]?followers?|followers?).*(?:job[_\s-]?function|function)/i,
    sub: "linkedin_demo_follower_job_function",
  },
  {
    test: /(?:new[_\s-]?followers?|followers?).*(?:company[_\s-]?size)/i,
    sub: "linkedin_demo_follower_company_size",
  },
  { test: /visitor.*location|location.*visitor/i, sub: "linkedin_demo_location" },
  { test: /visitor.*seniority|seniority.*visitor/i, sub: "linkedin_demo_seniority" },
  { test: /visitor.*industry|industry.*visitor/i, sub: "linkedin_demo_industry" },
  {
    test: /visitor.*(?:job[_\s-]?function|function)|(?:job[_\s-]?function).*visitor/i,
    sub: "linkedin_demo_job_function",
  },
  {
    test: /visitor.*company[_\s-]?size|company[_\s-]?size.*visitor/i,
    sub: "linkedin_demo_company_size",
  },
  { test: /location/i, sub: "linkedin_demo_location" },
  { test: /seniority/i, sub: "linkedin_demo_seniority" },
  { test: /industry/i, sub: "linkedin_demo_industry" },
  { test: /job[_\s-]?function/i, sub: "linkedin_demo_job_function" },
  { test: /company[_\s-]?size/i, sub: "linkedin_demo_company_size" },
  { test: /li[_\s-]?new[_\s-]?followers|new[_\s-]?followers/i, sub: "linkedin_followers" },
  {
    test: /visitor[_\s-]?metrics|page[_\s-]?views|li[_\s-]?visitor(?!.*senior|.*industr|.*job|.*size|.*location)/i,
    sub: "linkedin_visitors",
  },
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
  const m = trimmed.match(/^([A-Za-z0-9]+)\s*[-–—:|]\s*(.+)$/);
  if (m) {
    const head = m[1];
    const rest = m[2].trim();
    for (const p of PREFIX_MAP) {
      if (p.test.test(head)) return { kind: p.kind, rest };
    }
  }
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

  if (
    (keys.has("videotitle") || keys.has("content")) &&
    keys.has("views") &&
    (keys.has("watchtimehours") || keys.has("impressions") || keys.has("date"))
  ) {
    if (keys.has("date") && !keys.has("watchtimehours") && !keys.has("impressionsclickthroughrate")) {
      return "youtube_chart";
    }
    if (
      keys.has("watchtimehours") ||
      keys.has("impressionsclickthroughrate") ||
      keys.has("averageviewduration")
    ) {
      return "youtube_table";
    }
    return "youtube_organic";
  }

  if (
    (keys.has("cost") || keys.has("costeur")) &&
    (keys.has("impr") || keys.has("impressions")) &&
    (keys.has("campaigntype") || keys.has("campaign") || keys.has("conversions"))
  ) {
    if (!keys.has("amountspent") && !keys.has("amountspenteur") && !keys.has("linkclicks")) {
      return "google_ads";
    }
  }

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
  if (
    (keys.has("location") || keys.has("country") || keys.has("region")) &&
    (keys.has("totalviews") || keys.has("views"))
  ) {
    return "linkedin_demo_location";
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
  if (keys.has("companysize") && (keys.has("totalviews") || keys.has("views"))) {
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
  const fromName = detectSubcategoryFromName(rest) || detectSubcategoryFromName(`Li - ${rest}`);
  if (fromName) return fromName;
  return detectSubcategoryFromColumns(columns) || "linkedin_metrics";
}


function refineInstagram(rest: string, columns?: { key: string }[]): DatasetSubcategory {
  const blob = rest || "";
  if (/profiles?\s*reached|accounts?\s*reached/i.test(blob)) return "instagram_profiles_reached";
  if (/content\s*interactions?/i.test(blob)) return "instagram_content_interactions";
  if (/live\s*videos?/i.test(blob)) return "instagram_live";
  if (/posts?/i.test(blob)) return "instagram_posts";
  const keys = new Set((columns || []).map((c) => c.key.replace(/[^a-z0-9]/gi, "").toLowerCase()));
  if (keys.has("caption") || keys.has("thumbnailurl") || keys.has("createdat")) return "instagram_posts";
  if (keys.has("contentinteractions") || keys.has("postinteractions")) return "instagram_content_interactions";
  if (keys.has("accountsreached") || keys.has("followerspct")) return "instagram_profiles_reached";
  return "instagram_organic";
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
  if (kind === "instagram") return refineInstagram(rest || name, columns);
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
    linkedin_demo_seniority: "Li · Visitor · Seniority",
    linkedin_demo_industry: "Li · Visitor · Industry",
    linkedin_demo_job_function: "Li · Visitor · Job function",
    linkedin_demo_company_size: "Li · Visitor · Company size",
    linkedin_demo_location: "Li · Visitor · Location",
    linkedin_demo_follower_seniority: "Li · New Followers · Seniority",
    linkedin_demo_follower_industry: "Li · New Followers · Industry",
    linkedin_demo_follower_job_function: "Li · New Followers · Job function",
    linkedin_demo_follower_company_size: "Li · New Followers · Company size",
    linkedin_demo_follower_location: "Li · New Followers · Location",
    instagram_organic: "Instagram Organic",
    instagram_profiles_reached: "IG · Profiles Reached",
    instagram_content_interactions: "IG · Content Interactions",
    instagram_posts: "IG · Posts",
    instagram_live: "IG · Live videos",
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
  if (sub.startsWith("youtube") || sub.startsWith("instagram") || sub === "facebook_organic")
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

export function isInstagramOrganicSub(sub: string | null | undefined): boolean {
  return !!sub && (sub === "instagram_organic" || sub.startsWith("instagram_"));
}
