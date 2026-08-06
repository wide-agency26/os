"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import {
  GateIcon,
  ReviewQueueBadge,
  StaleBadge,
  TaskStatusBadge,
} from "@/components/pm/PmBadges";
import { assignPlaybookToProject } from "@/app/actions/pm";
import { PM_ICONS } from "@/lib/pm/icons";
import Link from "next/link";

type Props = { projectId: string };

export function ProjectOverviewClient({ projectId }: Props) {
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [selectedPlaybook, setSelectedPlaybook] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: proj } = await (supabase as any)
      .from("projects")
      .select(
        `id, title, status, package_playbook_id, pm_cycle_key, client:client_id ( company, name )`
      )
      .eq("id", projectId)
      .single();
    setProject(proj);

    const { data: taskRows } = await (supabase as any)
      .from("pm_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });
    setTasks(taskRows || []);

    const { count } = await (supabase as any)
      .from("task_review_queue")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "pending");
    setReviewCount(count || 0);

    const { data: pkgs } = await (supabase as any)
      .from("package_playbooks")
      .select(`id, cadence_type, package:package_id ( name )`)
      .order("created_at");
    setPackages(pkgs || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.status !== "cancelled"),
    [tasks]
  );

  const activeGate = useMemo(
    () => openTasks.find((t) => t.is_gate && t.status !== "done"),
    [openTasks]
  );

  const lastActivity = useMemo(() => {
    if (!tasks.length) return null;
    return tasks.reduce(
      (max: string | null, t: any) =>
        !max || new Date(t.last_activity_at) > new Date(max) ? t.last_activity_at : max,
      null as string | null
    );
  }, [tasks]);

  const currentPhase = useMemo(() => {
    const t = openTasks.find((x) => x.status === "in_progress") || openTasks[0];
    return t?.phase_label || "—";
  }, [openTasks]);

  const nextMilestones = useMemo(
    () => openTasks.filter((t) => t.status !== "blocked").slice(0, 5),
    [openTasks]
  );

  const clientLabel =
    project?.client?.company || project?.client?.name || undefined;

  const onAssign = () => {
    if (!selectedPlaybook) return;
    setMessage("");
    startTransition(async () => {
      const res = await assignPlaybookToProject(projectId, selectedPlaybook);
      if (!res.ok) setMessage(res.error || "Failed");
      else setMessage(`Created ${res.created ?? 0} tasks from playbook.`);
      await load();
    });
  };

  if (loading) {
    return <div className="text-sm text-gray-500 p-6">Loading project…</div>;
  }

  return (
    <ProjectPmShell
      projectId={projectId}
      title={project?.title || "Project"}
      clientLabel={clientLabel}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Status: {project?.status || "—"}</span>
            <StaleBadge lastActivityAt={lastActivity} />
            {reviewCount > 0 ? (
              <Link href={`/app/projects/${projectId}/review`}>
                <ReviewQueueBadge count={reviewCount} />
              </Link>
            ) : null}
            {project?.pm_cycle_key ? (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                <PM_ICONS.recurring className="w-3.5 h-3.5" />
                Cycle {project.pm_cycle_key}
              </span>
            ) : null}
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-2">Current phase</h2>
            <p className="text-lg text-gray-800">{currentPhase}</p>
            {activeGate ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-amber-900 bg-amber-50 rounded px-3 py-2">
                <GateIcon />
                Blocked — waiting on “{activeGate.title}”
              </p>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-sm text-emerald-800">
                <GateIcon cleared />
                No active gate
              </p>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">Next milestones</h2>
            {nextMilestones.length === 0 ? (
              <p className="text-sm text-gray-500">
                {tasks.length === 0
                  ? "Assign a package playbook to generate tasks."
                  : "No open milestones."}
              </p>
            ) : (
              <ul className="space-y-2">
                {nextMilestones.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    {t.is_gate ? <GateIcon /> : null}
                    <span className="flex-1 text-gray-800">{t.title}</span>
                    <TaskStatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-2">Package playbook</h2>
            {project?.package_playbook_id ? (
              <p className="text-sm text-gray-600">
                Assigned · {tasks.length} tasks instantiated
              </p>
            ) : (
              <>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mb-2"
                  value={selectedPlaybook}
                  onChange={(e) => setSelectedPlaybook(e.target.value)}
                >
                  <option value="">Select package…</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.package?.name || p.id} ({p.cadence_type})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedPlaybook || pending}
                  onClick={onAssign}
                  className="w-full text-sm bg-gray-900 text-white rounded px-3 py-1.5 disabled:opacity-50"
                >
                  {pending ? "Assigning…" : "Assign & generate tasks"}
                </button>
              </>
            )}
            {message ? <p className="text-xs text-gray-600 mt-2">{message}</p> : null}
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-2">Attention</h2>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>{openTasks.filter((t) => t.status === "in_progress").length} in progress</li>
              <li>{openTasks.filter((t) => t.status === "blocked").length} blocked</li>
              <li>{tasks.filter((t) => t.status === "done").length} done</li>
              <li>
                <Link
                  href={`/app/projects/${projectId}/review`}
                  className="underline hover:text-gray-900"
                >
                  {reviewCount} in review queue
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </ProjectPmShell>
  );
}
