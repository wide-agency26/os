/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from "@/utils/supabase/admin";
import { generateTextFromGateway, hasGatewayCredentials } from "@/lib/ai/gateway-json";
import type { ContextDigest } from "@/lib/context-bank/types";

const MAX_ENTRIES = 40;

type Scope = { company_id: string; project_id: string | null };

export type DigestRunResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  digest?: ContextDigest;
  error?: string;
};

function scopeKey(companyId: string, projectId: string | null) {
  return `${companyId}::${projectId ?? "company"}`;
}

function extractiveDigest(entries: { title: string | null; content: string; entry_type: string }[]) {
  const lines = entries.map((e) => {
    const title = (e.title || e.entry_type).trim();
    const body = e.content.replace(/\s+/g, " ").trim().slice(0, 140);
    return `• ${title}: ${body}`;
  });
  return `Rolling log (${entries.length} new ${entries.length === 1 ? "entry" : "entries"}):\n${lines.join("\n")}`;
}

async function lastWatermark(
  supabase: any,
  companyId: string,
  projectId: string | null
): Promise<string | null> {
  let query = supabase
    .from("context_digests")
    .select("entries_covered_through")
    .eq("company_id", companyId)
    .order("entries_covered_through", { ascending: false })
    .limit(1);
  query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);
  const { data } = await query.maybeSingle();
  return data?.entries_covered_through ?? null;
}

async function pendingEntries(
  supabase: any,
  companyId: string,
  projectId: string | null,
  after: string | null
) {
  let query = supabase
    .from("context_entries")
    .select("id, title, content, entry_type, created_at")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(MAX_ENTRIES);
  query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);
  if (after) query = query.gt("created_at", after);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    title: string | null;
    content: string;
    entry_type: string;
    created_at: string;
  }[];
}

async function summarize(
  entries: { title: string | null; content: string; entry_type: string }[]
): Promise<string> {
  const fallback = extractiveDigest(entries);
  if (!hasGatewayCredentials()) return fallback;

  const prompt = entries
    .map((e, i) => {
      const title = e.title ? `${e.title} ` : "";
      return `${i + 1}. [${e.entry_type}] ${title}${e.content.slice(0, 600)}`;
    })
    .join("\n");

  const text = await generateTextFromGateway({
    system:
      "You write compact internal agency memory. Summarize the new context entries for this company/project in 1–3 short paragraphs. No fluff, no markdown headings, no invented facts.",
    prompt: `New context entries:\n${prompt}`,
    maxOutputTokens: 700,
    temperature: 0.2,
  });
  return text || fallback;
}

export async function generateContextDigestForScope(
  companyId: string,
  projectId?: string | null
): Promise<DigestRunResult> {
  const supabase = createAdminClient() as any;
  const pid = projectId || null;
  try {
    const watermark = await lastWatermark(supabase, companyId, pid);
    const entries = await pendingEntries(supabase, companyId, pid, watermark);
    if (!entries.length) {
      return { ok: true, skipped: true, reason: "No new entries since last digest" };
    }
    const digestText = await summarize(entries);
    const coveredThrough = entries[entries.length - 1].created_at;
    const { data, error } = await supabase
      .from("context_digests")
      .insert({
        company_id: companyId,
        project_id: pid,
        digest: digestText,
        entries_covered_through: coveredThrough,
      })
      .select("id, company_id, project_id, digest, entries_covered_through, generated_at")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, digest: data as ContextDigest };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Digest failed" };
  }
}

export async function generateContextDigests(opts?: {
  companyId?: string;
}): Promise<{ ok: boolean; ran: number; skipped: number; errors: string[] }> {
  const supabase = createAdminClient() as any;
  let query = supabase
    .from("context_entries")
    .select("company_id, project_id")
    .eq("status", "active");
  if (opts?.companyId) query = query.eq("company_id", opts.companyId);
  const { data, error } = await query;
  if (error) return { ok: false, ran: 0, skipped: 0, errors: [error.message] };

  const seen = new Set<string>();
  const scopes: Scope[] = [];
  for (const row of data ?? []) {
    const key = scopeKey(row.company_id, row.project_id ?? null);
    if (seen.has(key)) continue;
    seen.add(key);
    scopes.push({ company_id: row.company_id, project_id: row.project_id ?? null });
  }

  let ran = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const scope of scopes) {
    const res = await generateContextDigestForScope(scope.company_id, scope.project_id);
    if (!res.ok) errors.push(res.error || "unknown");
    else if (res.skipped) skipped += 1;
    else ran += 1;
  }
  return { ok: errors.length === 0, ran, skipped, errors };
}
