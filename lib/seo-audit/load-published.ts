import { createAdminClient } from "@/utils/supabase/admin";
import type { SeoAuditReport, SeoAuditRow } from "./types";

function mapRow(row: Record<string, unknown>): SeoAuditRow {
  return {
    id: row.id as string,
    public_slug: row.public_slug as string,
    url: row.url as string,
    normalized_url: row.normalized_url as string,
    title: (row.title as string | null) ?? null,
    status: row.status as SeoAuditRow["status"],
    score: (row.score as number | null) ?? null,
    report: (row.report as SeoAuditReport) || ({} as SeoAuditReport),
    competitor_url: (row.competitor_url as string | null) ?? null,
    bd_record_id: (row.bd_record_id as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function loadPublishedSeoAuditBySlug(slug: string): Promise<{
  state: "not_found" | "success";
  audit?: SeoAuditRow;
}> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { state: "not_found" };
  }
  const { data } = await admin
    .from("seo_audits")
    .select("*")
    .eq("public_slug", slug)
    .eq("status", "ready")
    .maybeSingle();
  if (!data) return { state: "not_found" };
  return { state: "success", audit: mapRow(data as Record<string, unknown>) };
}
