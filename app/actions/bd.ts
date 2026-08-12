"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { BD_STAGE_LABELS, isBdStage } from "@/lib/bd/constants";
import { mapBdRecord, mapTimelineEntry } from "@/lib/bd/load";
import type {
  BdBoardFilters,
  BdDemandSignal,
  BdLegitimacyStatus,
  BdRecord,
  BdSource,
  BdStage,
  BdStaffOption,
  BdTimelineEntry,
} from "@/lib/bd/types";
import type { Json, Database } from "@/types/supabase";
import {
  computeQualificationAdvice,
  type BdQualificationRecommendation,
} from "@/lib/bd/qualification";

type BdRecordUpdate = Database["public"]["Tables"]["bd_records"]["Update"];

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
    return { supabase, user: null, error: "Only founders can manage BD records" };
  }
  return { supabase, user, error: null as string | null };
}

function revalidateBd(id?: string) {
  revalidatePath("/app/bd");
  revalidatePath("/app/bd/dashboard");
  revalidatePath("/app/bd/qualification");
  if (id) {
    revalidatePath(`/app/bd/${id}`);
    revalidatePath(`/app/bd/qualification/${id}`);
  }
}

async function appendTimeline(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    recordId: string;
    actorId: string | null;
    actorType?: "user" | "system";
    action: string;
    note?: string | null;
    meta?: Json;
  }
) {
  await supabase.from("bd_timeline_entries").insert({
    bd_record_id: opts.recordId,
    actor_type: opts.actorType ?? "user",
    actor_id: opts.actorId,
    action: opts.action,
    note: opts.note ?? null,
    meta: opts.meta ?? {},
  });
}

export async function listBdStaff(): Promise<{
  ok: boolean;
  error?: string;
  staff: BdStaffOption[];
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error, staff: [] };

  const { data, error: qErr } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", [
      "superadmin",
      "admin",
      "bd_manager",
      "client_manager",
      "hr_manager",
      "accountant",
    ])
    .order("full_name");

  if (qErr) return { ok: false, error: qErr.message, staff: [] };
  return {
    ok: true,
    staff: (data ?? []).map((p) => ({ id: p.id, full_name: p.full_name })),
  };
}

export async function listBdRecords(filters: BdBoardFilters = {}): Promise<{
  ok: boolean;
  error?: string;
  records: BdRecord[];
  staff: BdStaffOption[];
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error, records: [], staff: [] };

  const staffRes = await listBdStaff();
  const staff = staffRes.staff;
  const staffById = new Map(staff.map((s) => [s.id, s]));

  // Board/qualification lists omit heavy JSON blobs (proposal/contract/quotation/etc).
  let query = supabase
    .from("bd_records")
    .select(
      `
      id, name, company_name, position, email, phone, linkedin_url,
      company_id, contact_id, source, discovery_method, stage, stage_entered_at,
      owner_id, observer_ids, legitimacy_status, legitimacy_reason, demand_signals,
      archived_reason, next_action_due, next_action_label, sort_order,
      created_by, created_at, updated_at,
      owner:profiles!bd_records_owner_id_fkey ( id, full_name )
    `
    )
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(500);

  if (filters.ownerId) query = query.eq("owner_id", filters.ownerId);
  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }
  if (filters.stage && filters.stage !== "all") {
    query = query.eq("stage", filters.stage);
  }
  if (filters.legitimacy === "unset") {
    query = query.is("legitimacy_status", null);
  } else if (filters.legitimacy && filters.legitimacy !== "all") {
    query = query.eq("legitimacy_status", filters.legitimacy);
  }

  const { data, error: qErr } = await query;
  if (qErr) return { ok: false, error: qErr.message, records: [], staff };

  return {
    ok: true,
    staff,
    records: (data ?? []).map((row) => mapBdRecord(row, staffById)),
  };
}

