"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { createClient } from "@/utils/supabase/client";
import {
  COMP_MODELS,
  deriveSalaryTotals,
  formatMoney,
  type CompModel,
  type CompensationRecord,
} from "@/lib/hr/types";

type CompRow = CompensationRecord & {
  people?: {
    full_name: string;
    engagement_types?: { id: string; key: string; label: string } | null;
  } | null;
};

function accountingCost(row: CompRow): number | null {
  if (row.comp_model === "de_full_time_salary") {
    const sb = row.salary_breakdowns?.[0];
    if (!sb) return row.amount;
    return deriveSalaryTotals(sb).total_employer_cost;
  }
  return row.amount;
}

export default function HrCompensationPage() {
  const [rows, setRows] = useState<CompRow[]>([]);
  const [loaded, setLoaded] = useState<
    {
      person_id: string;
      full_name: string;
      engagement_type_label: string | null;
      monthly_compensation: number;
      monthly_overhead: number;
      monthly_fully_loaded: number;
      currency: string | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [modelFilter, setModelFilter] = useState<CompModel | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = (supabase as any)
      .from("compensation_records")
      .select(
        `
        *,
        salary_breakdowns (*),
        people (
          full_name,
          engagement_types ( id, key, label )
        )
      `
      )
      .order("effective_from", { ascending: false });

    if (modelFilter) {
      query = query.eq("comp_model", modelFilter);
    }

    const [{ data, error }, { data: fl }] = await Promise.all([
      query,
      (supabase as any)
        .from("hr_person_fully_loaded_cost")
        .select("*")
        .order("full_name"),
    ]);
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data || []) as CompRow[]);
    }
    setLoaded(fl || []);
    setLoading(false);
  }, [modelFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const rollups = useMemo(() => {
    const map = new Map<string, { label: string; total: number; count: number }>();
    for (const r of rows) {
      const label = r.people?.engagement_types?.label || "Unassigned";
      const key = r.people?.engagement_types?.id || "none";
      const cost = accountingCost(r);
      const prev = map.get(key) || { label, total: 0, count: 0 };
      prev.total += cost != null ? Number(cost) : 0;
      prev.count += 1;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const modelLabel = (m: CompModel) =>
    COMP_MODELS.find((x) => x.value === m)?.label || m;

  return (
    <Workspace wide>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Compensation & loaded cost</h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Pay records plus person overhead (desk, office, seats) for fully-loaded cost
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-gray-700">
          <span className="text-[12px] font-semibold text-gray-600">Model</span>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value as CompModel | "")}
            className="border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
          >
            <option value="">All models</option>
            {COMP_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rollups.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {rollups.map((r) => (
            <div
              key={r.label}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <p className="text-[12px] font-semibold text-gray-600">{r.label}</p>
              <p className="text-[16px] font-bold text-gray-900 tabular-nums mt-1">
                {formatMoney(r.total)}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {r.count} record{r.count === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {loaded.length > 0 ? (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm mb-6">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[14px] font-bold text-gray-900">
              Fully-loaded monthly (active people)
            </h3>
            <p className="text-[12px] text-gray-500">
              Compensation run-rate + overhead (desk / office / seats). One-off overhead
              excluded from monthly.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2.5">Person</th>
                  <th className="text-left px-4 py-2.5">Engagement</th>
                  <th className="text-right px-4 py-2.5">Comp / mo</th>
                  <th className="text-right px-4 py-2.5">Overhead / mo</th>
                  <th className="text-right px-4 py-2.5">Fully loaded</th>
                </tr>
              </thead>
              <tbody>
                {loaded.map((r) => (
                  <tr key={r.person_id} className="border-t border-gray-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/app/hr/${r.person_id}`}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        {r.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {r.engagement_type_label || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatMoney(Number(r.monthly_compensation || 0), r.currency || "EUR")}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatMoney(Number(r.monthly_overhead || 0), r.currency || "EUR")}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">
                      {formatMoney(Number(r.monthly_fully_loaded || 0), r.currency || "EUR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-[13px] text-gray-500">
            Loading compensation…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-gray-500">
            No compensation records yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2.5">Person</th>
                  <th className="text-left px-4 py-2.5">Engagement</th>
                  <th className="text-left px-4 py-2.5">Model</th>
                  <th className="text-left px-4 py-2.5">Accounting cost</th>
                  <th className="text-left px-4 py-2.5">Frequency</th>
                  <th className="text-left px-4 py-2.5">From</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50 hover:bg-blue-50/40">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/app/hr/${r.person_id}`}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        {r.people?.full_name || "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {r.people?.engagement_types?.label || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {modelLabel(r.comp_model)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-900 font-medium">
                      {formatMoney(accountingCost(r), r.currency)}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{r.frequency}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.effective_from}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Workspace>
  );
}
