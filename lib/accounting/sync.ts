import { createClient } from "@/utils/supabase/server";
import {
  firstOfMonth,
  pillarFromStage,
  type ProjectAccountingStage,
} from "@/lib/accounting/types";
import { monthlyOverheadAmount } from "@/lib/hr/types";

type Sb = any;

function monthStart(d = new Date()): string {
  return firstOfMonth(d.getFullYear(), d.getMonth() + 1);
}

async function upsertBySyncKey(
  supabase: Sb,
  row: Record<string, unknown>
): Promise<{ error: string | null }> {
  const syncKey = row.sync_key as string;
  const { data: existing } = await supabase
    .from("ledger_entries")
    .select("id, pillar, moved_from_pillar, moved_at")
    .eq("sync_key", syncKey)
    .maybeSingle();

  if (existing?.id) {
    // Refresh amounts/pillar from current project stage; keep migration audit fields.
    const patch = { ...row };
    delete patch.sync_key;
    if (existing.moved_from_pillar && existing.pillar === patch.pillar) {
      patch.moved_from_pillar = existing.moved_from_pillar;
      patch.moved_at = existing.moved_at;
    }
    const { error } = await supabase
      .from("ledger_entries")
      .update(patch)
      .eq("id", existing.id);
    return { error: error?.message ?? null };
  }

  const { error } = await supabase.from("ledger_entries").insert([row]);
  return { error: error?.message ?? null };
}

/** Resolve hourly rate: project compensation → people.hourly_rate_cost → role fallback. */
async function rateForPersonOnProject(
  supabase: Sb,
  personId: string,
  projectId: string
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: comps } = await supabase
    .from("compensation_records")
    .select("amount, comp_model, frequency")
    .eq("person_id", personId)
    .eq("project_id", projectId)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order("effective_from", { ascending: false })
    .limit(5);

  for (const c of comps || []) {
    if (
      (c.comp_model === "hourly_invoice" || c.frequency === "per_hour") &&
      c.amount != null
    ) {
      return Number(c.amount);
    }
  }

  const { data: person } = await supabase
    .from("people")
    .select("hourly_rate_cost, full_name")
    .eq("id", personId)
    .maybeSingle();
  if (person?.hourly_rate_cost != null && Number(person.hourly_rate_cost) > 0) {
    return Number(person.hourly_rate_cost);
  }
  return 80;
}

export async function syncProjectRevenue(projectId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = (await createClient()) as Sb;
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, title, client_id, stage, deal_value, expected_start_date")
    .eq("id", projectId)
    .single();
  if (error || !project) return { ok: false, error: error?.message || "Not found" };

  const stage = (project.stage || "signed") as ProjectAccountingStage;
  const pillar = pillarFromStage(stage);
  const companyId = project.client_id || null;
  const activeKeys = new Set<string>();

  // Primary deal value
  const dealKey = `auto_project:rev:${projectId}`;
  const dealAmount = Number(project.deal_value || 0);
  if (dealAmount) {
    activeKeys.add(dealKey);
    const entryDate = project.expected_start_date
      ? `${String(project.expected_start_date).slice(0, 7)}-01`
      : monthStart();
    const { error: upErr } = await upsertBySyncKey(supabase, {
      sync_key: dealKey,
      pillar,
      type: "revenue",
      amount: dealAmount,
      entry_date: entryDate,
      company_id: companyId,
      client_id: companyId,
      project_id: projectId,
      person_id: null,
      category: project.title ? `Deal — ${project.title}` : "Project deal value",
      source: "auto_project",
      updated_at: new Date().toISOString(),
    });
    if (upErr) return { ok: false, error: upErr };
  }

  // Additional revenue center lines
  const { data: lines } = await supabase
    .from("project_revenue_lines")
    .select("id, label, amount, entry_date, category")
    .eq("project_id", projectId);

  for (const line of lines || []) {
    const amount = Number(line.amount || 0);
    if (!amount) continue;
    const syncKey = `auto_project:revline:${line.id}`;
    activeKeys.add(syncKey);
    const { error: upErr } = await upsertBySyncKey(supabase, {
      sync_key: syncKey,
      pillar,
      type: "revenue",
      amount,
      entry_date: line.entry_date || monthStart(),
      company_id: companyId,
      client_id: companyId,
      project_id: projectId,
      person_id: null,
      category: line.label || line.category || "Project revenue",
      source: "auto_project",
      updated_at: new Date().toISOString(),
    });
    if (upErr) return { ok: false, error: upErr };
  }

  // Prune stale auto revenue rows for this project
  const { data: existing } = await supabase
    .from("ledger_entries")
    .select("id, sync_key")
    .eq("project_id", projectId)
    .eq("source", "auto_project")
    .eq("type", "revenue");
  for (const row of existing || []) {
    if (row.sync_key && !activeKeys.has(row.sync_key)) {
      await supabase.from("ledger_entries").delete().eq("id", row.id);
    }
  }

  return { ok: true };
}

