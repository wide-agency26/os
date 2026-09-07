"use server";

import { revalidatePath } from "next/cache";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { createClient } from "@/utils/supabase/server";
import { parseInboundToProposals } from "@/lib/pm/email-parse";
import {
  classifyReviewOutcome,
  isOverrideTrigger,
  reviewLatencySeconds,
  type OverrideTrigger,
} from "@/lib/pm/instrument";

export type ReviewActionResult = { ok: boolean; error?: string; created?: number };

function revalidateProject(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/review`);
  revalidatePath("/app/home");
}

export async function setProjectInboundEmail(
  projectId: string,
  email: string | null
): Promise<ReviewActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const normalized = email?.trim().toLowerCase() || null;

  if (normalized) {
    const { data: clash } = await (supabase as any)
      .from("projects")
      .select("id, title")
      .eq("pm_inbound_email", normalized)
      .neq("id", projectId)
      .maybeSingle();
    if (clash) {
      return {
        ok: false,
        error: `Already used by “${clash.title}”. Pick a unique alias.`,
      };
    }
  }

  const { error } = await (supabase as any)
    .from("projects")
    .update({ pm_inbound_email: normalized })
    .eq("id", projectId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/settings/integrations");
  return { ok: true };
}

/** Staff paste path — same consent queue as email webhook. Never creates live tasks. */
export async function ingestNoteForReview(
  projectId: string,
  input: { subject?: string; body: string }
): Promise<ReviewActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const body = String(input.body || "").trim();
  if (!body) return { ok: false, error: "Paste email or notes first." };

  const supabase = await createClient();
  const { data: openTasks } = await (supabase as any)
    .from("pm_tasks")
    .select("id, title")
    .eq("project_id", projectId)
    .in("status", ["todo", "in_progress", "blocked"]);

  const parsed = await parseInboundToProposals({
    subject: input.subject || "Pasted note",
    body,
    openTasks: openTasks || [],
  });

  if (!parsed.proposals.length) {
    return { ok: false, error: "No actionable tasks detected. Try a clearer list." };
  }

  const batchId = crypto.randomUUID();
  const rows = parsed.proposals.map((p) => ({
    project_id: projectId,
    proposed_title: p.title,
    proposed_description: p.description,
    suggested_match_task_id: p.suggestedMatchTaskId,
    status: "pending",
    source_ref: JSON.stringify({
      type: "paste",
      subject: input.subject || "Pasted note",
      batchId,
      highVolume: parsed.highVolume,
      parseMode: parsed.parseMode,
      bodyPreview: body.slice(0, 500),
    }),
  }));

  const { error } = await (supabase as any).from("task_review_queue").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidateProject(projectId);
  return { ok: true, created: rows.length };
}

export async function approveReviewItem(
  itemId: string,
  edits?: { title?: string; description?: string },
  trigger?: OverrideTrigger | null
): Promise<ReviewActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const { data: item, error: fetchErr } = await (supabase as any)
    .from("task_review_queue")
    .select("*")
    .eq("id", itemId)
    .single();

  if (fetchErr || !item) return { ok: false, error: fetchErr?.message ?? "Not found" };
  if (item.status !== "pending") return { ok: false, error: "Already reviewed." };

  const title = (edits?.title ?? item.proposed_title).trim();
  const description = edits?.description ?? item.proposed_description;
  const outcome = classifyReviewOutcome({
    originalTitle: item.proposed_title,
    originalDescription: item.proposed_description,
    nextTitle: title,
    nextDescription: description,
  });
  if (outcome === "edit" && !isOverrideTrigger(trigger)) {
    return { ok: false, error: "Pick why you changed the proposal." };
  }

  const now = new Date();
  const { data: created, error: insErr } = await (supabase as any)
    .from("pm_tasks")
    .insert({
      project_id: item.project_id,
      title,
      description,
      status: "todo",
      source: "email",
      source_ref: item.source_ref,
      last_activity_at: now.toISOString(),
    })
    .select("id")
    .single();
  if (insErr) return { ok: false, error: insErr.message };

  const { error: updErr } = await (supabase as any)
    .from("task_review_queue")
    .update({
      status: outcome === "edit" ? "edited" : "approved",
      proposed_title: title,
      proposed_description: description,
      reviewed_at: now.toISOString(),
      reviewed_by: gate.user!.id,
      created_task_id: created?.id ?? null,
      override_outcome: outcome,
      override_trigger: outcome === "edit" ? trigger : trigger || null,
      latency_s: reviewLatencySeconds(item.created_at, now),
    })
    .eq("id", itemId);

  if (updErr) return { ok: false, error: updErr.message };
  revalidateProject(item.project_id);
  return { ok: true, created: 1 };
}

export async function approveAllPending(projectId: string): Promise<ReviewActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const { data: items } = await (supabase as any)
    .from("task_review_queue")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "pending");

  let created = 0;
  for (const item of items || []) {
    const res = await approveReviewItem(item.id);
    if (res.ok) created += res.created ?? 0;
  }
  return { ok: true, created };
}

export async function discardReviewItem(
  itemId: string,
  trigger?: OverrideTrigger | null
): Promise<ReviewActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };
  if (!isOverrideTrigger(trigger)) {
    return { ok: false, error: "Pick why you discarded the proposal." };
  }

  const supabase = await createClient();
  const { data: item } = await (supabase as any)
    .from("task_review_queue")
    .select("project_id, status, created_at")
    .eq("id", itemId)
    .single();

  if (!item) return { ok: false, error: "Not found" };
  if (item.status !== "pending") return { ok: false, error: "Already reviewed." };

  const now = new Date();
  const { error } = await (supabase as any)
    .from("task_review_queue")
    .update({
      status: "discarded",
      reviewed_at: now.toISOString(),
      reviewed_by: gate.user!.id,
      override_outcome: "block",
      override_trigger: trigger,
      latency_s: reviewLatencySeconds(item.created_at, now),
    })
    .eq("id", itemId);

  if (error) return { ok: false, error: error.message };
  revalidateProject(item.project_id);
  return { ok: true };
}

export async function mergeReviewIntoTask(
  itemId: string,
  targetTaskId: string
): Promise<ReviewActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const { data: item } = await (supabase as any)
    .from("task_review_queue")
    .select("*")
    .eq("id", itemId)
    .single();

  if (!item || item.status !== "pending") {
    return { ok: false, error: "Item not pending." };
  }

  const { data: task } = await (supabase as any)
    .from("pm_tasks")
    .select("id, description, project_id")
    .eq("id", targetTaskId)
    .eq("project_id", item.project_id)
    .single();

  if (!task) return { ok: false, error: "Target task not found on this project." };

  const note = [
    task.description || "",
    "",
    `--- Merged from review (${new Date().toISOString().slice(0, 10)}) ---`,
    item.proposed_title,
    item.proposed_description || "",
  ]
    .join("\n")
    .trim();

  const { error: taskErr } = await (supabase as any)
    .from("pm_tasks")
    .update({
      description: note,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetTaskId);

  if (taskErr) return { ok: false, error: taskErr.message };

  const now = new Date();
  const { error } = await (supabase as any)
    .from("task_review_queue")
    .update({
      status: "merged",
      suggested_match_task_id: targetTaskId,
      reviewed_at: now.toISOString(),
      reviewed_by: gate.user!.id,
      override_outcome: "augment",
      latency_s: reviewLatencySeconds(item.created_at, now),
    })
    .eq("id", itemId);

  if (error) return { ok: false, error: error.message };
  revalidateProject(item.project_id);
  return { ok: true };
}
