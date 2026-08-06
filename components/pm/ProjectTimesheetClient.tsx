"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import { TaskStatusBadge } from "@/components/pm/PmBadges";

type Props = { projectId: string };

export function ProjectTimesheetClient({ projectId }: Props) {
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: proj } = await (supabase as any)
        .from("projects")
        .select(`id, title, client:client_id ( company, name )`)
        .eq("id", projectId)
        .single();
      setProject(proj);

      const { data: taskRows } = await (supabase as any)
        .from("pm_tasks")
        .select(
          "id, title, default_role, status, estimated_duration_hours, phase_label"
        )
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
      setTasks(taskRows || []);
      setLoading(false);
    }
    void load();
  }, [projectId]);

  const rows = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "cancelled")
      .map((t) => ({
        ...t,
        estimated: Number(t.estimated_duration_hours || 0),
      }));
  }, [tasks]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        estimated: acc.estimated + (r.estimated || 0),
        remaining:
          acc.remaining +
          (r.status === "done" ? 0 : r.estimated || 0),
      }),
      { estimated: 0, remaining: 0 }
    );
  }, [rows]);

  if (loading) {
    return <div className="text-sm text-gray-500 p-6">Loading timesheet…</div>;
  }

  return (
    <ProjectPmShell
      projectId={projectId}
      title={project?.title || "Project"}
      clientLabel={project?.client?.company || project?.client?.name}
    >
      <p className="text-sm text-gray-500 mb-4">
        Estimated hours from the playbook. Actual hours are paused until we have a
        reliable time source — no auto-running clock.
      </p>

      <div className="flex gap-6 text-sm mb-4">
        <div>
          <span className="text-gray-500">Playbook estimate </span>
          <span className="font-medium">{totals.estimated.toFixed(1)}h</span>
        </div>
        <div>
          <span className="text-gray-500">Remaining (open tasks) </span>
          <span className="font-medium">{totals.remaining.toFixed(1)}h</span>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Est.</th>
              <th className="px-3 py-2">Actual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-gray-500 text-center">
                  No tasks yet. Assign a package playbook from Overview.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-gray-900">{r.title}</td>
                  <td className="px-3 py-2 text-gray-500">{r.default_role || "—"}</td>
                  <td className="px-3 py-2">
                    <TaskStatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2">{r.estimated}h</td>
                  <td className="px-3 py-2 text-gray-400">—</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ProjectPmShell>
  );
}
