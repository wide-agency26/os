"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { GateIcon, StaleBadge } from "@/components/pm/PmBadges";
import { PM_ICONS } from "@/lib/pm/icons";

type Row = {
  id: string;
  title: string;
  status: string;
  clientLabel: string;
  phase: string;
  lastActivity: string | null;
  gateTitle: string | null;
  assigneeNames: string[];
  openCount: number;
};

export function CompanyOverviewClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [staleAfter, setStaleAfter] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: sett } = await (supabase as any)
        .from("pm_settings")
        .select("stale_after_days")
        .eq("id", 1)
        .maybeSingle();
      if (sett?.stale_after_days) setStaleAfter(sett.stale_after_days);

      const { data: projects } = await (supabase as any)
        .from("projects")
        .select(`id, title, status, client:client_id ( company, name )`)
        .order("title");

      const { data: tasks } = await (supabase as any)
        .from("pm_tasks")
        .select(
          `project_id, status, phase_label, is_gate, title, last_activity_at, assignee_id,
           assignee:assignee_id ( full_name )`
        );

      const byProject = new Map<string, any[]>();
      for (const t of tasks || []) {
        if (!byProject.has(t.project_id)) byProject.set(t.project_id, []);
        byProject.get(t.project_id)!.push(t);
      }

      const built: Row[] = (projects || []).map((p: any) => {
        const pts = byProject.get(p.id) || [];
        const open = pts.filter(
          (t) => t.status !== "done" && t.status !== "cancelled"
        );
        const gate = open.find((t) => t.is_gate && t.status !== "done");
        const lastActivity = pts.reduce(
          (max: string | null, t: any) =>
            !max || new Date(t.last_activity_at) > new Date(max)
              ? t.last_activity_at
              : max,
          null as string | null
        );
        const phase =
          open.find((t) => t.status === "in_progress")?.phase_label ||
          open[0]?.phase_label ||
          "—";
        const names = [
          ...new Set(
            open
              .map((t) => t.assignee?.full_name)
              .filter(Boolean) as string[]
          ),
        ];
        return {
          id: p.id,
          title: p.title,
          status: p.status,
          clientLabel: p.client?.company || p.client?.name || "—",
          phase,
          lastActivity,
          gateTitle: gate?.title ?? null,
          assigneeNames: names,
          openCount: open.length,
        };
      });

      // Staleness first
      built.sort((a, b) => {
        const da = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const db = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        return da - db;
      });

      setRows(built);
      setLoading(false);
    }
    void load();
  }, []);

  const staleCount = useMemo(() => {
    const cutoff = Date.now() - staleAfter * 86400000;
    return rows.filter((r) => {
      if (!r.lastActivity && r.openCount > 0) return true;
      if (!r.lastActivity) return false;
      return new Date(r.lastActivity).getTime() < cutoff;
    }).length;
  }, [rows, staleAfter]);

  return (
    <Workspace>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Company Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Birds-eye across all clients and projects · sorted by staleness
        </p>
        <p className="text-sm mt-2 flex items-center gap-2 text-red-700">
          <PM_ICONS.stale className="w-4 h-4" />
          {staleCount} project{staleCount === 1 ? "" : "s"} need attention (≥{staleAfter}d quiet)
        </p>
      </div>

      <Section title="Active projects">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Phase</th>
                  <th className="px-3 py-2">Gate</th>
                  <th className="px-3 py-2">People</th>
                  <th className="px-3 py-2">Staleness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link
                        href={`/app/projects/${r.id}`}
                        className="text-gray-900 font-medium hover:underline"
                      >
                        {r.title}
                      </Link>
                      <div className="text-xs text-gray-400">{r.openCount} open</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.clientLabel}</td>
                    <td className="px-3 py-2 text-gray-700">{r.phase}</td>
                    <td className="px-3 py-2">
                      {r.gateTitle ? (
                        <span className="inline-flex items-center gap-1 text-amber-900 text-xs">
                          <GateIcon /> {r.gateTitle}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-xs">
                          <GateIcon cleared /> Clear
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">
                      {r.assigneeNames.length ? r.assigneeNames.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StaleBadge
                        lastActivityAt={r.lastActivity}
                        staleAfterDays={staleAfter}
                      />
                      {!r.lastActivity && r.openCount === 0 ? (
                        <span className="text-xs text-gray-400">no PM tasks</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Workspace>
  );
}
