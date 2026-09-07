import { createClient } from "@/utils/supabase/server";
import { firstOfMonth } from "@/lib/accounting/types";
import {
  asFinanceFrequency,
  financeCoveredMonths,
  yearMonthKey,
} from "@/lib/accounting/finance";
import { isLoseStage } from "@/lib/work/stages";

type Sb = any;

function monthStart(d = new Date()): string {
  return firstOfMonth(d.getFullYear(), d.getMonth() + 1);
}

async function upsertBySyncKey(
  supabase: Sb,
  row: Record<string, unknown>
): Promise<{ error: string | null }> {
  const syncKey = row.sync_key as string;
  const { data: existing } = await supabase
    .from("ledger_entries")
    .select("id")
    .eq("sync_key", syncKey)
    .maybeSingle();
  if (existing?.id) {
    const patch = { ...row };
    delete patch.sync_key;
    const { error } = await supabase
      .from("ledger_entries")
      .update(patch)
      .eq("id", existing.id);
    return { error: error?.message ?? null };
  }
  const { error } = await supabase.from("ledger_entries").insert([row]);
  return { error: error?.message ?? null };
}

const PROJECT_OWNS_STAGES = new Set(["lead", "client", "signed", "completed"]);

/**
 * Pipeline-card estimates → Unidentified.
 * Skip when a SOW/project already owns the euros, or the card is live/lost.
 */
export async function syncCrmUnidentifiedLedger(): Promise<{
  ok: boolean;
  error?: string;
  upserted?: number;
  pruned?: number;
}> {
  const supabase = (await createClient()) as Sb;
  const year = new Date().getFullYear();
  const [{ data: cards, error }, { data: projects }] = await Promise.all([
    supabase
      .from("bd_records")
      .select(
        "id, name, company_name, company_id, stage, estimate_amount, estimate_service, estimate_frequency, estimate_start_date, estimate_end_date"
      )
      .gt("estimate_amount", 0),
    supabase
      .from("projects")
      .select("id, client_id, bd_record_id, stage, status, deal_value"),
  ]);
  if (error) return { ok: false, error: error.message };

  const claimedBd = new Set<string>();
  const claimedCompany = new Set<string>();
  for (const p of projects || []) {
    if (p.bd_record_id) claimedBd.add(p.bd_record_id);
    const owns =
      p.status !== "expired" &&
      p.status !== "completed" &&
      (PROJECT_OWNS_STAGES.has(p.stage || "") || p.status === "running");
    if (owns && p.client_id) claimedCompany.add(p.client_id);
  }

  const activeKeys = new Set<string>();
  let upserted = 0;

  for (const card of cards || []) {
    if (isLoseStage(card.stage) || card.stage === "client_won") continue;
    if (claimedBd.has(card.id)) continue;
    if (card.company_id && claimedCompany.has(card.company_id)) continue;
    const amount = Number(card.estimate_amount || 0);
    if (!(amount > 0)) continue;

    const from = card.estimate_start_date || monthStart();
    const months = financeCoveredMonths(
      asFinanceFrequency(card.estimate_frequency),
      from,
      card.estimate_end_date,
      year
    );
    const service = (card.estimate_service || "").trim();
    const label = card.company_name || card.name || "Prospect";
    const category = service
      ? `Prospect — ${label} · ${service}`
      : `Prospect — ${label}`;

    for (const month of months) {
      const syncKey = `auto_crm:rev:${card.id}:${yearMonthKey(year, month)}`;
      activeKeys.add(syncKey);
      const { error: upErr } = await upsertBySyncKey(supabase, {
        sync_key: syncKey,
        pillar: "unidentified",
        type: "revenue",
        amount,
        entry_date: firstOfMonth(year, month),
        company_id: card.company_id || null,
        client_id: card.company_id || null,
        project_id: null,
        person_id: null,
        category,
        source: "auto_crm",
        updated_at: new Date().toISOString(),
      });
      if (upErr) return { ok: false, error: upErr };
      upserted += 1;
    }
  }

  const { data: existingRows } = await supabase
    .from("ledger_entries")
    .select("id, sync_key")
    .eq("source", "auto_crm");
  let pruned = 0;
  for (const row of existingRows || []) {
    if (row.sync_key && !activeKeys.has(row.sync_key)) {
      await supabase.from("ledger_entries").delete().eq("id", row.id);
      pruned += 1;
    }
  }

  return { ok: true, upserted, pruned };
}

export async function pruneCrmUnidentifiedForCompany(
  companyId: string
): Promise<void> {
  const supabase = (await createClient()) as Sb;
  await supabase
    .from("ledger_entries")
    .delete()
    .eq("source", "auto_crm")
    .eq("company_id", companyId);
}

export async function pruneCrmUnidentifiedForBd(bdId: string): Promise<void> {
  const supabase = (await createClient()) as Sb;
  await supabase
    .from("ledger_entries")
    .delete()
    .eq("source", "auto_crm")
    .like("sync_key", `auto_crm:rev:${bdId}:%`);
}
