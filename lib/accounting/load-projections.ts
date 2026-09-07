import {
  computeScenario,
  PROJECTION_YEARS,
  type ComputedYear,
  type HrCapacity,
  type ProjectionAssumption,
  type ProjectionCapacity,
  type ProjectionScenario,
  type ProjectionSettings,
  type ProjectionSnapshot,
  type ProjectionTier,
} from "./projections";

type Sb = any;

export type ProjectionBoard = {
  scenarios: ProjectionScenario[];
  tiers: ProjectionTier[];
  assumptions: ProjectionAssumption[];
  capacity: ProjectionCapacity[];
  snapshots: ProjectionSnapshot[];
  settings: ProjectionSettings;
  hr: HrCapacity;
  computed: Record<string, ComputedYear[]>;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapTier(row: any): ProjectionTier {
  return {
    id: row.id,
    kind: row.kind,
    service_id: row.service_id,
    package_id: row.package_id,
    name: row.name,
    group_label: row.group_label,
    line_type: row.line_type,
    billing: row.billing,
    months_per_deal: Number(row.months_per_deal || 1),
    price_low: num(row.price_low),
    price_mid: num(row.price_mid),
    price_high: num(row.price_high),
    price_avg: num(row.price_avg),
    sort_order: Number(row.sort_order || 0),
    is_active: row.is_active !== false,
  };
}

function mapAssumption(row: any): ProjectionAssumption {
  return {
    id: row.id,
    scenario_id: row.scenario_id,
    tier_id: row.tier_id,
    year: Number(row.year),
    target_segment: row.target_segment,
    market_size: num(row.market_size),
    penetration_pct: num(row.penetration_pct),
    avg_deal_value: num(row.avg_deal_value),
    growth_pct: num(row.growth_pct),
    source_note: row.source_note,
    units: num(row.units),
    q1: num(row.q1),
    q2: num(row.q2),
    q3: num(row.q3),
    q4: num(row.q4),
  };
}

export async function loadProjectionBoard(supabase: Sb): Promise<ProjectionBoard> {
  const [
    { data: scenarios },
    { data: tiers },
    { data: assumptions },
    { data: capacity },
    { data: snapshots },
    { data: settingsRow },
    { count: peopleCount },
    { data: loaded },
  ] = await Promise.all([
    supabase.from("projection_scenarios").select("*").order("sort_order"),
    supabase.from("projection_tiers").select("*").order("sort_order"),
    supabase.from("projection_assumptions").select("*"),
    supabase.from("projection_capacity").select("*"),
    supabase.from("projection_snapshots").select("scenario_id, year, frozen_at, payload"),
    supabase.from("projection_settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("people")
      .select("id", { count: "exact", head: true })
      .eq("roster_status", "active"),
    supabase.from("hr_person_fully_loaded_cost").select("monthly_fully_loaded"),
  ]);

  const mappedScenarios = (scenarios || []) as ProjectionScenario[];
  const mappedTiers = (tiers || []).map(mapTier);
  const mappedAssumptions = (assumptions || []).map(mapAssumption);
  const mappedCapacity = (capacity || []) as ProjectionCapacity[];
  const mappedSnaps: ProjectionSnapshot[] = (snapshots || []).map((s: any) => ({
    scenario_id: s.scenario_id,
    year: Number(s.year),
    frozen_at: s.frozen_at,
    payload: {
      revenue: Number(s.payload?.revenue || 0),
      cost: Number(s.payload?.cost || 0),
      profit: Number(s.payload?.profit || 0),
    },
  }));
  const settings: ProjectionSettings = {
    horizon_start: Number(settingsRow?.horizon_start || 2027),
    horizon_end: Number(settingsRow?.horizon_end || 2031),
    pushed_scenario_id: settingsRow?.pushed_scenario_id || null,
    pushed_years: Array.isArray(settingsRow?.pushed_years)
      ? settingsRow.pushed_years.map(Number)
      : [],
  };
  const monthlyFullyLoaded = (loaded || []).reduce(
    (s: number, r: { monthly_fully_loaded?: number }) =>
      s + Number(r.monthly_fully_loaded || 0),
    0
  );

  const computed: Record<string, ComputedYear[]> = {};
  for (const sc of mappedScenarios) {
    computed[sc.id] = computeScenario({
      scenario: sc,
      tiers: mappedTiers,
      assumptions: mappedAssumptions,
      years: PROJECTION_YEARS,
    });
  }

  return {
    scenarios: mappedScenarios,
    tiers: mappedTiers,
    assumptions: mappedAssumptions,
    capacity: mappedCapacity,
    snapshots: mappedSnaps,
    settings,
    hr: {
      activePeople: peopleCount || 0,
      monthlyFullyLoaded,
    },
    computed,
  };
}
