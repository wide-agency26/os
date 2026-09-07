"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Block } from "@blocknote/core";
import { createClient } from "@/utils/supabase/client";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import { GateIcon } from "@/components/pm/PmBadges";
import { TaskRow } from "@/components/pm/TaskRow";
import { TaskBoardCard } from "@/components/pm/TaskBoardCard";
import { TaskDetailPage } from "@/components/pm/TaskDetailPage";
import { AssignWithProjectCompensationModal } from "@/components/hr/AssignWithProjectCompensationModal";
import {
  updatePmTaskStatus,
  updatePmTaskAssignee,
  updatePmTaskContent,
  updatePmTaskClientContent,
  updatePmTaskTitle,
  deletePmTask,
  duplicatePmTask,
  movePmTaskPhase,
  reorderPmTasks,
  createPmTasksBulk,
  deletePmTasksBulk,
  assignPlaybookToProject,
  setPmTaskClientVisible,
  setProjectTaskPolicy,
} from "@/app/actions/pm";
import { blocksToPlainSummary } from "@/lib/pm/blocknote";
import { needsProjectCompensationOnAssign } from "@/lib/hr/types";
import type { PmTaskStatus } from "@/lib/pm/types";
import { DoneSummary } from "@/components/frappe-ui/primitives";

type Props = { projectId: string };

