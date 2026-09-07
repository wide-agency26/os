"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { workPaths } from "@/lib/work/paths";
import { loadAudienceSegments, loadContextDocs } from "@/lib/audience/load";
import { syncAudienceModuleStatus } from "@/lib/audience/sync";
import { logToContextBank } from "@/lib/context-bank/log";
import {
  PROFILE_FIELDS,
  isProfileField,
  type ProfileField,
} from "@/lib/audience/types";

async function requireFounder() {
  const supabase = (await createClient()) as any;
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
    return { supabase, user: null, error: "Only founders can manage audience analysis" };
  }
  return { supabase, user, error: null as string | null };
}

function revalidateAudience(projectId: string) {
  revalidatePath(workPaths.proposeAudience(projectId));
  revalidatePath(`/app/work/propose/${projectId}`, "layout");
}

export async function updateSegment(input: {
  projectId: string;
  segmentId: string;
  patch: {
    name?: string;
    demographicSummary?: string;
    sizeOrValue?: string;
    rationale?: string;
    accepted?: boolean;
  };
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.patch.name !== undefined) row.name = input.patch.name;
  if (input.patch.demographicSummary !== undefined) {
    row.demographic_summary = input.patch.demographicSummary;
  }
  if (input.patch.sizeOrValue !== undefined) row.size_or_value = input.patch.sizeOrValue;
  if (input.patch.rationale !== undefined) row.rationale = input.patch.rationale;
  if (input.patch.accepted !== undefined) row.accepted = input.patch.accepted;
  const { error: upd } = await supabase
    .from("audience_segments")
    .update(row)
    .eq("id", input.segmentId)
    .eq("project_id", input.projectId);
  if (upd) return { ok: false, error: upd.message };
  revalidateAudience(input.projectId);
  return { ok: true };
}

