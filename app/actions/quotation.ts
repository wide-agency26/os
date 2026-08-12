"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { notifyBdStakeholders } from "@/lib/bd/notify";
import {
  createLexwareContact,
  createLexwareQuotation,
  findLexwareContact,
  getLexwareQuotation,
  hasLexwareCredentials,
  LEXWARE_NO_ENGAGEMENT_DAYS,
  lexwareQuotationDeeplink,
  type LexwareQuotationLine,
} from "@/lib/bd/lexware";
import {
  addBusinessDays,
  emptyQuotation,
  mergeQuotation,
  type BdQuotationPayload,
} from "@/lib/bd/quotation";
import { runBdClientHandoff } from "@/lib/bd/handoff";
import type { Json } from "@/types/supabase";

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
    return { supabase, user: null, error: "Only founders can manage quotations" };
  }
  return { supabase, user, error: null as string | null };
}

function comingSoonPayload(
  current: BdQuotationPayload
): BdQuotationPayload {
  return {
    ...current,
    status: "coming_soon",
    placeholder: true,
    message:
      "Lexware integration is ready in code — add LEXWARE_API_KEY to enable live contact sync & quotations. Coming soon until then.",
    updated_at: new Date().toISOString(),
  };
}

async function persistQuotation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recordId: string,
  quotation: BdQuotationPayload
) {
  await supabase
    .from("bd_records")
    .update({
      quotation: quotation as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recordId);
}

function linesFromContract(contract: Record<string, unknown>): LexwareQuotationLine[] {
  const items = Array.isArray(contract.line_items)
    ? (contract.line_items as { title?: string; description?: string; price?: number | null }[])
    : [];
  if (items.length === 0) {
    return [
      {
        type: "custom",
        name: "Services per accepted proposal",
        description: "See WIDE contract / proposal.",
        quantity: 1,
        unitName: "Pauschale",
        unitPrice: {
          currency: "EUR",
          netAmount: 0,
          taxRatePercentage: 19,
        },
      },
    ];
  }
  return items.map((li) => ({
    type: "custom" as const,
    name: li.title || "Line item",
    description: li.description || undefined,
    quantity: 1,
    unitName: "Pauschale",
    unitPrice: {
      currency: "EUR" as const,
      netAmount: typeof li.price === "number" ? li.price : 0,
      taxRatePercentage: 19,
    },
  }));
}

export async function getLexwareConnectionStatus(): Promise<{
  configured: boolean;
  message: string;
}> {
  if (hasLexwareCredentials()) {
    return { configured: true, message: "Lexware API key detected." };
  }
  return {
    configured: false,
    message:
      "Coming soon — set LEXWARE_API_KEY (and optional LEXWARE_APP_BASE_URL) in Vercel env.",
  };
}

export async function syncBdLexwareQuotation(input: {
  bdRecordId: string;
  finalize?: boolean;
}): Promise<{ ok: boolean; error?: string; quotation?: BdQuotationPayload }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const { data: rec } = await supabase
    .from("bd_records")
    .select(
      "id, name, company_name, email, phone, linkedin_url, position, company_id, contact_id, owner_id, observer_ids, contract, quotation, stage"
    )
    .eq("id", input.bdRecordId)
    .maybeSingle();
  if (!rec) return { ok: false, error: "Record not found" };

  let quotation = mergeQuotation(
    (rec.quotation as Record<string, unknown>) || emptyQuotation()
  );

  if (!hasLexwareCredentials()) {
    quotation = comingSoonPayload(quotation);
    await persistQuotation(supabase, rec.id, quotation);
    await supabase.from("bd_timeline_entries").insert({
      bd_record_id: rec.id,
      actor_type: "user",
      actor_id: user.id,
      action: "quotation_placeholder",
      note: "Lexware not configured — quotation marked coming soon.",
      meta: {},
    });
    revalidatePath(`/app/bd/quotation/${rec.id}`);
    revalidatePath(`/app/bd/${rec.id}`);
    return { ok: true, quotation };
  }

  // 1) Contact sync (dedup)
  let contactId = quotation.lexware_contact_id;
  if (!contactId) {
    const found = await findLexwareContact({
      email: rec.email,
      name: rec.company_name,
    });
    if (!found.ok) return { ok: false, error: found.error };
    if (found.data?.id) {
      contactId = found.data.id;
    } else {
      const created = await createLexwareContact({
        companyName: rec.company_name,
        contactName: rec.name,
        email: rec.email,
        phone: rec.phone,
      });
      if (!created.ok) return { ok: false, error: created.error };
      contactId = created.data.id;
    }
  }

  // 2) Create quotation if missing
  let quotationId = quotation.lexware_quotation_id;
  let voucherStatus = quotation.voucher_status;
  if (!quotationId) {
    const createdQ = await createLexwareQuotation({
      contactId: contactId!,
      companyName: rec.company_name,
      lineItems: linesFromContract(
        (rec.contract as Record<string, unknown>) || {}
      ),
      finalize: Boolean(input.finalize),
      introduction: `Angebot für ${rec.company_name}`,
    });
    if (!createdQ.ok) return { ok: false, error: createdQ.error };
    quotationId = createdQ.data.id;
    voucherStatus = createdQ.data.voucherStatus || (input.finalize ? "open" : "draft");
  }

  quotation = {
    ...quotation,
    status: input.finalize || voucherStatus === "open" ? "sent" : "draft",
    lexware_contact_id: contactId!,
    lexware_quotation_id: quotationId!,
    voucher_status: voucherStatus,
    deeplink: lexwareQuotationDeeplink(quotationId!),
    sent_at:
      input.finalize || voucherStatus === "open"
        ? quotation.sent_at || new Date().toISOString()
        : quotation.sent_at,
    placeholder: false,
    message: null,
    no_engagement_days: quotation.no_engagement_days || LEXWARE_NO_ENGAGEMENT_DAYS,
    last_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await persistQuotation(supabase, rec.id, quotation);
  if (rec.stage !== "quotation") {
    await supabase
      .from("bd_records")
      .update({
        stage: "quotation",
        stage_entered_at: new Date().toISOString(),
      })
      .eq("id", rec.id);

    const { ensureBdCrmCompanyAndContact } = await import("@/lib/bd/crm-link");
    const linked = await ensureBdCrmCompanyAndContact(supabase, {
      companyName: rec.company_name,
      contactName: rec.name,
      email: rec.email,
      linkedinUrl: rec.linkedin_url,
      position: rec.position,
      stage: "quotation",
      existingCompanyId: rec.company_id,
      existingContactId: rec.contact_id,
      bdRecordId: rec.id,
      sourceHint: "BD quotation",
    });
    if (linked.ok) {
      await supabase
        .from("bd_records")
        .update({
          company_id: linked.link.companyId,
          contact_id: linked.link.contactId,
        })
        .eq("id", rec.id);
    }
  }

  await supabase.from("bd_timeline_entries").insert({
    bd_record_id: rec.id,
    actor_type: "user",
    actor_id: user.id,
    action: "quotation_synced",
    note: input.finalize
      ? "Lexware quotation created & finalized (sent)."
      : "Lexware contact + draft quotation synced.",
    meta: {
      lexware_contact_id: contactId,
      lexware_quotation_id: quotationId,
    },
  });

  if (quotation.status === "sent") {
    await notifyBdStakeholders({
      ownerId: rec.owner_id,
      observerIds: (rec.observer_ids as string[]) || [],
      title: `Quotation sent — ${rec.company_name}`,
      message: `Lexware quotation is open. Track status or open the deeplink.`,
      link: `/app/bd/quotation/${rec.id}`,
      severity: "Info",
    });
  }

  revalidatePath(`/app/bd/quotation/${rec.id}`);
  revalidatePath(`/app/bd/${rec.id}`);
  return { ok: true, quotation };
}

export async function refreshBdLexwareQuotationStatus(input: {
  bdRecordId: string;
}): Promise<{ ok: boolean; error?: string; quotation?: BdQuotationPayload }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const { data: rec } = await supabase
    .from("bd_records")
    .select("id, quotation, owner_id, observer_ids, company_name")
    .eq("id", input.bdRecordId)
    .maybeSingle();
  if (!rec) return { ok: false, error: "Not found" };

  let quotation = mergeQuotation(
    (rec.quotation as Record<string, unknown>) || {}
  );

  if (!hasLexwareCredentials()) {
    quotation = comingSoonPayload(quotation);
    await persistQuotation(supabase, rec.id, quotation);
    return { ok: true, quotation };
  }

  if (!quotation.lexware_quotation_id) {
    return { ok: false, error: "No Lexware quotation linked yet." };
  }

  const got = await getLexwareQuotation(quotation.lexware_quotation_id);
  if (!got.ok) return { ok: false, error: got.error };

  const vs = got.data.voucherStatus || quotation.voucher_status;
  quotation = {
    ...quotation,
    voucher_status: vs,
    voucher_number: got.data.voucherNumber || quotation.voucher_number,
    last_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    placeholder: false,
  };

  if (vs === "accepted") {
    quotation.status = "accepted";
    quotation.accepted_at = quotation.accepted_at || new Date().toISOString();
    await persistQuotation(supabase, rec.id, quotation);
    const handoff = await runBdClientHandoff({
      bdRecordId: rec.id,
      actorId: user.id,
    });
    if (!handoff.ok) return { ok: false, error: handoff.error };
    const { data: refreshed } = await supabase
      .from("bd_records")
      .select("quotation")
      .eq("id", rec.id)
      .maybeSingle();
    quotation = mergeQuotation(
      (refreshed?.quotation as Record<string, unknown>) || quotation
    );
  } else if (vs === "rejected") {
    quotation.status = "rejected";
    await persistQuotation(supabase, rec.id, quotation);
  } else if (vs === "open") {
    quotation.status = "sent";
    await persistQuotation(supabase, rec.id, quotation);
  } else {
    quotation.status = "draft";
    await persistQuotation(supabase, rec.id, quotation);
  }

  revalidatePath(`/app/bd/quotation/${rec.id}`);
  return { ok: true, quotation };
}

