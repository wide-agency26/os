"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { notifyBdStakeholders } from "@/lib/bd/notify";
import {
  BD_DECLINE_REASONS,
  type BdDeclineReason,
  type BdProposalDecision,
} from "@/lib/bd/proposal-response";
import type { Json } from "@/types/supabase";

async function findBdRecordForProposal(linkedId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("bd_records")
    .select(
      "id, name, company_name, stage, owner_id, observer_ids, proposal"
    )
    .filter("proposal->>linked_id", "eq", linkedId)
    .limit(5);

  return (data ?? [])[0] ?? null;
}

export async function submitProposalDecision(input: {
  linkedId: string;
  proposalType: "sow" | "slides";
  decision: BdProposalDecision;
  declineReason?: string | null;
  declineOtherText?: string | null;
}): Promise<{ ok: boolean; error?: string; stage?: string }> {
  const admin = createAdminClient();
  const record = await findBdRecordForProposal(input.linkedId);
  if (!record) {
    return {
      ok: false,
      error:
        "No BD record is linked to this proposal yet. Ask WIDE to attach it in Proposal Builder.",
    };
  }

  const currentProposal =
    (record.proposal as Record<string, unknown>) || {};

  let stage: string;
  let proposalStatus: string;
  let note: string;
  let title: string;
  let message: string;
  let severity: "Info" | "Success" | "Warning" | "Critical" = "Info";

  if (input.decision === "accept") {
    stage = "contract";
    proposalStatus = "accepted";
    note = "Client accepted the proposal.";
    title = `Proposal accepted — ${record.company_name}`;
    message = `${record.name} accepted the ${input.proposalType} proposal. Move into Contract Builder.`;
    severity = "Success";
  } else if (input.decision === "hold") {
    stage = "on_hold";
    proposalStatus = "on_hold";
    note = "Client put the proposal on hold.";
    title = `Proposal on hold — ${record.company_name}`;
    message = `${record.name} paused the ${input.proposalType} proposal. Follow up when ready.`;
    severity = "Warning";
  } else {
    const reason = (input.declineReason || "").trim();
    if (!BD_DECLINE_REASONS.includes(reason as BdDeclineReason)) {
      return { ok: false, error: "Pick a decline reason." };
    }
    if (reason === "Other" && !(input.declineOtherText || "").trim()) {
      return { ok: false, error: "Please add a short note for Other." };
    }
    stage = "declined";
    proposalStatus = "declined";
    const detail =
      reason === "Other"
        ? `Other: ${(input.declineOtherText || "").trim()}`
        : reason;
    note = `Client declined: ${detail}`;
    title = `Proposal declined — ${record.company_name}`;
    message = `${record.name} declined (${detail}).`;
    severity = "Warning";
  }

  const nextProposal = {
    ...currentProposal,
    type: input.proposalType,
    linked_id: input.linkedId,
    status: proposalStatus,
    decision: input.decision,
    decline_reason:
      input.decision === "decline" ? input.declineReason : null,
    decline_other_text:
      input.decision === "decline" ? input.declineOtherText || null : null,
    decided_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: updErr } = await admin
    .from("bd_records")
    .update({
      stage,
      stage_entered_at: new Date().toISOString(),
      proposal: nextProposal as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.id);
  if (updErr) return { ok: false, error: updErr.message };

  if (input.proposalType === "slides") {
    await admin
      .from("bd_slide_decks")
      .update({
        status: proposalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.linkedId);
  } else if (input.decision === "accept") {
    await admin
      .from("sows")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", input.linkedId);
  }

  await admin.from("bd_timeline_entries").insert({
    bd_record_id: record.id,
    actor_type: "system",
    actor_id: null,
    action: `proposal_${input.decision}`,
    note,
    meta: {
      proposal_type: input.proposalType,
      linked_id: input.linkedId,
      decline_reason: input.declineReason ?? null,
    },
  });

  await notifyBdStakeholders({
    ownerId: record.owner_id,
    observerIds: (record.observer_ids as string[]) || [],
    title,
    message,
    link: `/app/bd/${record.id}`,
    severity,
    meta: {
      bd_record_id: record.id,
      decision: input.decision,
    },
  });

  revalidatePath(`/app/bd/${record.id}`);
  revalidatePath("/app/bd");
  return { ok: true, stage };
}

export async function runOnHoldReminders(): Promise<{
  ok: boolean;
  reminded: number;
  error?: string;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bd_records")
    .select("id, name, company_name, owner_id, observer_ids, stage_entered_at")
    .eq("stage", "on_hold");
  if (error) return { ok: false, reminded: 0, error: error.message };

  const rows = data ?? [];
  if (rows.length === 0) return { ok: true, reminded: 0 };

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const ids = rows.map((r) => r.id);
  const { data: recentReminders } = await admin
    .from("bd_timeline_entries")
    .select("bd_record_id")
    .in("bd_record_id", ids)
    .eq("action", "on_hold_reminder")
    .gte("created_at", weekAgo);

  const remindedRecently = new Set(
    (recentReminders ?? []).map((r) => r.bd_record_id)
  );

  let reminded = 0;
  for (const row of rows) {
    if (remindedRecently.has(row.id)) continue;

    await notifyBdStakeholders({
      ownerId: row.owner_id,
      observerIds: (row.observer_ids as string[]) || [],
      title: `On-hold follow-up — ${row.company_name}`,
      message: `${row.name} / ${row.company_name} is still on hold (since ${row.stage_entered_at}). Time for a check-in.`,
      link: `/app/bd/${row.id}`,
      severity: "Warning",
      meta: { bd_record_id: row.id, kind: "on_hold_weekly" },
    });
    await admin.from("bd_timeline_entries").insert({
      bd_record_id: row.id,
      actor_type: "system",
      actor_id: null,
      action: "on_hold_reminder",
      note: "Weekly on-hold follow-up notification sent to owner + observers.",
      meta: {},
    });
    reminded += 1;
  }

  return { ok: true, reminded };
}
