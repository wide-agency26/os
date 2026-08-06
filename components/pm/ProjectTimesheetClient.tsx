"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";

type Props = { projectId: string };

function hoursBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return null;
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

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
          "id, title, default_role, status, started_at, completed_at, estimated_duration_hours, phase_label"
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
      .filter((t) => t.started_at || t.status === "done")
      .map((t) => {
        const actual = hoursBetween(t.started_at, t.completed_at ?? new Date().toISOString());
        const estimated = Number(t.estimated_duration_hours || 0);
        return {
          ...t,
          actual,
          estimated,
          delta: actual != null ? Math.round((actual - estimated) * 10) / 10 : null,
        };
      });
  }, [tasks]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        estimated: acc.estimated + (r.estimated || 0),
        actual: acc.actual + (r.actual || 0),
      }),
      { estimated: 0, actual: 0 }
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
        Derived from task status transitions (in progress → done). No manual entry.
      </p>

      <div className="flex gap-6 text-sm mb-4">
        <div>
          <span className="text-gray-500">Estimated </span>
          <span className="font-medium">{totals.estimated.toFixed(1)}h</span>
        </div>
        <div>
          <span className="text-gray-500">Actual </span>
          <span className="font-medium">{totals.actual.toFixed(1)}h</span>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Est.</th>
              <th className="px-3 py-2">Actual</th>
              <th className="px-3 py-2">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-gray-500 text-center">
                  No timed work yet. Move tasks to In progress, then Done.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-gray-900">{r.title}</td>
                  <td className="px-3 py-2 text-gray-500">{r.default_role || "—"}</td>
                  <td className="px-3 py-2">{r.estimated}h</td>
                  <td className="px-3 py-2">
                    {r.actual != null ? `${r.actual}h` : "—"}
                    {r.status !== "done" && r.started_at ? (
                      <span className="text-xs text-sky-700 ml-1">(running)</span>
                    ) : null}
                  </td>
                  <td
                    className={`px-3 py-2 ${
                      r.delta != null && r.delta > 0
                        ? "text-amber-700"
                        : r.delta != null && r.delta < 0
                          ? "text-emerald-700"
                          : "text-gray-400"
                    }`}
                  >
                    {r.delta != null ? `${r.delta > 0 ? "+" : ""}${r.delta}h` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ProjectPmShell>
  );
}
