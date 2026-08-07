"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Block } from "@blocknote/core";
import { createClient } from "@/utils/supabase/client";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import { GateIcon } from "@/components/pm/PmBadges";
import { TaskRow } from "@/components/pm/TaskRow";
import { TaskDetailPage } from "@/components/pm/TaskDetailPage";
import {
  updatePmTaskStatus,
  updatePmTaskAssignee,
  updatePmTaskContent,
  updatePmTaskTitle,
  deletePmTask,
  duplicatePmTask,
  movePmTaskPhase,
  reorderPmTasks,
} from "@/app/actions/pm";
import { blocksToPlainSummary } from "@/lib/pm/blocknote";
import type { PmTaskStatus } from "@/lib/pm/types";

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
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const dragIdRef = useRef<string | null>(null);

  const patchTaskLocal = (taskId: string, patch: Record<string, unknown>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );
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

  const phaseOptions = useMemo(
    () => phases.map((p) => p.label),
    [phases]
  );

  const openTask = useMemo(
    () => tasks.find((t) => t.id === openTaskId) ?? null,
    [tasks, openTaskId]
  );

  const setStatus = (id: string, status: PmTaskStatus) => {
    patchTaskLocal(id, {
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    });
    startTransition(async () => {
      await updatePmTaskStatus(id, status);
      await load();
    });
  };

  const saveTaskContent = (taskId: string, blocks: Block[]) => {
    const plain = blocksToPlainSummary(blocks);
    patchTaskLocal(taskId, {
      content_blocks: blocks,
      description: plain || null,
    });
    startTransition(async () => {
      await updatePmTaskContent(taskId, blocks, plain);
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
            // Existing collapse-when-done phase wrapper — unchanged
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
            const visibleItems = phase.items.filter(
              (t) => t.status !== "blocked" || !openGate
            );

            return (
              <section
                key={phase.label}
                className="border border-gray-200 rounded-lg overflow-visible"
              >
                <header className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
                  {phase.label}
                </header>
                <ul className="divide-y divide-gray-100">
                  {openGate && blockedStack.length > 0 ? (
                    <li className="px-3 py-2.5 flex items-center gap-2 text-sm bg-amber-50 text-amber-950">
                      <GateIcon />
                      Blocked — waiting on “{openGate.title}” (
                      {blockedStack.length} tasks gated)
                    </li>
                  ) : null}
                  {visibleItems.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      profiles={profiles}
                      phaseOptions={phaseOptions}
                      disabled={pending}
                      onOpen={setOpenTaskId}
                      onToggleDone={(id, done) =>
                        setStatus(id, done ? "done" : "todo")
                      }
                      onTitleChange={(id, title) => {
                        patchTaskLocal(id, { title });
                        startTransition(async () => {
                          await updatePmTaskTitle(id, title);
                        });
                      }}
                      onAssigneeChange={(id, assigneeId) => {
                        patchTaskLocal(id, { assignee_id: assigneeId });
                        startTransition(async () => {
                          await updatePmTaskAssignee(id, assigneeId);
                        });
                      }}
                      onDelete={(id) => {
                        setTasks((prev) => prev.filter((x) => x.id !== id));
                        if (openTaskId === id) setOpenTaskId(null);
                        startTransition(async () => {
                          await deletePmTask(id);
                        });
                      }}
                      onDuplicate={(id) => {
                        startTransition(async () => {
                          await duplicatePmTask(id);
                          await load();
                        });
                      }}
                      onMovePhase={(id, label) => {
                        patchTaskLocal(id, {
                          phase_label: label === "General" ? null : label,
                        });
                        startTransition(async () => {
                          await movePmTaskPhase(
                            id,
                            label === "General" ? null : label
                          );
                          await load();
                        });
                      }}
                      onDragStart={(id) => {
                        dragIdRef.current = id;
                      }}
                      onDragOver={() => {}}
                      onDrop={(targetId) => {
                        const fromId = dragIdRef.current;
                        dragIdRef.current = null;
                        if (!fromId || fromId === targetId) return;

                        const ids = visibleItems.map((x) => x.id);
                        const fromIdx = ids.indexOf(fromId);
                        const toIdx = ids.indexOf(targetId);
                        if (fromIdx < 0 || toIdx < 0) return;

                        const next = [...ids];
                        next.splice(fromIdx, 1);
                        next.splice(toIdx, 0, fromId);

                        const orderMap = new Map(next.map((id, i) => [id, i]));
                        setTasks((prev) =>
                          [...prev].sort((a, b) => {
                            const aPhase = a.phase_label || "General";
                            const bPhase = b.phase_label || "General";
                            if (aPhase !== phase.label || bPhase !== phase.label) {
                              return (a.sort_order ?? 0) - (b.sort_order ?? 0);
                            }
                            return (
                              (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
                            );
                          }).map((t) =>
                            orderMap.has(t.id)
                              ? { ...t, sort_order: orderMap.get(t.id) }
                              : t
                          )
                        );

                        startTransition(async () => {
                          await reorderPmTasks(next);
                        });
                      }}
                    />
                  ))}
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
            <div
              key={col.key}
              className="border border-gray-200 rounded-lg bg-gray-50/50"
            >
              <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 px-3 py-2">
                {col.label}
              </h3>
              <ul className="space-y-2 p-2 min-h-[8rem]">
                {tasks
                  .filter((t) => t.status === col.key)
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

      {view === "board" && tasks.some((t) => t.status === "blocked") ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-amber-900 bg-amber-50 rounded px-3 py-2">
          <GateIcon />
          Blocked — gated work hidden from board (
          {tasks.filter((t) => t.status === "blocked").length} tasks)
        </p>
      ) : null}

      {openTask ? (
        <TaskDetailPage
          task={openTask}
          profiles={profiles}
          open
          onClose={() => setOpenTaskId(null)}
          onTitleChange={(id, title) => {
            patchTaskLocal(id, { title });
            startTransition(async () => {
              await updatePmTaskTitle(id, title);
            });
          }}
          onAssigneeChange={(id, assigneeId) => {
            patchTaskLocal(id, { assignee_id: assigneeId });
            startTransition(async () => {
              await updatePmTaskAssignee(id, assigneeId);
            });
          }}
          onStatusChange={setStatus}
          onContentSave={saveTaskContent}
        />
      ) : null}
    </ProjectPmShell>
  );
}
