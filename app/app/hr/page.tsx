"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  Plus,
  Users,
  UserPlus,
  PauseCircle,
  UserX,
  Layers,
  Wallet,
  ArrowRight,
  Crown,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  formatMoney,
  rosterStatusPill,
  type PersonRow,
} from "@/lib/hr/types";

type FullyLoadedRow = {
  person_id: string;
  monthly_fully_loaded: number | null;
  currency: string | null;
};

export default function HrDashboardPage() {
  const router = useRouter();
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [fullyLoaded, setFullyLoaded] = useState<FullyLoadedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const [{ data: peopleRows }, { data: costRows }] = await Promise.all([
        (supabase as any)
          .from("people")
          .select(
            `
            id,
            full_name,
            primary_email,
            phone,
            engagement_type_id,
            roster_status,
            co_founder_track,
            hourly_rate_cost,
            engagement_types ( id, key, label, assignable_to_tasks ),
            person_skills ( skill_id, skills ( id, label ) )
          `
          )
          .order("full_name", { ascending: true }),
        (supabase as any)
          .from("hr_person_fully_loaded_cost")
          .select("person_id, monthly_fully_loaded, currency"),
      ]);
      setPeople(peopleRows || []);
      setFullyLoaded(costRows || []);
      setLoading(false);
    }
    void load();
  }, []);

  const stats = useMemo(() => {
    const active = people.filter((p) => p.roster_status === "active");
    const pipeline = people.filter((p) => p.roster_status === "pipeline");
    const paused = people.filter((p) => p.roster_status === "paused");
    const offboarded = people.filter((p) => p.roster_status === "offboarded");
    const assignable = active.filter((p) => p.engagement_types?.assignable_to_tasks);
    const runRate = fullyLoaded.reduce(
      (sum, r) => sum + Number(r.monthly_fully_loaded || 0),
      0
    );
    return {
      activeCount: active.length,
      pipelineCount: pipeline.length,
      pausedCount: paused.length,
      offboardedCount: offboarded.length,
      assignableCount: assignable.length,
      runRate,
    };
  }, [people, fullyLoaded]);

  const sortedPeople = useMemo(() => {
    const rank: Record<string, number> = {
      active: 0,
      pipeline: 1,
      paused: 2,
      offboarded: 3,
    };
    return [...people].sort((a, b) => {
      const r = (rank[a.roster_status] ?? 9) - (rank[b.roster_status] ?? 9);
      if (r !== 0) return r;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [people]);

  const scorecards = [
    { label: "Active people", value: stats.activeCount, icon: Users, color: "text-green-600 bg-green-50" },
    { label: "Pipeline", value: stats.pipelineCount, icon: UserPlus, color: "text-blue-600 bg-blue-50" },
    { label: "Paused", value: stats.pausedCount, icon: PauseCircle, color: "text-amber-600 bg-amber-50" },
    { label: "Offboarded", value: stats.offboardedCount, icon: UserX, color: "text-gray-500 bg-gray-100" },
    { label: "Assignable", value: stats.assignableCount, icon: Layers, color: "text-purple-600 bg-purple-50" },
    {
      label: "Monthly run-rate",
      value: loading ? "—" : formatMoney(stats.runRate),
      icon: Wallet,
      color: "text-indigo-600 bg-indigo-50",
    },
  ];

  return (
    <Workspace wide>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">HR</h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Roster health, capacity, and cost run-rate.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app/hr/pipeline"
            className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-[13px] font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            Pipeline
          </Link>
          <Link
            href="/app/hr/roster"
            className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-[13px] font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            Full roster
          </Link>
          <Link
            href="/app/hr/new"
            className="px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            Add person
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {scorecards.map((s) => (
          <div key={s.label} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon size={16} />
            </div>
            <div className="text-xl font-bold text-gray-900 tabular-nums">
              {loading ? "—" : s.value}
            </div>
            <div className="text-[12px] text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-gray-900">People</h3>
        <Link
          href="/app/hr/roster"
          className="text-[12px] text-blue-600 hover:underline flex items-center gap-1"
        >
          View full roster
          <ArrowRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="p-10 text-center text-[13px] text-gray-500 border border-gray-200 rounded-lg">
          Loading roster…
        </div>
      ) : sortedPeople.length === 0 ? (
        <div className="p-10 text-center space-y-3 border border-dashed border-gray-300 rounded-lg">
          <UserPlus className="mx-auto text-gray-300" size={32} />
          <p className="text-[14px] font-medium text-gray-800">No people yet</p>
          <Link
            href="/app/hr/new"
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium"
          >
            <Plus size={14} />
            Add first person
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedPeople.map((p) => {
            const skillLabels = (p.person_skills || [])
              .map((ps) => ps.skills?.label)
              .filter(Boolean)
              .slice(0, 3) as string[];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/app/hr/${p.id}`)}
                className="text-left border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate flex items-center gap-1.5">
                      {p.full_name}
                      {p.co_founder_track && (
                        <Crown size={12} className="text-violet-600 shrink-0" />
                      )}
                    </p>
                    <p className="text-[12px] text-gray-500 mt-0.5 truncate">
                      {p.engagement_types?.label || "—"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${rosterStatusPill(
                      p.roster_status
                    )}`}
                  >
                    {p.roster_status}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-[12px] text-gray-500">
                  {p.primary_email && <p className="truncate">{p.primary_email}</p>}
                  {p.phone && <p className="truncate">{p.phone}</p>}
                </div>

                {skillLabels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {skillLabels.map((label) => (
                      <span
                        key={label}
                        className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px]"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                {p.hourly_rate_cost != null && (
                  <p className="mt-3 text-[12px] font-medium text-gray-700">
                    {formatMoney(p.hourly_rate_cost)} / hr
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Workspace>
  );
}