export async function deleteSegment(input: {
  projectId: string;
  segmentId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { error: del } = await supabase
    .from("audience_segments")
    .delete()
    .eq("id", input.segmentId)
    .eq("project_id", input.projectId);
  if (del) return { ok: false, error: del.message };
  await syncAudienceModuleStatus(supabase, input.projectId);
  revalidateAudience(input.projectId);
  return { ok: true };
}

export async function reorderSegments(input: {
  projectId: string;
  orderedIds: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  for (let i = 0; i < input.orderedIds.length; i++) {
    const { error: upd } = await supabase
      .from("audience_segments")
      .update({ sort_order: i + 1, updated_at: new Date().toISOString() })
      .eq("id", input.orderedIds[i])
      .eq("project_id", input.projectId);
    if (upd) return { ok: false, error: upd.message };
  }
  revalidateAudience(input.projectId);
  return { ok: true };
}

export async function mergeSegments(input: {
  projectId: string;
  keepId: string;
  dropId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  if (input.keepId === input.dropId) return { ok: false, error: "Pick two different segments" };
  const { data: rows } = await supabase
    .from("audience_segments")
    .select("*")
    .eq("project_id", input.projectId)
    .in("id", [input.keepId, input.dropId]);
  const keep = (rows ?? []).find((r: any) => r.id === input.keepId);
  const drop = (rows ?? []).find((r: any) => r.id === input.dropId);
  if (!keep || !drop) return { ok: false, error: "Segments not found" };
  const join = (a: string | null, b: string | null) =>
    [a, b].map((x) => (x || "").trim()).filter(Boolean).join("\n\n");
  await supabase
    .from("audience_segments")
    .update({
      name: keep.name.includes(drop.name) ? keep.name : `${keep.name} / ${drop.name}`,
      demographic_summary: join(keep.demographic_summary, drop.demographic_summary),
      size_or_value: join(keep.size_or_value, drop.size_or_value),
      rationale: join(keep.rationale, drop.rationale),
      accepted: false,
      status: "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", keep.id);
  await supabase.from("audience_segments").delete().eq("id", drop.id);
  await syncAudienceModuleStatus(supabase, input.projectId);
  revalidateAudience(input.projectId);
  return { ok: true };
}

export async function splitSegment(input: {
  projectId: string;
  segmentId: string;
  newName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const name = input.newName.trim();
  if (!name) return { ok: false, error: "Name the new segment" };
  const { data: src } = await supabase
    .from("audience_segments")
    .select("*")
    .eq("id", input.segmentId)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (!src) return { ok: false, error: "Segment not found" };
  const { error: ins } = await supabase.from("audience_segments").insert({
    project_id: input.projectId,
    name,
    demographic_summary: src.demographic_summary,
    size_or_value: src.size_or_value,
    rationale: src.rationale,
    status: "draft",
    accepted: false,
    ai_generated: false,
    sort_order: (src.sort_order ?? 0) + 1,
  });
  if (ins) return { ok: false, error: ins.message };
  revalidateAudience(input.projectId);
  return { ok: true };
}

export async function updateProfileField(input: {
  projectId: string;
  profileId: string;
  field: string;
  value: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  if (!isProfileField(input.field)) return { ok: false, error: "Unknown field" };
  const { data: profile } = await supabase
    .from("audience_insight_profiles")
    .select("id, segment_id, field_meta")
    .eq("id", input.profileId)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Profile not found" };
  const { data: owner } = await supabase
    .from("audience_segments")
    .select("id")
    .eq("id", profile.segment_id)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (!owner) return { ok: false, error: "Profile not found" };
  const meta = { ...(profile.field_meta || {}) };
  meta[input.field] = { origin: "sourced" };
  const { error: upd } = await supabase
    .from("audience_insight_profiles")
    .update({
      [input.field]: input.value,
      field_meta: meta,
      ai_generated: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.profileId);
  if (upd) return { ok: false, error: upd.message };
  revalidateAudience(input.projectId);
  return { ok: true };
}

export async function finalizePair(input: {
  projectId: string;
  segmentId: string;
  finalized: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { data: segment } = await supabase
    .from("audience_segments")
    .select("id, status, name")
    .eq("id", input.segmentId)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (!segment) return { ok: false, error: "Segment not found" };
  const { data: profile } = await supabase
    .from("audience_insight_profiles")
    .select("id")
    .eq("segment_id", input.segmentId)
    .maybeSingle();
  if (input.finalized && !profile) {
    return { ok: false, error: "Generate an insight profile before finalizing" };
  }
  const next = input.finalized ? "finalized" : "draft";
  await supabase
    .from("audience_segments")
    .update({ status: next, accepted: input.finalized || undefined, updated_at: new Date().toISOString() })
    .eq("id", input.segmentId);
  if (profile) {
    await supabase
      .from("audience_insight_profiles")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
  }
  await syncAudienceModuleStatus(supabase, input.projectId);
  if (input.finalized) {
    try {
      const { data: project } = await supabase
        .from("projects")
        .select("client_id")
        .eq("id", input.projectId)
        .maybeSingle();
      if (project?.client_id) {
        const bank = await logToContextBank({
          company_id: project.client_id,
          project_id: input.projectId,
          entry_type: "module_finalized",
          source_type: "audience_segment",
          source_table: "audience_segments",
          source_id: input.segmentId,
          title: segment.name ? `Audience: ${segment.name}` : "Audience segment finalized",
          content: `Audience analysis finalized for segment "${segment.name || input.segmentId}".`,
          is_system_generated: true,
          created_by: user?.id ?? null,
        });
        if (!bank.ok) {
          console.error("Context Bank write failed after audience finalize:", bank.error);
        }
      }
    } catch (err) {
      console.error("Context Bank write failed after audience finalize:", err);
    }
  }
  revalidateAudience(input.projectId);
  return { ok: true };
}

export { loadAudienceSegments, loadContextDocs, PROFILE_FIELDS };