/**
 * Rebuild auto_project cost rows for assignees on a project.
 * One row per person: sum(estimated hours) × hourly rate.
 */
export async function syncProjectAssignmentCosts(projectId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = (await createClient()) as Sb;
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, title, client_id, stage, expected_start_date")
    .eq("id", projectId)
    .single();
  if (error || !project) return { ok: false, error: error?.message || "Not found" };

  const stage = (project.stage || "signed") as ProjectAccountingStage;
  const pillar = pillarFromStage(stage);
  const entryDate = project.expected_start_date
    ? `${String(project.expected_start_date).slice(0, 7)}-01`
    : monthStart();
  const companyId = project.client_id || null;

  const { data: tasks } = await supabase
    .from("pm_tasks")
    .select("assignee_person_id, estimated_duration_hours, status")
    .eq("project_id", projectId)
    .not("assignee_person_id", "is", null);

  const hoursByPerson = new Map<string, number>();
  for (const t of tasks || []) {
    if (!t.assignee_person_id) continue;
    if (t.status === "cancelled") continue;
    const h = Number(t.estimated_duration_hours || 0);
    hoursByPerson.set(
      t.assignee_person_id,
      (hoursByPerson.get(t.assignee_person_id) || 0) + h
    );
  }

  const activeKeys = new Set<string>();
  for (const [personId, hours] of hoursByPerson) {
    const syncKey = `auto_project:cost:${projectId}:${personId}`;
    activeKeys.add(syncKey);
    const rate = await rateForPersonOnProject(supabase, personId, projectId);
    const amount = Math.round(hours * rate * 100) / 100;
    const { data: person } = await supabase
      .from("people")
      .select("full_name")
      .eq("id", personId)
      .maybeSingle();

    const { error: upErr } = await upsertBySyncKey(supabase, {
      sync_key: syncKey,
      pillar,
      type: "cost",
      amount,
      entry_date: entryDate,
      company_id: companyId,
      client_id: companyId,
      project_id: projectId,
      person_id: personId,
      category: person?.full_name
        ? `Assignment — ${person.full_name}`
        : "Project assignment",
      source: "auto_project",
      updated_at: new Date().toISOString(),
    });
    if (upErr) return { ok: false, error: upErr };
  }

  // Real cost center lines
  const { data: costLines } = await supabase
    .from("project_cost_lines")
    .select("id, label, amount, entry_date, category")
    .eq("project_id", projectId);

  for (const line of costLines || []) {
    const amount = Number(line.amount || 0);
    if (!amount) continue;
    const syncKey = `auto_project:realcost:${line.id}`;
    activeKeys.add(syncKey);
    const { error: upErr } = await upsertBySyncKey(supabase, {
      sync_key: syncKey,
      pillar,
      type: "cost",
      amount,
      entry_date: line.entry_date || monthStart(),
      company_id: companyId,
      client_id: companyId,
      project_id: projectId,
      person_id: null,
      category: line.label || line.category || "Actual cost",
      source: "auto_project",
      updated_at: new Date().toISOString(),
    });
    if (upErr) return { ok: false, error: upErr };
  }

  // Remove stale auto cost rows for people / lines no longer present
  const { data: existing } = await supabase
    .from("ledger_entries")
    .select("id, sync_key")
    .eq("project_id", projectId)
    .eq("source", "auto_project")
    .eq("type", "cost");
  for (const row of existing || []) {
    if (row.sync_key && !activeKeys.has(row.sync_key)) {
      await supabase.from("ledger_entries").delete().eq("id", row.id);
    }
  }

  return { ok: true };
}

