/** Client-side data helpers for the accounting ledger (Phase 2 UI). */

import { MONTH_SHORT, type LedgerEntry, type LedgerPillar } from "./types";

// Kept loose because generated Supabase types don't yet include the new
// accounting tables — mirrors the `as any` pattern used elsewhere (sync.ts,
// app/actions/accounting.ts).
type Sb = any;

const LEDGER_SELECT = `
  id, pillar, type, amount, entry_date, company_id, client_id, project_id, person_id,
  category, source, sync_key, moved_from_pillar, moved_at, confidence, created_at, updated_at,
  projects:project_id ( id, title, stage ),
  people:person_id ( id, full_name ),
  company:company_id ( id, name, company )
`;

export type LedgerFilter = {
  pillar: LedgerPillar;
  startDate: string;
  endDate: string;
};

export async function fetchLedgerEntries(
  supabase: Sb,
  filter: LedgerFilter
): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from("ledger_entries")
    .select(LEDGER_SELECT)
    .eq("pillar", filter.pillar)
    .gte("entry_date", filter.startDate)
    .lte("entry_date", filter.endDate)
    .order("entry_date", { ascending: true });
  if (error) {
    console.error("fetchLedgerEntries", error.message);
    return [];
  }
  return (data || []) as LedgerEntry[];
}

export function totals(entries: LedgerEntry[]): {
  revenue: number;
  cost: number;
  profit: number;
} {
  let revenue = 0;
  let cost = 0;
  for (const e of entries) {
    if (e.type === "revenue") revenue += Number(e.amount || 0);
    else cost += Number(e.amount || 0);
  }
  return { revenue, cost, profit: revenue - cost };
}

export type MonthlyPoint = {
  month: number;
  label: string;
  revenue: number;
  cost: number;
};

/** Buckets entries by calendar month (1-12), ignoring year — correct for
 * single fiscal-year filter ranges (the default & common case). */
export function aggregateMonthly(entries: LedgerEntry[]): MonthlyPoint[] {
  const points: MonthlyPoint[] = MONTH_SHORT.map((label, idx) => ({
    month: idx + 1,
    label,
    revenue: 0,
    cost: 0,
  }));
  for (const e of entries) {
    if (!e.entry_date) continue;
    const m = Number(e.entry_date.slice(5, 7));
    const point = points[m - 1];
    if (!point) continue;
    if (e.type === "revenue") point.revenue += Number(e.amount || 0);
    else point.cost += Number(e.amount || 0);
  }
  return points;
}

export type MonthKeyPoint = {
  key: string; // YYYY-MM
  label: string;
  revenue: number;
  cost: number;
};

/** Chronological month buckets (spans years) — used for runway trend math. */
export function monthlySeriesChronological(entries: LedgerEntry[]): MonthKeyPoint[] {
  const map = new Map<string, { revenue: number; cost: number }>();
  for (const e of entries) {
    if (!e.entry_date) continue;
    const key = e.entry_date.slice(0, 7);
    if (!map.has(key)) map.set(key, { revenue: 0, cost: 0 });
    const v = map.get(key)!;
    if (e.type === "revenue") v.revenue += Number(e.amount || 0);
    else v.cost += Number(e.amount || 0);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, v]) => ({ key, label: formatMonthKey(key), ...v }));
}

function formatMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_SHORT[(m || 1) - 1]} '${String(y).slice(2)}`;
}

export type LedgerGroup = {
  key: string;
  label: string;
  badge: string;
  entries: LedgerEntry[];
  revenue: number;
  cost: number;
};

function pushToGroup(
  map: Map<string, LedgerGroup>,
  key: string,
  label: string,
  badge: string,
  e: LedgerEntry
) {
  if (!map.has(key)) map.set(key, { key, label, badge, entries: [], revenue: 0, cost: 0 });
  const g = map.get(key)!;
  g.entries.push(e);
  if (e.type === "revenue") g.revenue += Number(e.amount || 0);
  else g.cost += Number(e.amount || 0);
}

/** Groups by project (else HR / Overhead / Other) — used by Actual & Identified. */
export function groupByProjectOrSource(entries: LedgerEntry[]): LedgerGroup[] {
  const map = new Map<string, LedgerGroup>();
  for (const e of entries) {
    if (e.project_id) {
      pushToGroup(
        map,
        `project:${e.project_id}`,
        e.projects?.title || "Untitled project",
        "Project",
        e
      );
    } else if (e.source === "auto_hr") {
      pushToGroup(map, "hr", "HR / Payroll", "HR", e);
    } else if (e.source === "auto_overhead") {
      pushToGroup(map, "overhead", "Overhead", "Overhead", e);
    } else {
      pushToGroup(map, `other:${e.category}`, e.category || "Other", "Other", e);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.revenue + b.cost - (a.revenue + a.cost)
  );
}

/** Groups by category — used by Unidentified. */
export function groupByCategory(entries: LedgerEntry[]): LedgerGroup[] {
  const map = new Map<string, LedgerGroup>();
  for (const e of entries) {
    const key = e.category || "Uncategorized";
    pushToGroup(map, key, key, "Category", e);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.revenue + b.cost - (a.revenue + a.cost)
  );
}

export type CompanyOption = { id: string; name: string; company: string | null };

export async function fetchCompanyOptions(supabase: Sb): Promise<CompanyOption[]> {
  const { data, error } = await supabase
    .from("crm_customers")
    .select("id, name, company")
    .order("company", { ascending: true });
  if (error) {
    console.error("fetchCompanyOptions", error.message);
    return [];
  }
  return (data || []) as CompanyOption[];
}

export type ProjectOption = {
  id: string;
  title: string | null;
  client_id: string | null;
  stage: string | null;
};

export async function fetchProjectsByClient(
  supabase: Sb,
  clientId: string
): Promise<ProjectOption[]> {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, client_id, stage")
    .eq("client_id", clientId)
    .order("title", { ascending: true });
  if (error) {
    console.error("fetchProjectsByClient", error.message);
    return [];
  }
  return (data || []) as ProjectOption[];
}

export async function fetchCashBalances(
  supabase: Sb,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from("cash_balance_entries")
    .select("*")
    .gte("balance_date", startDate)
    .lte("balance_date", endDate)
    .order("balance_date", { ascending: true });
  if (error) {
    console.error("fetchCashBalances", error.message);
    return [];
  }
  return data || [];
}

export async function fetchActivity(supabase: Sb, limit = 20) {
  const { data, error } = await supabase
    .from("ledger_activity")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("fetchActivity", error.message);
    return [];
  }
  return data || [];
}

export function companyLabel(c: { name: string; company: string | null } | null | undefined): string {
  if (!c) return "—";
  return c.company ? `${c.company}${c.name ? ` (${c.name})` : ""}` : c.name || "—";
}
