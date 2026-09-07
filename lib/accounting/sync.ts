import { createClient } from "@/utils/supabase/server";
import {
  firstOfMonth,
  pillarFromStage,
  type ProjectAccountingStage,
} from "@/lib/accounting/types";
import {
  financeCoveredMonths,
  yearMonthKey,
} from "@/lib/accounting/finance";
import {
  overheadAmountForCoveredMonth,
  type CompModel,
  type SalaryBreakdown,
} from "@/lib/hr/types";
import {
  accountingCostForRecord,
  monthsCoveredInYear,
} from "@/lib/hr/compensation";

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

export async function syncProjectRevenue(
  projectId: string,
  client?: Sb
): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = (client ?? ((await createClient()) as Sb)) as Sb;
  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, title, client_id, stage, status, deal_value, deal_frequency, deal_end_date, expected_start_date, start_date"
    )
    .eq("id", projectId)
    .single();
  if (error || !project) return { ok: false, error: error?.message || "Not found" };

  const stage = (project.stage || "signed") as ProjectAccountingStage;
  const pillar = pillarFromStage(stage);
  const companyId = project.client_id || null;
  const year = new Date().getFullYear();
  const activeKeys = new Set<string>();
  const lost = project.status === "expired";

  const dealAmount = lost ? 0 : Number(project.deal_value || 0);
  const dealFrom =
    project.expected_start_date || project.start_date || monthStart();
  if (dealAmount) {
    const months = financeCoveredMonths(
      project.deal_frequency,
      dealFrom,
      project.deal_end_date,
      year
    );
    const category = project.title
      ? `Deal — ${project.title}`
      : "Project deal value";
    for (const month of months) {
      const syncKey = `auto_project:rev:${projectId}:${yearMonthKey(year, month)}`;
      activeKeys.add(syncKey);
      const { error: upErr } = await upsertBySyncKey(supabase, {
        sync_key: syncKey,
        pillar,
        type: "revenue",
        amount: dealAmount,
        entry_date: firstOfMonth(year, month),
        company_id: companyId,
        client_id: companyId,
        project_id: projectId,
        person_id: null,
        category,
        source: "auto_project",
        updated_at: new Date().toISOString(),
      });
      if (upErr) return { ok: false, error: upErr };
    }
  }

  const { data: lines } = lost
    ? { data: [] as never[] }
    : await supabase
        .from("project_revenue_lines")
        .select("id, label, amount, entry_date, category, frequency, effective_to")
        .eq("project_id", projectId);

  for (const line of lines || []) {
    const amount = Number(line.amount || 0);
    if (!amount) continue;
    const from = line.entry_date || monthStart();
    const months = financeCoveredMonths(
      line.frequency,
      from,
      line.effective_to,
      year
    );
    const category = line.label || line.category || "Project revenue";
    for (const month of months) {
      const syncKey = `auto_project:revline:${line.id}:${yearMonthKey(year, month)}`;
      activeKeys.add(syncKey);
      const { error: upErr } = await upsertBySyncKey(supabase, {
        sync_key: syncKey,
        pillar,
        type: "revenue",
        amount,
        entry_date: firstOfMonth(year, month),
        company_id: companyId,
        client_id: companyId,
        project_id: projectId,
        person_id: null,
        category,
        source: "auto_project",
        updated_at: new Date().toISOString(),
      });
      if (upErr) return { ok: false, error: upErr };
    }
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
export async function syncProjectAssignmentCosts(
  projectId: string,
  client?: Sb
): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = (client ?? ((await createClient()) as Sb)) as Sb;
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, title, client_id, stage, status, expected_start_date")
    .eq("id", projectId)
    .single();
  if (error || !project) return { ok: false, error: error?.message || "Not found" };

  const stage = (project.stage || "signed") as ProjectAccountingStage;
  const pillar = pillarFromStage(stage);
  const lost = project.status === "expired";
  const entryDate = project.expected_start_date
    ? `${String(project.expected_start_date).slice(0, 7)}-01`
    : monthStart();
  const companyId = project.client_id || null;

  const { data: tasks } = lost
    ? { data: [] as never[] }
    : await supabase
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

  const year = new Date().getFullYear();
  const { data: costLines } = lost
    ? { data: [] as never[] }
    : await supabase
        .from("project_cost_lines")
        .select(
          "id, label, amount, entry_date, category, frequency, effective_to, overhead:overhead_cost_id ( person_id )"
        )
        .eq("project_id", projectId);

  for (const line of costLines || []) {
    const monthly = overheadAmountForCoveredMonth(line.amount, line.frequency);
    if (!monthly) continue;
    const from = line.entry_date || monthStart();
    const months = financeCoveredMonths(
      line.frequency,
      from,
      line.effective_to,
      year
    );
    const category = line.label || line.category || "Actual cost";
    for (const month of months) {
      const syncKey = `auto_project:realcost:${line.id}:${yearMonthKey(year, month)}`;
      activeKeys.add(syncKey);
      const { error: upErr } = await upsertBySyncKey(supabase, {
        sync_key: syncKey,
        pillar,
        type: "cost",
        amount: monthly,
        entry_date: firstOfMonth(year, month),
        company_id: companyId,
        client_id: companyId,
        project_id: projectId,
        person_id:
          (line as { overhead?: { person_id?: string | null } }).overhead
            ?.person_id || null,
        category,
        source: "auto_project",
        updated_at: new Date().toISOString(),
      });
      if (upErr) return { ok: false, error: upErr };
    }
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

/** Refresh deal-value ledger rows for every live project. */
export async function syncAllProjectLedgers(): Promise<{
  ok: boolean;
  error?: string;
  synced?: number;
}> {
  const supabase = (await createClient()) as Sb;
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, stage, status, sow_family_id")
    .in("stage", ["prospect", "lead", "client", "signed", "completed"]);
  if (error) return { ok: false, error: error.message };
  const { applyProjectDealValue } = await import("@/lib/accounting/deal-value");
  let synced = 0;
  for (const p of projects || []) {
    if (p.stage === "lead" || p.status === "pipeline" || p.sow_family_id) {
      await applyProjectDealValue(p.id);
    }
    const res = await syncProjectLedger(p.id);
    if (!res.ok) return { ok: false, error: res.error, synced };
    synced += 1;
  }
  return { ok: true, synced };
}

/**
 * Remove auto_project ledger ghosts left behind when projects/lines were deleted
 * (or before project_id FK cascaded).
 */
export async function pruneOrphanedProjectLedger(): Promise<{
  ok: boolean;
  error?: string;
  pruned?: number;
}> {
  const supabase = (await createClient()) as Sb;
  let pruned = 0;

  // 1) Rows with no project (legacy ON DELETE SET NULL)
  const { data: nullProj, error: e1 } = await supabase
    .from("ledger_entries")
    .select("id")
    .eq("source", "auto_project")
    .is("project_id", null);
  if (e1) return { ok: false, error: e1.message };
  for (const row of nullProj || []) {
    await supabase.from("ledger_entries").delete().eq("id", row.id);
    pruned += 1;
  }

  // 2) Rows pointing at a deleted project id (should be rare with CASCADE)
  const { data: autoRows, error: e2 } = await supabase
    .from("ledger_entries")
    .select("id, project_id")
    .eq("source", "auto_project")
    .not("project_id", "is", null);
  if (e2) return { ok: false, error: e2.message };

  const projectIds = [
    ...new Set((autoRows || []).map((r: { project_id: string }) => r.project_id)),
  ];
  if (projectIds.length) {
    const { data: live } = await supabase
      .from("projects")
      .select("id")
      .in("id", projectIds);
    const liveSet = new Set((live || []).map((p: { id: string }) => p.id));
    for (const row of autoRows || []) {
      if (row.project_id && !liveSet.has(row.project_id)) {
        await supabase.from("ledger_entries").delete().eq("id", row.id);
        pruned += 1;
      }
    }
  }

  // 3) Revenue / real-cost lines whose source rows are gone
  const { data: lineRows } = await supabase
    .from("ledger_entries")
    .select("id, sync_key")
    .eq("source", "auto_project")
    .or("sync_key.like.auto_project:revline:%,sync_key.like.auto_project:realcost:%");

  for (const row of lineRows || []) {
    const key = String(row.sync_key || "");
    const revMatch = key.match(/^auto_project:revline:(.+)$/);
    const costMatch = key.match(/^auto_project:realcost:(.+)$/);
    if (revMatch) {
      const { data } = await supabase
        .from("project_revenue_lines")
        .select("id")
        .eq("id", revMatch[1])
        .maybeSingle();
      if (!data) {
        await supabase.from("ledger_entries").delete().eq("id", row.id);
        pruned += 1;
      }
    } else if (costMatch) {
      const { data } = await supabase
        .from("project_cost_lines")
        .select("id")
        .eq("id", costMatch[1])
        .maybeSingle();
      if (!data) {
        await supabase.from("ledger_entries").delete().eq("id", row.id);
        pruned += 1;
      }
    }
  }

  return { ok: true, pruned };
}

const PIPELINE_IDENTIFIED_STAGES = new Set(["met", "testing", "onboarding"]);

function yearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function relatedName(rel: unknown, fallback = "Person"): string {
  if (!rel) return fallback;
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { full_name?: string } | null)?.full_name || fallback;
}

function latestSalaryBreakdown(raw: unknown): SalaryBreakdown | null {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => {
    const y = Number(a?.period_year || 0) - Number(b?.period_year || 0);
    if (y !== 0) return y;
    return Number(a?.period_month || 0) - Number(b?.period_month || 0);
  });
  return (sorted.at(-1) as SalaryBreakdown) || null;
}

