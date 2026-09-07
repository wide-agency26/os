/** Live vs file source catalog for Report Sources. */

export type DataProvider =
  | "google_analytics"
  | "google_search_console"
  | "google_ads"
  | "youtube"
  | "meta_ads"
  | "meta_instagram";

export type FileOnlyPlatformId =
  | "linkedin_ads"
  | "linkedin_organic"
  | "facebook_organic";

export const LIVE_PROVIDERS: {
  id: DataProvider;
  label: string;
  tab: "Website" | "SEO" | "Ads" | "Social";
  subcategories: string[];
  oauth: "google" | "google_popup" | "meta";
  hint?: string;
}[] = [
  {
    id: "google_analytics",
    label: "Google Analytics",
    tab: "Website",
    subcategories: ["ga4"],
    oauth: "google",
  },
  {
    id: "google_search_console",
    label: "Search Console",
    tab: "SEO",
    subcategories: [
      "gsc_dates",
      "gsc_queries",
      "gsc_pages",
      "gsc_countries",
      "gsc_devices",
      "gsc_search_appearance",
    ],
    oauth: "google",
  },
  {
    id: "google_ads",
    label: "Google Ads",
    tab: "Ads",
    subcategories: ["google_ads"],
    oauth: "google_popup",
    hint: "Opens a Google account picker in a new window.",
  },
  {
    id: "youtube",
    label: "YouTube",
    tab: "Social",
    subcategories: ["youtube_table", "youtube_chart", "youtube_organic"],
    oauth: "google_popup",
    hint: "Opens a new window so you can pick the YouTube channel’s Google account — not the WIDE inbox.",
  },
  {
    id: "meta_ads",
    label: "Meta Ads",
    tab: "Ads",
    subcategories: ["meta_ads"],
    oauth: "meta",
  },
  {
    id: "meta_instagram",
    label: "Instagram",
    tab: "Social",
    subcategories: [
      "instagram_organic",
      "instagram_profiles_reached",
      "instagram_content_interactions",
      "instagram_posts",
    ],
    oauth: "meta",
  },
];

export const FILE_ONLY_PLATFORMS: {
  id: FileOnlyPlatformId;
  label: string;
  tab: "Ads" | "Social";
  hint: string;
  acceptHint: string;
}[] = [
  {
    id: "linkedin_ads",
    label: "LinkedIn Ads",
    tab: "Ads",
    hint: "Campaign Manager export (LinkedIn has no usable Ads API for us yet)",
    acceptHint: "CSV / Excel",
  },
  {
    id: "linkedin_organic",
    label: "LinkedIn organic",
    tab: "Social",
    hint: "Page analytics export",
    acceptHint: "CSV / Excel",
  },
  {
    id: "facebook_organic",
    label: "Facebook organic",
    tab: "Social",
    hint: "Page insights export",
    acceptHint: "CSV / Excel",
  },
];

export function providerForSubcategory(sub: string | null | undefined): DataProvider | null {
  if (!sub) return null;
  if (sub === "google_ads") return "google_ads";
  if (sub.startsWith("youtube_")) return "youtube";
  for (const p of LIVE_PROVIDERS) {
    if (p.subcategories.includes(sub) || (sub.startsWith("gsc_") && p.id === "google_search_console")) {
      return p.id;
    }
    if (sub.startsWith("instagram_") && p.id === "meta_instagram") return p.id;
  }
  return null;
}

export function liveSubcategoriesForProvider(provider: DataProvider): string[] {
  return LIVE_PROVIDERS.find((p) => p.id === provider)?.subcategories ?? [];
}

export function csvBlockedMessage(
  subcategory: string | null,
  connected: { provider: string; label?: string | null }[]
): string | null {
  const provider = providerForSubcategory(subcategory);
  if (!provider) return null;
  const conn = connected.find((c) => c.provider === provider);
  if (!conn) return null;
  const meta = LIVE_PROVIDERS.find((p) => p.id === provider);
  const tab = meta?.tab ?? "This stream";
  const account = conn.label ? ` (${conn.label})` : "";
  return `${tab} is connected to ${meta?.label ?? provider}${account}. Sync instead, or disconnect to upload a file.`;
}
