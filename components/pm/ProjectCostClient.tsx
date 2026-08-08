"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import { PM_ICONS } from "@/lib/pm/icons";
import { currentCycleKey } from "@/lib/pm/types";
import {
  COMP_MODELS,
  formatMoney,
  type CompFrequency,
  type CompModel,
} from "@/lib/hr/types";

type Props = { projectId: string };

type ProjectCompRow = {
  id: string;
  person_id: string;
  comp_model: CompModel;
  amount: number | null;
  currency: string;
  frequency: CompFrequency;
  effective_from: string;
  effective_to: string | null;
  people?: { full_name: string | null } | null;
};

export function ProjectCostClient({ projectId }: Props) {
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [projectComps, setProjectComps] = useState<ProjectCompRow[]>([]);
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

      const today = new Date().toISOString().slice(0, 10);
      const { data: comps } = await (supabase as any)
        .from("compensation_records")
        .select(
          "id, person_id, comp_model, amount, currency, frequency, effective_from, effective_to, people:person_id ( full_name )"
        )
        .eq("project_id", projectId)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order("effective_from", { ascending: false });
      setProjectComps((comps || []) as ProjectCompRow[]);

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

  const hourlyByPerson = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of projectComps) {
      if (map[c.person_id] != null) continue;
      if (
        (c.comp_model === "hourly_invoice" || c.frequency === "per_hour") &&
        c.amount != null
      ) {
        map[c.person_id] = Number(c.amount);
      }
    }
    return map;
  }, [projectComps]);

  const analysis = useMemo(() => {
    let plannedHours = 0;
    let plannedCost = 0;
    const open = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");

    for (const t of open) {
      const hours = Number(t.estimated_duration_hours || 0);
      plannedHours += hours;
      const personId = t.assignee_person_id as string | null;
      const projectHourly =
        personId && hourlyByPerson[personId] != null
          ? hourlyByPerson[personId]
          : 0;
      const personRate = Number(t.assignee_person?.hourly_rate_cost || 0);
      const roleRate = rates[t.default_role || "Specialist"] ?? rates.Specialist ?? 80;
      const rate =
        projectHourly > 0 ? projectHourly : personRate > 0 ? personRate : roleRate;
      plannedCost += hours * rate;
    }

    // Fixed / retainer / per-project fees linked to this project
    let linkedFees = 0;
    for (const c of projectComps) {
      if (c.frequency === "per_hour" || c.comp_model === "hourly_invoice") continue;
      linkedFees += Number(c.amount || 0);
    }

    let maxConcurrent = 1;
    for (const [, count] of Object.entries(personProjectCounts)) {
      if (count > maxConcurrent) maxConcurrent = count;
    }
    const over = Math.max(0, maxConcurrent - settings.fragmentation_base_projects);
    const multiplier =
      1 + (over * Number(settings.fragmentation_penalty_pct)) / 100;
    const hoursCost = Math.round(plannedCost * 100) / 100;
    const projectedCost =
      Math.round((hoursCost * multiplier + linkedFees) * 100) / 100;
    const penaltyPct = Math.round((multiplier - 1) * 100);

    return {
      plannedHours,
      plannedCost: hoursCost,
      linkedFees: Math.round(linkedFees * 100) / 100,
      multiplier,
      projectedCost,
      penaltyPct,
      maxConcurrent,
    };
  }, [tasks, rates, personProjectCounts, settings, projectComps, hourlyByPerson]);

  if (loading) {
    return <div className="text-sm text-gray-500 p-6">Loading cost center…</div>;
  }

  const Icon = PM_ICONS.costCenter;
  const modelLabel = (m: CompModel) =>
    COMP_MODELS.find((x) => x.value === m)?.label || m;

  return (
    <ProjectPmShell
      projectId={projectId}
      title={project?.title || "Project"}
      clientLabel={project?.client?.company || project?.client?.name}
    >
      <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4" />
        Period {period} · hours × project-linked hourly rates (fallback: person /
        role rate) + linked project fees
      </p>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Planned hours</p>
          <p className="text-2xl font-semibold mt-1">{analysis.plannedHours.toFixed(1)}h</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Hours cost</p>
          <p className="text-2xl font-semibold mt-1">€{analysis.plannedCost.toFixed(0)}</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Projected total</p>
          <p className="text-2xl font-semibold mt-1">€{analysis.projectedCost.toFixed(0)}</p>
          {analysis.linkedFees > 0 ? (
            <p className="text-[11px] text-gray-500 mt-1">
              incl. {formatMoney(analysis.linkedFees)} linked fees
            </p>
          ) : null}
        </div>
      </div>

      {analysis.penaltyPct > 0 ? (
        <div className="border border-amber-200 bg-amber-50 text-amber-950 rounded-lg px-4 py-3 text-sm mb-4">
          Projected hours cost includes a {analysis.penaltyPct}% fragmentation
          adjustment because someone on this project is on {analysis.maxConcurrent}{" "}
          active projects this month (base {settings.fragmentation_base_projects}; +
          {settings.fragmentation_penalty_pct}% per extra). Multiplier ×
          {analysis.multiplier.toFixed(2)}.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600 mb-4">
          No fragmentation adjustment applied (concurrent load ≤{" "}
          {settings.fragmentation_base_projects} projects). Tunable in pm_settings.
        </div>
      )}

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
          Compensation linked to this project
        </div>
        {projectComps.length === 0 ? (
          <p className="px-3 py-4 text-[13px] text-gray-500">
            None yet. Link from HR Compensation, or assign a freelancer to a task
            and enter their project rate.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {projectComps.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[13px]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {c.people?.full_name || "Person"}
                  </p>
                  <p className="text-[12px] text-gray-500">
                    {modelLabel(c.comp_model)} · {c.frequency}
                  </p>
                </div>
                <p className="tabular-nums font-semibold text-gray-900">
                  {formatMoney(c.amount, c.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProjectPmShell>
  );
}
