"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import {
  applyGoalSeek,
  computeScenario,
  ledgerDatesForYear,
  splitAmountAcrossDates,
  type ProjectionAssumption,
  type ProjectionScenario,
  type ProjectionTier,
} from "@/lib/accounting/projections";

type Sb = any;

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
    return { supabase, user: null, error: "Only founders can edit projections" };
  }
  return { supabase: supabase as Sb, user, error: null as string | null };
}

function revalidateProjection() {
  revalidatePath("/app/accounting");
  revalidatePath("/app/accounting/projections");
  revalidatePath("/app/accounting/unidentified");
  revalidatePath("/app/accounting/runway");
}

export type AssumptionPatch = Partial<
  Pick<
    ProjectionAssumption,
    | "target_segment"
    | "market_size"
    | "penetration_pct"
    | "avg_deal_value"
    | "growth_pct"
    | "source_note"
    | "units"
    | "q1"
    | "q2"
    | "q3"
    | "q4"
  >
>;

export async function saveProjectionAssumption(input: {
  scenarioId: string;
  tierId: string;
  year: number;
  patch: AssumptionPatch;
}) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };

  const { data: existing } = await supabase
    .from("projection_assumptions")
    .select("id")
    .eq("scenario_id", input.scenarioId)
    .eq("tier_id", input.tierId)
    .eq("year", input.year)
    .maybeSingle();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(input.patch)) {
    if (v !== undefined) patch[k] = v;
  }

  if (existing?.id) {
    const { error: upErr } = await supabase
      .from("projection_assumptions")
      .update(patch)
      .eq("id", existing.id);
    if (upErr) return { ok: false as const, error: upErr.message };
  } else {
    const { error: insErr } = await supabase.from("projection_assumptions").insert([
      {
        scenario_id: input.scenarioId,
        tier_id: input.tierId,
        year: input.year,
        ...patch,
      },
    ]);
    if (insErr) return { ok: false as const, error: insErr.message };
  }
  revalidateProjection();
  return { ok: true as const };
}

export async function saveProjectionCapacity(input: {
  scenarioId: string;
  year: number;
  fte: number | null;
  max_projects: number | null;
  notes: string | null;
}) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const { error: upErr } = await supabase.from("projection_capacity").upsert(
    {
      scenario_id: input.scenarioId,
      year: input.year,
      fte: input.fte,
      max_projects: input.max_projects,
      notes: input.notes,
      source: "manual",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "scenario_id,year" }
  );
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateProjection();
  return { ok: true as const };
}

export async function freezeProjectionYear(scenarioId: string, year: number) {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false as const, error: error || "Not authenticated" };

  const [{ data: scenario }, { data: tiers }, { data: assumptions }] = await Promise.all([
    supabase.from("projection_scenarios").select("*").eq("id", scenarioId).single(),
    supabase.from("projection_tiers").select("*"),
    supabase.from("projection_assumptions").select("*").eq("scenario_id", scenarioId),
  ]);
  if (!scenario) return { ok: false as const, error: "Scenario not found" };

  const computed = computeScenario({
    scenario: scenario as ProjectionScenario,
    tiers: (tiers || []) as ProjectionTier[],
    assumptions: (assumptions || []) as ProjectionAssumption[],
  });
  const yearRow = computed.find((y) => y.year === year);
  if (!yearRow) return { ok: false as const, error: "Year not in horizon" };

  const payload = {
    revenue: yearRow.revenue,
    cost: yearRow.cost,
    profit: yearRow.profit,
  };
  const { error: upErr } = await supabase.from("projection_snapshots").upsert(
    {
      scenario_id: scenarioId,
      year,
      frozen_at: new Date().toISOString(),
      frozen_by: user.id,
      payload,
    },
    { onConflict: "scenario_id,year" }
  );
  if (upErr) return { ok: false as const, error: upErr.message };
  revalidateProjection();
  return { ok: true as const };
}

