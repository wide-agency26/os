import { loadWorkHubRows, type WorkHubRow } from "@/lib/work/load-hub";
import type { WorkGroup } from "@/lib/work/stages";
import {
  fetchCashBalances,
  fetchLedgerEntries,
  monthlySeriesChronological,
  totals,
} from "@/lib/accounting/queries";
import type { LedgerEntry, LedgerPillar } from "@/lib/accounting/types";
import { loadPendingCompanyAccess, type CompanyMemberRow } from "@/app/actions/company-members";
import { mapDealRow, type DiscoveredDealRow } from "@/lib/bd/deal-finder/rows";
import type { OfferingChip } from "@/lib/offerings/types";
import { loadCatalogOfferings, loadOfferingsByProjectIds } from "@/lib/offerings/load";

function fyRange(d = new Date()) {
  const year = d.getFullYear();
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

function avgMonthlyNetActual(entries: LedgerEntry[], trailingMonths = 3): number {
  const series = monthlySeriesChronological(entries);
  const last = series.slice(-trailingMonths);
  if (last.length === 0) return 0;
  const sum = last.reduce((s, m) => s + (m.revenue - m.cost), 0);
  return sum / last.length;
}

function avgMonthlyNetPipeline(entries: LedgerEntry[]): number {
  const series = monthlySeriesChronological(entries);
  if (series.length === 0) return 0;
  const sum = series.reduce((s, m) => s + (m.revenue - m.cost), 0);
  return sum / 12;
}

export type StaleProject = {
  id: string;
  title: string;
  clientLabel: string;
  lastActivity: string | null;
  openCount: number;
  daysQuiet: number;
};

export type MyLiveProject = {
  id: string;
  title: string;
  clientLabel: string;
  companyId: string;
  logoUrl: string | null;
  website: string | null;
  waitingOnYou: number;
  doneCount: number;
  totalCount: number;
  percentComplete: number;
  daysQuiet: number | null;
  offerings: OfferingChip[];
};

export type FounderHomeShellData = {
  rows: WorkHubRow[];
  groupCounts: Record<WorkGroup, number>;
  groupEuro: Record<WorkGroup, number>;
  pipelineEuro: number;
  activePeople: number;
  liveProjects: number;
  companyClients: number;
  companyProspects: number;
  myLive: MyLiveProject[];
  pendingAccess: CompanyMemberRow[];
  stale: StaleProject[];
  staleAfterDays: number;
};

export type FounderHomeBooksData = {
  pillars: Record<LedgerPillar, { revenue: number; cost: number; profit: number }>;
  actualProfit: number;
  pendingDeals: DiscoveredDealRow[];
  runway: {
    cash: number;
    months: number | null;
    monthlyNet: number;
  };
};

export type FounderHomeData = FounderHomeShellData & FounderHomeBooksData;

const GROUPS: WorkGroup[] = [
  "find",
  "qualify",
  "propose",
  "contract",
  "live",
  "done",
  "lose",
];

const OPEN_STATUSES = new Set(["todo", "in_progress", "blocked"]);

function isLiveProjectRow(p: { status?: string | null; stage?: string | null }) {
  if (p.status === "expired" || p.status === "completed" || p.stage === "completed") {
    return false;
  }
  return p.stage === "client" || p.stage === "signed";
}

export async function loadFounderHomeShell(
  supabase: any,
  userId: string
): Promise<FounderHomeShellData> {
  const [
    rows,
    { data: people },
    { data: myPeople },
    { data: sett },
    { data: liveProjectsRows },
    { data: tasks },
    pendingAccess,
  ] = await Promise.all([
    loadWorkHubRows(supabase),
    supabase.from("people").select("id").eq("roster_status", "active"),
    supabase.from("people").select("id").eq("auth_user_id", userId),
    supabase.from("pm_settings").select("stale_after_days").eq("id", 1).maybeSingle(),
    supabase
      .from("projects")
      .select(
        "id, title, status, stage, lead_admin_id, client_id, client:client_id ( company, name, logo_url, website )"
      )
      .or("status.eq.running,stage.eq.client,stage.eq.signed"),
    supabase
      .from("pm_tasks")
      .select("project_id, status, last_activity_at, assignee_id, assignee_person_id")
      .neq("status", "cancelled"),
    loadPendingCompanyAccess(),
  ]);

  const myPersonIds = (myPeople || [])
    .map((p: { id: string }) => p.id)
    .filter(Boolean) as string[];
  const { data: teamMemberships } = myPersonIds.length
    ? await supabase
        .from("project_team_members")
        .select("project_id")
        .in("person_id", myPersonIds)
    : { data: [] as { project_id: string }[] };
  const teamProjectIds = new Set(
    (teamMemberships || []).map((r: { project_id: string }) => r.project_id)
  );

  const groupCounts = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<
    WorkGroup,
    number
  >;
  const groupEuro = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<
    WorkGroup,
    number
  >;
  for (const r of rows) {
    groupCounts[r.group] += 1;
    groupEuro[r.group] += r.dealValue || 0;
  }
  const pipelineEuro = GROUPS.filter((g) => g !== "lose" && g !== "done").reduce(
    (s, g) => s + groupEuro[g],
    0
  );

  const companyClients = rows.filter((r) => r.crmStatus === "Client").length;
  const companyProspects = rows.filter((r) => r.crmStatus === "Prospect").length;
  const liveProjects = (liveProjectsRows || []).filter(isLiveProjectRow).length;

  const personIds = new Set(myPersonIds);
  const involvedIds = new Set<string>();
  const statsByProject = new Map<
    string,
    { waiting: number; done: number; total: number; last: string | null; open: number }
  >();
  for (const t of tasks || []) {
    if (!t.project_id) continue;
    const cur = statsByProject.get(t.project_id) ?? {
      waiting: 0,
      done: 0,
      total: 0,
      last: null,
      open: 0,
    };
    cur.total += 1;
    if (t.status === "done") cur.done += 1;
    if (OPEN_STATUSES.has(t.status)) cur.open += 1;
    const mine =
      t.assignee_id === userId ||
      (t.assignee_person_id && personIds.has(t.assignee_person_id));
    if (mine && OPEN_STATUSES.has(t.status)) {
      cur.waiting += 1;
      involvedIds.add(t.project_id);
    }
    if (
      t.last_activity_at &&
      (!cur.last || new Date(t.last_activity_at) > new Date(cur.last))
    ) {
      cur.last = t.last_activity_at;
    }
    statsByProject.set(t.project_id, cur);
  }

  const staleAfterDays = Number(sett?.stale_after_days || 7);
  const cutoff = Date.now() - staleAfterDays * 86400000;

  function quietDaysFor(projectId: string): number | null {
    const info = statsByProject.get(projectId);
    const last = info?.last ?? null;
    const openCount = info?.open ?? 0;
    const quiet =
      (!last && openCount > 0) || (last && new Date(last).getTime() < cutoff);
    if (!quiet) return null;
    const lastMs = last ? new Date(last).getTime() : 0;
    return lastMs ? Math.floor((Date.now() - lastMs) / 86400000) : staleAfterDays;
  }

  const myLive: MyLiveProject[] = [];
  const seenLive = new Set<string>();
  for (const p of liveProjectsRows || []) {
    if (!isLiveProjectRow(p)) continue;
    const mine =
      involvedIds.has(p.id) ||
      p.lead_admin_id === userId ||
      teamProjectIds.has(p.id);
    if (!mine || seenLive.has(p.id)) continue;
    seenLive.add(p.id);
    const client = Array.isArray(p.client) ? p.client[0] : p.client;
    const st = statsByProject.get(p.id);
    const total = st?.total ?? 0;
    const done = st?.done ?? 0;
    myLive.push({
      id: p.id,
      title: p.title,
      clientLabel: client?.company || client?.name || "—",
      companyId: p.client_id,
      logoUrl: client?.logo_url || null,
      website: client?.website || null,
      waitingOnYou: st?.waiting ?? 0,
      doneCount: done,
      totalCount: total,
      percentComplete: total > 0 ? Math.round((done / total) * 100) : 0,
      daysQuiet: quietDaysFor(p.id),
      offerings: [],
    });
  }
  myLive.sort((a, b) => {
    if (b.waitingOnYou !== a.waitingOnYou) return b.waitingOnYou - a.waitingOnYou;
    const aq = a.daysQuiet ?? -1;
    const bq = b.daysQuiet ?? -1;
    if (bq !== aq) return bq - aq;
    return a.clientLabel.localeCompare(b.clientLabel);
  });

  if (myLive.length) {
    const catalog = await loadCatalogOfferings(supabase);
    const byProject = await loadOfferingsByProjectIds(
      supabase,
      myLive.map((p) => p.id),
      catalog
    );
    for (const p of myLive) {
      p.offerings = byProject.get(p.id) ?? [];
    }
  }

  const stale: StaleProject[] = [];
  for (const p of liveProjectsRows || []) {
    if (!isLiveProjectRow(p)) continue;
    const days = quietDaysFor(p.id);
    if (days == null) continue;
    const info = statsByProject.get(p.id);
    const client = Array.isArray(p.client) ? p.client[0] : p.client;
    stale.push({
      id: p.id,
      title: p.title,
      clientLabel: client?.company || client?.name || "—",
      lastActivity: info?.last ?? null,
      openCount: info?.open ?? 0,
      daysQuiet: days,
    });
  }
  stale.sort((a, b) => b.daysQuiet - a.daysQuiet);

  return {
    rows,
    groupCounts,
    groupEuro,
    pipelineEuro,
    activePeople: (people || []).length,
    liveProjects,
    companyClients,
    companyProspects,
    myLive,
    pendingAccess,
    stale: stale.slice(0, 8),
    staleAfterDays,
  };
}

export async function loadFounderHomeBooks(supabase: any): Promise<FounderHomeBooksData> {
  const fy = fyRange();
  const year = new Date().getFullYear();
  const [actual, identified, unidentified, cashRows, { data: pendingDealRows }] =
    await Promise.all([
      fetchLedgerEntries(supabase, {
        pillar: "actual",
        startDate: fy.startDate,
        endDate: fy.endDate,
      }),
      fetchLedgerEntries(supabase, {
        pillar: "identified",
        startDate: fy.startDate,
        endDate: fy.endDate,
      }),
      fetchLedgerEntries(supabase, {
        pillar: "unidentified",
        startDate: fy.startDate,
        endDate: fy.endDate,
      }),
      fetchCashBalances(supabase, `${year - 1}-01-01`, `${year + 1}-12-31`),
      supabase
        .from("discovered_deals")
        .select(
          "id, fingerprint, company_name, contact_name, role, website, source, signal_summary, signal_url, geography, industry, status, notes, run_at, reviewed_at, bd_record_id"
        )
        .eq("status", "pending")
        .order("run_at", { ascending: false })
        .limit(12),
    ]);

  const actualT = totals(actual);
  const identifiedT = totals(identified);
  const unidentifiedT = totals(unidentified);
  const cash = Number((cashRows as { amount?: number }[]).at(-1)?.amount || 0);
  const actualNet = avgMonthlyNetActual(actual);
  const identifiedNet = avgMonthlyNetPipeline(identified);
  const monthlyNet = actualNet + identifiedNet * 0.5;
  const months =
    monthlyNet >= 0 ? null : cash <= 0 ? 0 : Math.floor(cash / Math.abs(monthlyNet));

  return {
    pillars: {
      actual: actualT,
      identified: identifiedT,
      unidentified: unidentifiedT,
    },
    actualProfit: actualT.profit,
    pendingDeals: (pendingDealRows ?? []).map(mapDealRow),
    runway: {
      cash,
      months,
      monthlyNet,
    },
  };
}

export async function loadFounderHome(
  supabase: any,
  userId: string
): Promise<FounderHomeData> {
  const [shell, books] = await Promise.all([
    loadFounderHomeShell(supabase, userId),
    loadFounderHomeBooks(supabase),
  ]);
  return { ...shell, ...books };
}