/** Manual confirm without Lexware (placeholder / offline path). */
export async function confirmBdQuotationAccepted(input: {
  bdRecordId: string;
}): Promise<{ ok: boolean; error?: string; projectId?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const { data: rec } = await supabase
    .from("bd_records")
    .select("id, quotation")
    .eq("id", input.bdRecordId)
    .maybeSingle();
  if (!rec) return { ok: false, error: "Not found" };

  const quotation = {
    ...mergeQuotation((rec.quotation as Record<string, unknown>) || {}),
    status: "accepted" as const,
    accepted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message: hasLexwareCredentials()
      ? null
      : "Accepted manually while Lexware key is pending.",
  };
  await persistQuotation(supabase, rec.id, quotation);

  const handoff = await runBdClientHandoff({
    bdRecordId: rec.id,
    actorId: user.id,
  });
  if (!handoff.ok) return { ok: false, error: handoff.error };

  revalidatePath(`/app/bd/quotation/${rec.id}`);
  revalidatePath(`/app/bd/${rec.id}`);
  revalidatePath("/app/projects/project");
  return { ok: true, projectId: handoff.projectId };
}

export async function runQuotationNoEngagementAlerts(): Promise<{
  ok: boolean;
  alerted: number;
  error?: string;
}> {
  const admin = (await import("@/utils/supabase/admin")).createAdminClient();
  const { data, error } = await admin
    .from("bd_records")
    .select("id, company_name, name, owner_id, observer_ids, quotation")
    .eq("stage", "quotation");
  if (error) return { ok: false, alerted: 0, error: error.message };

  let alerted = 0;
  const now = new Date();
  for (const row of data ?? []) {
    const q = mergeQuotation((row.quotation as Record<string, unknown>) || {});
    if (q.status !== "sent" && q.status !== "draft" && q.status !== "coming_soon") {
      continue;
    }
    const anchor = q.sent_at || q.updated_at;
    if (!anchor) continue;
    const days = q.no_engagement_days || LEXWARE_NO_ENGAGEMENT_DAYS;
    const due = addBusinessDays(new Date(anchor), days);
    if (due > now) continue;

    q.status = "stale";
    q.last_checked_at = now.toISOString();
    q.updated_at = now.toISOString();
    await admin
      .from("bd_records")
      .update({ quotation: q as unknown as Json })
      .eq("id", row.id);

    await notifyBdStakeholders({
      ownerId: row.owner_id,
      observerIds: (row.observer_ids as string[]) || [],
      title: `Quotation no engagement — ${row.company_name}`,
      message: `${row.name} / ${row.company_name}: quotation has not moved after ~${days} business days.`,
      link: `/app/bd/quotation/${row.id}`,
      severity: "Warning",
      meta: { kind: "quotation_no_engagement", bd_record_id: row.id },
    });
    await admin.from("bd_timeline_entries").insert({
      bd_record_id: row.id,
      actor_type: "system",
      actor_id: null,
      action: "quotation_no_engagement",
      note: `No-engagement alert after ${days} business days.`,
      meta: {},
    });
    alerted += 1;
  }
  return { ok: true, alerted };
}

