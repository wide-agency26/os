/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SentimentReportRow } from "@/lib/sentiment/types";
import {
  sentimentLauncherHref,
  sentimentSnapshot,
  sentimentStatusFromReport,
  type SentimentSnapshot,
} from "@/lib/sentiment/strategy";

type Sb = any;

function mapReport(row: any): SentimentReportRow {
  return {
    id: row.id,
    public_slug: row.public_slug,
    brand_name: row.brand_name,
    website_url: row.website_url ?? null,
    status: row.status,
    score: row.score ?? null,
    report: row.report || {},
    bd_record_id: row.bd_record_id ?? null,
    error_message: row.error_message ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return `${u.host}${u.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

async function upsertLink(
  supabase: Sb,
  projectId: string,
  reportId: string | null,
  status: ReturnType<typeof sentimentStatusFromReport>
) {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("sentiment_analysis_links")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing?.id) {
    await supabase
      .from("sentiment_analysis_links")
      .update({
        sentiment_result_id: reportId,
        status,
        updated_at: now,
      })
      .eq("id", existing.id);
    return;
  }
  await supabase.from("sentiment_analysis_links").insert({
    project_id: projectId,
    sentiment_result_id: reportId,
    status,
  });
}

async function findMatchingReport(
  supabase: Sb,
  project: { company: string; website: string | null; bdRecordId: string | null }
): Promise<SentimentReportRow | null> {
  if (project.bdRecordId) {
    const { data } = await supabase
      .from("sentiment_reports")
      .select("*")
      .eq("bd_record_id", project.bdRecordId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return mapReport(data);
  }
  if (project.company) {
    const { data } = await supabase
      .from("sentiment_reports")
      .select("*")
      .ilike("brand_name", project.company)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return mapReport(data);
  }
  const want = normalizeUrl(project.website);
  if (want) {
    const { data } = await supabase
      .from("sentiment_reports")
      .select("*")
      .not("website_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    const hit = (data ?? []).find((r: any) => normalizeUrl(r.website_url) === want);
    if (hit) return mapReport(hit);
  }
  return null;
}

export async function loadProjectSentimentReport(
  supabase: Sb,
  projectId: string
): Promise<SentimentReportRow | null> {
  const { data: link } = await supabase
    .from("sentiment_analysis_links")
    .select("sentiment_result_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!link?.sentiment_result_id) return null;
  const { data } = await supabase
    .from("sentiment_reports")
    .select("*")
    .eq("id", link.sentiment_result_id)
    .maybeSingle();
  return data ? mapReport(data) : null;
}

/** Attach a report to a project and refresh adapter status from the report. */
export async function linkSentimentReportToProject(
  supabase: Sb,
  projectId: string,
  reportId: string
) {
  const { data } = await supabase
    .from("sentiment_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  const report = data ? mapReport(data) : null;
  await upsertLink(
    supabase,
    projectId,
    reportId,
    sentimentStatusFromReport(report)
  );
  return report;
}

/**
 * Resolve the project's sentiment report (existing link or BD/brand/url match),
 * write the adapter row, and return the report for embeds.
 */
export async function ensureProjectSentimentLink(
  supabase: Sb,
  project: {
    id: string;
    company: string;
    website: string | null;
    bdRecordId: string | null;
  }
): Promise<SentimentReportRow | null> {
  let report = await loadProjectSentimentReport(supabase, project.id);
  if (!report) {
    report = await findMatchingReport(supabase, project);
  }
  await upsertLink(
    supabase,
    project.id,
    report?.id ?? null,
    sentimentStatusFromReport(report)
  );
  return report;
}

export function projectSentimentCard(
  project: {
    id: string;
    company: string;
    website: string | null;
    bdRecordId: string | null;
  },
  report: SentimentReportRow | null,
  clientSafe: boolean
): { snapshot?: SentimentSnapshot; href: string } {
  const snapshot = sentimentSnapshot(report, clientSafe);
  return {
    snapshot,
    href: snapshot?.href || sentimentLauncherHref(project),
  };
}