export async function getBdRecord(id: string): Promise<{
  ok: boolean;
  error?: string;
  record?: BdRecord;
  timeline?: BdTimelineEntry[];
  staff?: BdStaffOption[];
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const staffRes = await listBdStaff();
  const staff = staffRes.staff;
  const staffById = new Map(staff.map((s) => [s.id, s]));

  const { data, error: qErr } = await supabase
    .from("bd_records")
    .select(
      `
      *,
      owner:profiles!bd_records_owner_id_fkey ( id, full_name )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (qErr) return { ok: false, error: qErr.message };
  if (!data) return { ok: false, error: "Record not found" };

  const { data: timelineRows } = await supabase
    .from("bd_timeline_entries")
    .select("*, profiles:actor_id ( id, full_name )")
    .eq("bd_record_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  const record = mapBdRecord(data, staffById);
  record.timeline = (timelineRows ?? []).map(mapTimelineEntry);

  return {
    ok: true,
    record,
    timeline: record.timeline,
    staff,
  };
}

export async function createBdRecord(input: {
  name: string;
  company_name: string;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  owner_id: string;
  observer_ids?: string[];
  stage?: BdStage;
  next_action_due?: string | null;
  next_action_label?: string | null;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const name = input.name.trim();
  const company = input.company_name.trim();
  if (!name || !company) {
    return { ok: false, error: "Name and company are required" };
  }
  if (!input.owner_id) return { ok: false, error: "Owner is required" };

  const observers = (input.observer_ids ?? []).filter(
    (id) => id && id !== input.owner_id
  );
  const stage: BdStage =
    input.stage && isBdStage(input.stage) ? input.stage : "prospect";

  const { data, error: insErr } = await supabase
    .from("bd_records")
    .insert({
      name,
      company_name: company,
      position: input.position?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      linkedin_url: input.linkedin_url?.trim() || null,
      owner_id: input.owner_id,
      observer_ids: observers,
      source: "manual" satisfies BdSource,
      stage,
      stage_entered_at: new Date().toISOString(),
      next_action_due: input.next_action_due || null,
      next_action_label: input.next_action_label?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !data) return { ok: false, error: insErr?.message ?? "Create failed" };

  const { ensureBdCrmCompanyAndContact } = await import("@/lib/bd/crm-link");
  const linked = await ensureBdCrmCompanyAndContact(supabase, {
    companyName: company,
    contactName: name,
    email: input.email?.trim() || null,
    linkedinUrl: input.linkedin_url?.trim() || null,
    position: input.position?.trim() || null,
    stage,
    bdRecordId: data.id,
    sourceHint: "BD manual",
  });
  if (!linked.ok) {
    // Soft-fail CRM: keep BD record, surface error
    await appendTimeline(supabase, {
      recordId: data.id,
      actorId: user.id,
      action: "crm_link_failed",
      note: linked.error,
      meta: {},
    });
  } else {
    await supabase
      .from("bd_records")
      .update({
        company_id: linked.link.companyId,
        contact_id: linked.link.contactId,
      })
      .eq("id", data.id);
  }

  await appendTimeline(supabase, {
    recordId: data.id,
    actorId: user.id,
    action: "created",
    note: linked.ok
      ? `Record created in ${BD_STAGE_LABELS[stage]} · CRM company + contact linked`
      : `Record created in ${BD_STAGE_LABELS[stage]}`,
    meta: {
      stage,
      company_id: linked.ok ? linked.link.companyId : null,
      contact_id: linked.ok ? linked.link.contactId : null,
    },
  });

  revalidateBd(data.id);
  revalidatePath("/app/crm");
  revalidatePath("/app/crm/directory");
  return { ok: true, id: data.id };
}

export async function updateBdRecord(input: {
  id: string;
  name?: string;
  company_name?: string;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  owner_id?: string;
  observer_ids?: string[];
  next_action_due?: string | null;
  next_action_label?: string | null;
  legitimacy_status?: BdLegitimacyStatus | null;
  legitimacy_reason?: string | null;
  demand_signals?: BdDemandSignal[];
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const { data: existing } = await supabase
    .from("bd_records")
    .select(
      "id, owner_id, observer_ids, name, company_name, email, phone, linkedin_url, position, company_id, contact_id, stage"
    )
    .eq("id", input.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Record not found" };

  const patch: BdRecordUpdate = {};
  if (input.name !== undefined) {
    const v = input.name.trim();
    if (!v) return { ok: false, error: "Name is required" };
    patch.name = v;
  }
  if (input.company_name !== undefined) {
    const v = input.company_name.trim();
    if (!v) return { ok: false, error: "Company is required" };
    patch.company_name = v;
  }
  if (input.position !== undefined) patch.position = input.position?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.linkedin_url !== undefined) {
    patch.linkedin_url = input.linkedin_url?.trim() || null;
  }
  if (input.owner_id !== undefined) {
    if (!input.owner_id) return { ok: false, error: "Owner is required" };
    patch.owner_id = input.owner_id;
  }
  if (input.observer_ids !== undefined) {
    const ownerId = patch.owner_id || existing.owner_id;
    patch.observer_ids = input.observer_ids.filter((id) => id && id !== ownerId);
  }
  if (input.next_action_due !== undefined) {
    patch.next_action_due = input.next_action_due || null;
  }
  if (input.next_action_label !== undefined) {
    patch.next_action_label = input.next_action_label?.trim() || null;
  }
  if (input.legitimacy_status !== undefined) {
    patch.legitimacy_status = input.legitimacy_status;
  }
  if (input.legitimacy_reason !== undefined) {
    patch.legitimacy_reason = input.legitimacy_reason?.trim() || null;
  }
  if (input.demand_signals !== undefined) {
    patch.demand_signals = input.demand_signals as unknown as Json;
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error: updErr } = await supabase
    .from("bd_records")
    .update(patch)
    .eq("id", input.id);
  if (updErr) return { ok: false, error: updErr.message };

  const nextName = (patch.name as string | undefined) ?? existing.name;
  const nextCompany =
    (patch.company_name as string | undefined) ?? existing.company_name;
  const nextEmail =
    patch.email !== undefined ? (patch.email as string | null) : existing.email;
  const nextLinkedin =
    patch.linkedin_url !== undefined
      ? (patch.linkedin_url as string | null)
      : existing.linkedin_url;
  const nextPosition =
    patch.position !== undefined
      ? (patch.position as string | null)
      : existing.position;

  const missingCrm = !existing.company_id || !existing.contact_id;
  const identityDiffers =
    nextName !== existing.name ||
    nextCompany !== existing.company_name ||
    nextEmail !== existing.email ||
    nextLinkedin !== existing.linkedin_url ||
    nextPosition !== existing.position;

  if (missingCrm || identityDiffers) {
    const { ensureBdCrmCompanyAndContact } = await import("@/lib/bd/crm-link");
    const linked = await ensureBdCrmCompanyAndContact(supabase, {
      companyName: nextCompany,
      contactName: nextName,
      email: nextEmail,
      linkedinUrl: nextLinkedin,
      position: nextPosition,
      stage: existing.stage,
      existingCompanyId: existing.company_id,
      existingContactId: existing.contact_id,
      bdRecordId: existing.id,
      sourceHint: "BD",
    });
    if (linked.ok) {
      await supabase
        .from("bd_records")
        .update({
          company_id: linked.link.companyId,
          contact_id: linked.link.contactId,
        })
        .eq("id", input.id);
    }
  }

  const notes: string[] = [];
  if (patch.owner_id && patch.owner_id !== existing.owner_id) {
    notes.push("Owner changed");
  }
  if (patch.observer_ids) notes.push("Observers updated");
  if (patch.name || patch.company_name) notes.push("Contact details updated");
  if (patch.next_action_due !== undefined || patch.next_action_label !== undefined) {
    notes.push("Next action updated");
  }
  if (missingCrm || identityDiffers) notes.push("CRM company/contact synced");

  await appendTimeline(supabase, {
    recordId: input.id,
    actorId: user.id,
    action: "updated",
    note: notes.join(" · ") || "Record updated",
    meta: { fields: Object.keys(patch) },
  });

  revalidateBd(input.id);
  revalidatePath("/app/crm");
  revalidatePath("/app/crm/directory");
  return { ok: true };
}

export async function moveBdRecordStage(input: {
  id: string;
  stage: BdStage;
  note?: string | null;
  archived_reason?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  if (!isBdStage(input.stage)) return { ok: false, error: "Invalid stage" };

  const { data: existing } = await supabase
    .from("bd_records")
    .select(
      "id, stage, archived_reason, name, company_name, email, linkedin_url, position, company_id, contact_id"
    )
    .eq("id", input.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Record not found" };
  if (existing.stage === input.stage) return { ok: true };

  const sideWithReason = ["archived", "declined"].includes(input.stage);
  const reason =
    input.archived_reason?.trim() ||
    input.note?.trim() ||
    (sideWithReason ? existing.archived_reason : null);

  if (sideWithReason && !reason) {
    return {
      ok: false,
      error: `A reason is required when moving to ${BD_STAGE_LABELS[input.stage]}`,
    };
  }

  const patch: BdRecordUpdate = {
    stage: input.stage,
    stage_entered_at: new Date().toISOString(),
  };
  if (sideWithReason) {
    patch.archived_reason = reason;
  }
  if (input.stage === "on_hold" && input.note?.trim()) {
    patch.archived_reason = input.note.trim();
  }

  const { error: updErr } = await supabase
    .from("bd_records")
    .update(patch)
    .eq("id", input.id);
  if (updErr) return { ok: false, error: updErr.message };

  // Keep CRM company + contact status aligned with BD stage
  {
    const { ensureBdCrmCompanyAndContact, promoteBdCrmToClient } =
      await import("@/lib/bd/crm-link");
    const linked = await ensureBdCrmCompanyAndContact(supabase, {
      companyName: existing.company_name,
      contactName: existing.name,
      email: existing.email,
      linkedinUrl: existing.linkedin_url,
      position: existing.position,
      stage: input.stage,
      existingCompanyId: existing.company_id,
      existingContactId: existing.contact_id,
      bdRecordId: existing.id,
      sourceHint: "BD",
    });
    if (linked.ok) {
      await supabase
        .from("bd_records")
        .update({
          company_id: linked.link.companyId,
          contact_id: linked.link.contactId,
        })
        .eq("id", input.id);
      if (input.stage === "client_won") {
        await promoteBdCrmToClient(supabase, {
          companyId: linked.link.companyId,
          contactId: linked.link.contactId,
        });
      }
    }
  }

  await appendTimeline(supabase, {
    recordId: input.id,
    actorId: user.id,
    action: "stage_changed",
    note:
      input.note?.trim() ||
      `Moved from ${BD_STAGE_LABELS[existing.stage as BdStage]} → ${BD_STAGE_LABELS[input.stage]}`,
    meta: {
      from: existing.stage,
      to: input.stage,
      reason: reason ?? null,
    },
  });

  revalidateBd(input.id);
  revalidatePath("/app/crm");
  revalidatePath("/app/crm/directory");
  return { ok: true };
}

/** Soft-remove: always archive with a reason. There is no delete. */
export async function archiveBdRecord(input: {
  id: string;
  reason: string;
}): Promise<{ ok: boolean; error?: string }> {
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "Archive reason is required" };
  return moveBdRecordStage({
    id: input.id,
    stage: "archived",
    archived_reason: reason,
    note: `Archived: ${reason}`,
  });
}

/** Reverse archive / declined / on_hold back to a pipeline stage. */
export async function restoreBdRecord(input: {
  id: string;
  stage?: BdStage;
  note?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const target = input.stage && isBdStage(input.stage) ? input.stage : "prospect";
  if (["archived", "declined", "on_hold"].includes(target)) {
    return { ok: false, error: "Restore target must be a main pipeline stage" };
  }
  return moveBdRecordStage({
    id: input.id,
    stage: target,
    note: input.note?.trim() || `Restored to ${BD_STAGE_LABELS[target]}`,
  });
}

/** Persist qualification fields only — does not change stage. */
export async function saveBdQualification(input: {
  id: string;
  legitimacy_status: BdLegitimacyStatus | null;
  legitimacy_reason: string | null;
  demand_signals: BdDemandSignal[];
}): Promise<{
  ok: boolean;
  error?: string;
  recommendation?: BdQualificationRecommendation;
}> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const cleanedSignals = input.demand_signals
    .map((s) => ({
      type: s.type.trim(),
      description: s.description.trim(),
      source: s.source.trim(),
      date_found: s.date_found.trim() || new Date().toISOString().slice(0, 10),
    }))
    .filter((s) => s.type || s.description);

  const advice = computeQualificationAdvice({
    legitimacy_status: input.legitimacy_status,
    legitimacy_reason: input.legitimacy_reason,
    demand_signals: cleanedSignals,
  });

  const { error: updErr } = await supabase
    .from("bd_records")
    .update({
      legitimacy_status: input.legitimacy_status,
      legitimacy_reason: input.legitimacy_reason?.trim() || null,
      demand_signals: cleanedSignals as unknown as Json,
    })
    .eq("id", input.id);

  if (updErr) return { ok: false, error: updErr.message };

  await appendTimeline(supabase, {
    recordId: input.id,
    actorId: user.id,
    actorType: "user",
    action: "qualification_saved",
    note: `Qualification saved — system suggests: ${advice.label}`,
    meta: {
      legitimacy_status: input.legitimacy_status,
      demand_signal_count: cleanedSignals.length,
      recommendation: advice.recommendation,
    },
  });

  // System recommendation logged separately (never auto-applies)
  await appendTimeline(supabase, {
    recordId: input.id,
    actorId: null,
    actorType: "system",
    action: "qualification_recommendation",
    note: `${advice.label}. ${advice.reasoning.join(" ")}`,
    meta: {
      recommendation: advice.recommendation,
      target_stage: advice.targetStage,
      awaiting_human_confirmation: true,
    },
  });

  revalidateBd(input.id);
  return { ok: true, recommendation: advice.recommendation };
}

/**
 * Explicit human confirmation of a qualification recommendation.
 * Never called implicitly — stage only changes here.
 */
export async function confirmBdQualification(input: {
  id: string;
  /** Must match what the server recomputes from saved fields (or after save). */
  recommendation: BdQualificationRecommendation;
  /** Required when disqualifying / when advice.requiresReason. */
  confirm_reason?: string | null;
}): Promise<{ ok: boolean; error?: string; stage?: BdStage }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const { data: row, error: qErr } = await supabase
    .from("bd_records")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (qErr) return { ok: false, error: qErr.message };
  if (!row) return { ok: false, error: "Record not found" };

  const signals = Array.isArray(row.demand_signals)
    ? (row.demand_signals as BdDemandSignal[])
    : [];

  const advice = computeQualificationAdvice({
    legitimacy_status: (row.legitimacy_status as BdLegitimacyStatus | null) ?? null,
    legitimacy_reason: row.legitimacy_reason,
    demand_signals: signals,
  });

  if (advice.recommendation !== input.recommendation) {
    return {
      ok: false,
      error:
        "Recommendation changed after recompute — save qualification again, then confirm.",
    };
  }

  let reason =
    input.confirm_reason?.trim() ||
    row.legitimacy_reason?.trim() ||
    null;

  if (advice.recommendation === "disqualify") {
    if (!reason) {
      return {
        ok: false,
        error: "Disqualify requires a reason (use legitimacy reason or enter one).",
      };
    }
  }

  const noteByRec: Record<BdQualificationRecommendation, string> = {
    promote: "Human confirmed: promote to Qualified Lead",
    hold: "Human confirmed: move to On Hold",
    disqualify: `Human confirmed: disqualify — ${reason}`,
  };

  const move = await moveBdRecordStage({
    id: input.id,
    stage: advice.targetStage,
    note: noteByRec[advice.recommendation],
    archived_reason:
      advice.recommendation === "disqualify" ? reason : undefined,
  });

  if (!move.ok) return move;

  await appendTimeline(supabase, {
    recordId: input.id,
    actorId: user.id,
    action: "qualification_confirmed",
    note: noteByRec[advice.recommendation],
    meta: {
      recommendation: advice.recommendation,
      target_stage: advice.targetStage,
      reason: reason ?? null,
    },
  });

  revalidateBd(input.id);
  return { ok: true, stage: advice.targetStage };
}

export async function saveBdDiscoveryCall(input: {
  id: string;
  notes_text?: string | null;
  notes_file_url?: string | null;
  notes_file_name?: string | null;
  audio_file_url?: string | null;
  audio_file_name?: string | null;
  transcript?: string | null;
  processAi?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const { data: row } = await supabase
    .from("bd_records")
    .select("id, name, company_name, discovery_call")
    .eq("id", input.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Record not found" };

  const {
    DISCOVERY_CONSENT_LINE,
    extractDiscoveryInsights,
    mergeDiscoveryCall,
    transcribeAudioBuffer,
  } = await import("@/lib/bd/discovery");

  const current = mergeDiscoveryCall(
    (row.discovery_call as Record<string, unknown>) || {}
  );

  let transcript = input.transcript ?? current.transcript;
  if (input.audio_file_url && input.processAi && !transcript) {
    try {
      const audioRes = await fetch(input.audio_file_url, {
        signal: AbortSignal.timeout(60000),
      });
      if (audioRes.ok) {
        const buf = new Uint8Array(await audioRes.arrayBuffer());
        const mediaType =
          audioRes.headers.get("content-type") || "audio/mpeg";
        transcript = await transcribeAudioBuffer(buf, mediaType);
      }
    } catch (e) {
      console.error("audio fetch/transcribe", e);
    }
  }

  const sourceText = [input.notes_text ?? current.notes_text, transcript]
    .filter(Boolean)
    .join("\n\n");

  let summary = current.summary;
  let action_items = current.action_items;
  let needs = current.needs;
  let budget = current.budget;
  let timeline = current.timeline;

  if (input.processAi && sourceText.trim()) {
    const extracted = await extractDiscoveryInsights({
      companyName: row.company_name,
      contactName: row.name,
      sourceText,
    });
    summary = extracted.summary;
    action_items = extracted.action_items;
    needs = extracted.needs;
    budget = extracted.budget;
    timeline = extracted.timeline;
  }

  const next = {
    ...current,
    consent_disclosed: true as const,
    consent_line: DISCOVERY_CONSENT_LINE,
    notes_text:
      input.notes_text !== undefined ? input.notes_text : current.notes_text,
    notes_file_url:
      input.notes_file_url !== undefined
        ? input.notes_file_url
        : current.notes_file_url,
    notes_file_name:
      input.notes_file_name !== undefined
        ? input.notes_file_name
        : current.notes_file_name,
    audio_file_url:
      input.audio_file_url !== undefined
        ? input.audio_file_url
        : current.audio_file_url,
    audio_file_name:
      input.audio_file_name !== undefined
        ? input.audio_file_name
        : current.audio_file_name,
    transcript: transcript ?? null,
    summary,
    action_items,
    needs,
    budget,
    timeline,
    updated_at: new Date().toISOString(),
  };

  const { error: updErr } = await supabase
    .from("bd_records")
    .update({ discovery_call: next as unknown as Json })
    .eq("id", input.id);
  if (updErr) return { ok: false, error: updErr.message };

  await appendTimeline(supabase, {
    recordId: input.id,
    actorId: user.id,
    action: input.processAi ? "discovery_processed" : "discovery_saved",
    note: input.processAi
      ? "Discovery call notes processed (summary + signals extracted)."
      : "Discovery call capture updated.",
    meta: {
      has_audio: Boolean(next.audio_file_url),
      has_transcript: Boolean(next.transcript),
      consent_disclosed: true,
    },
  });

  revalidateBd(input.id);
  return { ok: true };
}

export async function linkBdProposal(input: {
  bdRecordId: string;
  type: "sow" | "slides";
  linkedId: string;
  status?: string;
  title?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const { buildProposalPayload } = await import("@/lib/bd/proposal");
  const payload = buildProposalPayload({
    type: input.type,
    linkedId: input.linkedId,
    status: (input.status as "draft") || "draft",
    title: input.title,
  });

  const { error: updErr } = await supabase
    .from("bd_records")
    .update({ proposal: payload as unknown as Json })
    .eq("id", input.bdRecordId);
  if (updErr) return { ok: false, error: updErr.message };

  await appendTimeline(supabase, {
    recordId: input.bdRecordId,
    actorId: user.id,
    action: "proposal_linked",
    note: `Proposal linked (${input.type}).`,
    meta: payload as unknown as Json,
  });

  revalidateBd(input.bdRecordId);
  revalidatePath("/app/bd/proposal");
  return { ok: true };
}

export async function createBdSlideDeck(input: {
  bdRecordId?: string | null;
  companyId?: string | null;
  title?: string;
  serviceIds: string[];
}): Promise<{ ok: boolean; deckId?: string; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const { buildTemplatedSlides } = await import("@/lib/bd/slides");

  let companyName = "Prospect";
  let contactName: string | null = null;
  let discovery: Record<string, unknown> = {};
  let companyId = input.companyId ?? null;
  const bdRecordId = input.bdRecordId ?? null;

  if (bdRecordId) {
    const { data: rec } = await supabase
      .from("bd_records")
      .select("id, name, company_name, company_id, discovery_call")
      .eq("id", bdRecordId)
      .maybeSingle();
    if (rec) {
      companyName = rec.company_name;
      contactName = rec.name;
      companyId = companyId || rec.company_id;
      discovery = (rec.discovery_call as Record<string, unknown>) || {};
    }
  } else if (companyId) {
    const { data: co } = await supabase
      .from("crm_customers")
      .select("company, name")
      .eq("id", companyId)
      .maybeSingle();
    if (co) companyName = co.company || co.name || companyName;
  }

  const { data: services } = await supabase
    .from("pm_services")
    .select("id, name, short_description")
    .in(
      "id",
      input.serviceIds.length
        ? input.serviceIds
        : ["00000000-0000-0000-0000-000000000000"]
    )
    .order("sort_order");

  const slides = buildTemplatedSlides({
    companyName,
    contactName,
    services: services ?? [],
    discoverySummary:
      typeof discovery.summary === "string" ? discovery.summary : null,
    discoveryNeeds: typeof discovery.needs === "string" ? discovery.needs : null,
    discoveryBudget:
      typeof discovery.budget === "string" ? discovery.budget : null,
    discoveryTimeline:
      typeof discovery.timeline === "string" ? discovery.timeline : null,
  });

  const title =
    input.title?.trim() || `Proposal deck — ${companyName}`;

  const { data: deck, error: insErr } = await supabase
    .from("bd_slide_decks")
    .insert({
      bd_record_id: bdRecordId,
      company_id: companyId,
      title,
      status: "draft",
      slides: slides as unknown as Json,
      service_ids: input.serviceIds,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !deck) {
    return { ok: false, error: insErr?.message || "Insert failed" };
  }

  if (bdRecordId) {
    await linkBdProposal({
      bdRecordId,
      type: "slides",
      linkedId: deck.id,
      status: "draft",
      title,
    });
  }

  revalidatePath("/app/bd/proposal");
  revalidatePath(`/app/bd/proposal/slides/${deck.id}`);
  return { ok: true, deckId: deck.id };
}

export async function saveBdSlideDeck(input: {
  id: string;
  title?: string;
  status?: string;
  slides?: unknown[];
  serviceIds?: string[];
  publish?: boolean;
}): Promise<{ ok: boolean; error?: string; publicSlug?: string | null }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const { data: existing } = await supabase
    .from("bd_slide_decks")
    .select("id, bd_record_id, title, public_slug, status")
    .eq("id", input.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Deck not found" };

  const patch: Database["public"]["Tables"]["bd_slide_decks"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) patch.title = input.title;
  if (input.slides !== undefined) patch.slides = input.slides as unknown as Json;
  if (input.serviceIds !== undefined) patch.service_ids = input.serviceIds;
  if (input.status !== undefined) patch.status = input.status;

  let publicSlug = existing.public_slug;
  if (input.publish) {
    patch.status = "published";
    if (!publicSlug) {
      const base = (input.title || existing.title || "proposal")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);
      publicSlug = `${base || "proposal"}-${input.id.slice(0, 8)}`;
      patch.public_slug = publicSlug;
    }
  }

  const { error: updErr } = await supabase
    .from("bd_slide_decks")
    .update(patch)
    .eq("id", input.id);
  if (updErr) return { ok: false, error: updErr.message };

  if (existing.bd_record_id) {
    await linkBdProposal({
      bdRecordId: existing.bd_record_id,
      type: "slides",
      linkedId: input.id,
      status: (patch.status as string) || existing.status,
      title: (patch.title as string) || existing.title,
    });
  }

  revalidatePath(`/app/bd/proposal/slides/${input.id}`);
  revalidatePath("/app/bd/proposal");
  return { ok: true, publicSlug };
}

export async function getBdSlideDeck(id: string): Promise<{
  ok: boolean;
  error?: string;
  deck?: {
    id: string;
    bd_record_id: string | null;
    company_id: string | null;
    title: string;
    status: string;
    slides: unknown;
    service_ids: string[];
    public_slug: string | null;
    updated_at: string;
  };
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const { data, error: qErr } = await supabase
    .from("bd_slide_decks")
    .select(
      "id, bd_record_id, company_id, title, status, slides, service_ids, public_slug, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (qErr) return { ok: false, error: qErr.message };
  if (!data) return { ok: false, error: "Not found" };
  return { ok: true, deck: data };
}

export async function generateBdContract(input: {
  bdRecordId: string;
}): Promise<{ ok: boolean; error?: string; contract?: Record<string, unknown> }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const { data: rec } = await supabase
    .from("bd_records")
    .select(
      "id, name, company_name, email, discovery_call, proposal, contract"
    )
    .eq("id", input.bdRecordId)
    .maybeSingle();
  if (!rec) return { ok: false, error: "Record not found" };

  const discovery = (rec.discovery_call as Record<string, unknown>) || {};
  const proposal = (rec.proposal as Record<string, unknown>) || {};
  let serviceNames: string[] = [];

  if (proposal.type === "slides" && typeof proposal.linked_id === "string") {
    const { data: deck } = await supabase
      .from("bd_slide_decks")
      .select("service_ids, title")
      .eq("id", proposal.linked_id)
      .maybeSingle();
    if (deck?.service_ids?.length) {
      const { data: svcs } = await supabase
        .from("pm_services")
        .select("name")
        .in("id", deck.service_ids);
      serviceNames = (svcs ?? []).map((s) => s.name);
    }
  } else if (proposal.type === "sow" && typeof proposal.linked_id === "string") {
    const { data: sections } = await supabase
      .from("sow_sections")
      .select("service_name_snapshot, title")
      .eq("sow_id", proposal.linked_id)
      .order("sort_order");
    serviceNames = (sections ?? [])
      .map((s) => s.service_name_snapshot || s.title)
      .filter(Boolean) as string[];
  }

  const { generateContractDraft } = await import("@/lib/bd/contract");
  const draft = generateContractDraft({
    companyName: rec.company_name,
    contactName: rec.name,
    email: rec.email,
    discoveryNeeds:
      typeof discovery.needs === "string" ? discovery.needs : null,
    discoveryBudget:
      typeof discovery.budget === "string" ? discovery.budget : null,
    proposalTitle: typeof proposal.title === "string" ? proposal.title : null,
    serviceNames,
  });

  const { error: updErr } = await supabase
    .from("bd_records")
    .update({ contract: draft as unknown as Json })
    .eq("id", input.bdRecordId);
  if (updErr) return { ok: false, error: updErr.message };

  await appendTimeline(supabase, {
    recordId: input.bdRecordId,
    actorId: user.id,
    action: "contract_generated",
    note: "Contract draft generated from proposal + discovery context.",
    meta: { line_items: draft.line_items.length },
  });

  revalidateBd(input.bdRecordId);
  revalidatePath("/app/bd/contract");
  revalidatePath(`/app/bd/contract/${input.bdRecordId}`);
  return { ok: true, contract: draft as unknown as Record<string, unknown> };
}

export async function saveBdContract(input: {
  bdRecordId: string;
  contract: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const next = {
    ...input.contract,
    updated_at: new Date().toISOString(),
  };

  const { error: updErr } = await supabase
    .from("bd_records")
    .update({ contract: next as unknown as Json })
    .eq("id", input.bdRecordId);
  if (updErr) return { ok: false, error: updErr.message };

  await appendTimeline(supabase, {
    recordId: input.bdRecordId,
    actorId: user.id,
    action: "contract_saved",
    note: "Contract draft updated.",
    meta: {},
  });

  revalidateBd(input.bdRecordId);
  revalidatePath(`/app/bd/contract/${input.bdRecordId}`);
  return { ok: true };
}
export async function finalizeBdContract(input: {
  bdRecordId: string;
  contract?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string; stage?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error || "Not authenticated" };

  const { data: rec } = await supabase
    .from("bd_records")
    .select("id, contract")
    .eq("id", input.bdRecordId)
    .maybeSingle();
  if (!rec) return { ok: false, error: "Record not found" };

  const base =
    (input.contract as Record<string, unknown>) ||
    ((rec.contract as Record<string, unknown>) || {});
  const next = {
    ...base,
    status: "finalized",
    finalized_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: updErr } = await supabase
    .from("bd_records")
    .update({
      contract: next as unknown as Json,
      stage: "quotation",
      stage_entered_at: new Date().toISOString(),
      quotation: {
        status: "pending_lexware",
        updated_at: new Date().toISOString(),
      } as unknown as Json,
    })
    .eq("id", input.bdRecordId);
  if (updErr) return { ok: false, error: updErr.message };

  // Keep CRM aligned when jumping to quotation via contract finalize
  {
    const { data: full } = await supabase
      .from("bd_records")
      .select(
        "id, name, company_name, email, linkedin_url, position, company_id, contact_id"
      )
      .eq("id", input.bdRecordId)
      .maybeSingle();
    if (full) {
      const { ensureBdCrmCompanyAndContact } = await import("@/lib/bd/crm-link");
      const linked = await ensureBdCrmCompanyAndContact(supabase, {
        companyName: full.company_name,
        contactName: full.name,
        email: full.email,
        linkedinUrl: full.linkedin_url,
        position: full.position,
        stage: "quotation",
        existingCompanyId: full.company_id,
        existingContactId: full.contact_id,
        bdRecordId: full.id,
        sourceHint: "BD",
      });
      if (linked.ok) {
        await supabase
          .from("bd_records")
          .update({
            company_id: linked.link.companyId,
            contact_id: linked.link.contactId,
          })
          .eq("id", input.bdRecordId);
      }
    }
  }

  await appendTimeline(supabase, {
    recordId: input.bdRecordId,
    actorId: user.id,
    action: "contract_finalized",
    note: "Contract finalized — stage moved to quotation.",
    meta: {},
  });

  revalidateBd(input.bdRecordId);
  revalidatePath(`/app/bd/contract/${input.bdRecordId}`);
  revalidatePath("/app/bd/contract");
  revalidatePath("/app/crm");
  return { ok: true, stage: "quotation" };
}

/** One-shot: ensure every BD record has CRM company + contact rows linked. */
export async function backfillBdCrmLinks(): Promise<{
  ok: boolean;
  error?: string;
  processed: number;
  linked: number;
  failed: number;
}> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) {
    return { ok: false, error: error || "Not authenticated", processed: 0, linked: 0, failed: 0 };
  }

  const { ensureBdCrmCompanyAndContact } = await import("@/lib/bd/crm-link");
  const { data: rows, error: qErr } = await supabase
    .from("bd_records")
    .select(
      "id, name, company_name, email, linkedin_url, position, stage, company_id, contact_id, source"
    )
    .order("created_at");
  if (qErr) {
    return { ok: false, error: qErr.message, processed: 0, linked: 0, failed: 0 };
  }

  let linked = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    const res = await ensureBdCrmCompanyAndContact(supabase, {
      companyName: row.company_name,
      contactName: row.name,
      email: row.email,
      linkedinUrl: row.linkedin_url,
      position: row.position,
      stage: row.stage,
      existingCompanyId: row.company_id,
      existingContactId: row.contact_id,
      bdRecordId: row.id,
      sourceHint: row.source === "auto_discovered" ? "BD auto_discovered" : "BD",
    });
    if (!res.ok) {
      failed += 1;
      continue;
    }
    const { error: updErr } = await supabase
      .from("bd_records")
      .update({
        company_id: res.link.companyId,
        contact_id: res.link.contactId,
      })
      .eq("id", row.id);
    if (updErr) {
      failed += 1;
      continue;
    }
    linked += 1;
  }

  revalidateBd();
  revalidatePath("/app/crm");
  revalidatePath("/app/crm/directory");
  return {
    ok: true,
    processed: (rows ?? []).length,
    linked,
    failed,
  };
}

