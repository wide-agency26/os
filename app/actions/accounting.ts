"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  syncHrAndOverheadLedger,
  syncProjectAssignmentCosts,
  syncProjectLedger,
  syncProjectRevenue,
  pruneOrphanedProjectLedger,
} from "@/lib/accounting/sync";
import type { LedgerPillar, LedgerType } from "@/lib/accounting/types";
import { isAutoSource } from "@/lib/accounting/types";

export async function runSyncProjectLedger(projectId: string) {
  const result = await syncProjectLedger(projectId);
  if (result.ok) {
    revalidatePath("/app/accounting");
    revalidatePath(`/app/projects/${projectId}`);
  }
  return result;
}

export async function runSyncProjectAssignmentCosts(projectId: string) {
  const result = await syncProjectAssignmentCosts(projectId);
  if (result.ok) revalidatePath("/app/accounting");
  return result;
}

export async function runSyncHrAndOverheadLedger() {
  const result = await syncHrAndOverheadLedger();
  if (result.ok) revalidatePath("/app/accounting");
  return result;
}

export async function runSyncProjectRevenue(projectId: string) {
  const result = await syncProjectRevenue(projectId);
  if (result.ok) revalidatePath("/app/accounting");
  return result;
}

/** Prune ghost auto rows + refresh HR/overhead. Call on accounting page load. */
export async function runAccountingHygiene() {
  const prune = await pruneOrphanedProjectLedger();
  const hr = await syncHrAndOverheadLedger();
  if (prune.ok || hr.ok) {
    revalidatePath("/app/accounting");
    revalidatePath("/app/accounting/actual");
    revalidatePath("/app/accounting/identified");
    revalidatePath("/app/accounting/unidentified");
  }
  return {
    ok: prune.ok && hr.ok,
    pruned: prune.pruned ?? 0,
    error: prune.error || hr.error,
  };
}

export type ManualLedgerInput = {
  id?: string;
  pillar: LedgerPillar;
  type: LedgerType;
  amount: number;
  entry_date: string;
  company_id?: string | null;
  client_id?: string | null;
  project_id?: string | null;
  category: string;
  confidence?: string | null;
};

export async function saveManualLedgerEntry(input: ManualLedgerInput) {
  const supabase = await createClient();
  const payload = {
    pillar: input.pillar,
    type: input.type,
    amount: input.amount,
    entry_date: input.entry_date,
    company_id: input.company_id || null,
    client_id: input.client_id || null,
    project_id: input.project_id || null,
    category: input.category.trim() || "Manual",
    source: "manual" as const,
    confidence: input.confidence || null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data: existing } = await (supabase as any)
      .from("ledger_entries")
      .select("source")
      .eq("id", input.id)
      .single();
    if (existing && isAutoSource(existing.source)) {
      return { ok: false as const, error: "Auto-sourced rows are read-only." };
    }
    const { error } = await (supabase as any)
      .from("ledger_entries")
      .update(payload)
      .eq("id", input.id);
    if (error) return { ok: false as const, error: error.message };
  } else {
    const { error } = await (supabase as any)
      .from("ledger_entries")
      .insert([payload]);
    if (error) return { ok: false as const, error: error.message };
  }
  revalidatePath("/app/accounting");
  return { ok: true as const };
}

/** Auto rows: category tagging only. */
export async function updateLedgerCategory(id: string, category: string) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("ledger_entries")
    .update({
      category: category.trim() || "Untitled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/app/accounting");
  return { ok: true as const };
}

export async function deleteManualLedgerEntry(id: string) {
  const supabase = await createClient();
  const { data: existing } = await (supabase as any)
    .from("ledger_entries")
    .select("source")
    .eq("id", id)
    .single();
  if (existing && isAutoSource(existing.source)) {
    return { ok: false as const, error: "Auto-sourced rows cannot be deleted here." };
  }
  const { error } = await (supabase as any)
    .from("ledger_entries")
    .delete()
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/app/accounting");
  return { ok: true as const };
}

