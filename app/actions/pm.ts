"use server";

import { revalidatePath } from "next/cache";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { createClient } from "@/utils/supabase/server";
import {
  advanceRecurringCycle,
  instantiatePackagePlaybook,
} from "@/lib/pm/instantiate";
import { nextCycleKey, currentCycleKey, type PmTaskStatus } from "@/lib/pm/types";

export type PmActionResult = {
  ok: boolean;
  error?: string;
  created?: number;
  refreshTasks?: boolean;
};

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
  return { ok: true, created: result.created };
}

export async function updatePmTaskStatus(
  taskId: string,
  status: PmTaskStatus
): Promise<PmActionResult> {
  try {
    const gate = await requireAgencyStaff();
    if (!gate.ok) return { ok: false, error: "Staff only." };

    const supabase = await createClient();
    const { data: task, error: fetchErr } = await (supabase as any)
      .from("pm_tasks")
      .select("id, project_id, is_gate, task_template_id, status, started_at")
      .eq("id", taskId)
      .single();

    if (fetchErr || !task) return { ok: false, error: fetchErr?.message ?? "Task not found" };

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status,
      last_activity_at: now,
      updated_at: now,
    };

    if (!task.started_at && status !== "todo" && status !== "cancelled") {
      patch.started_at = now;
    }
    if (status === "done") {
      patch.completed_at = now;
      patch.closed_by = gate.user!.id;
    } else if (task.status === "done") {
      patch.completed_at = null;
      patch.closed_by = null;
    }

    const { error } = await (supabase as any).from("pm_tasks").update(patch).eq("id", taskId);
    if (error) return { ok: false, error: error.message };

    let refreshTasks = false;
    if (status === "done" && task.is_gate && task.project_id) {
      try {
        await unblockAfterGate(supabase as any, task.project_id, task.task_template_id);
        refreshTasks = true;
      } catch (err: any) {
        console.error("unblockAfterGate failed", err);
        return {
          ok: false,
          error: err?.message || "Task marked done, but gate unblock failed.",
        };
      }
    }

    return { ok: true, refreshTasks };
  } catch (err: any) {
    console.error("updatePmTaskStatus failed", err);
    return { ok: false, error: err?.message || "Could not update task status" };
  }
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
  /** HR roster people.id — null to unassign */
  personId: string | null
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

  let authUserId: string | null = null;
  if (personId) {
    const { data: person, error: personErr } = await (supabase as any)
      .from("people")
      .select(
        "id, auth_user_id, primary_email, roster_status, engagement_types ( assignable_to_tasks )"
      )
      .eq("id", personId)
      .single();
    if (personErr || !person) {
      return { ok: false, error: personErr?.message ?? "Person not found in HR roster" };
    }
    if (person.roster_status !== "active") {
      return { ok: false, error: "Only active roster people can be assigned." };
    }
    if (person.engagement_types?.assignable_to_tasks === false) {
      return {
        ok: false,
        error: "This engagement type is not assignable to project tasks.",
      };
    }
    authUserId = person.auth_user_id || null;

    // If HR person isn't linked to a portal login yet, match by primary_email
    if (!authUserId && person.primary_email) {
      const { data: linkedId } = await (supabase as any).rpc(
        "link_person_to_auth_by_email",
        { p_person_id: personId }
      );
      if (linkedId) authUserId = linkedId as string;
    }
  }

  const { error } = await (supabase as any)
    .from("pm_tasks")
    .update({
      assignee_person_id: personId,
      // Keep profile mirror for My Week / RLS when the person has a portal login
      assignee_id: authUserId,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/projects/${task.project_id}`);
  revalidatePath("/app/home");

  // Keep accounting ledger in sync with assignment changes (Phase 1 hook).
  try {
    const { syncProjectAssignmentCosts } = await import("@/lib/accounting/sync");
    await syncProjectAssignmentCosts(task.project_id);
    revalidatePath("/app/accounting");
  } catch (e) {
    console.error("ledger sync after assignee change failed", e);
  }

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
  revalidatePath("/app/client-tasks");
  return { ok: true };
}

export async function updatePmTaskClientContent(
  taskId: string,
  clientContentBlocks: unknown
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
      client_content_blocks: clientContentBlocks ?? null,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/projects/${task.project_id}/tasks`);
  revalidatePath("/app/client-tasks");
  return { ok: true };
}

export async function updatePmTaskTitle(
  taskId: string,
  title: string,
  opts?: { materialChange?: boolean }
): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title required." };

  const supabase = await createClient();
  const { data: task, error: fetchErr } = await (supabase as any)
    .from("pm_tasks")
    .select("id, title, project_id, retitle_count")
    .eq("id", taskId)
    .single();
  if (fetchErr || !task) return { ok: false, error: fetchErr?.message ?? "Not found" };

  const { data: project } = await (supabase as any)
    .from("projects")
    .select("task_policy")
    .eq("id", task.project_id)
    .maybeSingle();

  const {
    assertRetitleAllowed,
    loadGlobalTaskPolicy,
    parseProjectTaskPolicy,
  } = await import("@/lib/pm/task-policy");
  const global = await loadGlobalTaskPolicy();
  const gateTitle = assertRetitleAllowed({
    currentTitle: task.title || "",
    nextTitle: trimmed,
    retitleCount: Number(task.retitle_count) || 0,
    projectPolicy: parseProjectTaskPolicy(project?.task_policy),
    global,
    materialChange: opts?.materialChange === true,
  });
  if (!gateTitle.allowed) {
    return { ok: false, error: gateTitle.error || "Retitle not allowed." };
  }

  const { error } = await (supabase as any)
    .from("pm_tasks")
    .update({
      title: trimmed,
      retitle_count: gateTitle.nextRetitleCount ?? task.retitle_count ?? 0,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/projects/${task.project_id}/tasks`);
  return { ok: true };
}

export async function deletePmTask(taskId: string): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const { data: task, error: fetchErr } = await (supabase as any)
    .from("pm_tasks")
    .select("project_id")
    .eq("id", taskId)
    .single();
  if (fetchErr || !task) return { ok: false, error: fetchErr?.message ?? "Not found" };

  const { error } = await (supabase as any).from("pm_tasks").delete().eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/projects/${task.project_id}/tasks`);
  revalidatePath("/app/home");
  return { ok: true };
}

