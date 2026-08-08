"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import { PM_ICONS } from "@/lib/pm/icons";
import { currentCycleKey } from "@/lib/pm/types";

type Props = { projectId: string };

export function ProjectCostClient({ projectId }: Props) {
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState({
    fragmentation_base_projects: 2,
    fragmentation_penalty_pct: 10,
  });
  const [personProjectCounts, setPersonProjectCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const period = currentCycleKey();

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
          "id, title, default_role, assignee_id, assignee_person_id, estimated_duration_hours, status, assignee_person:assignee_person_id ( id, full_name, hourly_rate_cost )"
        )
        .eq("project_id", projectId);
      setTasks(taskRows || []);

      const { data: rateRows } = await (supabase as any)
        .from("pm_role_rates")
        .select("role_label, hourly_rate");
      const rateMap: Record<string, number> = {};
      for (const r of rateRows || []) rateMap[r.role_label] = Number(r.hourly_rate);
      setRates(rateMap);

      const { data: sett } = await (supabase as any)
        .from("pm_settings")
        .select("fragmentation_base_projects, fragmentation_penalty_pct")
        .eq("id", 1)
        .maybeSingle();
      if (sett) setSettings(sett);

      // Count concurrent active projects per HR person
      const personIds = [
        ...new Set(
          (taskRows || []).map((t: any) => t.assignee_person_id).filter(Boolean)
        ),
      ] as string[];
      const counts: Record<string, number> = {};
      if (personIds.length) {
        const { data: allOpen } = await (supabase as any)
          .from("pm_tasks")
          .select("assignee_person_id, project_id")
          .in("assignee_person_id", personIds)
          .in("status", ["todo", "in_progress", "blocked"]);
        const byPerson = new Map<string, Set<string>>();
        for (const row of allOpen || []) {
          if (!row.assignee_person_id) continue;
          if (!byPerson.has(row.assignee_person_id)) {
            byPerson.set(row.assignee_person_id, new Set());
          }
          byPerson.get(row.assignee_person_id)!.add(row.project_id);
        }
        byPerson.forEach((set, personId) => {
          counts[personId] = set.size;
        });
      }
      setPersonProjectCounts(counts);
      setLoading(false);
    }
    void load();
  }, [projectId]);

  const analysis = useMemo(() => {
    let plannedHours = 0;
    let plannedCost = 0;
    const open = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");

    for (const t of open) {
      const hours = Number(t.estimated_duration_hours || 0);
      plannedHours += hours;
      const personRate = Number(t.assignee_person?.hourly_rate_cost || 0);
      const roleRate = rates[t.default_role || "Specialist"] ?? rates.Specialist ?? 80;
      plannedCost += hours * (personRate > 0 ? personRate : roleRate);
    }

    // Max fragmentation across people on this project
    let maxConcurrent = 1;
    let fragmentedPerson: string | null = null;
    for (const [personId, count] of Object.entries(personProjectCounts)) {
      if (count > maxConcurrent) {
        maxConcurrent = count;
        fragmentedPerson = personId;
      }
    }
    // Also consider role-only estimate when no assignees: use 1
    const over =
      Math.max(0, maxConcurrent - settings.fragmentation_base_projects);
    const multiplier =
      1 + (over * Number(settings.fragmentation_penalty_pct)) / 100;
    const projectedCost = Math.round(plannedCost * multiplier * 100) / 100;
    const penaltyPct = Math.round((multiplier - 1) * 100);

    return {
      plannedHours,
      plannedCost: Math.round(plannedCost * 100) / 100,
      multiplier,
      projectedCost,
      penaltyPct,
      maxConcurrent,
      fragmentedPerson,
    };
  }, [tasks, rates, personProjectCounts, settings]);

  if (loading) {
    return <div className="text-sm text-gray-500 p-6">Loading cost center…</div>;
  }

  const Icon = PM_ICONS.costCenter;

  return (
    <ProjectPmShell
      projectId={projectId}
      title={project?.title || "Project"}
      clientLabel={project?.client?.company || project?.client?.name}
    >
      <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4" />
        Period {period} · planned figures use playbook estimated hours × stub rates
        (actual hours not wired yet)
      </p>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Planned hours</p>
          <p className="text-2xl font-semibold mt-1">{analysis.plannedHours.toFixed(1)}h</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Planned cost</p>
          <p className="text-2xl font-semibold mt-1">€{analysis.plannedCost.toFixed(0)}</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Projected cost</p>
          <p className="text-2xl font-semibold mt-1">€{analysis.projectedCost.toFixed(0)}</p>
        </div>
      </div>

      {analysis.penaltyPct > 0 ? (
        <div className="border border-amber-200 bg-amber-50 text-amber-950 rounded-lg px-4 py-3 text-sm mb-4">
          Projected cost includes a {analysis.penaltyPct}% fragmentation adjustment
          because someone on this project is on {analysis.maxConcurrent} active projects
          this month (base {settings.fragmentation_base_projects}; +
          {settings.fragmentation_penalty_pct}% per extra). Multiplier ×
          {analysis.multiplier.toFixed(2)}.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600 mb-4">
          No fragmentation adjustment applied (concurrent load ≤{" "}
          {settings.fragmentation_base_projects} projects). Tunable in pm_settings.
        </div>
      )}
    </ProjectPmShell>
  );
}
