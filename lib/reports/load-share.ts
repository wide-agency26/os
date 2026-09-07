import { createAdminClient } from "@/utils/supabase/admin";
import { loadReportPrintData, type ReportPrintPayload } from "@/lib/reports/load-print-data";
import { isReportCategory, type ReportCategory } from "@/lib/reports/categories";

export type ReportShareRow = {
  projectId: string;
  publicSlug: string;
  enabled: boolean;
  passwordHash: string;
};

export async function loadShareBySlug(slug: string): Promise<ReportShareRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("project_report_shares")
    .select("project_id, public_slug, enabled, password_hash")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!data) return null;
  return {
    projectId: data.project_id,
    publicSlug: data.public_slug,
    enabled: data.enabled,
    passwordHash: data.password_hash,
  };
}

export async function loadShareByProject(projectId: string): Promise<ReportShareRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("project_report_shares")
    .select("project_id, public_slug, enabled, password_hash")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!data) return null;
  return {
    projectId: data.project_id,
    publicSlug: data.public_slug,
    enabled: data.enabled,
    passwordHash: data.password_hash,
  };
}

export async function listPublishedReportCategories(
  projectId: string
): Promise<ReportCategory[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("published_reports")
    .select("category")
    .eq("project_id", projectId)
    .eq("status", "published");
  const cats = (data ?? [])
    .map((r) => r.category)
    .filter((c): c is ReportCategory => isReportCategory(c));
  const order: ReportCategory[] = ["General", "Social", "Ads", "Website", "SEO"];
  return order.filter((c) => cats.includes(c));
}

export async function loadSharedReportView(
  projectId: string,
  category: ReportCategory
): Promise<ReportPrintPayload | null> {
  const published = await listPublishedReportCategories(projectId);
  if (!published.includes(category)) return null;
  return loadReportPrintData(projectId, category);
}
