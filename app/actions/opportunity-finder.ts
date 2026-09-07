"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import {
  DEFAULT_DISCOVERY_CONFIG,
  type DiscoveryConfig,
} from "@/lib/bd/opportunity-finder";
import { revalidateWork } from "@/lib/work/revalidate";
import {
  loadDealFinderHistory,
  loadPendingDeals,
  mapDealRow,
  type DiscoveredDealRow,
} from "@/lib/bd/deal-finder/rows";

async function requireFounder() {
  const supabase = (await createClient()) as any;
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
    return { supabase, user: null, error: "Founders only" };
  }
  return { supabase, user, error: null as string | null };
}

const CONFIG_KEY = "bd_opportunity_finder";

function revalidateFinder() {
  revalidatePath("/app/home");
  revalidatePath("/app/tools/find");
  revalidatePath("/app/work/find");
  revalidateWork();
}

export async function getDiscoveryConfig(): Promise<{
  ok: boolean;
  config: DiscoveryConfig;
  error?: string;
}> {
  try {
    const { supabase, error } = await requireFounder();
    if (error) return { ok: false, config: DEFAULT_DISCOVERY_CONFIG, error };

    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", CONFIG_KEY)
      .maybeSingle();

    if (!data?.value || typeof data.value !== "object") {
      return { ok: true, config: DEFAULT_DISCOVERY_CONFIG };
    }
    return {
      ok: true,
      config: { ...DEFAULT_DISCOVERY_CONFIG, ...(data.value as DiscoveryConfig) },
    };
  } catch (e) {
    return {
      ok: false,
      config: DEFAULT_DISCOVERY_CONFIG,
      error: e instanceof Error ? e.message : "Config failed to load",
    };
  }
}

