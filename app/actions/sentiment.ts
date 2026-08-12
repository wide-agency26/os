"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { runSentimentAnalysis, slugifySentimentPart } from "@/lib/sentiment/analyze";
import type { SentimentReportPayload, SentimentReportRow } from "@/lib/sentiment/types";
import type { Json } from "@/types/supabase";

async function requireFounder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not authenticated" as string };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return { supabase, user: null, error: "Founders only" };
  }
  return { supabase, user, error: null as string | null };
}

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

export async function runSentimentReport(input: {
  brandName: string;
  websiteUrl?: string | null;
  bdRecordId?: string | null;
}): Promise<{ ok: boolean; error?: string; id?: string; slug?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const brand = input.brandName.trim();
  if (!brand) return { ok: false, error: "Brand name is required" };

  const slug = `${slugifySentimentPart(brand)}-${Date.now().toString(36).slice(-6)}`;

  const { data: stub, error: insErr } = await supabase
    .from("sentiment_reports")
    .insert({
      public_slug: slug,
      brand_name: brand,
      website_url: input.websiteUrl?.trim() || null,
      status: "running",
      bd_record_id: input.bdRecordId || null,
      created_by: user.id,
      report: {},
    })
    .select("id")
    .single();

  if (insErr || !stub) return { ok: false, error: insErr?.message ?? "Insert failed" };

  try {
    const report = await runSentimentAnalysis({
      brandName: brand,
      websiteUrl: input.websiteUrl,
    });

    const { error: updErr } = await supabase
      .from("sentiment_reports")
      .update({
        status: "ready",
        score: report.score,
        report: report as unknown as Json,
        website_url: report.website_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stub.id);
    if (updErr) return { ok: false, error: updErr.message };

    if (input.bdRecordId) {
      const { data: rec } = await supabase
        .from("bd_records")
        .select("audit_links")
        .eq("id", input.bdRecordId)
        .maybeSingle();
      if (rec) {
        const existing = Array.isArray(rec.audit_links) ? rec.audit_links : [];
        const entry = {
          type: "sentiment",
          report_id: stub.id,
          slug,
          path: `/n/${slug}`,
          score: report.score,
          brand_name: brand,
          created_at: new Date().toISOString(),
        };
        const nextLinks = [
          entry,
          ...existing.filter((x) => {
            if (!x || typeof x !== "object" || Array.isArray(x)) return true;
            const obj = x as { type?: string; report_id?: string };
            return !(obj.type === "sentiment" && obj.report_id === stub.id);
          }),
        ];
        await supabase
          .from("bd_records")
          .update({
            audit_links: nextLinks as unknown as Json,
          })
          .eq("id", input.bdRecordId);
        await supabase.from("bd_timeline_entries").insert({
          bd_record_id: input.bdRecordId,
          actor_type: "user",
          actor_id: user.id,
          action: "sentiment_linked",
          note: `Sentiment report linked (score ${report.score}) → /n/${slug}`,
          meta: entry,
        });
        revalidatePath(`/app/bd/${input.bdRecordId}`);
      }
    }

    revalidatePath("/app/sentiment");
    revalidatePath(`/app/sentiment/${stub.id}`);
    revalidatePath(`/n/${slug}`);
    return { ok: true, id: stub.id, slug };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    await supabase
      .from("sentiment_reports")
      .update({
        status: "failed",
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stub.id);
    return { ok: false, error: msg, id: stub.id, slug };
  }
}

export async function listSentimentReports(): Promise<{
  ok: boolean;
  error?: string;
  reports: SentimentReportRow[];
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error, reports: [] };
  const { data, error: qErr } = await supabase
    .from("sentiment_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (qErr) return { ok: false, error: qErr.message, reports: [] };
  return {
    ok: true,
    reports: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
  };
}

export async function getSentimentReport(id: string): Promise<{
  ok: boolean;
  error?: string;
  report?: SentimentReportRow;
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { data, error: qErr } = await supabase
    .from("sentiment_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (qErr) return { ok: false, error: qErr.message };
  if (!data) return { ok: false, error: "Not found" };
  return { ok: true, report: mapRow(data as Record<string, unknown>) };
}