export async function syncProjectLedger(projectId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const rev = await syncProjectRevenue(projectId);
  if (!rev.ok) return rev;
  return syncProjectAssignmentCosts(projectId);
}

/** Always-on payroll / retainers (no project) + overhead lines → actual costs. */
export async function syncHrAndOverheadLedger(): Promise<{
  ok: boolean;
  error?: string;
  upserted?: number;
  pruned?: number;
}> {
  const supabase = (await createClient()) as Sb;
  const today = new Date().toISOString().slice(0, 10);
  const entryDate = monthStart();
  let upserted = 0;
  const activeKeys = new Set<string>();

  // Compensation without project: monthly retainers / salaries as actual HR cost
  const { data: comps, error: cErr } = await supabase
    .from("compensation_records")
    .select(
      "id, person_id, amount, frequency, comp_model, people:person_id ( full_name )"
    )
    .is("project_id", null)
    .or(`effective_to.is.null,effective_to.gte.${today}`);
  if (cErr) return { ok: false, error: cErr.message };

  for (const c of comps || []) {
    if (c.frequency === "one_off" || c.frequency === "per_project") continue;
    if (c.comp_model === "non_monetary" || c.comp_model === "equity") continue;
    const amount = Number(c.amount || 0);
    if (c.frequency === "per_hour") continue; // need hours; skip org-level hourly
    if (!amount) continue;
    const syncKey = `auto_hr:comp:${c.id}`;
    activeKeys.add(syncKey);
    const name = (c as any).people?.full_name || "Person";
    const { error: upErr } = await upsertBySyncKey(supabase, {
      sync_key: syncKey,
      pillar: "actual",
      type: "cost",
      amount,
      entry_date: entryDate,
      company_id: null,
      client_id: null,
      project_id: null,
      person_id: c.person_id,
      category: `Payroll — ${name}`,
      source: "auto_hr",
      updated_at: new Date().toISOString(),
    });
    if (upErr) return { ok: false, error: upErr };
    upserted += 1;
  }

  const { data: overhead, error: oErr } = await supabase
    .from("person_overhead_costs")
    .select(
      "id, person_id, label, amount, frequency, cost_category, people:person_id ( full_name )"
    )
    .is("project_id", null)
    .or(`effective_to.is.null,effective_to.gte.${today}`);
  if (oErr) return { ok: false, error: oErr.message };

  for (const o of overhead || []) {
    const monthly = monthlyOverheadAmount(o.amount, o.frequency);
    if (!monthly) continue;
    const syncKey = `auto_overhead:${o.id}`;
    activeKeys.add(syncKey);
    const name = (o as any).people?.full_name || "Person";
    const { error: upErr } = await upsertBySyncKey(supabase, {
      sync_key: syncKey,
      pillar: "actual",
      type: "cost",
      amount: monthly,
      entry_date: entryDate,
      company_id: null,
      client_id: null,
      project_id: null,
      person_id: o.person_id,
      category: `${o.label || o.cost_category} — ${name}`,
      source: "auto_overhead",
      updated_at: new Date().toISOString(),
    });
    if (upErr) return { ok: false, error: upErr };
    upserted += 1;
  }

  // Drop auto HR / overhead ledger rows whose source records were deleted or ended
  const { data: existing, error: exErr } = await supabase
    .from("ledger_entries")
    .select("id, sync_key")
    .in("source", ["auto_hr", "auto_overhead"]);
  if (exErr) return { ok: false, error: exErr.message };

  let pruned = 0;
  for (const row of existing || []) {
    if (!row.sync_key || activeKeys.has(row.sync_key)) continue;
    const { error: delErr } = await supabase
      .from("ledger_entries")
      .delete()
      .eq("id", row.id);
    if (delErr) return { ok: false, error: delErr.message };
    pruned += 1;
  }

  return { ok: true, upserted, pruned };
}