export async function saveDiscoveryConfig(
  config: DiscoveryConfig
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const next = { ...config, updated_at: new Date().toISOString() };
  const { error: upsertErr } = await supabase.from("app_settings").upsert(
    {
      key: CONFIG_KEY,
      value: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (upsertErr && upsertErr.code === "42P01") {
    return { ok: true };
  }
  if (upsertErr) return { ok: false, error: upsertErr.message };
  revalidateFinder();
  return { ok: true };
}

export async function runOpportunityDiscovery(): Promise<{
  ok: boolean;
  error?: string;
  newCount: number;
  skippedCount: number;
  feedCount: number;
}> {
  const { error } = await requireFounder();
  if (error) {
    return { ok: false, error, newCount: 0, skippedCount: 0, feedCount: 0 };
  }
  const result = await (async () => {
    try {
      const { runDealFinder } = await import("@/lib/bd/deal-finder/run");
      return await runDealFinder();
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Deal finder failed",
        newCount: 0,
        skippedCount: 0,
        feedCount: 0,
      };
    }
  })();
  revalidateFinder();
  return {
    ok: result.ok,
    error: result.error,
    newCount: result.newCount,
    skippedCount: result.skippedCount,
    feedCount: result.feedCount,
  };
}

export async function getDealFinderQueue(): Promise<{
  ok: boolean;
  pending: DiscoveredDealRow[];
  deals: DiscoveredDealRow[];
  lastRunAt: string | null;
  lastSummary: string | null;
  error?: string;
}> {
  try {
    const { supabase, error } = await requireFounder();
    if (error) {
      return {
        ok: false,
        pending: [],
        deals: [],
        lastRunAt: null,
        lastSummary: null,
        error,
      };
    }
    const [pending, history] = await Promise.all([
      loadPendingDeals(supabase),
      loadDealFinderHistory(supabase),
    ]);
    return {
      ok: true,
      pending,
      deals: history.deals,
      lastRunAt: history.lastRunAt,
      lastSummary: history.lastSummary,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Deal Finder failed to load";
    console.error("[deal-finder] queue", e);
    return {
      ok: false,
      pending: [],
      deals: [],
      lastRunAt: null,
      lastSummary: null,
      error: message,
    };
  }
}

export async function updateDiscoveredDeal(input: {
  id: string;
  companyName?: string;
  contactName?: string | null;
  role?: string | null;
  website?: string | null;
  signalSummary?: string;
  geography?: string | null;
  industry?: string | null;
  notes?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const { error: upd } = await supabase
    .from("discovered_deals")
    .update({
      company_name: input.companyName?.trim() || undefined,
      contact_name: input.contactName === undefined ? undefined : input.contactName?.trim() || null,
      role: input.role === undefined ? undefined : input.role?.trim() || null,
      website: input.website === undefined ? undefined : input.website?.trim() || null,
      signal_summary: input.signalSummary?.trim() || undefined,
      geography: input.geography === undefined ? undefined : input.geography?.trim() || null,
      industry: input.industry === undefined ? undefined : input.industry?.trim() || null,
      notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("status", "pending");
  if (upd) return { ok: false, error: upd.message };
  revalidateFinder();
  return { ok: true };
}

export async function dismissDiscoveredDeal(id: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Auth" };

  const { error: upd } = await supabase
    .from("discovered_deals")
    .update({
      status: "dismissed",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");
  if (upd) return { ok: false, error: upd.message };
  revalidateFinder();
  return { ok: true };
}

export async function approveDiscoveredDeal(input: {
  id: string;
  companyName: string;
  contactName?: string | null;
  role?: string | null;
  website?: string | null;
  signalSummary?: string;
  geography?: string | null;
  industry?: string | null;
}): Promise<{ ok: boolean; error?: string; recordId?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Auth" };

  const { data: row } = await supabase
    .from("discovered_deals")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (!row || row.status !== "pending") {
    return { ok: false, error: "This prospect is no longer waiting for review." };
  }

  const deal = mapDealRow({
    ...row,
    company_name: input.companyName.trim() || row.company_name,
    contact_name: input.contactName?.trim() || row.contact_name,
    role: input.role?.trim() || row.role,
    website: input.website?.trim() || row.website,
    signal_summary: input.signalSummary?.trim() || row.signal_summary,
    geography: input.geography?.trim() || row.geography,
    industry: input.industry?.trim() || row.industry,
  });

  const company = deal.companyName.trim();
  const contact = (deal.contactName || "Unknown contact").trim();
  if (!company) return { ok: false, error: "Company name is required" };

  const { data: existing } = await supabase
    .from("bd_records")
    .select("id")
    .ilike("company_name", company)
    .limit(1)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("discovered_deals")
      .update({
        status: "approved",
        company_name: company,
        contact_name: contact,
        role: deal.role,
        website: deal.website,
        signal_summary: deal.signalSummary,
        geography: deal.geography,
        industry: deal.industry,
        bd_record_id: existing.id,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    revalidateFinder();
    return { ok: true, recordId: existing.id };
  }

  const { data: created, error: insErr } = await supabase
    .from("bd_records")
    .insert({
      name: contact,
      company_name: company,
      position: deal.role,
      source: "auto_discovered",
      discovery_method: `${deal.source}: ${deal.signalSummary}`,
      stage: "prospect",
      stage_entered_at: new Date().toISOString(),
      owner_id: user.id,
      observer_ids: [],
      demand_signals: [
        {
          type: deal.source,
          description: deal.signalSummary,
          source: deal.signalUrl || "deal_finder",
          date_found: new Date().toISOString().slice(0, 10),
        },
      ],
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !created) {
    return { ok: false, error: insErr?.message || "Could not create prospect" };
  }

  const { ensureBdCrmCompanyAndContact } = await import("@/lib/bd/crm-link");
  const linked = await ensureBdCrmCompanyAndContact(supabase, {
    companyName: company,
    contactName: contact,
    position: deal.role,
    stage: "prospect",
    bdRecordId: created.id,
    sourceHint: `BD auto_discovered:${deal.source}`,
  });
  if (linked.ok) {
    await supabase.from("bd_records").update({
      company_id: linked.link.companyId,
      contact_id: linked.link.contactId,
    }).eq("id", created.id);
    if (deal.website) {
      await supabase
        .from("crm_customers")
        .update({ website: deal.website })
        .eq("id", linked.link.companyId)
        .is("website", null);
    }
  }

  await supabase.from("bd_timeline_entries").insert({
    bd_record_id: created.id,
    actor_type: "user",
    actor_id: user.id,
    action: "auto_discovered",
    note: `Approved from Deal Finder (${deal.source}). Sent to Qualify as a prospect.`,
    meta: {
      discovered_deal_id: input.id,
      company_id: linked.ok ? linked.link.companyId : null,
      contact_id: linked.ok ? linked.link.contactId : null,
    },
  });

  await supabase
    .from("discovered_deals")
    .update({
      status: "approved",
      company_name: company,
      contact_name: contact,
      role: deal.role,
      website: deal.website,
      signal_summary: deal.signalSummary,
      geography: deal.geography,
      industry: deal.industry,
      bd_record_id: created.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (deal.industry) {
    const cfg = await getDiscoveryConfig();
    if (cfg.ok) {
      const industries = cfg.config.industries;
      const exists = industries.some(
        (i) => i.toLowerCase() === deal.industry!.toLowerCase()
      );
      if (!exists) {
        await saveDiscoveryConfig({
          ...cfg.config,
          industries: [...industries, deal.industry],
        });
      }
    }
  }

  revalidateFinder();
  revalidatePath("/app/crm");
  revalidatePath(`/app/work/qualify/${created.id}`);
  return { ok: true, recordId: created.id };
}

export type { DiscoveredDealRow };
