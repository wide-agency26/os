"use server";

import { revalidatePath } from "next/cache";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { createClient } from "@/utils/supabase/server";
import {
  advanceRecurringCycle,
  instantiatePackagePlaybook,
} from "@/lib/pm/instantiate";
import { nextCycleKey, currentCycleKey, type PmTaskStatus } from "@/lib/pm/types";

export type PmActionResult = { ok: boolean; error?: string; created?: number };

export async function assignPlaybookToProject(
  projectId: string,
  packagePlaybookId: string
): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const result = await instantiatePackagePlaybook(
    supabase as any,
    projectId,
    packagePlaybookId
  );

  if (result.error) return { ok: false, error: result.error, created: result.created };

  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/home");
  revalidatePath("/app/company-overview");
  return { ok: true, created: result.created };
}

export async function updatePmTaskStatus(
  taskId: string,
  status: PmTaskStatus
): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    last_activity_at: now,
    updated_at: now,
  };

  if (status === "in_progress") {
    const { data: existing } = await (supabase as any)
      .from("pm_tasks")
      .select("started_at, project_id")
      .eq("id", taskId)
      .single();
    if (existing && !existing.started_at) patch.started_at = now;

    const { error } = await (supabase as any)
      .from("pm_tasks")
      .update(patch)
      .eq("id", taskId);
    if (error) return { ok: false, error: error.message };
    if (existing?.project_id) revalidatePath(`/app/projects/${existing.project_id}`);
    return { ok: true };
  }

  if (status === "done") {
    patch.completed_at = now;
  }

  const { data: task, error: fetchErr } = await (supabase as any)
    .from("pm_tasks")
    .select("id, project_id, is_gate, task_template_id")
    .eq("id", taskId)
    .single();

  if (fetchErr || !task) return { ok: false, error: fetchErr?.message ?? "Task not found" };

  const { error } = await (supabase as any).from("pm_tasks").update(patch).eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  // Clearing a gate: unblock tasks that were waiting
  if (status === "done" && task.is_gate && task.project_id) {
    await unblockAfterGate(supabase as any, task.project_id, task.task_template_id);
  }

  revalidatePath(`/app/projects/${task.project_id}`);
  revalidatePath("/app/home");
  return { ok: true };
}

async function unblockAfterGate(
  supabase: any,
  projectId: string,
  gateTemplateId: string | null
) {
  if (!gateTemplateId) return;

  const { data: project } = await supabase
    .from("projects")
    .select("package_playbook_id")
    .eq("id", projectId)
    .single();

  if (!project?.package_playbook_id) return;

  const { data: gates } = await supabase
    .from("package_playbook_gates")
    .select("blocks_service_playbook_id")
    .eq("package_playbook_id", project.package_playbook_id)
    .eq("after_task_template_id", gateTemplateId);

  if (!gates?.length) return;

  // Check if all gates for each blocked service are cleared
  for (const g of gates) {
    const { data: templates } = await supabase
      .from("task_templates")
      .select("id")
      .eq("service_playbook_id", g.blocks_service_playbook_id);

    const templateIds = (templates ?? []).map((t: { id: string }) => t.id);
    if (!templateIds.length) continue;

    await supabase
      .from("pm_tasks")
      .update({
        status: "todo",
        last_activity_at: new Date().toISOString(),
      })
      .eq("project_id", projectId)
      .eq("status", "blocked")
      .in("task_template_id", templateIds);
  }
}

export async function saveTaskTemplateRow(
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    deliverable?: string | null;
    default_role?: string;
    estimated_duration_hours?: number;
    is_gate?: boolean;
    phase_label?: string | null;
    recurs?: boolean;
    sort_order?: number;
  }
): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("task_templates")
    .update(patch)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/playbooks");
  return { ok: true };
}

export async function addTaskTemplate(
  servicePlaybookId: string,
  title: string
): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const { data: maxRow } = await (supabase as any)
    .from("task_templates")
    .select("sort_order")
    .eq("service_playbook_id", servicePlaybookId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await (supabase as any).from("task_templates").insert({
    service_playbook_id: servicePlaybookId,
    title,
    default_role: "Specialist",
    sort_order: (maxRow?.sort_order ?? 0) + 1,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/playbooks");
  return { ok: true };
}

export async function deleteTaskTemplate(id: string): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const { error } = await (supabase as any).from("task_templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/playbooks");
  return { ok: true };
}

export async function updatePmTaskAssignee(
  taskId: string,
  assigneeId: string | null
): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const { data: task, error: fetchErr } = await (supabase as any)
    .from("pm_tasks")
    .select("project_id")
    .eq("id", taskId)
    .single();
  if (fetchErr || !task) return { ok: false, error: fetchErr?.message ?? "Not found" };

  const { error } = await (supabase as any)
    .from("pm_tasks")
    .update({
      assignee_id: assigneeId,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/projects/${task.project_id}`);
  revalidatePath("/app/home");
  return { ok: true };
}

/**
 * Persist BlockNote document. Keeps `description` as a plain-text summary for
 * email/review/search surfaces that don't read content_blocks.
 */
export async function updatePmTaskContent(
  taskId: string,
  contentBlocks: unknown,
  plainSummary?: string | null
): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const { data: task, error: fetchErr } = await (supabase as any)
    .from("pm_tasks")
    .select("project_id")
    .eq("id", taskId)
    .single();
  if (fetchErr || !task) return { ok: false, error: fetchErr?.message ?? "Not found" };

  const patch: Record<string, unknown> = {
    content_blocks: contentBlocks ?? null,
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (plainSummary !== undefined) {
    patch.description = plainSummary?.trim() || null;
  }

  const { error } = await (supabase as any)
    .from("pm_tasks")
    .update(patch)
    .eq("id", taskId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/projects/${task.project_id}/tasks`);
  return { ok: true };
}

export async function rollProjectCycle(projectId: string): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const { data: project } = await (supabase as any)
    .from("projects")
    .select("pm_cycle_key")
    .eq("id", projectId)
    .single();

  const next = nextCycleKey(project?.pm_cycle_key ?? currentCycleKey());
  const result = await advanceRecurringCycle(supabase as any, projectId, next);
  if (result.error) return { ok: false, error: result.error, created: result.created };
  revalidatePath(`/app/projects/${projectId}`);
  return { ok: true, created: result.created };
}
