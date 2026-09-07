/** Multi-year unidentified projections (2027–2031). */

export const PROJECTION_YEARS = [2027, 2028, 2029, 2030, 2031] as const;
export type ProjectionYear = (typeof PROJECTION_YEARS)[number];

export const QUARTERLY_YEAR: ProjectionYear = 2027;

export type ScenarioKind = "conservative" | "base" | "aggressive" | "custom";
export type TierKind = "service" | "package" | "passive" | "carryover" | "cost";
export type LineType = "revenue" | "cost";
export type Billing = "one_off" | "monthly";

export type ProjectionScenario = {
  id: string;
  slug: string;
  name: string;
  kind: ScenarioKind;
  is_default: boolean;
  notes: string | null;
  sort_order: number;
};

export type ProjectionTier = {
  id: string;
  kind: TierKind;
  service_id: string | null;
  package_id: string | null;
  name: string;
  group_label: string;
  line_type: LineType;
  billing: Billing;
  months_per_deal: number;
  price_low: number | null;
  price_mid: number | null;
  price_high: number | null;
  price_avg: number | null;
  sort_order: number;
  is_active: boolean;
};

export type ProjectionAssumption = {
  id: string;
  scenario_id: string;
  tier_id: string;
  year: number;
  target_segment: string | null;
  market_size: number | null;
  penetration_pct: number | null;
  avg_deal_value: number | null;
  growth_pct: number | null;
  source_note: string | null;
  units: number | null;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
};

export type ProjectionCapacity = {
  id: string;
  scenario_id: string;
  year: number;
  fte: number | null;
  max_projects: number | null;
  notes: string | null;
  source: "hr" | "manual";
};

export type ProjectionSnapshot = {
  scenario_id: string;
  year: number;
  frozen_at: string;
  payload: { revenue: number; cost: number; profit: number };
};

export type ProjectionSettings = {
  horizon_start: number;
  horizon_end: number;
  pushed_scenario_id: string | null;
  pushed_years: number[];
};

export type HrCapacity = {
  activePeople: number;
  monthlyFullyLoaded: number;
};

