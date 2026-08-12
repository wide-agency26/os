"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import {
  normalizeAuditUrl,
  runSeoAuditAnalysis,
  slugifySeoPart,
} from "@/lib/seo-audit/analyze";
import type { SeoAuditReport, SeoAuditRow } from "@/lib/seo-audit/types";
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

export async function runSeoAudit(input: {
  url: string;
  competitorUrl?: string | null;
  bdRecordId?: string | null;
}): Promise<{ ok: boolean; error?: string; id?: string; slug?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  let normalized: string;
  try {
    normalized = normalizeAuditUrl(input.url);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid URL" };
  }

  const host = (() => {
    try {
      return new URL(normalized).hostname.replace(/^www\./, "");
    } catch {
      return "site";
    }
  })();
  const slug = `${slugifySeoPart(host)}-${Date.now().toString(36).slice(-6)}`;

  const { data: stub, error: insErr } = await supabase
    .from("seo_audits")
    .insert({
      public_slug: slug,
      url: input.url.trim(),
      normalized_url: normalized,
      status: "running",
      competitor_url: input.competitorUrl?.trim() || null,
      bd_record_id: input.bdRecordId || null,
      created_by: user.id,
      report: {},
    })
    .select("id")
    .single();

  if (insErr || !stub) return { ok: false, error: insErr?.message ?? "Insert failed" };

  try {
    const report = await runSeoAuditAnalysis({
      url: normalized,
      competitorUrl: input.competitorUrl,
    });

    const { error: updErr } = await supabase
      .from("seo_audits")
      .update({
        status: "ready",
        score: report.score,
        title: report.title,
        report: report as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stub.id);

    if (updErr) return { ok: false, error: updErr.message };

    if (input.bdRecordId) {
      await linkSeoAuditToBdRecord({
        supabase,
        bdRecordId: input.bdRecordId,
        auditId: stub.id,
        slug,
        url: normalized,
        score: report.score,
        actorId: user.id,
      });
    }

    revalidatePath("/app/seo-audit");
    revalidatePath(`/app/seo-audit/${stub.id}`);
    revalidatePath(`/a/${slug}`);
    if (input.bdRecordId) revalidatePath(`/app/bd/${input.bdRecordId}`);

    return { ok: true, id: stub.id, slug };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Audit failed";
    await supabase
      .from("seo_audits")
      .update({
        status: "failed",
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stub.id);
    return { ok: false, error: msg, id: stub.id, slug };
  }
}

async function linkSeoAuditToBdRecord(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  bdRecordId: string;
  auditId: string;
  slug: string;
  url: string;
  score: number;
  actorId: string;
}) {
  const { data: rec } = await opts.supabase
    .from("bd_records")
    .select("audit_links")
    .eq("id", opts.bdRecordId)
    .maybeSingle();
  if (!rec) return;

  const existing = Array.isArray(rec.audit_links) ? rec.audit_links : [];
  const entry = {
    type: "seo_audit",
    audit_id: opts.auditId,
    slug: opts.slug,
    url: opts.url,
    score: opts.score,
    path: `/a/${opts.slug}`,
    created_at: new Date().toISOString(),
  };
  const next = [
    entry,
    ...existing.filter(
      (x: { audit_id?: string }) => x?.audit_id !== opts.auditId
    ),
  ];

  await opts.supabase
    .from("bd_records")
    .update({ audit_links: next })
    .eq("id", opts.bdRecordId);

  await opts.supabase.from("bd_timeline_entries").insert({
    bd_record_id: opts.bdRecordId,
    actor_type: "user",
    actor_id: opts.actorId,
    action: "seo_audit_linked",
    note: `SEO audit linked (score ${opts.score}) → /a/${opts.slug}`,
    meta: entry,
  });
}

export async function listSeoAudits(): Promise<{
  ok: boolean;
  error?: string;
  audits: SeoAuditRow[];
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error, audits: [] };
  const { data, error: qErr } = await supabase
    .from("seo_audits")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (qErr) return { ok: false, error: qErr.message, audits: [] };
  return { ok: true, audits: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)) };
}

export async function getSeoAudit(id: string): Promise<{
  ok: boolean;
  error?: string;
  audit?: SeoAuditRow;
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { data, error: qErr } = await supabase
    .from("seo_audits")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (qErr) return { ok: false, error: qErr.message };
  if (!data) return { ok: false, error: "Not found" };
  return { ok: true, audit: mapRow(data as Record<string, unknown>) };
}
