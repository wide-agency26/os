"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder } from "@/lib/rbac";
import { logToContextBank } from "@/lib/context-bank/log";
import { loadContextEntries, loadLatestDigest } from "@/lib/context-bank/load";
import { generateContextDigestForScope, generateContextDigests } from "@/lib/context-bank/digest";
import type {
  ContextDigest,
  ContextEntry,
  ContextEntryFilters,
  ContextEntryStatus,
} from "@/lib/context-bank/types";

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
    return { supabase, user: null, error: "Staff only" };
  }
  return { supabase, user, error: null as string | null };
}

function revalidateContext(companyId: string, projectId?: string | null) {
  revalidatePath(`/app/crm/${companyId}`);
  if (projectId) revalidatePath(`/app/projects/${projectId}`);
}

export async function addContextNote(input: {
  companyId: string;
  projectId?: string | null;
  entryType?: string;
  title?: string;
  content: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error ?? "Unauthorized" };
  const res = await logToContextBank({
    company_id: input.companyId,
    project_id: input.projectId || null,
    entry_type: (input.entryType || "note").trim() || "note",
    source_type: "manual",
    title: input.title,
    content: input.content,
    is_system_generated: false,
    created_by: user.id,
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidateContext(input.companyId, input.projectId);
  return { ok: true, id: res.id };
}

export async function listContextEntries(
  filters: ContextEntryFilters
): Promise<{ ok: boolean; entries?: ContextEntry[]; error?: string }> {
  const { error } = await requireFounder();
  if (error) return { ok: false, error };
  try {
    const entries = await loadContextEntries(createAdminClient() as any, filters);
    return { ok: true, entries };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Load failed" };
  }
}

export async function getLatestContextDigest(input: {
  companyId: string;
  projectId?: string | null;
}): Promise<{ ok: boolean; digest?: ContextDigest | null; error?: string }> {
  const { error } = await requireFounder();
  if (error) return { ok: false, error };
  try {
    const digest = await loadLatestDigest(
      createAdminClient() as any,
      input.companyId,
      input.projectId
    );
    return { ok: true, digest };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Load failed" };
  }
}

export async function setContextEntryStatus(input: {
  id: string;
  status: ContextEntryStatus;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await requireFounder();
  if (error) return { ok: false, error };
  if (!["active", "archived", "superseded"].includes(input.status)) {
    return { ok: false, error: "Invalid status" };
  }
  const supabase = createAdminClient() as any;
  const { data, error: upErr } = await supabase
    .from("context_entries")
    .update({ status: input.status })
    .eq("id", input.id)
    .select("company_id, project_id")
    .maybeSingle();
  if (upErr) return { ok: false, error: upErr.message };
  if (data) revalidateContext(data.company_id, data.project_id);
  return { ok: true };
}

export async function updateContextEntry(input: {
  id: string;
  title?: string | null;
  content?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await requireFounder();
  if (error) return { ok: false, error };
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title?.trim() || null;
  if (input.content !== undefined) {
    const content = input.content.trim();
    if (!content) return { ok: false, error: "Content is required" };
    patch.content = content;
  }
  if (!Object.keys(patch).length) return { ok: true };
  const supabase = createAdminClient() as any;
  const { data, error: upErr } = await supabase
    .from("context_entries")
    .update(patch)
    .eq("id", input.id)
    .select("company_id, project_id")
    .maybeSingle();
  if (upErr) return { ok: false, error: upErr.message };
  if (data) revalidateContext(data.company_id, data.project_id);
  return { ok: true };
}

export async function runContextDigest(input: {
  companyId: string;
  projectId?: string | null;
}): Promise<{ ok: boolean; skipped?: boolean; reason?: string; error?: string }> {
  const { error } = await requireFounder();
  if (error) return { ok: false, error };
  const res = input.projectId
    ? await generateContextDigestForScope(input.companyId, input.projectId)
    : await generateContextDigests({ companyId: input.companyId }).then((batch) => {
        if (!batch.ok) return { ok: false as const, error: batch.errors.join("; ") };
        if (batch.ran === 0) {
          return {
            ok: true as const,
            skipped: true,
            reason: batch.skipped
              ? "No new entries since last digest"
              : "No active entries to summarize",
          };
        }
        return { ok: true as const, skipped: false };
      });
  if (!res.ok) return { ok: false, error: res.error };
  revalidateContext(input.companyId, input.projectId);
  return { ok: true, skipped: res.skipped, reason: res.reason };
}
