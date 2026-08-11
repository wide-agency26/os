"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  GateIcon,
  RecurringIcon,
  TaskStatusBadge,
} from "@/components/pm/PmBadges";
import { updatePmTaskStatus } from "@/app/actions/pm";
import type { PmTaskStatus } from "@/lib/pm/types";
import {
  Building2,
  Briefcase,
  BookOpen,
  ArrowRight,
} from "lucide-react";

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
      // Soft-link so future assignee_id mirrors work for My Week / RLS
      await supabase
        .from("people")
        .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
        .eq("id", p.id)
        .is("auth_user_id", null);
    }
  }
  return [...ids];
}

export function MyWeekClient({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const personIds = await resolveMyPersonIds(supabase, userId);

    let query = (supabase as any)
      .from("pm_tasks")
      .select(
        `id, title, status, is_gate, phase_label, cycle_key, last_activity_at, project_id,
         assignee_id, assignee_person_id,
         project:project_id ( title, client:client_id ( company ) )`
      )
      .in("status", ["todo", "in_progress", "blocked"])
      .order("last_activity_at", { ascending: true });

    // Match either auth mirror (assignee_id) or HR person (assignee_person_id)
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

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">My Week</h2>
        <p className="text-gray-500 mt-1">
          What needs you now — across every project you&apos;re on.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <Link
          href="/app/company-overview"
          className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50"
        >
          <Building2 className="w-5 h-5 text-gray-700" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">Company Overview</div>
            <div className="text-xs text-gray-500">Birds-eye rollup</div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </Link>
        <Link
          href="/app/projects"
          className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50"
        >
          <Briefcase className="w-5 h-5 text-gray-700" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">Clients</div>
            <div className="text-xs text-gray-500">Client list</div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </Link>
        <Link
          href="/app/playbooks"
          className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50"
        >
          <BookOpen className="w-5 h-5 text-gray-700" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">Playbooks</div>
            <div className="text-xs text-gray-500">Services & packages</div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </Link>
      </div>

      <h3 className="text-sm font-medium text-gray-900 mb-3">Task queue</h3>
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg px-4 py-6">
          Nothing assigned to you yet. Open a project, assign a playbook, and set
          yourself as assignee on tasks.
        </p>
      ) : (
        <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {tasks.map((t) => (
            <li key={t.id} className="px-3 py-2.5 flex flex-wrap items-center gap-2 text-sm">
              {t.is_gate || t.status === "blocked" ? <GateIcon /> : null}
              {t.cycle_key ? <RecurringIcon /> : null}
              <div className="flex-1 min-w-[14rem]">
                <div className="text-gray-900">{t.title}</div>
                <Link
                  href={`/app/projects/${t.project_id}/tasks`}
                  className="text-xs text-gray-500 hover:underline"
                >
                  {t.project?.title}
                  {t.project?.client?.company
                    ? ` · ${t.project.client.company}`
                    : ""}
                </Link>
              </div>
              <TaskStatusBadge status={t.status} />
              <select
                disabled={pending}
                className="text-xs border border-gray-200 rounded px-1 py-0.5"
                value={t.status}
                onChange={(e) => {
                  const status = e.target.value as PmTaskStatus;
                  startTransition(async () => {
                    await updatePmTaskStatus(t.id, status);
                    await load();
                  });
                }}
              >
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
