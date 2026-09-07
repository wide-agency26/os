/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from "@/utils/supabase/admin";
import {
  DEFAULT_DISCOVERY_CONFIG,
  type DiscoveryConfig,
} from "@/lib/bd/opportunity-finder";
import { collectDiscoveryFeeds } from "./feeds";
import { extractDealsFromFeeds } from "./extract";
import { companyFingerprint } from "./fingerprint";

export type { DiscoveredDealRow } from "./rows";
export { mapDealRow, loadPendingDeals, loadDealFinderHistory } from "./rows";

const CONFIG_KEY = "bd_opportunity_finder";

export type DealFinderRunResult = {
  ok: boolean;
  newCount: number;
  skippedCount: number;
  feedCount: number;
  error?: string;
  pendingIds: string[];
};

async function loadConfig(supabase: any): Promise<DiscoveryConfig> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", CONFIG_KEY)
    .maybeSingle();
  if (!data?.value || typeof data.value !== "object") return DEFAULT_DISCOVERY_CONFIG;
  return { ...DEFAULT_DISCOVERY_CONFIG, ...(data.value as DiscoveryConfig) };
}

function blockedNames(rows: { name?: string | null; company?: string | null; company_name?: string | null }[]) {
  const set = new Set<string>();
  for (const row of rows) {
    for (const raw of [row.name, row.company, row.company_name]) {
      const fp = companyFingerprint(raw || "");
      if (fp) set.add(fp);
    }
  }
  return set;
}

export async function runDealFinder(): Promise<DealFinderRunResult> {
  const empty: DealFinderRunResult = {
    ok: true,
    newCount: 0,
    skippedCount: 0,
    feedCount: 0,
    pendingIds: [],
  };

  let supabase: any;
  try {
    supabase = createAdminClient() as any;
    const config = await loadConfig(supabase);
    const { items, feedCount } = await collectDiscoveryFeeds(config);
    const extracted = await extractDealsFromFeeds(items, config);

    const [{ data: knownDeals }, { data: crm }, { data: bd }] = await Promise.all([
      supabase.from("discovered_deals").select("fingerprint, company_name"),
      supabase
        .from("crm_customers")
        .select("name, company")
        .eq("record_kind", "company")
        .limit(2000),
      supabase.from("bd_records").select("company_name").limit(2000),
    ]);

    const skip = new Set<string>([
      ...((knownDeals ?? []).map((d: any) => d.fingerprint).filter(Boolean)),
      ...blockedNames(crm ?? []),
      ...blockedNames(bd ?? []),
    ]);

    const pendingIds: string[] = [];
    let skippedCount = 0;
    const now = new Date().toISOString();

    for (const deal of extracted) {
      const fingerprint = companyFingerprint(deal.company_name);
      if (!fingerprint || skip.has(fingerprint)) {
        skippedCount += 1;
        continue;
      }
      skip.add(fingerprint);
      const { data, error } = await supabase
        .from("discovered_deals")
        .insert({
          fingerprint,
          company_name: deal.company_name,
          contact_name: deal.contact_name,
          role: deal.role,
          website: deal.website,
          source: deal.source,
          signal_summary: deal.signal_summary,
          signal_url: deal.signal_url,
          geography: deal.geography,
          industry: deal.industry,
          status: "pending",
          run_at: now,
          raw: { extracted: true },
        })
        .select("id")
        .maybeSingle();
      if (error || !data) {
        skippedCount += 1;
        continue;
      }
      pendingIds.push(data.id);
    }

    await supabase.from("discovered_deal_runs").insert({
      ran_at: now,
      new_count: pendingIds.length,
      skipped_count: skippedCount,
      feed_count: feedCount,
      summary:
        pendingIds.length > 0
          ? `${pendingIds.length} new prospect${pendingIds.length === 1 ? "" : "s"} to review`
          : feedCount
            ? "No new prospects after filters"
            : "Feeds returned nothing",
    });

    if (pendingIds.length > 0) {
      await supabase.from("founder_notifications").insert({
        title:
          pendingIds.length === 1
            ? "1 new prospect from Deal Finder"
            : `${pendingIds.length} new prospects from Deal Finder`,
        message: "Review on Home — approve after edits to send them into Qualify.",
        severity_level: "Info",
        link: "/app/home#deal-finder",
        meta: { kind: "deal_finder", deal_ids: pendingIds, ran_at: now },
      });
    }

    return {
      ok: true,
      newCount: pendingIds.length,
      skippedCount,
      feedCount,
      pendingIds,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Deal finder failed";
    try {
      await supabase.from("discovered_deal_runs").insert({
        new_count: 0,
        skipped_count: 0,
        feed_count: 0,
        error,
        summary: error,
      });
    } catch {
      /* ignore */
    }
    return { ...empty, ok: false, error };
  }
}
