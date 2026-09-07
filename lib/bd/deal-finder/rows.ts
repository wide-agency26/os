/* eslint-disable @typescript-eslint/no-explicit-any */

export type DiscoveredDealRow = {
  id: string;
  fingerprint: string;
  companyName: string;
  contactName: string | null;
  role: string | null;
  website: string | null;
  source: string;
  signalSummary: string;
  signalUrl: string | null;
  geography: string | null;
  industry: string | null;
  status: "pending" | "approved" | "dismissed";
  notes: string | null;
  runAt: string;
  reviewedAt: string | null;
  bdRecordId: string | null;
};

export function mapDealRow(row: any): DiscoveredDealRow {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    companyName: row.company_name,
    contactName: row.contact_name ?? null,
    role: row.role ?? null,
    website: row.website ?? null,
    source: row.source,
    signalSummary: row.signal_summary ?? "",
    signalUrl: row.signal_url ?? null,
    geography: row.geography ?? null,
    industry: row.industry ?? null,
    status: row.status,
    notes: row.notes ?? null,
    runAt: row.run_at,
    reviewedAt: row.reviewed_at ?? null,
    bdRecordId: row.bd_record_id ?? null,
  };
}

export async function loadPendingDeals(supabase: any): Promise<DiscoveredDealRow[]> {
  const { data, error } = await supabase
    .from("discovered_deals")
    .select("*")
    .eq("status", "pending")
    .order("run_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[deal-finder] pending", error.message);
    return [];
  }
  return (data ?? []).map(mapDealRow);
}

export async function loadDealFinderHistory(supabase: any): Promise<{
  deals: DiscoveredDealRow[];
  lastRunAt: string | null;
  lastSummary: string | null;
}> {
  const [{ data: deals, error: dealsErr }, { data: run, error: runErr }] =
    await Promise.all([
      supabase
        .from("discovered_deals")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(40),
      supabase
        .from("discovered_deal_runs")
        .select("ran_at, summary, error, new_count")
        .order("ran_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if (dealsErr) console.error("[deal-finder] history", dealsErr.message);
  if (runErr) console.error("[deal-finder] last run", runErr.message);
  return {
    deals: (deals ?? []).map(mapDealRow),
    lastRunAt: run?.ran_at ?? null,
    lastSummary: run?.error || run?.summary || null,
  };
}