function overheadScopeLabel(scope: string | undefined): string {
  if (scope === "office") return "Office";
  if (scope === "marketing") return "Marketing";
  if (scope === "unassigned") return "Unassigned";
  if (scope === "project") return "Project";
  return "Person";
}

async function pruneStaleKeys(
  supabase: Sb,
  sources: string[],
  activeKeys: Set<string>
): Promise<{ ok: boolean; pruned: number; error?: string }> {
  const { data: existing, error: exErr } = await supabase
    .from("ledger_entries")
    .select("id, sync_key")
    .in("source", sources);
  if (exErr) return { ok: false, pruned: 0, error: exErr.message };

  let pruned = 0;
  for (const row of existing || []) {
    if (!row.sync_key || activeKeys.has(row.sync_key)) continue;
    const { error: delErr } = await supabase
      .from("ledger_entries")
      .delete()
      .eq("id", row.id);
    if (delErr) return { ok: false, pruned, error: delErr.message };
    pruned += 1;
  }
  return { ok: true, pruned };
}

/** Org-level payroll + overhead calendars → one Actual cost row per covered month. */
export async function syncHrAndOverheadLedger(): Promise<{
  ok: boolean;
  error?: string;
  upserted?: number;
  pruned?: number;
}> {
  const supabase = (await createClient()) as Sb;
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  let upserted = 0;
  const activeKeys = new Set<string>();

  const { data: comps, error: cErr } = await supabase
    .from("compensation_records")
    .select(
      "id, person_id, amount, frequency, comp_model, effective_from, effective_to, people:person_id ( full_name ), salary_breakdowns ( * )"
    )
    .is("project_id", null)
    .lte("effective_from", yearEnd)
    .or(`effective_to.is.null,effective_to.gte.${yearStart}`);
  if (cErr) return { ok: false, error: cErr.message };

  for (const c of comps || []) {
    if (
      c.frequency === "one_off" ||
      c.frequency === "per_project" ||
      c.frequency === "per_hour"
    ) {
      continue;
    }
    if (c.comp_model === "non_monetary" || c.comp_model === "equity") continue;
    const amount = accountingCostForRecord({
      comp_model: c.comp_model as CompModel,
      amount: c.amount,
      breakdown: latestSalaryBreakdown((c as { salary_breakdowns?: unknown }).salary_breakdowns),
    });
    if (!amount) continue;
    const months = monthsCoveredInYear(
      { effective_from: c.effective_from, effective_to: c.effective_to },
      year
    );
    const name = relatedName((c as { people?: unknown }).people);
    for (const month of months) {
      const syncKey = `auto_hr:comp:${c.id}:${yearMonth(year, month)}`;
      activeKeys.add(syncKey);
      const { error: upErr } = await upsertBySyncKey(supabase, {
        sync_key: syncKey,
        pillar: "actual",
        type: "cost",
        amount,
        entry_date: firstOfMonth(year, month),
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
  }

  const { data: overhead, error: oErr } = await supabase
    .from("person_overhead_costs")
    .select(
      "id, person_id, scope, label, amount, frequency, cost_category, effective_from, effective_to, people:person_id ( full_name )"
    )
    .is("project_id", null)
    .lte("effective_from", yearEnd)
    .or(`effective_to.is.null,effective_to.gte.${yearStart}`);
  if (oErr) return { ok: false, error: oErr.message };

  for (const o of overhead || []) {
    const monthly = overheadAmountForCoveredMonth(o.amount, o.frequency);
    if (!monthly) continue;
    const months = monthsCoveredInYear(
      { effective_from: o.effective_from, effective_to: o.effective_to },
      year
    );
    const scopeLabel = overheadScopeLabel(o.scope);
    const name = relatedName((o as { people?: unknown }).people, scopeLabel);
    for (const month of months) {
      const syncKey = `auto_overhead:${o.id}:${yearMonth(year, month)}`;
      activeKeys.add(syncKey);
      const { error: upErr } = await upsertBySyncKey(supabase, {
        sync_key: syncKey,
        pillar: "actual",
        type: "cost",
        amount: monthly,
        entry_date: firstOfMonth(year, month),
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
  }

  const prune = await pruneStaleKeys(
    supabase,
    ["auto_hr", "auto_overhead"],
    activeKeys
  );
  if (!prune.ok) return { ok: false, error: prune.error };
  return { ok: true, upserted, pruned: prune.pruned };
}

/** Met / Testing / Onboarding cards with a monthly cost → Identified people cost. */
export async function syncPipelinePeopleLedger(): Promise<{
  ok: boolean;
  error?: string;
  upserted?: number;
  pruned?: number;
}> {
  const supabase = (await createClient()) as Sb;
  const year = new Date().getFullYear();
  let upserted = 0;
  const activeKeys = new Set<string>();

  const { data: cards, error: pErr } = await supabase
    .from("roster_pipeline")
    .select("id, name, stage, expected_monthly_cost, created_at");
  if (pErr) return { ok: false, error: pErr.message };

  for (const card of cards || []) {
    if (!PIPELINE_IDENTIFIED_STAGES.has(card.stage)) continue;
    const amount = Number(card.expected_monthly_cost || 0);
    if (!(amount > 0)) continue;

    const created = card.created_at ? new Date(card.created_at) : new Date();
    const startMonth =
      created.getFullYear() === year ? created.getMonth() + 1 : 1;

    for (let month = startMonth; month <= 12; month++) {
      const syncKey = `auto_pipeline:${card.id}:${yearMonth(year, month)}`;
      activeKeys.add(syncKey);
      const { error: upErr } = await upsertBySyncKey(supabase, {
        sync_key: syncKey,
        pillar: "identified",
        type: "cost",
        amount,
        entry_date: firstOfMonth(year, month),
        company_id: null,
        client_id: null,
        project_id: null,
        person_id: null,
        category: `Pipeline — ${card.name}`,
        source: "auto_pipeline",
        updated_at: new Date().toISOString(),
      });
      if (upErr) return { ok: false, error: upErr };
      upserted += 1;
    }
  }

  const prune = await pruneStaleKeys(supabase, ["auto_pipeline"], activeKeys);
  if (!prune.ok) return { ok: false, error: prune.error };
  return { ok: true, upserted, pruned: prune.pruned };
}
