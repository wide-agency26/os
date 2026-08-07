"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import type { Block } from "@blocknote/core";
import { createClient } from "@/utils/supabase/client";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import {
  GateIcon,
  RecurringIcon,
  EmailSourceIcon,
  TaskStatusBadge,
} from "@/components/pm/PmBadges";
import {
  updatePmTaskStatus,
  updatePmTaskAssignee,
  updatePmTaskContent,
} from "@/app/actions/pm";
import {
  blocksToPlainSummary,
  initialBlocksForTask,
} from "@/lib/pm/blocknote";
import type { PmTaskStatus } from "@/lib/pm/types";

const TaskContentEditor = dynamic(
  () =>
    import("@/components/pm/TaskContentEditor").then((m) => m.TaskContentEditor),
  {
    ssr: false,
    loading: () => (
      <p className="text-xs text-gray-400 px-1 py-2">Loading editor…</p>
    ),
  }
);

type Props = { projectId: string };

const COLUMNS: { key: PmTaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export function ProjectTasksClient({ projectId }: Props) {
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [view, setView] = useState<"board" | "list">("list");
  const [showDonePhases, setShowDonePhases] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const saveTaskContent = (taskId: string, blocks: Block[]) => {
    const plain = blocksToPlainSummary(blocks);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, content_blocks: blocks, description: plain || null }
          : t
      )
    );
    startTransition(async () => {
      await updatePmTaskContent(taskId, blocks, plain);
    });
  };

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: proj } = await (supabase as any)
      .from("projects")
      .select(`id, title, client:client_id ( company, name )`)
      .eq("id", projectId)
      .single();
    setProject(proj);

    const { data: taskRows } = await (supabase as any)
      .from("pm_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });
    setTasks(taskRows || []);

    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name");
    setProfiles(people || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const phases = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of tasks) {
      const key = t.phase_label || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).map(([label, items]) => {
      const allDone = items.every(
        (t) => t.status === "done" || t.status === "cancelled"
      );
      const blockedLine = items.find(
        (t) => t.status === "blocked" || (t.is_gate && t.status !== "done")
      );
      return { label, items, allDone, blockedLine };
    });
  }, [tasks]);

  const setStatus = (id: string, status: PmTaskStatus) => {
    startTransition(async () => {
      await updatePmTaskStatus(id, status);
      await load();
    });
  };

  const clientLabel =
    project?.client?.company || project?.client?.name || undefined;

  if (loading) {
    return <div className="text-sm text-gray-500 p-6">Loading tasks…</div>;
  }

  return (
    <ProjectPmShell
      projectId={projectId}
      title={project?.title || "Project"}
      clientLabel={clientLabel}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1 rounded border border-gray-200 p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`text-xs px-3 py-1 rounded ${view === "list" ? "bg-gray-900 text-white" : "text-gray-600"}`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView("board")}
            className={`text-xs px-3 py-1 rounded ${view === "board" ? "bg-gray-900 text-white" : "text-gray-600"}`}
          >
            Board
          </button>
        </div>
        <label className="text-xs text-gray-500 flex items-center gap-2">
          <input
            type="checkbox"
            checked={showDonePhases}
            onChange={(e) => setShowDonePhases(e.target.checked)}
          />
          Show completed phases
        </label>
      </div>

      {view === "list" ? (
        <div className="space-y-3">
          {phases.map((phase) => {
            if (phase.allDone && !showDonePhases) {
              return (
                <button
                  key={phase.label}
                  type="button"
                  onClick={() => setShowDonePhases(true)}
                  className="w-full text-left text-sm text-gray-500 border border-dashed border-gray-200 rounded px-3 py-2 hover:bg-gray-50"
                >
                  ✓ {phase.label} — completed ({phase.items.length} tasks)
                </button>
              );
            }

            const openGate = phase.items.find(
              (t) => t.is_gate && t.status !== "done" && t.status !== "cancelled"
            );
            const blockedStack = phase.items.filter((t) => t.status === "blocked");

            return (
              <section key={phase.label} className="border border-gray-200 rounded-lg overflow-hidden">
                <header className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
                  {phase.label}
                </header>
                <ul className="divide-y divide-gray-100">
                  {openGate && blockedStack.length > 0 ? (
                    <li className="px-3 py-2.5 flex items-center gap-2 text-sm bg-amber-50 text-amber-950">
                      <GateIcon />
                      Blocked — waiting on “{openGate.title}” ({blockedStack.length} tasks gated)
                    </li>
                  ) : null}
                  {phase.items
                    .filter((t) => t.status !== "blocked" || !openGate)
                    .map((t) => {
                      const expanded = expandedTaskId === t.id;
                      return (
                        <li key={t.id} className="text-sm">
                          {/* Row header — collapse/gate logic above is unchanged */}
                          <div className="px-3 py-2.5 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-label={expanded ? "Collapse task" : "Expand task"}
                              onClick={() =>
                                setExpandedTaskId(expanded ? null : t.id)
                              }
                              className="text-gray-400 hover:text-gray-700 w-4 shrink-0"
                            >
                              {expanded ? "▾" : "▸"}
                            </button>
                            {t.is_gate ? (
                              <GateIcon cleared={t.status === "done"} />
                            ) : null}
                            {t.cycle_key ? <RecurringIcon /> : null}
                            {t.source === "email" ? <EmailSourceIcon /> : null}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTaskId(expanded ? null : t.id)
                              }
                              className="flex-1 min-w-[12rem] text-left text-gray-900 hover:underline"
                            >
                              {t.title}
                            </button>
                            {t.default_role ? (
                              <span className="text-xs text-gray-400">
                                {t.default_role}
                              </span>
                            ) : null}
                            <TaskStatusBadge status={t.status} />
                            <select
                              disabled={pending}
                              className="text-xs border border-gray-200 rounded px-1 py-0.5 max-w-[8rem]"
                              value={t.assignee_id || ""}
                              onChange={(e) => {
                                const v = e.target.value || null;
                                startTransition(async () => {
                                  await updatePmTaskAssignee(t.id, v);
                                  await load();
                                });
                              }}
                            >
                              <option value="">Unassigned</option>
                              {profiles.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.full_name || p.id.slice(0, 8)}
                                </option>
                              ))}
                            </select>
                            <select
                              disabled={pending}
                              className="text-xs border border-gray-200 rounded px-1 py-0.5"
                              value={t.status}
                              onChange={(e) =>
                                setStatus(t.id, e.target.value as PmTaskStatus)
                              }
                            >
                              {COLUMNS.map((c) => (
                                <option key={c.key} value={c.key}>
                                  {c.label}
                                </option>
                              ))}
                              <option value="blocked">Blocked</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                          {expanded ? (
                            <div className="px-3 pb-3 pl-9">
                              <TaskContentEditor
                                taskId={t.id}
                                initialContent={initialBlocksForTask(t)}
                                onSave={(blocks) => saveTaskContent(t.id, blocks)}
                              />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                </ul>
              </section>
            );
          })}
          {phases.length === 0 ? (
            <p className="text-sm text-gray-500">
              No tasks yet. Assign a package playbook from Overview.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.key} className="border border-gray-200 rounded-lg bg-gray-50/50">
              <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 px-3 py-2">
                {col.label}
              </h3>
              <ul className="space-y-2 p-2 min-h-[8rem]">
                {tasks
                  .filter((t) => t.status === col.key)
                  .filter((t) => {
                    // Collapse blocked into single signal — don't show blocked on board columns
                    return true;
                  })
                  .map((t) => (
                    <li
                      key={t.id}
                      className="bg-white border border-gray-200 rounded p-2 text-sm shadow-sm"
                    >
                      <div className="flex items-start gap-1.5">
                        {t.is_gate ? <GateIcon cleared={false} /> : null}
                        <span className="text-gray-900">{t.title}</span>
                      </div>
                      <div className="mt-2 flex gap-1">
                        {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            disabled={pending}
                            onClick={() => setStatus(t.id, c.key)}
                            className="text-[10px] text-gray-500 hover:text-gray-900 underline"
                          >
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Single blocked line for board */}
      {view === "board" && tasks.some((t) => t.status === "blocked") ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-amber-900 bg-amber-50 rounded px-3 py-2">
          <GateIcon />
          Blocked — gated work hidden from board (
          {tasks.filter((t) => t.status === "blocked").length} tasks)
        </p>
      ) : null}
    </ProjectPmShell>
  );
}
