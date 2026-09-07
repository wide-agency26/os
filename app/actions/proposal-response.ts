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
import { workPaths } from "@/lib/work/paths";
import { revalidateWork } from "@/lib/work/revalidate";

const BD_SELECT =
  "id, name, company_name, stage, owner_id, observer_ids, proposal";

type BdRecordRow = {
  id: string;
  name: string;
  company_name: string;
  stage: string;
  owner_id: string;
  observer_ids: string[] | null;
  proposal: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function loadBdById(
  admin: ReturnType<typeof createAdminClient>,
  id: string | null | undefined
): Promise<BdRecordRow | null> {
  if (!id) return null;
  const { data } = await admin
    .from("bd_records")
    .select(BD_SELECT)
    .eq("id", id)
    .maybeSingle();
  return (data as BdRecordRow | null) ?? null;
}

async function findBdByProposalLinkedId(
  admin: ReturnType<typeof createAdminClient>,
  linkedId: string
): Promise<BdRecordRow | null> {
  const { data: byPath } = await admin
    .from("bd_records")
    .select(BD_SELECT)
    .filter("proposal->>linked_id", "eq", linkedId)
    .limit(1);
  if (byPath?.[0]) return byPath[0] as BdRecordRow;

  const { data: byContains } = await admin
    .from("bd_records")
    .select(BD_SELECT)
    .contains("proposal", { linked_id: linkedId })
    .limit(1);
  return (byContains?.[0] as BdRecordRow | undefined) ?? null;
}

async function sowFamilyIds(
  admin: ReturnType<typeof createAdminClient>,
  sow: { id: string; version_root_id: string | null }
): Promise<string[]> {
  const root = sow.version_root_id || sow.id;
  const ids = new Set<string>([sow.id, root]);
  const { data: family } = await admin
    .from("sows")
    .select("id, version_root_id")
    .or(
      `id.eq.${root},version_root_id.eq.${root},id.eq.${sow.id},version_root_id.eq.${sow.id}`
    );
  for (const row of family ?? []) {
    ids.add(row.id);
    if (row.version_root_id) ids.add(row.version_root_id);
  }
  return [...ids];
}

async function findBdRecordForProposal(
  linkedId: string,
  proposalType: "sow" | "slides"
): Promise<BdRecordRow | null> {
  const admin = createAdminClient();

  if (proposalType === "slides") {
    const byLink = await findBdByProposalLinkedId(admin, linkedId);
    if (byLink) return byLink;
    const { data: deck } = await admin
      .from("bd_slide_decks")
      .select("bd_record_id")
      .eq("id", linkedId)
      .maybeSingle();
    return loadBdById(admin, deck?.bd_record_id);
  }

  const { data: sow } = await admin
    .from("sows")
    .select("id, company_id, project_id, version_root_id, assist_context")
    .eq("id", linkedId)
    .maybeSingle();

  if (!sow) return findBdByProposalLinkedId(admin, linkedId);

  const family = await sowFamilyIds(admin, {
    id: sow.id,
    version_root_id: sow.version_root_id,
  });
  for (const id of family) {
    const byLink = await findBdByProposalLinkedId(admin, id);
    if (byLink) return byLink;
  }

  const assist = asRecord(sow.assist_context);
  const assistBd = await loadBdById(
    admin,
    typeof assist.bd_record_id === "string" ? assist.bd_record_id : null
  );
  if (assistBd) return assistBd;

  if (sow.project_id) {
    const { data: project } = await admin
      .from("projects")
      .select("bd_record_id")
      .eq("id", sow.project_id)
      .maybeSingle();
    const viaProject = await loadBdById(admin, project?.bd_record_id);
    if (viaProject) return viaProject;
  }

  if (!sow.company_id) return null;

  const { data: openDeals } = await admin
    .from("bd_records")
    .select(BD_SELECT)
    .eq("company_id", sow.company_id)
    .not("stage", "in", "(declined,archived,client_won)")
    .order("updated_at", { ascending: false })
    .limit(8);
  if (openDeals && openDeals.length === 1) {
    return openDeals[0] as BdRecordRow;
  }
  const preferred = (openDeals ?? []).filter((row) =>
    ["proposal_sent", "proposal", "on_hold", "qualification", "discovery"].includes(
      row.stage
    )
  );
  if (preferred[0]) return preferred[0] as BdRecordRow;
  if (openDeals?.[0]) return openDeals[0] as BdRecordRow;

  const { data: anyDeal } = await admin
    .from("bd_records")
    .select(BD_SELECT)
    .eq("company_id", sow.company_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (anyDeal as BdRecordRow | null) ?? null;
}

async function persistSowDecision(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    sowId: string;
    decision: BdProposalDecision;
    proposalStatus: string;
    declineReason?: string | null;
    declineOtherText?: string | null;
    bdRecordId?: string | null;
  }
) {
  const { data: sow } = await admin
    .from("sows")
    .select("assist_context, public_slug")
    .eq("id", input.sowId)
    .maybeSingle();
  if (!sow) return;

  const existing = asRecord(sow.assist_context);
  const now = new Date().toISOString();
  const patch: {
    assist_context: Json;
    updated_at: string;
    status?: string;
  } = {
    assist_context: {
      ...existing,
      bd_record_id: input.bdRecordId ?? existing.bd_record_id ?? null,
      client_response: {
        decision: input.decision,
        status: input.proposalStatus,
        decided_at: now,
        decline_reason:
          input.decision === "decline" ? input.declineReason ?? null : null,
        decline_other_text:
          input.decision === "decline" ? input.declineOtherText ?? null : null,
      },
    } as Json,
    updated_at: now,
  };
  if (input.decision === "accept") patch.status = "accepted";

  await admin.from("sows").update(patch).eq("id", input.sowId);
  if (sow.public_slug) revalidatePath(`/s/${sow.public_slug}`);
}

async function persistSlideDecision(
  admin: ReturnType<typeof createAdminClient>,
  linkedId: string,
  proposalStatus: string
) {
  const { data: deck } = await admin
    .from("bd_slide_decks")
    .select("public_slug")
    .eq("id", linkedId)
    .maybeSingle();
  await admin
    .from("bd_slide_decks")
    .update({
      status: proposalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", linkedId);
  if (deck?.public_slug) revalidatePath(`/p/${deck.public_slug}`);
}

export async function submitProposalDecision(input: {
  linkedId: string;
  proposalType: "sow" | "slides";
  decision: BdProposalDecision;
  declineReason?: string | null;
  declineOtherText?: string | null;
}): Promise<{ ok: boolean; error?: string; stage?: string }> {
  const admin = createAdminClient();
  const record = await findBdRecordForProposal(input.linkedId, input.proposalType);

  let stage: string;
  let proposalStatus: string;
  let note: string;
  let title: string;
  let message: string;
  let severity: "Info" | "Success" | "Warning" | "Critical" = "Info";

  const companyName = record?.company_name || "Client";
  const contactName = record?.name || "Client";

  if (input.decision === "accept") {
    stage = "contract";
    proposalStatus = "accepted";
    note = "Client accepted the proposal.";
    title = `Proposal accepted — ${companyName}`;
    message = `${contactName} accepted the ${input.proposalType} proposal. Move into Contract Builder.`;
    severity = "Success";
  } else if (input.decision === "hold") {
    stage = "on_hold";
    proposalStatus = "on_hold";
    note = "Client put the proposal on hold.";
    title = `Proposal on hold — ${companyName}`;
    message = `${contactName} paused the ${input.proposalType} proposal. Follow up when ready.`;
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
    title = `Proposal declined — ${companyName}`;
    message = `${contactName} declined (${detail}).`;
    severity = "Warning";
  }

  if (record) {
    const currentProposal = asRecord(record.proposal);
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
      link: workPaths.pipelineId(record.id),
      severity,
      meta: {
        bd_record_id: record.id,
        decision: input.decision,
      },
    });
  } else {
    await admin.from("founder_notifications").insert({
      title,
      message: `${message} No BD card was attached; decision was saved on the ${input.proposalType}.`,
      severity_level: severity,
      link:
        input.proposalType === "sow"
          ? workPaths.sowId(input.linkedId)
          : workPaths.proposeSlide(input.linkedId),
      meta: {
        linked_id: input.linkedId,
        proposal_type: input.proposalType,
        decision: input.decision,
      } as Json,
    });
  }

  if (input.proposalType === "slides") {
    await persistSlideDecision(admin, input.linkedId, proposalStatus);
  } else {
    await persistSowDecision(admin, {
      sowId: input.linkedId,
      decision: input.decision,
      proposalStatus,
      declineReason: input.declineReason,
      declineOtherText: input.declineOtherText,
      bdRecordId: record?.id ?? null,
    });
  }

  if (record) revalidateWork({ bdId: record.id, sowId: input.linkedId });
  else if (input.proposalType === "sow") revalidateWork({ sowId: input.linkedId });

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
      link: workPaths.pipelineId(row.id),
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
