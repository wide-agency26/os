"use server";

/**
 * Impact analysis before deleting an HR roster person.
 */
export async function getPersonDeleteImpact(personId: string) {
  const { createClient } = await import("@/utils/supabase/server");
  const { requireAgencyStaff } = await import("@/lib/auth-guards");
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false as const, error: "Staff only." };

  const supabase = await createClient();

  const { data: tasks } = await (supabase as any)
    .from("pm_tasks")
    .select(`id, title, status, project_id, project:project_id ( title )`)
    .eq("assignee_person_id", personId);

  const openTasks = (tasks || [])
    .filter((t: any) => t.status !== "done" && t.status !== "cancelled")
    .map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      project_id: t.project_id,
      project_title: t.project?.title ?? null,
    }));

  const doneTasks = (tasks || []).filter(
    (t: any) => t.status === "done" || t.status === "cancelled"
  ).length;

  const [
    { count: compensationRecords },
    { count: overheadCosts },
    { count: esopAllocations },
    { count: documents },
    { count: pipelineLinks },
  ] = await Promise.all([
    (supabase as any)
      .from("compensation_records")
      .select("id", { count: "exact", head: true })
      .eq("person_id", personId),
    (supabase as any)
      .from("person_overhead_costs")
      .select("id", { count: "exact", head: true })
      .eq("person_id", personId),
    (supabase as any)
      .from("esop_allocations")
      .select("id", { count: "exact", head: true })
      .eq("person_id", personId),
    (supabase as any)
      .from("hr_documents")
      .select("id", { count: "exact", head: true })
      .eq("person_id", personId),
    (supabase as any)
      .from("roster_pipeline")
      .select("id", { count: "exact", head: true })
      .eq("converted_person_id", personId),
  ]);

  return {
    ok: true as const,
    impact: {
      openTasks,
      doneTasks,
      compensationRecords: compensationRecords || 0,
      overheadCosts: overheadCosts || 0,
      esopAllocations: esopAllocations || 0,
      documents: documents || 0,
      pipelineLinks: pipelineLinks || 0,
    },
  };
}