/** Poll Lexware statuses for open quotations (cron fallback). */
export async function pollLexwareQuotationStatuses(): Promise<{
  ok: boolean;
  checked: number;
  accepted: number;
  error?: string;
}> {
  if (!hasLexwareCredentials()) {
    return { ok: true, checked: 0, accepted: 0 };
  }
  const admin = (await import("@/utils/supabase/admin")).createAdminClient();
  const { data, error } = await admin
    .from("bd_records")
    .select("id, quotation")
    .eq("stage", "quotation");
  if (error) return { ok: false, checked: 0, accepted: 0, error: error.message };

  let checked = 0;
  let accepted = 0;
  for (const row of data ?? []) {
    const q = mergeQuotation((row.quotation as Record<string, unknown>) || {});
    if (!q.lexware_quotation_id) continue;
    const got = await getLexwareQuotation(q.lexware_quotation_id);
    if (!got.ok) continue;
    checked += 1;
    const vs = got.data.voucherStatus;
    if (vs === "accepted") {
      q.status = "accepted";
      q.voucher_status = vs;
      q.accepted_at = q.accepted_at || new Date().toISOString();
      await admin
        .from("bd_records")
        .update({ quotation: q as unknown as Json })
        .eq("id", row.id);
      const handoff = await runBdClientHandoff({ bdRecordId: row.id });
      if (handoff.ok) accepted += 1;
    } else if (vs) {
      q.voucher_status = vs;
      q.last_checked_at = new Date().toISOString();
      if (vs === "rejected") q.status = "rejected";
      else if (vs === "open") q.status = "sent";
      await admin
        .from("bd_records")
        .update({ quotation: q as unknown as Json })
        .eq("id", row.id);
    }
  }
  return { ok: true, checked, accepted };
}
