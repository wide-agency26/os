"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  Search,
  RefreshCw,
  Users,
  Briefcase,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { GateIcon, StaleBadge, ReviewQueueBadge } from "@/components/pm/PmBadges";
import { PM_ICONS } from "@/lib/pm/icons";
import { ClientIntakeChart } from "@/components/pm/ClientIntakeChart";
import {
  ATTENTION_LABELS,
  ATTENTION_SEVERITY,
  ACTIVITY_LABELS,
  type ActivityEvent,
  type ActivityEventType,
  type AttentionSignal,
  formatUpdatedAgo,
  needsAttention,
  projectAttentionSignal,
  worstAttention,
} from "@/lib/pm/attention";

type ClientRow = {
  id: string;
  label: string;
  company: string | null;
  name: string;
  status: string | null;
  start_date: string | null;
  contract_value: number | null;
  services_package: unknown;
  signal: AttentionSignal;
  projectCount: number;
  openTaskCount: number;
  pendingReview: number;
  lastActivityAt: string | null;
  projects: { id: string; title: string; signal: AttentionSignal }[];
};

const SIGNAL_FILTERS: Array<AttentionSignal | "all"> = [
  "all",
  "stale",
  "blocked",
  "pending_review",
  "on_track",
];

const ACTIVITY_FILTERS: Array<ActivityEventType | "all"> = [
  "all",
  "gate_cleared",
  "task_completed",
  "pending_review",
  "cycle_regenerated",
];

function SignalIcons({ signal }: { signal: AttentionSignal }) {
  if (signal === "blocked") return <GateIcon />;
  if (signal === "stale") {
    return <PM_ICONS.stale className="w-3.5 h-3.5 text-red-600 shrink-0" />;
  }
  if (signal === "pending_review") {
    return <PM_ICONS.pendingReview className="w-3.5 h-3.5 text-indigo-700 shrink-0" />;
  }
  return <PM_ICONS.gateCleared className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
}

