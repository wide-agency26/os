"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { workPaths } from "@/lib/work/paths";
import { loadPositioning } from "@/lib/positioning/load";
import { syncPositioningModuleStatus } from "@/lib/positioning/sync";
import { logToContextBank } from "@/lib/context-bank/log";

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
    return { supabase, user: null, error: "Only founders can manage positioning" };
  }
  return { supabase, user, error: null as string | null };
}

function revalidatePositioning(projectId: string, scopeId: string, strategyId: string) {
  revalidatePath(workPaths.proposePositioning(projectId, scopeId, strategyId));
  revalidatePath(workPaths.proposeBuilder(projectId, scopeId, strategyId));
  revalidatePath(workPaths.proposeShare(projectId, scopeId, strategyId));
  revalidatePath(workPaths.proposeScope(projectId, scopeId));
}

export async function updatePositioning(input: {
  projectId: string;
  scopeId: string;
  strategyId: string;
  statement: string;
  rationale: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const existing = await loadPositioning(supabase, input.strategyId);
  if (!existing) return { ok: false, error: "Generate a draft first" };
  const { error: upd } = await supabase
    .from("strategy_positioning")
    .update({
      positioning_statement: input.statement,
      rationale: input.rationale,
      ai_generated: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .eq("strategy_id", input.strategyId);
  if (upd) return { ok: false, error: upd.message };
  await syncPositioningModuleStatus(supabase, input.strategyId);
  revalidatePositioning(input.projectId, input.scopeId, input.strategyId);
  return { ok: true };
}

export async function finalizePositioning(input: {
  projectId: string;
  scopeId: string;
  strategyId: string;
  finalized: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error) return { ok: false, error };
  const existing = await loadPositioning(supabase, input.strategyId);
  if (!existing) return { ok: false, error: "Generate a draft before finalizing" };
  if (input.finalized && !existing.statement.trim()) {
    return { ok: false, error: "Write a positioning statement before finalizing" };
  }
  const next = input.finalized ? "finalized" : "draft";
  const { error: upd } = await supabase
    .from("strategy_positioning")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .eq("strategy_id", input.strategyId);
  if (upd) return { ok: false, error: upd.message };
  await syncPositioningModuleStatus(supabase, input.strategyId);
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
          source_type: "strategy_positioning",
          source_table: "strategy_positioning",
          source_id: existing.id,
          title: "Positioning finalized",
          content: existing.statement,
          is_system_generated: true,
          created_by: user?.id ?? null,
        });
        if (!bank.ok) {
          console.error("Context Bank write failed after positioning finalize:", bank.error);
        }
      }
    } catch (err) {
      console.error("Context Bank write failed after positioning finalize:", err);
    }
  }
  revalidatePositioning(input.projectId, input.scopeId, input.strategyId);
  return { ok: true };
}
