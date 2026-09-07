"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  Plus,
  ArrowRight,
  Crown,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  formatMoney,
  isFounderPerson,
  monthlyOverheadAmount,
  rosterStatusPill,
  type PersonRow,
} from "@/lib/hr/types";
import {
  EmptyState,
  PageHeader,
  Panel,
  buttonClass,
} from "@/components/frappe-ui/primitives";

type FullyLoadedRow = {
  person_id: string;
  monthly_compensation: number | null;
  monthly_overhead: number | null;
  monthly_fully_loaded: number | null;
  currency: string | null;
};

function overlapsToday(from: string, to: string | null): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (from > today) return false;
  if (to && to < today) return false;
  return true;
}

export default function HrDashboardPage() {
  const router = useRouter();
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [fullyLoaded, setFullyLoaded] = useState<FullyLoadedRow[]>([]);
  const [companyOverheadRunRate, setCompanyOverheadRunRate] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const [{ data: peopleRows }, { data: costRows }, { data: resourceRows }] =
        await Promise.all([
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
            wishlist_hourly_rate,
            engagement_types ( id, key, label, assignable_to_tasks ),
            person_skills ( skill_id, skills ( id, label ) )
          `
            )
            .order("full_name", { ascending: true }),
          (supabase as any)
            .from("hr_person_fully_loaded_cost")
            .select(
              "person_id, monthly_compensation, monthly_overhead, monthly_fully_loaded, currency"
            ),
          (supabase as any)
            .from("person_overhead_costs")
            .select("amount, frequency, effective_from, effective_to")
            .is("person_id", null)
            .is("project_id", null),
        ]);
      setPeople(peopleRows || []);
      setFullyLoaded(costRows || []);
      const companyOh = (resourceRows || []).reduce(
        (sum: number, row: {
          amount: number | null;
          frequency: string;
          effective_from: string;
          effective_to: string | null;
        }) => {
          if (!overlapsToday(row.effective_from, row.effective_to)) return sum;
          return sum + monthlyOverheadAmount(row.amount, row.frequency);
        },
        0
      );
      setCompanyOverheadRunRate(companyOh);
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
    const payroll = fullyLoaded.reduce(
      (sum, r) => sum + Number(r.monthly_compensation || 0),
      0
    );
    const personOverhead = fullyLoaded.reduce(
      (sum, r) => sum + Number(r.monthly_overhead || 0),
      0
    );
    const overhead = personOverhead + companyOverheadRunRate;
    return {
      activeCount: active.length,
      pipelineCount: pipeline.length,
      pausedCount: paused.length,
      offboardedCount: offboarded.length,
      assignableCount: assignable.length,
      payroll,
      overhead,
      runRate: payroll + overhead,
    };
  }, [people, fullyLoaded, companyOverheadRunRate]);

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

  const scorecards: {
    label: string;
    value: string | number;
    sub?: string;
  }[] = [
    { label: "Active", value: stats.activeCount },
    { label: "Pipeline", value: stats.pipelineCount },
    { label: "Paused", value: stats.pausedCount },
    { label: "Offboarded", value: stats.offboardedCount },
    { label: "Assignable", value: stats.assignableCount },
    {
      label: "Monthly run-rate",
      value: loading ? "—" : formatMoney(stats.runRate),
      sub: loading
        ? undefined
        : `Payroll ${formatMoney(stats.payroll)} · Overhead ${formatMoney(stats.overhead)}`,
    },
  ];

  return (
    <Workspace wide>
      <PageHeader
        title="HR"
        subtitle="Roster health, capacity, and cost run-rate."
        actions={
          <>
            <Link href="/app/hr/pipeline" className={buttonClass("secondary")}>
              Pipeline
            </Link>
            <Link href="/app/hr/roster" className={buttonClass("secondary")}>
              Full roster
            </Link>
            <Link href="/app/hr/new" className={buttonClass("primary")}>
              <Plus size={14} strokeWidth={1.75} />
              Add person
            </Link>
          </>
        }
      />

      <Panel className="overflow-hidden mb-8">
        <div className="flex divide-x divide-border overflow-x-auto">
          {scorecards.map((s) => (
            <div key={s.label} className="flex-1 min-w-[6.5rem] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {s.label}
              </p>
              <p className="text-lg font-semibold text-text-primary tabular-nums mt-1">
                {loading ? "—" : s.value}
              </p>
              {s.sub ? (
                <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{s.sub}</p>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>

      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">People</h3>
        <Link
          href="/app/hr/roster"
          className="text-[12px] text-text-primary hover:underline flex items-center gap-1"
        >
          View full roster
          <ArrowRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="p-10 text-center text-[13px] text-text-secondary border border-border rounded-lg">
          Loading roster…
        </div>
      ) : sortedPeople.length === 0 ? (
        <EmptyState>
          No people yet.{" "}
          <Link href="/app/hr/new" className="font-medium text-text-primary hover:underline">
            Add first person
          </Link>
        </EmptyState>
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
                className="text-left border border-border rounded-lg p-4 bg-surface hover:border-text-muted transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary truncate flex items-center gap-1.5">
                      {p.full_name}
                      {p.co_founder_track && (
                        <Crown size={12} strokeWidth={1.75} className="text-text-muted shrink-0" />
                      )}
                    </p>
                    <p className="text-[12px] text-text-secondary mt-0.5 truncate">
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

                <div className="mt-3 space-y-1 text-[12px] text-text-secondary">
                  {p.primary_email && <p className="truncate">{p.primary_email}</p>}
                  {p.phone && <p className="truncate">{p.phone}</p>}
                </div>

                {skillLabels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {skillLabels.map((label) => (
                      <span
                        key={label}
                        className="px-1.5 py-0.5 rounded-md bg-surface-raised text-text-secondary text-[11px]"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                {p.hourly_rate_cost != null && Number(p.hourly_rate_cost) > 0 ? (
                  <p className="mt-3 text-[12px] font-medium text-text-primary">
                    {formatMoney(p.hourly_rate_cost)} / hr
                    {isFounderPerson(p) && p.wishlist_hourly_rate != null && Number(p.wishlist_hourly_rate) > 0
                      ? ` · wishlist ${formatMoney(p.wishlist_hourly_rate)}`
                      : isFounderPerson(p)
                        ? " · wishlist —"
                        : ""}
                  </p>
                ) : isFounderPerson(p) ? (
                  <p className="mt-3 text-[12px] text-text-secondary">Wishlist rate not set</p>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </Workspace>
  );
}
