"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { workPaths } from "@/lib/work/paths";
import { loadCompetitionSynthesis, loadCompetitors } from "@/lib/competition/load";
import { syncCompetitionModuleStatus } from "@/lib/competition/sync";
import { logToContextBank } from "@/lib/context-bank/log";
import { isCompetitorField, type CompetitorField } from "@/lib/competition/types";

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
    return { supabase, user: null, error: "Only founders can manage competition analysis" };
  }
  return { supabase, user, error: null as string | null };
}

function revalidateCompetition(projectId: string) {
  revalidatePath(workPaths.proposeCompetition(projectId));
  revalidatePath(workPaths.propose);
  revalidatePath(workPaths.proposeProject(projectId));
  revalidatePath(`/app/work/propose/${projectId}`, "layout");
}

export async function addCompetitor(input: {
  projectId: string;
  name: string;
  url?: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required" };
  const { data: last } = await supabase
    .from("competitors")
    .select("sort_order")
    .eq("project_id", input.projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error: ins } = await supabase
    .from("competitors")
    .insert({
      project_id: input.projectId,
      name,
      url: input.url?.trim() || null,
      notes: input.notes?.trim() || null,
      status: "draft",
      accepted: false,
      ai_generated: false,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (ins || !data) return { ok: false, error: ins?.message || "Could not add" };
  await syncCompetitionModuleStatus(supabase, input.projectId);
  revalidateCompetition(input.projectId);
  return { ok: true, id: data.id };
}

export async function deleteCompetitor(input: {
  projectId: string;
  competitorId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { error: del } = await supabase
    .from("competitors")
    .delete()
    .eq("id", input.competitorId)
    .eq("project_id", input.projectId);
  if (del) return { ok: false, error: del.message };
  await syncCompetitionModuleStatus(supabase, input.projectId);
  revalidateCompetition(input.projectId);
  return { ok: true };
}

export async function setCompetitorAccepted(input: {
  projectId: string;
  competitorId: string;
  accepted: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { error: upd } = await supabase
    .from("competitors")
    .update({
      accepted: input.accepted,
      status: input.accepted ? "finalized" : "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.competitorId)
    .eq("project_id", input.projectId);
  if (upd) return { ok: false, error: upd.message };
  await syncCompetitionModuleStatus(supabase, input.projectId);
  revalidateCompetition(input.projectId);
  return { ok: true };
}

export async function updateCompetitorField(input: {
  projectId: string;
  competitorId: string;
  field: string;
  value: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  if (!isCompetitorField(input.field)) return { ok: false, error: "Unknown field" };
  const { data: row } = await supabase
    .from("competitors")
    .select("id, field_meta")
    .eq("id", input.competitorId)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Competitor not found" };
  const meta = { ...(row.field_meta || {}) };
  meta[input.field as CompetitorField] = { origin: "sourced" };
  const { error: upd } = await supabase
    .from("competitors")
    .update({
      [input.field]: input.value,
      field_meta: meta,
      ai_generated: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (upd) return { ok: false, error: upd.message };
  revalidateCompetition(input.projectId);
  return { ok: true };
}

export async function updateCompetitionSynthesis(input: {
  projectId: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const existing = await loadCompetitionSynthesis(supabase, input.projectId);
  const now = new Date().toISOString();
  if (existing?.id) {
    const { error: upd } = await supabase
      .from("competition_synthesis")
      .update({
        gaps_and_opportunities: input.text,
        ai_generated: false,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (upd) return { ok: false, error: upd.message };
  } else {
    const { error: ins } = await supabase.from("competition_synthesis").insert({
      project_id: input.projectId,
      gaps_and_opportunities: input.text,
      status: "draft",
      ai_generated: false,
    });
    if (ins) return { ok: false, error: ins.message };
  }
  await syncCompetitionModuleStatus(supabase, input.projectId);
  revalidateCompetition(input.projectId);
  return { ok: true };
}

export async function finalizeCompetition(input: {
  projectId: string;
  finalized: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error) return { ok: false, error };
  const competitors = await loadCompetitors(supabase, input.projectId);
  const accepted = competitors.filter((c) => c.accepted);
  const existing = await loadCompetitionSynthesis(supabase, input.projectId);
  if (input.finalized) {
    if (!accepted.length) {
      return { ok: false, error: "Accept at least one competitor before finalizing" };
    }
    if (!existing?.gapsAndOpportunities?.trim()) {
      return { ok: false, error: "Generate or write the gaps note before finalizing" };
    }
  }
  if (!existing) return { ok: false, error: "Generate the gaps note first" };
  const next = input.finalized ? "finalized" : "draft";
  const { error: upd } = await supabase
    .from("competition_synthesis")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (upd) return { ok: false, error: upd.message };
  await syncCompetitionModuleStatus(supabase, input.projectId);
  if (input.finalized) {
    try {
      const { data: project } = await supabase
        .from("projects")
        .select("client_id")
        .eq("id", input.projectId)
        .maybeSingle();
      if (project?.client_id) {
        await logToContextBank({
          company_id: project.client_id,
          project_id: input.projectId,
          entry_type: "module_finalized",
          source_type: "competition_analysis",
          source_table: "competition_synthesis",
          source_id: existing.id,
          title: "Competition analysis finalized",
          content: existing.gapsAndOpportunities,
          is_system_generated: true,
          created_by: user?.id ?? null,
        });
      }
    } catch (err) {
      console.error("Context Bank write failed after competition finalize:", err);
    }
  }
  revalidateCompetition(input.projectId);
  return { ok: true };
}
