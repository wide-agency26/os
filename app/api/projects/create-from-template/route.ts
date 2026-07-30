import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/projects/create-from-template
 * 
 * Creates a project and auto-generates tasks from a project template.
 * Follows ERPNext's `copy_from_template` pattern:
 *   1. Create the project
 *   2. Fetch all template tasks
 *   3. Create erp_tasks with calculated dates (start_offset_days + duration_days)
 *   4. Map dependencies between created tasks
 * 
 * Body: { title, client_id, template_id, expected_start_date?, status?, priority?, ... }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, client_id, template_id, ...projectFields } = body;

    if (!title || !client_id) {
      return NextResponse.json({ error: "title and client_id are required" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. If template provided, fetch template + tasks
    let templateData: any = null;
    let templateTasks: any[] = [];

    if (template_id) {
      const { data: tmpl } = await (supabase as any)
        .from("project_templates")
        .select("*, project_type_id")
        .eq("id", template_id)
        .single();
      templateData = tmpl;

      const { data: tasks } = await (supabase as any)
        .from("project_template_tasks")
        .select("*")
        .eq("template_id", template_id)
        .order("sort_order", { ascending: true });
      templateTasks = tasks || [];
    }

    // 2. Create the project
    const projectPayload: any = {
      title,
      client_id,
      status: projectFields.status || "running",
      priority: projectFields.priority || "Medium",
      expected_start_date: projectFields.expected_start_date || new Date().toISOString().slice(0, 10),
      expected_end_date: projectFields.expected_end_date || null,
      estimated_cost: projectFields.estimated_cost || 0,
      scope: projectFields.scope || null,
      department: projectFields.department || null,
      completion_method: projectFields.completion_method || "Task Completion",
      project_template_id: template_id || null,
      project_type_id: templateData?.project_type_id || projectFields.project_type_id || null,
    };

    const { data: project, error: projectError } = await (supabase as any)
      .from("projects")
      .insert(projectPayload)
      .select()
      .single();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    // 3. Create tasks from template
    const createdTasks: any[] = [];
    if (templateTasks.length > 0) {
      const startDate = new Date(project.expected_start_date || new Date());

      for (const tmplTask of templateTasks) {
        const taskStart = addBusinessDays(startDate, tmplTask.start_offset_days || 0);
        const taskEnd = addBusinessDays(taskStart, (tmplTask.duration_days || 1) - 1);

        const { data: task, error: taskError } = await (supabase as any)
          .from("erp_tasks")
          .insert({
            project_id: project.id,
            workspace_id: project.workspace_id || null,
            title: tmplTask.title,
            description: tmplTask.description || null,
            status: "Todo",
            priority: tmplTask.priority || "Medium",
            weight: tmplTask.weight || 0,
            expected_start_date: taskStart.toISOString().slice(0, 10),
            expected_end_date: taskEnd.toISOString().slice(0, 10),
            expected_time: tmplTask.expected_time || 0,
            is_milestone: tmplTask.is_milestone || false,
          })
          .select()
          .single();

        if (taskError) {
          console.error("Error creating task:", taskError);
          continue;
        }

        createdTasks.push({ ...task, template_sort: tmplTask.sort_order, template_depends_on: tmplTask.depends_on_task_idx });
      }

      // 4. Map dependencies
      for (const task of createdTasks) {
        if (task.template_depends_on != null) {
          const dependsOnTask = createdTasks.find(t => t.template_sort === task.template_depends_on);
          if (dependsOnTask) {
            await (supabase as any)
              .from("erp_task_dependencies")
              .insert({
                task_id: task.id,
                depends_on_task_id: dependsOnTask.id,
              });
          }
        }
      }
    }

    return NextResponse.json({
      project,
      tasks_created: createdTasks.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Add business days (skip weekends) */
function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}
