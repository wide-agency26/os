import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinanceDashboardData, MonthlyPlPoint, PlFilter } from "@/lib/finance/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelFromKey(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function emptyYearMonths(fyStartYear: number): Map<string, MonthlyPlPoint> {
  const map = new Map<string, MonthlyPlPoint>();
  for (let m = 0; m < 12; m++) {
    const d = new Date(fyStartYear, m, 1);
    const key = monthKey(d);
    map.set(key, { month: key, label: labelFromKey(key), revenue: 0, cost: 0, profit: 0 });
  }
  return map;
}

function addToMap(
  map: Map<string, MonthlyPlPoint>,
  dateStr: string | null | undefined,
  kind: "revenue" | "cost",
  amount: number
) {
  if (!dateStr || !amount) return;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return;
  const key = monthKey(d);
  const row = map.get(key) ?? {
    month: key,
    label: labelFromKey(key),
    revenue: 0,
    cost: 0,
    profit: 0,
  };
  if (kind === "revenue") row.revenue += amount;
  else row.cost += amount;
  row.profit = row.revenue - row.cost;
  map.set(key, row);
}

function mapToSeries(map: Map<string, MonthlyPlPoint>): MonthlyPlPoint[] {
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export async function loadFinanceDashboard(
  supabase: SupabaseClient,
  fyYear: number,
  yearSpan: 1 | 5 = 1
): Promise<{ data: FinanceDashboardData | null; error: string | null }> {
  const [
    workspaces,
    identified
  ] = await Promise.all([
    supabase.from("workspaces").select("actual_revenue, burn_rate_override, updated_at"),
    supabase.from("finance_identified_opportunities").select("amount, synced_at")
  ]);

  const errors = [workspaces.error, identified.error].filter(Boolean);
  if (errors.length) return { data: null, error: errors[0]!.message };

  const actualsMap = emptyYearMonths(fyYear);
  const identifiedMap = emptyYearMonths(fyYear);
  const unidentifiedMap = emptyYearMonths(fyYear);

  let actualRevenueTotal = 0;
  let actualCostTotal = 0;
  
  for (const w of workspaces.data ?? []) {
    const rev = Number(w.actual_revenue || 0);
    const cost = Number(w.burn_rate_override || 0);
    actualRevenueTotal += rev;
    actualCostTotal += cost;
    addToMap(actualsMap, w.updated_at, "revenue", rev);
    addToMap(actualsMap, w.updated_at, "cost", cost);
  }

  let identifiedRevenueTotal = 0;
  for (const r of identified.data ?? []) {
    const rev = Number(r.amount || 0);
    identifiedRevenueTotal += rev;
    addToMap(identifiedMap, r.synced_at, "revenue", rev);
  }

  const years =
    yearSpan === 5
      ? [fyYear - 4, fyYear - 3, fyYear - 2, fyYear - 1, fyYear]
      : [fyYear];

  return {
    data: {
      fyYear,
      years,
      actuals: mapToSeries(actualsMap),
      identified: mapToSeries(identifiedMap),
      unidentified: mapToSeries(unidentifiedMap),
      totals: {
        actualRevenue: actualRevenueTotal,
        actualCost: actualCostTotal,
        identifiedRevenue: identifiedRevenueTotal,
        identifiedCost: 0,
        unidentifiedRevenue: 0,
        unidentifiedCost: 0,
        unidentifiedGap: identifiedRevenueTotal - actualRevenueTotal,
      },
    },
    error: null,
  };
}

export function mergePlSeries(
  filter: PlFilter,
  data: FinanceDashboardData
): MonthlyPlPoint[] {
  const base = new Map<string, MonthlyPlPoint>();

  const addSeries = (series: MonthlyPlPoint[]) => {
    for (const p of series) {
      const cur = base.get(p.month) ?? { ...p, revenue: 0, cost: 0, profit: 0 };
      cur.revenue += p.revenue;
      cur.cost += p.cost;
      cur.profit = cur.revenue - cur.cost;
      base.set(p.month, cur);
    }
  };

  if (filter === "actuals" || filter === "combined") addSeries(data.actuals);
  if (filter === "identified" || filter === "combined") addSeries(data.identified);
  if (filter === "unidentified" || filter === "combined") addSeries(data.unidentified);

  return Array.from(base.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/** All WIDE OS financials are quoted in Euro. */
export function formatEuro(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** @deprecated Use formatEuro */
export const formatUsd = formatEuro;
