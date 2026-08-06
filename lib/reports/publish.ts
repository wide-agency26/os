import type { ReportCategory } from "@/lib/reports/categories";

export type ReportPublishStatus = "draft" | "published" | "none";

export function publishConfigVersion(category: ReportCategory): string {
  switch (category) {
    case "Ads":
      return "4.0-ads";
    case "Website":
      return "4.0-website";
    case "Social":
      return "4.0-social-organic";
    case "SEO":
      return "4.0-seo";
    case "General":
    default:
      return "4.0-general";
  }
}
