/** Top-level report navigation (Report Builder tabs) */
export const REPORT_CATEGORIES = [
  "General",
  "Social",
  "Ads",
  "Website",
  "SEO",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Categories that accept Data Hub CSV uploads (General is synthesis-only) */
export const DATA_HUB_CATEGORIES = ["Social", "Ads", "Website", "SEO"] as const;

export type DataHubCategory = (typeof DATA_HUB_CATEGORIES)[number];

export const ADS_PLATFORMS = [
  { id: "meta", label: "Meta Ads" },
  { id: "google", label: "Google Ads" },
  { id: "linkedin", label: "LinkedIn Ads" },
] as const;

export const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram Organic" },
  { id: "facebook", label: "Facebook Organic" },
  { id: "linkedin", label: "LinkedIn Organic" },
  { id: "youtube", label: "YouTube Organic" },
] as const;

/** Legacy categories still present in older datasets */
export const LEGACY_CATEGORY_MAP: Record<string, ReportCategory> = {
  Digital: "Ads",
  Content: "Social",
};

export function isReportCategory(value: string): value is ReportCategory {
  return (REPORT_CATEGORIES as readonly string[]).includes(value);
}

export function dataHubCategoriesForUpload(): string[] {
  return [...DATA_HUB_CATEGORIES];
}

/** Categories to query when loading Ads (includes legacy Social Meta uploads) */
export function datasetCategoriesForReport(category: ReportCategory): string[] {
  if (category === "Ads") return ["Ads", "Digital", "Social"];
  if (category === "Social") return ["Social", "Content"];
  if (category === "General") return []; // synthesis — no direct datasets
  return [category];
}