const COLUMNS: { key: PmTaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

type PendingAssign = {
  taskId: string;
  personId: string;
  personName: string | null;
  engagementKey: string | null;
};

export function ProjectTasksClient({ projectId }: Props) {
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [suggestionsByTemplate, setSuggestionsByTemplate] = useState<
    Record<string, import("@/lib/hr/suggest").RosterSuggestPerson[]>
  >({});
  const [view, setView] = useState<"board" | "list">("list");
  const [showDonePhases, setShowDonePhases] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [pendingAssign, setPendingAssign] = useState<PendingAssign | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [playbooks, setPlaybooks] = useState<{ id: string; name: string }[]>([]);
  const [playbookId, setPlaybookId] = useState("");
  const dragIdRef = useRef<string | null>(null);

  const patchTaskLocal = (taskId: string, patch: Record<string, unknown>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );
  };

  const commitAssignee = (taskId: string, personId: string | null) => {
    patchTaskLocal(taskId, { assignee_person_id: personId });
    startTransition(async () => {
      await updatePmTaskAssignee(taskId, personId);
    });
  };

  const requestAssigneeChange = async (
    taskId: string,
    personId: string | null
  ) => {
    if (!personId) {
      commitAssignee(taskId, null);
      return;
    }
    const profile = profiles.find((p) => p.id === personId);
    if (!needsProjectCompensationOnAssign(profile?.engagement_key)) {
      commitAssignee(taskId, personId);
      return;
    }

    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data: linked } = await (supabase as any)
      .from("compensation_records")
      .select("id")
      .eq("person_id", personId)
      .eq("project_id", projectId)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .limit(1);

    if (linked?.length) {
      commitAssignee(taskId, personId);
      return;
    }

    setPendingAssign({
      taskId,
      personId,
      personName: profile?.full_name || null,
      engagementKey: profile?.engagement_key || null,
    });
  };

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: proj } = await (supabase as any)
      .from("projects")
      .select(`id, title, status, task_policy, client:client_id ( company, name )`)
      .eq("id", projectId)
      .single();
    setProject(proj);

    const { data: taskRows } = await (supabase as any)
      .from("pm_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });
    setTasks(taskRows || []);

    const { data: pkgs } = await (supabase as any)
      .from("package_playbooks")
      .select(`id, package:package_id ( name )`)
      .order("created_at");
    setPlaybooks(
      (pkgs || []).map((p: any) => ({
        id: p.id,
        name: p.package?.name || "Playbook",
      }))
    );

    const { data: roster } = await (supabase as any)
      .from("people")
      .select(
        `
        id, full_name, auth_user_id, engagement_type_id, roster_status,
        engagement_types ( key, label, assignable_to_tasks ),
        person_skills ( skill_id, skills ( label ) )
      `
      )
      .eq("roster_status", "active")
      .order("full_name");

    const rosterAssignable = (roster || []).filter(
      (p: any) => p.engagement_types?.assignable_to_tasks !== false
    );

    setProfiles(
      rosterAssignable.map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        engagement_label: p.engagement_types?.label || null,
        engagement_key: p.engagement_types?.key || null,
        auth_user_id: p.auth_user_id || null,
      }))
    );

    // Precompute RACI suggestions for template-backed tasks
    const templateIds = [
      ...new Set(
        (taskRows || [])
          .map((t: any) => t.task_template_id)
          .filter(Boolean) as string[]
      ),
    ];
    const suggestMap: Record<string, any[]> = {};
    if (templateIds.length && rosterAssignable.length) {
      const { scorePeopleForRoles } = await import("@/lib/hr/suggest");
      const { data: roles } = await (supabase as any)
        .from("playbook_step_roles")
        .select("task_template_id, raci, required_skill_id, required_engagement_type_id")
        .in("task_template_id", templateIds);
      const byTemplate = new Map<string, any[]>();
      for (const r of roles || []) {
        const list = byTemplate.get(r.task_template_id) || [];
        list.push(r);
        byTemplate.set(r.task_template_id, list);
      }
      for (const tid of templateIds) {
        const specs = byTemplate.get(tid) || [];
        if (!specs.length) continue;
        suggestMap[tid] = scorePeopleForRoles(rosterAssignable, specs).slice(0, 8);
      }
    }
    setSuggestionsByTemplate(suggestMap);

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

  useEffect(() => {
    if (!openTaskId) return;
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await (supabase as any)
        .from("pm_tasks")
        .select("content_blocks, client_content_blocks, description")
        .eq("id", openTaskId)
        .maybeSingle();
      if (cancelled || !data) return;
      patchTaskLocal(openTaskId, {
        content_blocks: data.content_blocks,
        client_content_blocks: data.client_content_blocks,
        description: data.description,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [openTaskId]);

  const refreshTasksOnly = async () => {
    const supabase = createClient();
    const { data: taskRows } = await (supabase as any)
      .from("pm_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });
    setTasks(taskRows || []);
  };

  const revertRef = useRef<Record<string, { status: PmTaskStatus; completed_at: string | null }>>(
    {}
  );

  const setStatus = (id: string, status: PmTaskStatus) => {
    setTasks((prev) => {
      const current = prev.find((t) => t.id === id);
      if (current) {
        revertRef.current[id] = {
          status: current.status,
          completed_at: current.completed_at ?? null,
        };
      }
      return prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status,
              completed_at: status === "done" ? new Date().toISOString() : null,
            }
          : t
      );
    });
    void updatePmTaskStatus(id, status).then((res) => {
      if (!res?.ok && revertRef.current[id]) {
        patchTaskLocal(id, revertRef.current[id]);
        return;
      }
      if (res?.refreshTasks) void refreshTasksOnly();
    });
  };

  const setClientVisible = (id: string, visible: boolean) => {
    patchTaskLocal(id, { client_visible: visible });
    startTransition(async () => {
      await setPmTaskClientVisible(id, visible);
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

  const saveClientTaskContent = (taskId: string, blocks: Block[]) => {
    patchTaskLocal(taskId, { client_content_blocks: blocks });
    startTransition(async () => {
      await updatePmTaskClientContent(taskId, blocks);
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
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`text-xs px-3 py-1 rounded-md ${view === "list" ? "bg-accent text-white" : "text-text-secondary"}`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView("board")}
            className={`text-xs px-3 py-1 rounded-md ${view === "board" ? "bg-accent text-white" : "text-text-secondary"}`}
          >
            Board
          </button>
        </div>
        <label className="text-xs text-text-secondary flex items-center gap-2">
          <span className="text-text-muted">Retitle policy</span>
          <select
            className="border border-border rounded-md px-2 py-1 bg-surface text-text-primary"
            value={project?.task_policy || "default"}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value as "locked" | "default" | "free";
              setProject((p: any) => (p ? { ...p, task_policy: next } : p));
              startTransition(async () => {
                const res = await setProjectTaskPolicy(projectId, next);
                if (!res.ok) alert(res.error || "Could not save policy");
              });
            }}
          >
            <option value="default">Default (global rules)</option>
            <option value="locked">Locked</option>
            <option value="free">Free</option>
          </select>
        </label>
        <p className="text-[11px] text-text-muted">
          Eye icon: show or hide each task on the client board (default show).
        </p>
        <label className="text-xs text-text-secondary flex items-center gap-2">
          <input
            type="checkbox"
            checked={showDonePhases}
            onChange={(e) => setShowDonePhases(e.target.checked)}
          />
          Show completed phases
        </label>
      </div>

      {project?.status === "pipeline" && (
        <p className="text-[11px] text-gray-500 mb-3">
          Tasks are for after the contract. You can still sketch them here.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          className={`text-xs font-semibold rounded-lg border px-3 py-1.5 ${
            selectMode
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200"
          }`}
          onClick={() => {
            setSelectMode((v) => !v);
            if (selectMode) setSelected(new Set());
          }}
        >
          {selectMode ? "Done selecting" : "Select"}
        </button>
        <button
          type="button"
          className="text-xs font-semibold rounded-lg border border-gray-200 px-3 py-1.5"
          onClick={() => setShowBulk((v) => !v)}
        >
          Add many
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            className="text-xs font-semibold rounded-lg border border-red-200 text-red-700 px-3 py-1.5"
            onClick={() => {
              const ids = [...selected];
              setTasks((prev) => prev.filter((t) => !selected.has(t.id)));
              setSelected(new Set());
              startTransition(async () => {
                await deletePmTasksBulk(projectId, ids);
              });
            }}
          >
            Delete selected ({selected.size})
          </button>
        )}
      </div>
      {showBulk && (
        <div className="mb-4 rounded-lg border border-gray-200 p-3 space-y-2">
          <textarea
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm min-h-[80px]"
            placeholder="One task title per line"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          {playbooks.length > 0 && (
            <select
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              value={playbookId}
              onChange={(e) => setPlaybookId(e.target.value)}
            >
              <option value="">Or seed from a playbook…</option>
              {playbooks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-gray-900 text-white text-xs font-semibold px-3 py-1.5"
            onClick={() => {
              const titles = bulkText.split("\n");
              const pb = playbookId;
              startTransition(async () => {
                if (pb) await assignPlaybookToProject(projectId, pb);
                if (titles.some((t) => t.trim())) {
                  await createPmTasksBulk(projectId, titles);
                }
                setBulkText("");
                setPlaybookId("");
                setShowBulk(false);
                await load();
              });
            }}
          >
            Add tasks
          </button>
        </div>
      )}

      {view === "list" ? (
        <div className="space-y-3">
          {phases.map((phase) => {
            // Existing collapse-when-done phase wrapper — unchanged
            if (phase.allDone && !showDonePhases) {
              return (
                <DoneSummary
                  key={phase.label}
                  label={phase.label}
                  count={phase.items.length}
                  onExpand={() => setShowDonePhases(true)}
                />
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
                    <li key={t.id} className="flex items-start gap-2 px-2">
                      {selectMode ? (
                        <input
                          type="checkbox"
                          className="mt-3"
                          checked={selected.has(t.id)}
                          aria-label={`Select ${t.title}`}
                          onChange={(e) => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(t.id);
                              else next.delete(t.id);
                              return next;
                            });
                          }}
                        />
                      ) : null}
                      <div className="flex-1 min-w-0">
                    <TaskRow
                      key={t.id}
                      task={t}
                      profiles={profiles}
                      phaseOptions={phaseOptions}
                      onOpen={setOpenTaskId}
                      onToggleDone={(id, done) =>
                        setStatus(id, done ? "done" : "todo")
                      }
                      onClientVisibleChange={setClientVisible}
                      onTitleChange={(id, title) => {
                        const prev = tasks.find((t) => t.id === id)?.title;
                        patchTaskLocal(id, { title });
                        startTransition(async () => {
                          const res = await updatePmTaskTitle(id, title, {
                            materialChange: true,
                          });
                          if (!res.ok) {
                            if (prev !== undefined) patchTaskLocal(id, { title: prev });
                            alert(res.error || "Retitle blocked");
                          }
                        });
                      }}
                      onAssigneeChange={(id, personId) => {
                        void requestAssigneeChange(id, personId);
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
                      </div>
                    </li>
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
                <span className="ml-1.5 font-normal text-gray-400">
                  {tasks.filter((t) => t.status === col.key).length}
                </span>
              </h3>
              <ul className="space-y-2 p-2 min-h-[8rem]">
                {tasks
                  .filter((t) => t.status === col.key)
                  .map((t) => (
                    <TaskBoardCard
                      key={t.id}
                      task={t}
                      profiles={profiles}
                      disabled={false}
                      onOpen={setOpenTaskId}
                      onTitleChange={(id, title) => {
                        const prev = tasks.find((t) => t.id === id)?.title;
                        patchTaskLocal(id, { title });
                        startTransition(async () => {
                          const res = await updatePmTaskTitle(id, title, {
                            materialChange: true,
                          });
                          if (!res.ok) {
                            if (prev !== undefined) patchTaskLocal(id, { title: prev });
                            alert(res.error || "Retitle blocked");
                          }
                        });
                      }}
                      onAssigneeChange={(id, personId) => {
                        void requestAssigneeChange(id, personId);
                      }}
                      onStatusChange={setStatus}
                      onToggleDone={(id, done) =>
                        setStatus(id, done ? "done" : "todo")
                      }
                      onClientVisibleChange={setClientVisible}
                    />
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
            const prev = tasks.find((t) => t.id === id)?.title;
            patchTaskLocal(id, { title });
            startTransition(async () => {
              const res = await updatePmTaskTitle(id, title, {
                materialChange: true,
              });
              if (!res.ok) {
                if (prev !== undefined) patchTaskLocal(id, { title: prev });
                alert(res.error || "Retitle blocked");
              }
            });
          }}
          onAssigneeChange={(id, personId) => {
            void requestAssigneeChange(id, personId);
          }}
          onStatusChange={setStatus}
          onContentSave={saveTaskContent}
          onClientContentSave={saveClientTaskContent}
          suggestions={
            openTask.task_template_id
              ? suggestionsByTemplate[openTask.task_template_id] || []
              : []
          }
        />
      ) : null}

      {pendingAssign ? (
        <AssignWithProjectCompensationModal
          projectId={projectId}
          projectTitle={project?.title}
          personId={pendingAssign.personId}
          personName={pendingAssign.personName}
          defaultModel={
            pendingAssign.engagementKey === "recurring_freelancer"
              ? "retainer"
              : "hourly_invoice"
          }
          onCancel={() => setPendingAssign(null)}
          onSaved={() => {
            const { taskId, personId } = pendingAssign;
            setPendingAssign(null);
            commitAssignee(taskId, personId);
          }}
        />
      ) : null}
    </ProjectPmShell>
  );
}
