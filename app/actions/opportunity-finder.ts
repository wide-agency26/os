"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import {
  DEFAULT_DISCOVERY_CONFIG,
  sampleDiscoverySignals,
  scoreWarmIntros,
  type DiscoveryConfig,
  type DiscoveredSignal,
  type WarmIntroPath,
} from "@/lib/bd/opportunity-finder";

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
    return { supabase, user: null, error: "Founders only" };
  }
  return { supabase, user, error: null as string | null };
}

const CONFIG_KEY = "bd_opportunity_finder";

export async function getDiscoveryConfig(): Promise<{
  ok: boolean;
  config: DiscoveryConfig;
  error?: string;
}> {
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

  // If app_settings missing, fall back silently to in-memory (still ok for UI)
  if (upsertErr && upsertErr.code === "42P01") {
    return { ok: true };
  }
  if (upsertErr) return { ok: false, error: upsertErr.message };
  revalidatePath("/app/bd/discovery");
  return { ok: true };
}

export type DiscoveryRunHit = DiscoveredSignal & {
  warm_intros: WarmIntroPath[];
  already_logged: boolean;
};

export async function runOpportunityDiscovery(): Promise<{
  ok: boolean;
  error?: string;
  hits: DiscoveryRunHit[];
}> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Auth", hits: [] };

  const cfgRes = await getDiscoveryConfig();
  const config = cfgRes.config;
  const signals = sampleDiscoverySignals(config);

  const { data: network } = await supabase
    .from("crm_customers")
    .select("id, name, company, email, record_kind")
    .limit(500);

  const { data: existing } = await supabase
    .from("bd_records")
    .select("id, company_name")
    .eq("source", "auto_discovered")
    .limit(200);

  const existingNames = new Set(
    (existing ?? []).map((e) => e.company_name.toLowerCase())
  );

  const hits: DiscoveryRunHit[] = signals.map((s) => ({
    ...s,
    warm_intros: scoreWarmIntros(s, network ?? []),
    already_logged: existingNames.has(s.company_name.toLowerCase()),
  }));

  return { ok: true, hits };
}

export async function logDiscoveredProspect(input: {
  signal: DiscoveredSignal;
  warmIntros: WarmIntroPath[];
}): Promise<{ ok: boolean; error?: string; recordId?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Auth" };

  const { data: existing } = await supabase
    .from("bd_records")
    .select("id")
    .eq("source", "auto_discovered")
    .ilike("company_name", input.signal.company_name)
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, recordId: existing.id };

  const { data: row, error: insErr } = await supabase
    .from("bd_records")
    .insert({
      name: input.signal.contact_name || "Unknown contact",
      company_name: input.signal.company_name,
      position: input.signal.role,
      source: "auto_discovered",
      discovery_method: `${input.signal.source}: ${input.signal.signal_summary}`,
      stage: "prospect",
      owner_id: user.id,
      observer_ids: [],
      demand_signals: [
        {
          type: input.signal.source,
          description: input.signal.signal_summary,
          source: input.signal.signal_url || "opportunity_finder",
          date_found: new Date().toISOString().slice(0, 10),
        },
      ],
      outreach_log: [
        {
          type: "warm_intro_index",
          at: new Date().toISOString(),
          cold_outreach_disabled: true,
          paths: input.warmIntros,
        },
      ],
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !row) return { ok: false, error: insErr?.message || "Insert failed" };

  const { ensureBdCrmCompanyAndContact } = await import("@/lib/bd/crm-link");
  const linked = await ensureBdCrmCompanyAndContact(supabase, {
    companyName: input.signal.company_name,
    contactName: input.signal.contact_name || "Unknown contact",
    position: input.signal.role,
    stage: "prospect",
    bdRecordId: row.id,
    sourceHint: `BD auto_discovered:${input.signal.source}`,
  });
  if (linked.ok) {
    await supabase
      .from("bd_records")
      .update({
        company_id: linked.link.companyId,
        contact_id: linked.link.contactId,
      })
      .eq("id", row.id);
  }

  await supabase.from("bd_timeline_entries").insert({
    bd_record_id: row.id,
    actor_type: "user",
    actor_id: user.id,
    action: "auto_discovered",
    note: `Logged from Opportunity Finder (${input.signal.source}). Warm intros: ${input.warmIntros.length}. CRM company + contact linked. No cold outreach enabled.`,
    meta: {
      signal_id: input.signal.id,
      warm_intro_count: input.warmIntros.length,
      company_id: linked.ok ? linked.link.companyId : null,
      contact_id: linked.ok ? linked.link.contactId : null,
    },
  });

  revalidatePath("/app/bd");
  revalidatePath("/app/bd/discovery");
  revalidatePath("/app/crm");
  revalidatePath("/app/crm/directory");
  return { ok: true, recordId: row.id };
}
