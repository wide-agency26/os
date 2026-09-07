"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Block } from "@blocknote/core";
import { createClient } from "@/utils/supabase/client";
import { TaskRow, type TaskRowProfile } from "@/components/pm/TaskRow";
import { TaskDetailPage } from "@/components/pm/TaskDetailPage";
import {
  updatePmTaskStatus,
  updatePmTaskAssignee,
  updatePmTaskContent,
  updatePmTaskClientContent,
  updatePmTaskTitle,
  deletePmTask,
  duplicatePmTask,
  movePmTaskPhase,
} from "@/app/actions/pm";
import { blocksToPlainSummary } from "@/lib/pm/blocknote";
import type { PmTaskStatus } from "@/lib/pm/types";

/**
 * Resolve HR roster person(s) for the signed-in portal user.
 * Prefer people.auth_user_id; fall back to primary_email match and auto-link.
 */
async function resolveMyPersonIds(
  supabase: any,
  userId: string
): Promise<string[]> {
  const { data: byAuth } = await supabase
    .from("people")
    .select("id")
    .eq("auth_user_id", userId);
  const ids = new Set<string>(
    (byAuth || []).map((p: { id: string }) => p.id).filter(Boolean)
  );
  if (ids.size > 0) return [...ids];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = (user?.email || "").trim().toLowerCase();
  if (!email) return [];

  const { data: byEmail } = await supabase
    .from("people")
    .select("id, auth_user_id")
    .ilike("primary_email", email);

  for (const p of byEmail || []) {
    if (!p?.id) continue;
    ids.add(p.id);
    if (!p.auth_user_id) {
      await supabase
        .from("people")
        .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
        .eq("id", p.id)
        .is("auth_user_id", null);
    }
  }
  return [...ids];
}

export function MyWeekClient({
  userId,
  embedded,
}: {
  userId: string;
  embedded?: boolean;
}) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<TaskRowProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const patchTaskLocal = (taskId: string, patch: Record<string, unknown>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );
  };

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const personIds = await resolveMyPersonIds(supabase, userId);

    const { data: peopleRows } = await (supabase as any)
      .from("people")
      .select(
        `id, full_name, auth_user_id, roster_status,
         engagement_types ( key, label )`
      )
      .eq("roster_status", "active")
      .order("full_name");
    setProfiles(
      (peopleRows || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        auth_user_id: p.auth_user_id || null,
        engagement_key: p.engagement_types?.key || null,
        engagement_label: p.engagement_types?.label || null,
      }))
    );

    let query = (supabase as any)
      .from("pm_tasks")
      .select(
        `id, title, status, is_gate, phase_label, cycle_key, last_activity_at,
         project_id, assignee_id, assignee_person_id, default_role, source,
         description, content_blocks, client_content_blocks, task_template_id, sort_order,
         project:project_id ( title, client:client_id ( company, name ) )`
      )
      .in("status", ["todo", "in_progress", "blocked"])
      .order("last_activity_at", { ascending: true });

    if (personIds.length > 0) {
      query = query.or(
        `assignee_id.eq.${userId},assignee_person_id.in.(${personIds.join(",")})`
      );
    } else {
      query = query.eq("assignee_id", userId);
    }

    const { data } = await query;

    const sorted = (data || []).slice().sort((a: any, b: any) => {
      const rank = (t: any) =>
        t.status === "blocked" || (t.is_gate && t.status !== "done")
          ? 0
          : t.status === "in_progress"
            ? 1
            : 2;
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return (
        new Date(a.last_activity_at || 0).getTime() -
        new Date(b.last_activity_at || 0).getTime()
      );
    });
    setTasks(sorted);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [userId]);

  const openTask = useMemo(
    () => tasks.find((t) => t.id === openTaskId) || null,
    [tasks, openTaskId]
  );

  const phaseOptions = useMemo(() => {
    const set = new Set<string>(["General"]);
    for (const t of tasks) {
      if (t.phase_label) set.add(t.phase_label);
    }
    return [...set];
  }, [tasks]);

  const grouped = useMemo(() => {
    const map = new Map<string, { projectId: string; label: string; items: any[] }>();
    for (const t of tasks) {
      const key = t.project_id || "none";
      if (!map.has(key)) {
        const company =
          t.project?.client?.company || t.project?.client?.name || "";
        const title = t.project?.title || "Project";
        map.set(key, {
          projectId: t.project_id,
          label: company ? `${title} · ${company}` : title,
          items: [],
        });
      }
      map.get(key)!.items.push(t);
    }
    return [...map.values()];
  }, [tasks]);

  const setStatus = (taskId: string, status: PmTaskStatus) => {
    const prev = tasks.find((t) => t.id === taskId);
    const prevStatus = prev?.status;
    patchTaskLocal(taskId, { status });
    startTransition(async () => {
      try {
        const res = await updatePmTaskStatus(taskId, status);
        if (!res.ok) {
          if (prevStatus) patchTaskLocal(taskId, { status: prevStatus });
          console.error(res.error || "Could not update task status");
          return;
        }
        if (status === "done" || status === "cancelled") {
          setTasks((list) => list.filter((t) => t.id !== taskId));
          if (openTaskId === taskId) setOpenTaskId(null);
        }
      } catch (err) {
        if (prevStatus) patchTaskLocal(taskId, { status: prevStatus });
        console.error(err);
      }
    });
  };

  return (
    <div>
      {embedded ? null : (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">My Week</h2>
          <p className="text-gray-500 mt-1">
            What needs you now — across every project you&apos;re on.
          </p>
        </div>
      )}

          <h3 className="text-[13px] font-semibold text-text-primary mb-3">Task queue</h3>
      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-text-secondary border border-dashed border-border rounded-lg px-4 py-6">
          Nothing assigned to you yet. Open a project, assign a playbook, and set
          yourself as assignee on tasks.
        </p>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <section
              key={group.projectId || group.label}
              className="border border-border rounded-lg overflow-visible"
            >
              <header className="bg-surface-raised px-3 py-2 flex items-center justify-between gap-2">
                <Link
                  href={`/app/projects/${group.projectId}/tasks`}
                  className="text-sm font-medium text-text-primary hover:underline"
                >
                  {group.label}
                </Link>
                <span className="text-[11px] text-text-muted">
                  {group.items.length} task{group.items.length === 1 ? "" : "s"}
                </span>
              </header>
              <ul className="divide-y divide-gray-100">
                {group.items.map((t) => (
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
                    onAssigneeChange={(id, personId) => {
                      patchTaskLocal(id, { assignee_person_id: personId });
                      startTransition(async () => {
                        await updatePmTaskAssignee(id, personId);
                        // If reassigned away from me, drop from My Week
                        await load();
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
                      });
                    }}
                    onDragStart={() => {}}
                    onDragOver={() => {}}
                    onDrop={() => {}}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

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
          onAssigneeChange={(id, personId) => {
            patchTaskLocal(id, { assignee_person_id: personId });
            startTransition(async () => {
              await updatePmTaskAssignee(id, personId);
              await load();
            });
          }}
          onStatusChange={setStatus}
          onContentSave={(id, blocks: Block[]) => {
            patchTaskLocal(id, { content_blocks: blocks });
            startTransition(async () => {
              await updatePmTaskContent(id, blocks, blocksToPlainSummary(blocks));
            });
          }}
          onClientContentSave={(id, blocks: Block[]) => {
            patchTaskLocal(id, { client_content_blocks: blocks });
            startTransition(async () => {
              await updatePmTaskClientContent(id, blocks);
            });
          }}
        />
      ) : null}
    </div>
  );
}