export async function pushProjectionYear(scenarioId: string, year: number) {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false as const, error: error || "Not authenticated" };

  const [{ data: scenario }, { data: tiers }, { data: assumptions }, { data: settings }] =
    await Promise.all([
      supabase.from("projection_scenarios").select("*").eq("id", scenarioId).single(),
      supabase.from("projection_tiers").select("*"),
      supabase.from("projection_assumptions").select("*").eq("scenario_id", scenarioId),
      supabase.from("projection_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
  if (!scenario) return { ok: false as const, error: "Scenario not found" };

  const computed = computeScenario({
    scenario: scenario as ProjectionScenario,
    tiers: (tiers || []) as ProjectionTier[],
    assumptions: (assumptions || []) as ProjectionAssumption[],
  });
  const yearRow = computed.find((y) => y.year === year);
  if (!yearRow) return { ok: false as const, error: "Year not in horizon" };

  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const { error: delErr } = await supabase
    .from("ledger_entries")
    .delete()
    .eq("source", "auto_projection")
    .gte("entry_date", start)
    .lte("entry_date", end);
  if (delErr) return { ok: false as const, error: delErr.message };

  const dates = ledgerDatesForYear(year);
  const rows: Record<string, unknown>[] = [];
  for (const line of yearRow.lines) {
    if (!line.amount) continue;
    const splits = splitAmountAcrossDates(line.amount, dates, line.quarters);
    for (const part of splits) {
      if (!part.amount) continue;
      const ym = part.date.slice(0, 7);
      rows.push({
        pillar: "unidentified",
        type: line.tier.line_type,
        amount: Math.round(part.amount * 100) / 100,
        entry_date: part.date,
        category: `Projection · ${line.tier.name}`,
        source: "auto_projection",
        sync_key: `proj:${year}:${line.tier.id}:${ym}:${line.tier.line_type}`,
        confidence: "projection",
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length) {
    const { error: insErr } = await supabase.from("ledger_entries").insert(rows);
    if (insErr) return { ok: false as const, error: insErr.message };
  }

  const pushedYears = new Set<number>(
    Array.isArray(settings?.pushed_years) ? settings.pushed_years.map(Number) : []
  );
  pushedYears.add(year);
  const { error: setErr } = await supabase.from("projection_settings").upsert({
    id: 1,
    pushed_scenario_id: scenarioId,
    pushed_years: [...pushedYears].sort(),
    updated_at: new Date().toISOString(),
  });
  if (setErr) return { ok: false as const, error: setErr.message };

  await supabase.from("ledger_activity").insert([
    {
      event_type: "projection_push",
      message: `Pushed ${scenario.name} ${year} to Unidentified (${rows.length} rows)`,
      revenue_amount: yearRow.revenue,
      cost_amount: yearRow.cost,
    },
  ]);

  revalidateProjection();
  return { ok: true as const, rows: rows.length };
}

export async function applyGoalSeekToYear(input: {
  scenarioId: string;
  year: number;
  volumeMul: number;
  dealMul: number;
  mix: number;
}) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };

  const [{ data: scenario }, { data: tiers }, { data: assumptions }] = await Promise.all([
    supabase.from("projection_scenarios").select("*").eq("id", input.scenarioId).single(),
    supabase.from("projection_tiers").select("*"),
    supabase.from("projection_assumptions").select("*").eq("scenario_id", input.scenarioId),
  ]);
  if (!scenario) return { ok: false as const, error: "Scenario not found" };

  const computed = computeScenario({
    scenario: scenario as ProjectionScenario,
    tiers: (tiers || []) as ProjectionTier[],
    assumptions: (assumptions || []) as ProjectionAssumption[],
  });
  const yearRow = computed.find((y) => y.year === input.year);
  if (!yearRow) return { ok: false as const, error: "Year not in horizon" };
  const seeked = applyGoalSeek(yearRow, {
    volumeMul: input.volumeMul,
    dealMul: input.dealMul,
    mix: input.mix,
  });

  const now = new Date().toISOString();
  const results = await Promise.all(
    seeked.lines.map((line) =>
      supabase
        .from("projection_assumptions")
        .update({
          units: Math.round(line.units * 100) / 100,
          avg_deal_value: Math.round(line.deal * 100) / 100,
          updated_at: now,
        })
        .eq("scenario_id", input.scenarioId)
        .eq("tier_id", line.tier.id)
        .eq("year", input.year)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false as const, error: failed.error.message };
  revalidateProjection();
  return { ok: true as const };
}

export async function clearPushedProjectionYear(year: number) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };

  const { error: delErr } = await supabase
    .from("ledger_entries")
    .delete()
    .eq("source", "auto_projection")
    .gte("entry_date", `${year}-01-01`)
    .lte("entry_date", `${year}-12-31`);
  if (delErr) return { ok: false as const, error: delErr.message };

  const { data: settings } = await supabase
    .from("projection_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const years = (Array.isArray(settings?.pushed_years) ? settings.pushed_years : [])
    .map(Number)
    .filter((y: number) => y !== year);
  await supabase.from("projection_settings").upsert({
    id: 1,
    pushed_years: years,
    pushed_scenario_id: years.length ? settings?.pushed_scenario_id : null,
    updated_at: new Date().toISOString(),
  });
  revalidateProjection();
  return { ok: true as const };
}
