"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { workPaths } from "@/lib/work/paths";
import { loadMarketAnalysis } from "@/lib/market/load";
import { syncMarketModuleStatus } from "@/lib/market/sync";
import { logToContextBank } from "@/lib/context-bank/log";
import { isMarketField, type MarketField } from "@/lib/market/types";

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
    return { supabase, user: null, error: "Only founders can manage market analysis" };
  }
  return { supabase, user, error: null as string | null };
}

function revalidateMarket(projectId: string) {
  revalidatePath(workPaths.proposeMarket(projectId));
  revalidatePath(`/app/work/propose/${projectId}`, "layout");
}

export async function upsertMarketCategory(input: {
  projectId: string;
  category: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const category = input.category.trim();
  if (!category) return { ok: false, error: "Set a category first" };
  const { data: existing } = await supabase
    .from("market_analysis")
    .select("id")
    .eq("project_id", input.projectId)
    .maybeSingle();
  const now = new Date().toISOString();
  if (existing?.id) {
    const { error: upd } = await supabase
      .from("market_analysis")
      .update({ category, updated_at: now })
      .eq("id", existing.id)
      .eq("project_id", input.projectId);
    if (upd) return { ok: false, error: upd.message };
  } else {
    const { error: ins } = await supabase.from("market_analysis").insert({
      project_id: input.projectId,
      category,
      status: "draft",
      ai_generated: false,
    });
    if (ins) return { ok: false, error: ins.message };
  }
  await syncMarketModuleStatus(supabase, input.projectId);
  revalidateMarket(input.projectId);
  return { ok: true };
}

export async function updateMarketField(input: {
  projectId: string;
  field: string;
  value: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  if (!isMarketField(input.field)) return { ok: false, error: "Unknown field" };
  const { data: row } = await supabase
    .from("market_analysis")
    .select("id, field_meta")
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Generate a draft first" };
  const meta = { ...(row.field_meta || {}) };
  meta[input.field as MarketField] = { origin: "sourced" };
  const { error: upd } = await supabase
    .from("market_analysis")
    .update({
      [input.field]: input.value,
      field_meta: meta,
      ai_generated: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("project_id", input.projectId);
  if (upd) return { ok: false, error: upd.message };
  revalidateMarket(input.projectId);
  return { ok: true };
}

export async function finalizeMarket(input: {
  projectId: string;
  finalized: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { data: row } = await supabase
    .from("market_analysis")
    .select("id, category, size_notes, trend_notes, timing_notes, risk_notes")
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Generate a draft before finalizing" };
  const hasBody = Boolean(
    row.size_notes || row.trend_notes || row.timing_notes || row.risk_notes
  );
  if (input.finalized && !hasBody) {
    return { ok: false, error: "Draft the four sections before finalizing" };
  }
  const next = input.finalized ? "finalized" : "draft";
  const { error: upd } = await supabase
    .from("market_analysis")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("project_id", input.projectId);
  if (upd) return { ok: false, error: upd.message };
  await syncMarketModuleStatus(supabase, input.projectId);
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
          source_type: "market_analysis",
          source_table: "market_analysis",
          source_id: row.id,
          title: row.category ? `Market: ${row.category}` : "Market analysis finalized",
          content: `Market analysis finalized for "${row.category || input.projectId}".`,
          is_system_generated: true,
          created_by: user?.id ?? null,
        });
        if (!bank.ok) {
          console.error("Context Bank write failed after market finalize:", bank.error);
        }
      }
    } catch (err) {
      console.error("Context Bank write failed after market finalize:", err);
    }
  }
  revalidateMarket(input.projectId);
  return { ok: true };
}

export { loadMarketAnalysis };