function n(v: number | null | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function firstPositive(...vals: Array<number | null | undefined>): number {
  for (const v of vals) {
    const x = Number(v);
    if (Number.isFinite(x) && x > 0) return x;
  }
  return 0;
}

export function catalogRate(tier: ProjectionTier, kind: ScenarioKind): number {
  if (kind === "conservative") {
    return firstPositive(tier.price_low, tier.price_mid, tier.price_avg, tier.price_high);
  }
  if (kind === "aggressive") {
    return firstPositive(tier.price_high, tier.price_avg, tier.price_mid, tier.price_low);
  }
  return firstPositive(tier.price_avg, tier.price_mid, tier.price_low, tier.price_high);
}

/** Full engagement value (retainer = monthly × months). */
export function engagementValue(
  tier: ProjectionTier,
  kind: ScenarioKind,
  assumption: ProjectionAssumption | undefined
): number {
  if (assumption?.avg_deal_value != null && Number(assumption.avg_deal_value) > 0) {
    return Number(assumption.avg_deal_value);
  }
  const rate = catalogRate(tier, kind);
  const months = Math.max(1, n(tier.months_per_deal));
  return tier.billing === "monthly" ? rate * months : rate;
}

export function suggestedUnitsFromMarket(
  assumption: ProjectionAssumption | undefined
): number | null {
  if (!assumption) return null;
  if (assumption.market_size == null || assumption.penetration_pct == null) return null;
  const size = Number(assumption.market_size);
  const pct = Number(assumption.penetration_pct);
  if (!Number.isFinite(size) || !Number.isFinite(pct) || size <= 0) return null;
  return Math.round(size * (pct / 100) * 100) / 100;
}

export type QuarterSplit = { q1: number; q2: number; q3: number; q4: number };

export function quarterSplit(
  units: number,
  assumption: ProjectionAssumption | undefined
): QuarterSplit {
  const qs = [
    assumption?.q1,
    assumption?.q2,
    assumption?.q3,
    assumption?.q4,
  ].map((v) => (v == null ? null : Number(v)));
  if (qs.some((v) => v != null && Number.isFinite(v))) {
    return {
      q1: n(qs[0]),
      q2: n(qs[1]),
      q3: n(qs[2]),
      q4: n(qs[3]),
    };
  }
  const each = units / 4;
  return { q1: each, q2: each, q3: each, q4: each };
}

export type ComputedLine = {
  tier: ProjectionTier;
  assumption: ProjectionAssumption | undefined;
  units: number;
  unitsInherited: boolean;
  deal: number;
  amount: number;
  quarters: QuarterSplit | null;
  suggestedUnits: number | null;
};

export type ComputedYear = {
  year: number;
  revenue: number;
  cost: number;
  profit: number;
  lines: ComputedLine[];
  packageClients: number;
  serviceDeals: number;
};

export function unitsForYear(
  assumption: ProjectionAssumption | undefined,
  prevUnits: number | null,
  prevGrowth: number | null
): { units: number; inherited: boolean } {
  if (assumption?.units != null && Number.isFinite(Number(assumption.units))) {
    return { units: Number(assumption.units), inherited: false };
  }
  if (prevUnits != null && prevGrowth != null && Number.isFinite(prevGrowth)) {
    return {
      units: prevUnits * (1 + Number(prevGrowth) / 100),
      inherited: true,
    };
  }
  return { units: 0, inherited: false };
}

export function computeScenario(input: {
  scenario: ProjectionScenario;
  tiers: ProjectionTier[];
  assumptions: ProjectionAssumption[];
  years?: readonly number[];
}): ComputedYear[] {
  const years = input.years ?? [...PROJECTION_YEARS];
  const byKey = new Map<string, ProjectionAssumption>();
  for (const a of input.assumptions) {
    if (a.scenario_id !== input.scenario.id) continue;
    byKey.set(`${a.tier_id}:${a.year}`, a);
  }
  const activeTiers = input.tiers
    .filter((t) => t.is_active !== false)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const prevUnits = new Map<string, number>();
  const prevGrowth = new Map<string, number | null>();
  const out: ComputedYear[] = [];

  for (const year of years) {
    const lines: ComputedLine[] = [];
    let revenue = 0;
    let cost = 0;
    let packageClients = 0;
    let serviceDeals = 0;

    for (const tier of activeTiers) {
      const assumption = byKey.get(`${tier.id}:${year}`);
      const { units, inherited } = unitsForYear(
        assumption,
        prevUnits.get(tier.id) ?? null,
        prevGrowth.get(tier.id) ?? null
      );
      const deal = engagementValue(tier, input.scenario.kind, assumption);
      const amount = units * deal;
      const quarters =
        year === QUARTERLY_YEAR ? quarterSplit(units, assumption) : null;
      lines.push({
        tier,
        assumption,
        units,
        unitsInherited: inherited,
        deal,
        amount,
        quarters,
        suggestedUnits: suggestedUnitsFromMarket(assumption),
      });
      if (tier.line_type === "cost") cost += amount;
      else revenue += amount;
      if (tier.kind === "package") packageClients += units;
      if (tier.kind === "service") serviceDeals += units;
      prevUnits.set(tier.id, units);
      prevGrowth.set(
        tier.id,
        assumption?.growth_pct != null ? Number(assumption.growth_pct) : null
      );
    }

    out.push({
      year,
      revenue,
      cost,
      profit: revenue - cost,
      lines,
      packageClients,
      serviceDeals,
    });
  }
  return out;
}

export type GoalSeekInput = {
  volumeMul: number;
  dealMul: number;
  /** 0 = lean services, 0.5 = as-is, 1 = lean packages */
  mix: number;
};

export function applyGoalSeek(
  year: ComputedYear,
  input: GoalSeekInput
): ComputedYear {
  const volumeMul = n(input.volumeMul) || 1;
  const dealMul = n(input.dealMul) || 1;
  const mix = Math.min(1, Math.max(0, n(input.mix)));
  const packageMul = 0.5 + mix;
  const serviceMul = 1.5 - mix;

  let revenue = 0;
  let cost = 0;
  let packageClients = 0;
  let serviceDeals = 0;
  const lines = year.lines.map((line) => {
    let v = volumeMul;
    let d = dealMul;
    if (line.tier.kind === "package") v *= packageMul;
    else if (line.tier.kind === "service") v *= serviceMul;
    const units = line.units * v;
    const deal = line.deal * d;
    const amount = units * deal;
    if (line.tier.line_type === "cost") cost += amount;
    else revenue += amount;
    if (line.tier.kind === "package") packageClients += units;
    if (line.tier.kind === "service") serviceDeals += units;
    return { ...line, units, deal, amount };
  });
  return {
    ...year,
    revenue,
    cost,
    profit: revenue - cost,
    lines,
    packageClients,
    serviceDeals,
  };
}

export function groupLines(lines: ComputedLine[]) {
  const order = [
    "Packages",
    "Services",
    "Passive",
    "Carryover",
    "People",
    "Office",
    "Tools",
  ];
  const map = new Map<string, ComputedLine[]>();
  for (const line of lines) {
    const key = line.tier.group_label || "Other";
    const list = map.get(key) ?? [];
    list.push(line);
    map.set(key, list);
  }
  const keys = [
    ...order.filter((k) => map.has(k)),
    ...[...map.keys()].filter((k) => !order.includes(k)),
  ];
  return keys.map((label) => ({
    label,
    lines: map.get(label) || [],
    amount: (map.get(label) || []).reduce((s, l) => s + l.amount, 0),
    type: (map.get(label) || [])[0]?.tier.line_type ?? "revenue",
  }));
}

export function ledgerDatesForYear(year: number): string[] {
  if (year === QUARTERLY_YEAR) {
    return [`${year}-01-01`, `${year}-04-01`, `${year}-07-01`, `${year}-10-01`];
  }
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`);
}

export function splitAmountAcrossDates(
  amount: number,
  dates: string[],
  quarters: QuarterSplit | null
): { date: string; amount: number }[] {
  if (amount === 0) return [];
  if (quarters && dates.length === 4) {
    const totalQ = quarters.q1 + quarters.q2 + quarters.q3 + quarters.q4;
    if (totalQ <= 0) return [];
    const parts = [quarters.q1, quarters.q2, quarters.q3, quarters.q4];
    return dates.map((date, i) => ({
      date,
      amount: amount * (parts[i] / totalQ),
    }));
  }
  const each = amount / dates.length;
  return dates.map((date) => ({ date, amount: each }));
}

export type SnapshotPayload = {
  revenue: number;
  cost: number;
  profit: number;
};

export function yearIsOpen(year: number, now = new Date()): boolean {
  return now.getFullYear() >= year;
}
