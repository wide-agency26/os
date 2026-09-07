"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  syncHrAndOverheadLedger,
  syncPipelinePeopleLedger,
  syncProjectAssignmentCosts,
  syncProjectLedger,
  syncProjectRevenue,
  pruneOrphanedProjectLedger,
  syncAllProjectLedgers,
} from "@/lib/accounting/sync";
import type { LedgerPillar, LedgerType } from "@/lib/accounting/types";
import { isAutoSource } from "@/lib/accounting/types";
import {
  asFinanceFrequency,
  financeEndDate,
} from "@/lib/accounting/finance";
import { lastDayOfMonth } from "@/lib/hr/compensation";
import { revalidateWork } from "@/lib/work/revalidate";
import {
  deleteResourceCostByProjectLine,
  upsertResourceCostRow,
} from "@/lib/hr/resource-cost";
import type { OverheadFrequency } from "@/lib/hr/types";

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
  const hr = await syncHrAndOverheadLedger();
  const pipeline = await syncPipelinePeopleLedger();
  if (hr.ok || pipeline.ok) {
    revalidatePath("/app/accounting");
    revalidatePath("/app/accounting/actual");
    revalidatePath("/app/accounting/identified");
    revalidatePath("/app/hr");
    revalidatePath("/app/hr/pipeline");
  }
  return {
    ok: hr.ok && pipeline.ok,
    upserted: (hr.upserted ?? 0) + (pipeline.upserted ?? 0),
    pruned: (hr.pruned ?? 0) + (pipeline.pruned ?? 0),
    error: hr.error || pipeline.error,
  };
}

export async function runSyncProjectRevenue(projectId: string) {
  const result = await syncProjectRevenue(projectId);
  if (result.ok) revalidatePath("/app/accounting");
  return result;
}