export async function saveCashBalance(input: {
  id?: string;
  balance_date: string;
  amount: number;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const payload = {
    balance_date: input.balance_date,
    amount: input.amount,
    source: "manual" as const,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { error } = await (supabase as any)
      .from("cash_balance_entries")
      .update(payload)
      .eq("id", input.id);
    if (error) return { ok: false as const, error: error.message };
  } else {
    const { error } = await (supabase as any)
      .from("cash_balance_entries")
      .upsert(payload, { onConflict: "balance_date,source" });
    if (error) return { ok: false as const, error: error.message };
  }
  revalidatePath("/app/accounting/runway");
  return { ok: true as const };
}

export async function deleteCashBalance(id: string) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("cash_balance_entries")
    .delete()
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/app/accounting/runway");
  return { ok: true as const };
}

export type ProjectFinanceLineInput = {
  id?: string;
  project_id: string;
  label: string;
  amount: number;
  entry_date: string;
  category?: string;
  notes?: string | null;
};

async function saveProjectFinanceLine(
  table: "project_cost_lines" | "project_revenue_lines",
  input: ProjectFinanceLineInput
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    project_id: input.project_id,
    label: input.label.trim() || (table === "project_cost_lines" ? "Actual cost" : "Revenue"),
    amount: Number(input.amount) || 0,
    entry_date: input.entry_date,
    category:
      input.category?.trim() ||
      (table === "project_cost_lines" ? "Actual cost" : "Revenue"),
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await (supabase as any)
      .from(table)
      .update(payload)
      .eq("id", input.id);
    if (error) return { ok: false as const, error: error.message };
  } else {
    const { error } = await (supabase as any).from(table).insert([
      { ...payload, created_by: user?.id || null },
    ]);
    if (error) return { ok: false as const, error: error.message };
  }

  const sync =
    table === "project_cost_lines"
      ? await syncProjectAssignmentCosts(input.project_id)
      : await syncProjectRevenue(input.project_id);
  if (!sync.ok) return { ok: false as const, error: sync.error || "Sync failed" };

  revalidatePath("/app/accounting");
  revalidatePath(`/app/projects/${input.project_id}/cost`);
  revalidatePath(`/app/projects/${input.project_id}/revenue`);
  return { ok: true as const };
}

export async function saveProjectCostLine(input: ProjectFinanceLineInput) {
  return saveProjectFinanceLine("project_cost_lines", input);
}

export async function saveProjectRevenueLine(input: ProjectFinanceLineInput) {
  return saveProjectFinanceLine("project_revenue_lines", input);
}

async function deleteProjectFinanceLine(
  table: "project_cost_lines" | "project_revenue_lines",
  id: string,
  projectId: string
) {
  const supabase = await createClient();
  const { error } = await (supabase as any).from(table).delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  const sync =
    table === "project_cost_lines"
      ? await syncProjectAssignmentCosts(projectId)
      : await syncProjectRevenue(projectId);
  if (!sync.ok) return { ok: false as const, error: sync.error || "Sync failed" };

  revalidatePath("/app/accounting");
  revalidatePath(`/app/projects/${projectId}/cost`);
  revalidatePath(`/app/projects/${projectId}/revenue`);
  return { ok: true as const };
}

export async function deleteProjectCostLine(id: string, projectId: string) {
  return deleteProjectFinanceLine("project_cost_lines", id, projectId);
}

export async function deleteProjectRevenueLine(id: string, projectId: string) {
  return deleteProjectFinanceLine("project_revenue_lines", id, projectId);
}

export async function updateProjectDealValue(
  projectId: string,
  dealValue: number | null
) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("projects")
    .update({
      deal_value: dealValue,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) return { ok: false as const, error: error.message };
  const sync = await syncProjectRevenue(projectId);
  if (!sync.ok) return { ok: false as const, error: sync.error || "Sync failed" };
  revalidatePath("/app/accounting");
  revalidatePath(`/app/projects/${projectId}/revenue`);
  return { ok: true as const };
}
