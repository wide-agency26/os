import type { SupabaseClient } from "@supabase/supabase-js";
import { currentCycleKey } from "@/lib/pm/types";

type Sb = SupabaseClient<any, "public", any>;

/**
 * Instantiate pm_tasks from a package playbook onto a project.
 * - one_off packages: all templates once
 * - recurring: setup (recurs=false) once + current cycle (recurs=true) only
 * Never materializes future cycles beyond current (+ preview is UI-only).
 */
export async function instantiatePackagePlaybook(
  supabase: Sb,
  projectId: string,
  packagePlaybookId: string,
  options?: { cycleKey?: string; previewOnly?: boolean }
): Promise<{ created: number; error?: string }> {
  const cycleKey = options?.cycleKey ?? currentCycleKey();

  const { data: pkg, error: pkgErr } = await supabase
    .from("package_playbooks")
    .select("id, cadence_type")
    .eq("id", packagePlaybookId)
    .single();

  if (pkgErr || !pkg) {
    return { created: 0, error: pkgErr?.message ?? "Package playbook not found" };
  }

  const { data: members, error: memErr } = await supabase
    .from("package_playbook_members")
    .select("service_playbook_id, sequence_group, parallel")
    .eq("package_playbook_id", packagePlaybookId)
    .order("sequence_group", { ascending: true });

  if (memErr) return { created: 0, error: memErr.message };
  if (!members?.length) return { created: 0, error: "Package has no service members" };

  const { data: gates } = await supabase
    .from("package_playbook_gates")
    .select("after_task_template_id, blocks_service_playbook_id")
    .eq("package_playbook_id", packagePlaybookId);

  const blockedServiceIds = new Set(
    (gates ?? []).map((g: { blocks_service_playbook_id: string }) => g.blocks_service_playbook_id)
  );

  // Already instantiated?
  const { count } = await supabase
    .from("pm_tasks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("source", "template");

  if ((count ?? 0) > 0 && !options?.previewOnly) {
    return { created: 0, error: "Project already has playbook tasks. Clear or regenerate explicitly." };
  }

  if (options?.previewOnly) {
    return { created: 0 };
  }

  const rows: Record<string, unknown>[] = [];
  let sortBase = 0;

  for (const member of members) {
    const { data: templates } = await supabase
      .from("task_templates")
      .select("*")
      .eq("service_playbook_id", member.service_playbook_id)
      .order("sort_order", { ascending: true });

    if (!templates?.length) continue;

    const serviceBlocked = blockedServiceIds.has(member.service_playbook_id);

    for (const t of templates) {
      const isRecurringPkg = pkg.cadence_type === "recurring";
      // For recurring packages: include setup once + current cycle recurs tasks
      if (isRecurringPkg && t.recurs === false) {
        // setup — always include at start
      } else if (isRecurringPkg && t.recurs === true) {
        // current cycle only
      } else if (!isRecurringPkg) {
        // one-off: all templates
      }

      // Skip future-only: we never generate next cycle here
      const taskCycle =
        isRecurringPkg && t.recurs ? cycleKey : isRecurringPkg && !t.recurs ? null : null;

      rows.push({
        project_id: projectId,
        task_template_id: t.id,
        title: t.title,
        description: t.description,
        default_role: t.default_role,
        status: serviceBlocked && !t.is_gate ? "blocked" : "todo",
        is_gate: t.is_gate,
        phase_label: t.phase_label,
        source: "template",
        cycle_key: taskCycle,
        estimated_duration_hours: t.estimated_duration_hours,
        sort_order: sortBase + (t.sort_order ?? 0),
        last_activity_at: new Date().toISOString(),
      });
    }
    sortBase += 100;
  }

  if (!rows.length) return { created: 0, error: "No templates to instantiate" };

  const { error: insErr } = await supabase.from("pm_tasks").insert(rows);
  if (insErr) return { created: 0, error: insErr.message };

  await supabase
    .from("projects")
    .update({
      package_playbook_id: packagePlaybookId,
      pm_cycle_key: pkg.cadence_type === "recurring" ? cycleKey : null,
    })
    .eq("id", projectId);

  return { created: rows.length };
}

/**
 * When a recurring cycle closes, materialize next cycle's recurs:true templates only.
 */
export async function advanceRecurringCycle(
  supabase: Sb,
  projectId: string,
  nextKey: string
): Promise<{ created: number; error?: string }> {
  const { data: project } = await supabase
    .from("projects")
    .select("package_playbook_id, pm_cycle_key")
    .eq("id", projectId)
    .single();

  if (!project?.package_playbook_id) {
    return { created: 0, error: "No package playbook on project" };
  }

  const { data: existing } = await supabase
    .from("pm_tasks")
    .select("id")
    .eq("project_id", projectId)
    .eq("cycle_key", nextKey)
    .limit(1);

  if (existing?.length) return { created: 0, error: "Next cycle already exists" };

  const { data: members } = await supabase
    .from("package_playbook_members")
    .select("service_playbook_id")
    .eq("package_playbook_id", project.package_playbook_id);

  const rows: Record<string, unknown>[] = [];
  let sortBase = 0;

  for (const member of members ?? []) {
    const { data: templates } = await supabase
      .from("task_templates")
      .select("*")
      .eq("service_playbook_id", member.service_playbook_id)
      .eq("recurs", true)
      .order("sort_order", { ascending: true });

    for (const t of templates ?? []) {
      rows.push({
        project_id: projectId,
        task_template_id: t.id,
        title: t.title,
        description: t.description,
        default_role: t.default_role,
        status: "todo",
        is_gate: t.is_gate,
        phase_label: t.phase_label,
        source: "template",
        cycle_key: nextKey,
        estimated_duration_hours: t.estimated_duration_hours,
        sort_order: sortBase + (t.sort_order ?? 0),
        last_activity_at: new Date().toISOString(),
      });
    }
    sortBase += 100;
  }

  if (!rows.length) return { created: 0, error: "No recurring templates" };

  const { error } = await supabase.from("pm_tasks").insert(rows);
  if (error) return { created: 0, error: error.message };

  await supabase.from("projects").update({ pm_cycle_key: nextKey }).eq("id", projectId);
  return { created: rows.length };
}
