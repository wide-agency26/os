import { lastDayOfMonth } from "@/lib/hr/compensation";
import {
  type OverheadCostCategory,
  type OverheadFrequency,
  type ResourceScope,
} from "@/lib/hr/types";

export type ResourceCostInput = {
  id?: string;
  scope: ResourceScope;
  person_id?: string | null;
  project_id?: string | null;
  cost_category: OverheadCostCategory;
  label: string;
  amount: number;
  currency?: string;
  frequency: OverheadFrequency;
  effective_from: string;
  effective_to?: string | null;
  notes?: string | null;
  accounting_ref_id?: string | null;
};

export type NormalizedResourceCost = {
  scope: ResourceScope;
  person_id: string | null;
  project_id: string | null;
  cost_category: OverheadCostCategory;
  label: string;
  amount: number;
  currency: string;
  frequency: OverheadFrequency;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  accounting_ref_id: string | null;
};

function oneOffEnd(from: string): string {
  return lastDayOfMonth(Number(from.slice(0, 4)), Number(from.slice(5, 7)));
}

export function normalizeResourceCost(
  input: ResourceCostInput
): { ok: true; value: NormalizedResourceCost } | { ok: false; error: string } {
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Label is required." };

  const person_id = input.person_id?.trim() || null;
  const project_id = input.project_id?.trim() || null;
  let scope: ResourceScope = input.scope;

  if (person_id) {
    scope = "person";
  } else if (scope === "person") {
    if (project_id) scope = "project";
    else return { ok: false, error: "Pick a person for a People-scoped cost." };
  }

  if (scope === "project" && !project_id) {
    return { ok: false, error: "Pick a project for a project cost." };
  }

  const from = input.effective_from || new Date().toISOString().slice(0, 10);
  const frequency = input.frequency || "monthly";
  const effective_to =
    frequency === "one_off"
      ? input.effective_to || oneOffEnd(from)
      : input.effective_to || null;

  return {
    ok: true,
    value: {
      scope,
      person_id: scope === "person" ? person_id : null,
      project_id,
      cost_category: input.cost_category || "other",
      label,
      amount: Number(input.amount) || 0,
      currency: input.currency || "EUR",
      frequency,
      effective_from: from,
      effective_to,
      notes: input.notes?.trim() || null,
      accounting_ref_id: input.accounting_ref_id?.trim() || null,
    },
  };
}

type Sb = {
  from: (table: string) => any;
};

/** Write the canonical overhead row and keep a matching project_cost_lines row. */
export async function upsertResourceCostRow(
  supabase: Sb,
  input: ResourceCostInput,
  createdBy?: string | null,
  opts?: { existingCostLineId?: string | null }
): Promise<{ ok: true; id: string; projectIds: string[] } | { ok: false; error: string }> {
  const norm = normalizeResourceCost(input);
  if (!norm.ok) return norm;

  const { value } = norm;
  const now = new Date().toISOString();
  const projectIds = new Set<string>();

  let previousProjectId: string | null = null;
  let previousLineId: string | null = null;
  if (input.id) {
    const { data: prev, error: prevErr } = await supabase
      .from("person_overhead_costs")
      .select("id, project_id")
      .eq("id", input.id)
      .maybeSingle();
    if (prevErr) return { ok: false, error: prevErr.message };
    if (!prev) return { ok: false, error: "Cost not found." };
    previousProjectId = prev.project_id || null;
    if (previousProjectId) projectIds.add(previousProjectId);

    const { data: line } = await supabase
      .from("project_cost_lines")
      .select("id")
      .eq("overhead_cost_id", input.id)
      .maybeSingle();
    previousLineId = line?.id || opts?.existingCostLineId || null;
  } else {
    previousLineId = opts?.existingCostLineId || null;
  }

  const overheadPayload = {
    scope: value.scope,
    person_id: value.person_id,
    project_id: value.project_id,
    cost_category: value.cost_category,
    label: value.label,
    amount: value.amount,
    currency: value.currency,
    frequency: value.frequency,
    effective_from: value.effective_from,
    effective_to: value.effective_to,
    notes: value.notes,
    accounting_ref_id: value.accounting_ref_id,
    updated_at: now,
  };

  let overheadId = input.id || "";
  if (input.id) {
    const { error } = await supabase
      .from("person_overhead_costs")
      .update(overheadPayload)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("person_overhead_costs")
      .insert([overheadPayload])
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message || "Failed to save cost." };
    overheadId = data.id;
  }

  if (value.project_id) {
    projectIds.add(value.project_id);
    const linePayload = {
      project_id: value.project_id,
      label: value.label,
      amount: value.amount,
      entry_date: value.effective_from,
      frequency: value.frequency,
      effective_to: value.effective_to,
      category: "Resource cost",
      notes: value.notes,
      overhead_cost_id: overheadId,
      updated_at: now,
    };
    if (previousLineId) {
      const { error } = await supabase
        .from("project_cost_lines")
        .update(linePayload)
        .eq("id", previousLineId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("project_cost_lines").insert([
        { ...linePayload, created_by: createdBy || null },
      ]);
      if (error) return { ok: false, error: error.message };
    }
  } else if (previousLineId) {
    const { error } = await supabase
      .from("project_cost_lines")
      .delete()
      .eq("id", previousLineId);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, id: overheadId, projectIds: [...projectIds] };
}

export async function deleteResourceCostRow(
  supabase: Sb,
  overheadId: string
): Promise<{ ok: true; projectIds: string[] } | { ok: false; error: string }> {
  const { data: row, error: fetchErr } = await supabase
    .from("person_overhead_costs")
    .select("id, project_id")
    .eq("id", overheadId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row) return { ok: false, error: "Cost not found." };

  const projectIds = row.project_id ? [row.project_id] : [];
  const { error } = await supabase
    .from("person_overhead_costs")
    .delete()
    .eq("id", overheadId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, projectIds };
}

export async function deleteResourceCostByProjectLine(
  supabase: Sb,
  costLineId: string,
  projectId: string
): Promise<{ ok: true; projectIds: string[] } | { ok: false; error: string }> {
  const { data: line, error: fetchErr } = await supabase
    .from("project_cost_lines")
    .select("id, overhead_cost_id, project_id")
    .eq("id", costLineId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!line) return { ok: false, error: "Cost line not found." };

  if (line.overhead_cost_id) {
    return deleteResourceCostRow(supabase, line.overhead_cost_id);
  }

  const { error } = await supabase.from("project_cost_lines").delete().eq("id", costLineId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, projectIds: [projectId] };
}