/** Prune ghost auto rows + refresh CRM unidentified + every project deal. */
export async function runAccountingHygiene() {
  const prune = await pruneOrphanedProjectLedger();
  const projects = await syncAllProjectLedgers();
  const hr = await syncHrAndOverheadLedger();
  const pipeline = await syncPipelinePeopleLedger();
  const { syncCrmUnidentifiedLedger } = await import("@/lib/accounting/sync-crm");
  const crm = await syncCrmUnidentifiedLedger();
  if (prune.ok || hr.ok || pipeline.ok || crm.ok || projects.ok) {
    revalidatePath("/app/accounting");
    revalidatePath("/app/accounting/actual");
    revalidatePath("/app/accounting/identified");
    revalidatePath("/app/accounting/unidentified");
    revalidatePath("/app/hr");
    revalidatePath("/app/hr/pipeline");
  }
  return {
    ok: prune.ok && hr.ok && pipeline.ok && crm.ok && projects.ok,
    pruned: (prune.pruned ?? 0) + (hr.pruned ?? 0) + (pipeline.pruned ?? 0),
    error: prune.error || hr.error || pipeline.error || crm.error || projects.error,
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

function revalidateProjectFinance(projectId: string) {
  revalidatePath("/app/accounting");
  revalidatePath("/app/accounting/actual");
  revalidatePath("/app/accounting/identified");
  revalidatePath("/app/accounting/unidentified");
  revalidatePath(`/app/projects/${projectId}/cost`);
  revalidatePath(`/app/projects/${projectId}/revenue`);
}

export type ProjectFinanceLineInput = {
  id?: string;
  project_id: string;
  label: string;
  amount: number;
  entry_date: string;
  frequency?: OverheadFrequency | "one_off" | "monthly";
  effective_to?: string | null;
  category?: string;
  notes?: string | null;
  person_id?: string | null;
  overhead_cost_id?: string | null;
};

async function saveProjectFinanceLine(
  table: "project_revenue_lines",
  input: ProjectFinanceLineInput
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const frequency = asFinanceFrequency(input.frequency);
  const payload = {
    project_id: input.project_id,
    label: input.label.trim() || "Revenue",
    amount: Number(input.amount) || 0,
    entry_date: input.entry_date,
    frequency,
    effective_to: financeEndDate(frequency, input.entry_date, input.effective_to),
    category: input.category?.trim() || "Revenue",
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

  const sync = await syncProjectRevenue(input.project_id);
  if (!sync.ok) return { ok: false as const, error: sync.error || "Sync failed" };

  revalidateProjectFinance(input.project_id);
  return { ok: true as const };
}

export async function saveProjectCostLine(input: ProjectFinanceLineInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let overheadId = input.overhead_cost_id || null;
  if (input.id && !overheadId) {
    const { data: line } = await (supabase as any)
      .from("project_cost_lines")
      .select("overhead_cost_id")
      .eq("id", input.id)
      .maybeSingle();
    overheadId = line?.overhead_cost_id || null;
  }

  const saved = await upsertResourceCostRow(
    supabase,
    {
      id: overheadId || undefined,
      scope: input.person_id ? "person" : "project",
      person_id: input.person_id || null,
      project_id: input.project_id,
      cost_category: "other",
      label: input.label.trim() || "Actual cost",
      amount: Number(input.amount) || 0,
      frequency: (input.frequency as OverheadFrequency) || "one_off",
      effective_from: input.entry_date,
      effective_to: input.effective_to || null,
      notes: input.notes || null,
    },
    user?.id || null,
    { existingCostLineId: input.id || null }
  );
  if (!saved.ok) return saved;

  const hr = await syncHrAndOverheadLedger();
  if (!hr.ok) return { ok: false as const, error: hr.error || "HR ledger sync failed" };
  for (const projectId of saved.projectIds) {
    const proj = await syncProjectAssignmentCosts(projectId);
    if (!proj.ok) return { ok: false as const, error: proj.error || "Project ledger sync failed" };
  }

  revalidateProjectFinance(input.project_id);
  revalidatePath("/app/resources");
  revalidatePath("/app/hr");
  return { ok: true as const };
}

export async function saveProjectRevenueLine(input: ProjectFinanceLineInput) {
  return saveProjectFinanceLine("project_revenue_lines", input);
}

async function deleteProjectFinanceLine(
  table: "project_revenue_lines",
  id: string,
  projectId: string
) {
  const supabase = await createClient();
  const { error } = await (supabase as any).from(table).delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  const sync = await syncProjectRevenue(projectId);
  if (!sync.ok) return { ok: false as const, error: sync.error || "Sync failed" };

  revalidateProjectFinance(projectId);
  return { ok: true as const };
}

export async function deleteProjectCostLine(id: string, projectId: string) {
  const supabase = await createClient();
  const deleted = await deleteResourceCostByProjectLine(supabase, id, projectId);
  if (!deleted.ok) return deleted;

  const hr = await syncHrAndOverheadLedger();
  if (!hr.ok) return { ok: false as const, error: hr.error || "HR ledger sync failed" };
  for (const pid of deleted.projectIds.length ? deleted.projectIds : [projectId]) {
    const proj = await syncProjectAssignmentCosts(pid);
    if (!proj.ok) return { ok: false as const, error: proj.error || "Project ledger sync failed" };
  }

  revalidateProjectFinance(projectId);
  revalidatePath("/app/resources");
  revalidatePath("/app/hr");
  return { ok: true as const };
}

export async function deleteProjectRevenueLine(id: string, projectId: string) {
  return deleteProjectFinanceLine("project_revenue_lines", id, projectId);
}

export async function updateProjectDealValue(
  projectId: string,
  dealValue: number | null,
  extras?: {
    frequency?: "one_off" | "monthly";
    startDate?: string | null;
    endDate?: string | null;
  }
) {
  const supabase = await createClient();
  const frequency = asFinanceFrequency(extras?.frequency);
  const startDate = extras?.startDate || null;
  const payload: Record<string, unknown> = {
    deal_value: dealValue,
    deal_frequency: frequency,
    updated_at: new Date().toISOString(),
  };
  if (startDate) payload.expected_start_date = startDate;
  payload.deal_end_date = startDate
    ? financeEndDate(frequency, startDate, extras?.endDate)
    : extras?.endDate || null;

  const { error } = await (supabase as any)
    .from("projects")
    .update(payload)
    .eq("id", projectId);
  if (error) return { ok: false as const, error: error.message };
  const sync = await syncProjectRevenue(projectId);
  if (!sync.ok) return { ok: false as const, error: sync.error || "Sync failed" };
  revalidateProjectFinance(projectId);
  return { ok: true as const };
}

export async function updateProjectAccountingStage(
  projectId: string,
  stage: "prospect" | "lead" | "client" | "completed",
  options?: { skipContractCheck?: boolean }
) {
  const supabase = await createClient();
  const { data: project } = await (supabase as any)
    .from("projects")
    .select(
      "contract_confirmed_at, client_id, bd_record_id, deal_frequency, deal_end_date, expected_end_date"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (
    stage === "client" &&
    !project?.contract_confirmed_at &&
    !options?.skipContractCheck
  ) {
    return {
      ok: false as const,
      error: "Confirm the contract to start this project.",
    };
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const payload: Record<string, unknown> = {
    stage,
    updated_at: now.toISOString(),
  };
  if (stage === "completed") {
    payload.status = "completed";
    if (!project?.expected_end_date) payload.expected_end_date = today;
    if (
      asFinanceFrequency(project?.deal_frequency) === "monthly" &&
      !project?.deal_end_date
    ) {
      payload.deal_end_date = lastDayOfMonth(
        now.getFullYear(),
        now.getMonth() + 1
      );
    }
  } else if (stage === "client") {
    payload.status = "running";
  } else {
    payload.status = "pipeline";
  }

  const { error } = await (supabase as any)
    .from("projects")
    .update(payload)
    .eq("id", projectId);
  if (error) return { ok: false as const, error: error.message };

  // Stage is persisted — ledger sync is best-effort so the UI never deadlocks.
  let syncWarning: string | undefined;
  try {
    const sync = await syncProjectLedger(projectId);
    if (!sync.ok) {
      syncWarning = sync.error || "Ledger sync failed";
    }
  } catch (e) {
    syncWarning =
      e instanceof Error ? e.message : "Ledger sync failed unexpectedly";
  }

  revalidatePath("/app/accounting");
  revalidatePath("/app/accounting/actual");
  revalidatePath("/app/accounting/identified");
  revalidatePath("/app/accounting/unidentified");
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/cost`);
  revalidatePath(`/app/projects/${projectId}/revenue`);
  revalidatePath("/app/projects");
  revalidatePath("/app/home");
  revalidateWork({
    companyId: project?.client_id || undefined,
    bdId: project?.bd_record_id || undefined,
  });
  return syncWarning
    ? ({ ok: true as const, syncWarning } as const)
    : ({ ok: true as const } as const);
}