export function ClientsHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signalFilter = (searchParams.get("signal") as AttentionSignal | "all") || "all";
  const activityFilter =
    (searchParams.get("activity") as ActivityEventType | "all") || "all";

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [rawCustomers, setRawCustomers] = useState<any[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [stats, setStats] = useState({
    activeClients: 0,
    activeProjects: 0,
    needingAttention: 0,
    teamLoad: 0,
  });
  const [staleAfter, setStaleAfter] = useState(7);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `/app/projects?${qs}` : "/app/projects", { scroll: false });
  };

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: sett } = await (supabase as any)
      .from("pm_settings")
      .select("stale_after_days")
      .eq("id", 1)
      .maybeSingle();
    const staleDays = sett?.stale_after_days ?? 7;
    setStaleAfter(staleDays);

    const { data: customers } = await (supabase as any)
      .from("crm_customers")
      .select(
        "id, name, company, status, start_date, contract_value, services_package, subscriber_status"
      )
      .order("company", { ascending: true });
    setRawCustomers(customers || []);

    const { data: projects } = await (supabase as any)
      .from("projects")
      .select("id, title, status, client_id, pm_cycle_key, package_playbook_id");

    const projectIds = (projects || []).map((p: any) => p.id);

    const [{ data: tasks }, { data: queue }, { data: recentDone }, { data: recentQueue }] =
      await Promise.all([
        projectIds.length
          ? (supabase as any)
              .from("pm_tasks")
              .select(
                "id, project_id, title, status, is_gate, last_activity_at, completed_at, assignee_id, cycle_key, source, created_at"
              )
              .in("project_id", projectIds)
          : Promise.resolve({ data: [] }),
        projectIds.length
          ? (supabase as any)
              .from("task_review_queue")
              .select("id, project_id, status")
              .in("project_id", projectIds)
              .eq("status", "pending")
          : Promise.resolve({ data: [] }),
        projectIds.length
          ? (supabase as any)
              .from("pm_tasks")
              .select(
                "id, project_id, title, is_gate, completed_at, cycle_key, created_at, status"
              )
              .in("project_id", projectIds)
              .eq("status", "done")
              .not("completed_at", "is", null)
              .order("completed_at", { ascending: false })
              .limit(40)
          : Promise.resolve({ data: [] }),
        projectIds.length
          ? (supabase as any)
              .from("task_review_queue")
              .select("id, project_id, proposed_title, created_at, status")
              .in("project_id", projectIds)
              .eq("status", "pending")
              .order("created_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [] }),
      ]);

    const tasksByProject = new Map<string, any[]>();
    for (const t of tasks || []) {
      if (!tasksByProject.has(t.project_id)) tasksByProject.set(t.project_id, []);
      tasksByProject.get(t.project_id)!.push(t);
    }

    const reviewByProject = new Map<string, number>();
    for (const q of queue || []) {
      reviewByProject.set(
        q.project_id,
        (reviewByProject.get(q.project_id) || 0) + 1
      );
    }

    const projectMeta = new Map<
      string,
      { title: string; clientId: string | null; signal: AttentionSignal }
    >();

    const activeProjectStatuses = new Set(["running", "active", "open", null, undefined, ""]);
    let activeProjectCount = 0;
    const assigneeSet = new Set<string>();

    for (const p of projects || []) {
      const pts = tasksByProject.get(p.id) || [];
      const open = pts.filter(
        (t) => t.status !== "done" && t.status !== "cancelled"
      );
      const lastActivity = pts.reduce(
        (max: string | null, t: any) =>
          !max || new Date(t.last_activity_at) > new Date(max)
            ? t.last_activity_at
            : max,
        null as string | null
      );
      const hasOpenGate = open.some(
        (t) => t.is_gate && t.status !== "done" && t.status !== "cancelled"
      );
      const signal = projectAttentionSignal(
        {
          id: p.id,
          clientId: p.client_id,
          status: p.status,
          lastActivityAt: lastActivity,
          hasOpenGate,
          pendingReviewCount: reviewByProject.get(p.id) || 0,
          hasOpenPmTasks: open.length > 0,
        },
        staleDays
      );
      projectMeta.set(p.id, {
        title: p.title,
        clientId: p.client_id,
        signal,
      });

      const isActive =
        !p.status ||
        activeProjectStatuses.has(p.status) ||
        p.status === "running";
      if (isActive && p.status !== "completed" && p.status !== "expired") {
        activeProjectCount += 1;
      }

      for (const t of open) {
        if (t.assignee_id) assigneeSet.add(t.assignee_id);
      }
    }

    const customerById = new Map<string, any>(
      (customers || []).map((c: any) => [c.id as string, c])
    );

    const rows: ClientRow[] = (customers || []).map((c: any) => {
      const clientProjects = (projects || []).filter(
        (p: any) => p.client_id === c.id
      );
      const signals = clientProjects.map(
        (p: any) => projectMeta.get(p.id)!.signal
      );
      const signal = worstAttention(signals);
      let lastActivityAt: string | null = null;
      let openTaskCount = 0;
      let pendingReview = 0;
      for (const p of clientProjects) {
        pendingReview += reviewByProject.get(p.id) || 0;
        const pts = tasksByProject.get(p.id) || [];
        openTaskCount += pts.filter(
          (t) => t.status !== "done" && t.status !== "cancelled"
        ).length;
        for (const t of pts) {
          if (
            !lastActivityAt ||
            new Date(t.last_activity_at) > new Date(lastActivityAt)
          ) {
            lastActivityAt = t.last_activity_at;
          }
        }
      }
      return {
        id: c.id,
        label: c.company || c.name,
        company: c.company,
        name: c.name,
        status: c.status,
        start_date: c.start_date,
        contract_value: c.contract_value,
        services_package: c.services_package,
        signal,
        projectCount: clientProjects.length,
        openTaskCount,
        pendingReview,
        lastActivityAt,
        projects: clientProjects.map((p: any) => ({
          id: p.id,
          title: p.title,
          signal: projectMeta.get(p.id)!.signal,
        })),
      };
    });

    // Sort: attention severity desc, then last activity asc (quietest first within band)
    rows.sort((a, b) => {
      const d =
        ATTENTION_SEVERITY[b.signal] - ATTENTION_SEVERITY[a.signal];
      if (d !== 0) return d;
      const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return ta - tb;
    });

    setClients(rows);

    const needingAttention = rows.filter((r) => needsAttention(r.signal)).length;
    const activeClientCount = rows.filter((r) =>
      r.projects.some((p) => {
        const proj = (projects || []).find((x: any) => x.id === p.id);
        return proj && proj.status !== "completed" && proj.status !== "expired";
      })
    ).length;

    setStats({
      activeClients: activeClientCount,
      activeProjects: activeProjectCount,
      needingAttention,
      teamLoad: assigneeSet.size,
    });

    // Activity feed
    const events: ActivityEvent[] = [];
    for (const t of recentDone || []) {
      const meta = projectMeta.get(t.project_id);
      const cust = meta?.clientId ? customerById.get(meta.clientId) : null;
      const at = t.completed_at;
      if (!at || !meta) continue;
      events.push({
        id: `done-${t.id}`,
        type: t.is_gate ? "gate_cleared" : "task_completed",
        at,
        title: t.title,
        projectId: t.project_id,
        projectTitle: meta.title,
        clientId: meta.clientId,
        clientLabel: cust?.company || cust?.name || "—",
      });
    }
    for (const q of recentQueue || []) {
      const meta = projectMeta.get(q.project_id);
      const cust = meta?.clientId ? customerById.get(meta.clientId) : null;
      if (!meta) continue;
      events.push({
        id: `review-${q.id}`,
        type: "pending_review",
        at: q.created_at,
        title: q.proposed_title,
        projectId: q.project_id,
        projectTitle: meta.title,
        clientId: meta.clientId,
        clientLabel: cust?.company || cust?.name || "—",
      });
    }
    // Cycle regenerated: template tasks created with a cycle_key in last 30d
    for (const t of tasks || []) {
      if (!t.cycle_key || t.source !== "template") continue;
      const created = t.created_at;
      if (!created) continue;
      const age = Date.now() - new Date(created).getTime();
      if (age > 30 * 86400000) continue;
      const meta = projectMeta.get(t.project_id);
      const cust = meta?.clientId ? customerById.get(meta.clientId) : null;
      if (!meta) continue;
      events.push({
        id: `cycle-${t.project_id}-${t.cycle_key}`,
        type: "cycle_regenerated",
        at: created,
        title: `Cycle ${t.cycle_key}`,
        projectId: t.project_id,
        projectTitle: meta.title,
        clientId: meta.clientId,
        clientLabel: cust?.company || cust?.name || "—",
      });
    }

    // Dedupe cycle events by project+cycle
    const seen = new Set<string>();
    const deduped = events.filter((e) => {
      if (e.type !== "cycle_regenerated") return true;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
    deduped.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
    setActivity(deduped.slice(0, 50));

    setFetchedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (signalFilter !== "all" && c.signal !== signalFilter) return false;
      if (!q) return true;
      if (c.label.toLowerCase().includes(q)) return true;
      if (c.name?.toLowerCase().includes(q)) return true;
      return c.projects.some((p) => p.title.toLowerCase().includes(q));
    });
  }, [clients, query, signalFilter]);

  const filteredActivity = useMemo(() => {
    if (activityFilter === "all") return activity;
    return activity.filter((e) => e.type === activityFilter);
  }, [activity, activityFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clients</h2>
          <p className="text-gray-500 mt-1 text-sm">
            Attention-first rollup across every client and their projects.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            updated {formatUpdatedAgo(fetchedAt)}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs border border-gray-300 rounded px-2.5 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/app/projects/project"
            className="text-xs text-gray-600 underline"
          >
            All projects →
          </Link>
        </div>
      </div>

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to any client or project…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-500"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Active clients",
            value: stats.activeClients,
            icon: Users,
          },
          {
            label: "Active projects",
            value: stats.activeProjects,
            icon: Briefcase,
          },
          {
            label: "Needing attention",
            value: stats.needingAttention,
            icon: AlertTriangle,
            alert: stats.needingAttention > 0,
          },
          {
            label: "Team load this week",
            value: stats.teamLoad,
            icon: UserCheck,
            hint: "people with open assigned tasks",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="border border-gray-200 rounded-lg px-4 py-3 bg-white"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                {s.label}
              </p>
              <s.icon className="w-4 h-4 text-gray-400" />
            </div>
            <p
              className={`text-2xl font-semibold mt-1 ${
                s.alert ? "text-red-700" : "text-gray-900"
              }`}
            >
              {loading ? "…" : s.value}
            </p>
            {"hint" in s && s.hint ? (
              <p className="text-[11px] text-gray-400 mt-0.5">{s.hint}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-medium text-gray-900">Clients</h3>
            <div className="flex flex-wrap gap-1">
              {SIGNAL_FILTERS.map((f) => {
                const active = signalFilter === f;
                const label = f === "all" ? "All" : ATTENTION_LABELS[f];
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setParam("signal", f)}
                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                      active
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white overflow-hidden">
            {loading ? (
              <p className="p-6 text-sm text-gray-500">Loading clients…</p>
            ) : filteredClients.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">No clients match.</p>
            ) : (
              filteredClients.map((c) => (
                <div key={c.id} className="px-4 py-3 hover:bg-gray-50/80">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <SignalIcons signal={c.signal} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/app/crm/${c.id}`}
                          className="text-sm font-medium text-gray-900 hover:underline"
                        >
                          {c.label}
                        </Link>
                        <span className="text-[11px] text-gray-500">
                          {ATTENTION_LABELS[c.signal]}
                        </span>
                        {c.signal === "stale" ? (
                          <StaleBadge
                            lastActivityAt={c.lastActivityAt}
                            staleAfterDays={staleAfter}
                          />
                        ) : null}
                        {c.pendingReview > 0 ? (
                          <ReviewQueueBadge count={c.pendingReview} />
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.projectCount} project{c.projectCount === 1 ? "" : "s"}
                        {c.openTaskCount
                          ? ` · ${c.openTaskCount} open tasks`
                          : ""}
                      </p>
                      {c.projects.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {c.projects
                            .slice()
                            .sort(
                              (a, b) =>
                                ATTENTION_SEVERITY[b.signal] -
                                ATTENTION_SEVERITY[a.signal]
                            )
                            .map((p) => (
                              <li key={p.id}>
                                <Link
                                  href={`/app/projects/${p.id}`}
                                  className="inline-flex items-center gap-1.5 text-xs text-gray-700 hover:underline"
                                >
                                  <SignalIcons signal={p.signal} />
                                  {p.title}
                                </Link>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">No projects yet</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="lg:col-span-2 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-medium text-gray-900">Recent activity</h3>
            <div className="flex flex-wrap gap-1">
              {ACTIVITY_FILTERS.map((f) => {
                const active = activityFilter === f;
                const label = f === "all" ? "All" : ACTIVITY_LABELS[f];
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setParam("activity", f)}
                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                      active
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white max-h-[36rem] overflow-y-auto">
            {loading ? (
              <p className="p-6 text-sm text-gray-500">Loading…</p>
            ) : filteredActivity.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">No recent events.</p>
            ) : (
              filteredActivity.map((e) => (
                <div key={e.id} className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    {e.type === "gate_cleared" ? (
                      <GateIcon cleared />
                    ) : e.type === "pending_review" ? (
                      <PM_ICONS.pendingReview className="w-3.5 h-3.5" />
                    ) : e.type === "cycle_regenerated" ? (
                      <PM_ICONS.recurring className="w-3.5 h-3.5" />
                    ) : (
                      <PM_ICONS.gateCleared className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    {ACTIVITY_LABELS[e.type]}
                    <span>· {formatUpdatedAgo(e.at)}</span>
                  </div>
                  <Link
                    href={
                      e.type === "pending_review"
                        ? `/app/projects/${e.projectId}/review`
                        : `/app/projects/${e.projectId}`
                    }
                    className="text-sm text-gray-900 hover:underline mt-0.5 block"
                  >
                    {e.title}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {e.clientLabel} · {e.projectTitle}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <ClientIntakeChart customers={rawCustomers} />
    </div>
  );
}