export async function setPmTaskClientVisible(
  taskId: string,
  visible: boolean
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
      client_visible: visible,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/projects/${task.project_id}/tasks`);
  revalidatePath("/app/client-tasks");
  return { ok: true };
}

export async function duplicatePmTask(taskId: string): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };

  const supabase = await createClient();
  const { data: task, error: fetchErr } = await (supabase as any)
    .from("pm_tasks")
    .select("*")
    .eq("id", taskId)
    .single();
  if (fetchErr || !task) return { ok: false, error: fetchErr?.message ?? "Not found" };

  const now = new Date().toISOString();
  const { error } = await (supabase as any).from("pm_tasks").insert({
    project_id: task.project_id,
    task_template_id: task.task_template_id,
    title: `${task.title} (copy)`,
    description: task.description,
    content_blocks: task.content_blocks ?? null,
    assignee_id: task.assignee_id,
    assignee_person_id: task.assignee_person_id ?? null,
    default_role: task.default_role,
    status: "todo",
    is_gate: false,
    depends_on: null,
    phase_label: task.phase_label,
    source: "manual",
    source_ref: null,
    cycle_key: task.cycle_key,
    estimated_duration_hours: task.estimated_duration_hours,
    sort_order: (task.sort_order ?? 0) + 1,
    last_activity_at: now,
    started_at: null,
    completed_at: null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/projects/${task.project_id}/tasks`);
  return { ok: true };
}

export async function movePmTaskPhase(
  taskId: string,
  phaseLabel: string | null
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
      phase_label: phaseLabel,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/projects/${task.project_id}/tasks`);
  return { ok: true };
}

/** Persist sort_order for tasks within a phase after drag-reorder. */
export async function reorderPmTasks(
  orderedIds: string[]
): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };
  if (!orderedIds.length) return { ok: true };

  const supabase = await createClient();
  const { data: first } = await (supabase as any)
    .from("pm_tasks")
    .select("project_id")
    .eq("id", orderedIds[0])
    .single();

  const now = new Date().toISOString();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await (supabase as any)
      .from("pm_tasks")
      .update({ sort_order: i, updated_at: now })
      .eq("id", orderedIds[i]);
    if (error) return { ok: false, error: error.message };
  }

  if (first?.project_id) {
    revalidatePath(`/app/projects/${first.project_id}/tasks`);
  }
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

export async function createPmTasksBulk(
  projectId: string,
  titles: string[]
): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };
  const cleaned = titles.map((t) => t.trim()).filter(Boolean);
  if (!cleaned.length) return { ok: false, error: "Add at least one task title." };

  const supabase = await createClient();
  const { data: maxRow } = await (supabase as any)
    .from("pm_tasks")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = (maxRow?.sort_order ?? 0) + 1;
  const now = new Date().toISOString();
  const rows = cleaned.map((title, i) => ({
    project_id: projectId,
    title,
    status: "todo",
    source: "manual",
    sort_order: base + i,
    last_activity_at: now,
  }));
  const { error } = await (supabase as any).from("pm_tasks").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/projects/${projectId}/tasks`);
  return { ok: true, created: rows.length };
}

export async function deletePmTasksBulk(
  projectId: string,
  taskIds: string[]
): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };
  if (!taskIds.length) return { ok: true };
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("pm_tasks")
    .delete()
    .eq("project_id", projectId)
    .in("id", taskIds);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/projects/${projectId}/tasks`);
  return { ok: true };
}

export async function getGlobalTaskPolicyAction(): Promise<
  | { ok: true; policy: import("@/lib/pm/task-policy").GlobalTaskPolicy }
  | { ok: false; error: string }
> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };
  const { loadGlobalTaskPolicy } = await import("@/lib/pm/task-policy");
  return { ok: true, policy: await loadGlobalTaskPolicy() };
}

export async function saveGlobalTaskPolicyAction(
  patch: Partial<import("@/lib/pm/task-policy").GlobalTaskPolicy>
): Promise<
  | { ok: true; policy: import("@/lib/pm/task-policy").GlobalTaskPolicy }
  | { ok: false; error: string }
> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };
  try {
    const { saveGlobalTaskPolicy } = await import("@/lib/pm/task-policy");
    const policy = await saveGlobalTaskPolicy(patch);
    revalidatePath("/app/settings/pm");
    return { ok: true, policy };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function setProjectTaskPolicy(
  projectId: string,
  taskPolicy: "locked" | "default" | "free"
): Promise<PmActionResult> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };
  if (taskPolicy !== "locked" && taskPolicy !== "default" && taskPolicy !== "free") {
    return { ok: false, error: "Invalid task policy." };
  }
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("projects")
    .update({ task_policy: taskPolicy, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/projects/${projectId}/tasks`);
  revalidatePath(`/app/projects/${projectId}/portal`);
  return { ok: true };
}
