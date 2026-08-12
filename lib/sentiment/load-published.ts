import { createAdminClient } from "@/utils/supabase/admin";
import type { SentimentReportPayload, SentimentReportRow } from "./types";

function mapRow(row: Record<string, unknown>): SentimentReportRow {
  return {
    id: row.id as string,
    public_slug: row.public_slug as string,
    brand_name: row.brand_name as string,
    website_url: (row.website_url as string | null) ?? null,
    status: row.status as SentimentReportRow["status"],
    score: (row.score as number | null) ?? null,
    report: (row.report as SentimentReportPayload) || ({} as SentimentReportPayload),
    bd_record_id: (row.bd_record_id as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function loadPublishedSentimentBySlug(slug: string): Promise<{
  state: "not_found" | "success";
  report?: SentimentReportRow;
}> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { state: "not_found" };
  }
  const { data } = await admin
    .from("sentiment_reports")
    .select("*")
    .eq("public_slug", slug)
    .eq("status", "ready")
    .maybeSingle();
  if (!data) return { state: "not_found" };
  return { state: "success", report: mapRow(data as Record<string, unknown>) };
}
