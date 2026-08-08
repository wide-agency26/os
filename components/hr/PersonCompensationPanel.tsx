"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash } from "lucide-react";
import { SalaryBreakdownForm } from "@/components/hr/SalaryBreakdownForm";
import { ProjectLinkSelect } from "@/components/hr/ProjectLinkSelect";
import {
  firstDayOfMonth,
  lastDayOfMonth,
  MONTH_SHORT,
  monthCellTone,
  monthsCoveredInYear,
  recordTouchesYear,
  shortCompValue,
  compModelLabel,
} from "@/lib/hr/compensation";
import {
  COMP_FREQUENCIES,
  COMP_MODELS,
  deriveSalaryTotals,
  emptySalaryBreakdown,
  prefersProjectLink,
  type CompFrequency,
  type CompModel,
  type CompensationRecord,
  type SalaryBreakdown,
} from "@/lib/hr/types";

type Props = { personId: string };

type SpanKind = "recurring" | "one_off";

type FormState = {
  id?: string;
  comp_model: CompModel;
  amount: string;
  currency: string;
  frequency: CompFrequency;
  non_monetary_description: string;
  referral_percentage: string;
  year: number;
  startMonth: number;
  endMonth: number;
  openEnded: boolean;
  notes: string;
  salary: SalaryBreakdown;
  spanKind: SpanKind;
  project_id: string;
};

function emptyForm(
  year: number,
  startMonth = 1,
  endMonth = 1,
  spanKind: SpanKind = "recurring"
): FormState {
  return {
    comp_model: "hourly_invoice",
    amount: "",
    currency: "EUR",
    frequency: spanKind === "one_off" ? "one_off" : "monthly",
    non_monetary_description: "",
    referral_percentage: "",
    year,
    startMonth,
    endMonth: spanKind === "one_off" ? startMonth : endMonth,
    openEnded: false,
    notes: "",
    salary: emptySalaryBreakdown(),
    spanKind,
    project_id: "",
  };
}

function formFromRecord(row: CompensationRecord, year: number): FormState {
  const months = monthsCoveredInYear(row, year);
  const startMonth = months[0] ?? new Date(row.effective_from).getUTCMonth() + 1;
  const endMonth = months[months.length - 1] ?? startMonth;
  const spanKind: SpanKind =
    row.frequency === "one_off" ? "one_off" : "recurring";
  const sb = row.salary_breakdowns?.[0];
  return {
    id: row.id,
    comp_model: row.comp_model,
    amount: row.amount != null ? String(row.amount) : "",
    currency: row.currency || "EUR",
    frequency: row.frequency,
    non_monetary_description: row.non_monetary_description || "",
    referral_percentage:
      row.referral_percentage != null ? String(row.referral_percentage) : "",
    year,
    startMonth,
    endMonth: spanKind === "one_off" ? startMonth : endMonth,
    openEnded: !row.effective_to,
    notes: row.notes || "",
    salary: sb ? { ...emptySalaryBreakdown(), ...sb } : emptySalaryBreakdown(),
    spanKind,
    project_id: row.project_id || "",
  };
}

export function PersonCompensationPanel({ personId }: Props) {
  const [rows, setRows] = useState<CompensationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(new Date().getFullYear())
  );
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [rangeAnchor, setRangeAnchor] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await (supabase as any)
      .from("compensation_records")
      .select("*, salary_breakdowns (*), projects:project_id ( id, title )")
      .eq("person_id", personId)
      .order("effective_from", { ascending: false });
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data || []) as CompensationRecord[]);
    }
    setLoading(false);
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  const yearRows = useMemo(
    () => rows.filter((r) => recordTouchesYear(r, year)),
    [rows, year]
  );

  const byMonth = useMemo(() => {
    const map: Record<number, CompensationRecord[]> = {};
    for (let m = 1; m <= 12; m++) map[m] = [];
    for (const r of yearRows) {
      for (const m of monthsCoveredInYear(r, year)) {
        map[m].push(r);
      }
    }
    return map;
  }, [yearRows, year]);

  const startCreate = (
    startMonth = new Date().getMonth() + 1,
    endMonth = startMonth,
    spanKind: SpanKind = "recurring"
  ) => {
    setRangeAnchor(null);
    setForm(emptyForm(year, startMonth, endMonth, spanKind));
    setEditing(true);
  };

  const startEdit = (row: CompensationRecord) => {
    setRangeAnchor(null);
    setForm(formFromRecord(row, year));
    setEditing(true);
  };

  const handleMonthClick = (month: number) => {
    if (editing) return;
    const covering = byMonth[month] || [];
    if (rangeAnchor == null) {
      if (covering.length === 1) {
        startEdit(covering[0]);
        return;
      }
      if (covering.length > 1) {
        // Ambiguous: start a new range from this month instead of guessing.
        setRangeAnchor(month);
        return;
      }
      setRangeAnchor(month);
      return;
    }
    const a = Math.min(rangeAnchor, month);
    const b = Math.max(rangeAnchor, month);
    const spanKind: SpanKind = a === b ? "one_off" : "recurring";
    startCreate(a, b, spanKind);
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const startM =
      form.spanKind === "one_off" ? form.startMonth : Math.min(form.startMonth, form.endMonth);
    const endM =
      form.spanKind === "one_off" ? form.startMonth : Math.max(form.startMonth, form.endMonth);
    const frequency: CompFrequency =
      form.spanKind === "one_off"
        ? "one_off"
        : form.frequency === "one_off"
          ? "monthly"
          : form.frequency;

    const payload = {
      person_id: personId,
      comp_model: form.comp_model,
      amount:
        form.comp_model === "referral_percentage" ||
        form.comp_model === "non_monetary"
          ? null
          : form.amount
            ? Number(form.amount)
            : null,
      currency: form.currency || "EUR",
      frequency,
      non_monetary_description:
        form.comp_model === "non_monetary"
          ? form.non_monetary_description.trim() || null
          : null,
      referral_percentage:
        form.comp_model === "referral_percentage"
          ? form.referral_percentage
            ? Number(form.referral_percentage)
            : null
          : null,
      effective_from: firstDayOfMonth(form.year, startM),
      effective_to:
        form.openEnded && form.spanKind === "recurring"
          ? null
          : lastDayOfMonth(form.year, endM),
      notes: form.notes.trim() || null,
      project_id: form.project_id || null,
      updated_at: new Date().toISOString(),
    };

    let recordId = form.id;
    if (form.id) {
      const { error } = await (supabase as any)
        .from("compensation_records")
        .update(payload)
        .eq("id", form.id);
      if (error) {
        setSaving(false);
        alert("Error saving: " + error.message);
        return;
      }
    } else {
      const { data, error } = await (supabase as any)
        .from("compensation_records")
        .insert([payload])
        .select("id")
        .single();
      if (error || !data?.id) {
        setSaving(false);
        alert("Error creating: " + (error?.message || "unknown"));
        return;
      }
      recordId = data.id;
    }

    if (form.comp_model === "de_full_time_salary" && recordId) {
      const totals = deriveSalaryTotals(form.salary);
      const salaryPayload = {
        compensation_record_id: recordId,
        gross_salary: form.salary.gross_salary,
        pension_employee: form.salary.pension_employee,
        pension_employer: form.salary.pension_employer,
        unemployment_employee: form.salary.unemployment_employee,
        unemployment_employer: form.salary.unemployment_employer,
        health_employee: form.salary.health_employee,
        health_employer: form.salary.health_employer,
        care_employee: form.salary.care_employee,
        care_employer: form.salary.care_employer,
        income_tax: form.salary.income_tax,
        employer_surcharges: form.salary.employer_surcharges,
        accident_insurance: form.salary.accident_insurance,
        payslip_payout: totals.payslip_payout,
        post_tax_direct_debit_tk: form.salary.post_tax_direct_debit_tk,
        true_usable_income: totals.true_usable_income,
        period_month: startM,
        period_year: form.year,
        updated_at: new Date().toISOString(),
      };

      if (form.salary.id) {
        const { error: sbErr } = await (supabase as any)
          .from("salary_breakdowns")
          .update(salaryPayload)
          .eq("id", form.salary.id);
        if (sbErr) {
          setSaving(false);
          alert("Error saving salary breakdown: " + sbErr.message);
          return;
        }
      } else {
        const { error: sbErr } = await (supabase as any)
          .from("salary_breakdowns")
          .insert([salaryPayload]);
        if (sbErr) {
          setSaving(false);
          alert("Error saving salary breakdown: " + sbErr.message);
          return;
        }
      }
    }

    if (
      (form.comp_model === "hourly_invoice" || frequency === "per_hour") &&
      form.amount
    ) {
      await (supabase as any)
        .from("people")
        .update({
          hourly_rate_cost: Number(form.amount),
          updated_at: new Date().toISOString(),
        })
        .eq("id", personId);
    }

    setSaving(false);
    setEditing(false);
    setRangeAnchor(null);
    await load();
  };

  const handleSaveWithGuard = async () => {
    const freq: CompFrequency =
      form.spanKind === "one_off"
        ? "one_off"
        : form.frequency === "one_off"
          ? "monthly"
          : form.frequency;
    if (prefersProjectLink(form.comp_model, freq) && !form.project_id) {
      const ok = confirm(
        "Hourly / per-project compensation usually links to a project for cost tracking. Save without a project?"
      );
      if (!ok) return;
    }
    await handleSave();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this compensation record?")) return;
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("compensation_records")
      .delete()
      .eq("id", id);
    if (error) {
      alert("Error deleting: " + error.message);
      return;
    }
    setEditing(false);
    await load();
  };

  const selectionHint =
    rangeAnchor != null
      ? `Select end month (started ${MONTH_SHORT[rangeAnchor - 1]}) — same month = one-off`
      : "Click a month to edit, or click empty months to set a period";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[13px] font-bold text-gray-900">Compensation</h3>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Financial year {year} · Jan 1 – Dec 31
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setYear((y) => y - 1);
                setRangeAnchor(null);
                setEditing(false);
              }}
              className="p-2 text-gray-600 hover:bg-gray-50"
              aria-label="Previous year"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-[13px] font-semibold text-gray-900 tabular-nums min-w-[3.5rem] text-center">
              {year}
            </span>
            <button
              type="button"
              onClick={() => {
                setYear((y) => y + 1);
                setRangeAnchor(null);
                setEditing(false);
              }}
              className="p-2 text-gray-600 hover:bg-gray-50"
              aria-label="Next year"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {!editing ? (
            <button
              type="button"
              onClick={() => startCreate(1, 3, "recurring")}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium hover:bg-blue-700 inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              Add period
            </button>
          ) : null}
          {rangeAnchor != null ? (
            <button
              type="button"
              onClick={() => setRangeAnchor(null)}
              className="px-3 py-1.5 border border-gray-200 rounded text-[12px] text-gray-700 hover:bg-gray-50"
            >
              Cancel select
            </button>
          ) : null}
        </div>
      </div>

      <p className="text-[12px] text-gray-500">{selectionHint}</p>

      {loading ? (
        <p className="text-[13px] text-gray-500">Loading compensation…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {MONTH_SHORT.map((label, idx) => {
            const month = idx + 1;
            const covering = byMonth[month] || [];
            const isAnchor = rangeAnchor === month;
            const primary = covering[0];
            return (
              <button
                key={label}
                type="button"
                disabled={editing}
                onClick={() => handleMonthClick(month)}
                className={[
                  "text-left rounded-xl border p-3 min-h-[96px] transition-colors",
                  editing ? "opacity-60 cursor-not-allowed" : "hover:border-blue-300",
                  isAnchor
                    ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/40"
                    : covering.length
                      ? monthCellTone(primary)
                      : "border-dashed border-gray-200 bg-white text-gray-500",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[12px] font-bold uppercase tracking-wide">
                    {label}
                  </span>
                  {covering.length > 1 ? (
                    <span className="text-[10px] font-medium text-gray-500">
                      +{covering.length - 1}
                    </span>
                  ) : null}
                </div>
                {covering.length === 0 ? (
                  <span className="text-[12px] text-gray-400">Empty</span>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[13px] font-semibold truncate">
                      {shortCompValue(primary)}
                    </p>
                    <p className="text-[11px] opacity-80 truncate">
                      {compModelLabel(primary.comp_model)}
                      {primary.frequency === "one_off" ? " · one-off" : " · recurring"}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-sky-200 bg-sky-50" /> Recurring
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-amber-200 bg-amber-50" /> One-off
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-indigo-200 bg-indigo-50" /> DE salary
        </span>
      </div>

      {editing ? (
        <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-[13px] font-bold text-gray-900">
                {form.id ? "Edit period" : "New period"}
              </h4>
              <p className="text-[12px] text-gray-500 mt-0.5">
                {form.spanKind === "one_off"
                  ? `${MONTH_SHORT[form.startMonth - 1]} ${form.year} (one-off)`
                  : `${MONTH_SHORT[Math.min(form.startMonth, form.endMonth) - 1]} – ${MONTH_SHORT[Math.max(form.startMonth, form.endMonth) - 1]} ${form.year}`}
              </p>
            </div>
            {form.id ? (
              <button
                type="button"
                onClick={() => void handleDelete(form.id!)}
                className="p-1.5 text-gray-500 hover:text-red-600"
                aria-label="Delete"
              >
                <Trash size={14} />
              </button>
            ) : null}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  spanKind: "recurring",
                  frequency: f.frequency === "one_off" ? "monthly" : f.frequency,
                  endMonth: Math.max(f.startMonth, f.endMonth),
                }))
              }
              className={[
                "px-3 py-1.5 rounded text-[12px] font-medium border",
                form.spanKind === "recurring"
                  ? "bg-sky-50 border-sky-300 text-sky-900"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              Recurring months
            </button>
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  spanKind: "one_off",
                  frequency: "one_off",
                  endMonth: f.startMonth,
                  openEnded: false,
                }))
              }
              className={[
                "px-3 py-1.5 rounded text-[12px] font-medium border",
                form.spanKind === "one_off"
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              One-off month
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">From month</span>
              <select
                value={form.startMonth}
                onChange={(e) => {
                  const startMonth = Number(e.target.value);
                  setForm((f) => ({
                    ...f,
                    startMonth,
                    endMonth:
                      f.spanKind === "one_off"
                        ? startMonth
                        : Math.max(startMonth, f.endMonth),
                    year,
                  }));
                }}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              >
                {MONTH_SHORT.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m} {year}
                  </option>
                ))}
              </select>
            </label>

            {form.spanKind === "recurring" ? (
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">To month</span>
                <select
                  value={form.endMonth}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      endMonth: Math.max(f.startMonth, Number(e.target.value)),
                      year,
                    }))
                  }
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                >
                  {MONTH_SHORT.map((m, i) => (
                    <option key={m} value={i + 1} disabled={i + 1 < form.startMonth}>
                      {m} {year}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="flex items-end">
                <p className="text-[12px] text-gray-500 pb-2">
                  Applies only to {MONTH_SHORT[form.startMonth - 1]} {year}
                </p>
              </div>
            )}

            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">Model</span>
              <select
                value={form.comp_model}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    comp_model: e.target.value as CompModel,
                  }))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              >
                {COMP_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            {form.spanKind === "recurring" ? (
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">
                  Pay frequency
                </span>
                <select
                  value={form.frequency === "one_off" ? "monthly" : form.frequency}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      frequency: e.target.value as CompFrequency,
                    }))
                  }
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                >
                  {COMP_FREQUENCIES.filter((f) => f.value !== "one_off").map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {form.comp_model === "referral_percentage" ? (
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">
                  Referral %
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={form.referral_percentage}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      referral_percentage: e.target.value,
                    }))
                  }
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                />
              </label>
            ) : form.comp_model === "non_monetary" ? (
              <label className="block sm:col-span-2">
                <span className="text-[12px] font-semibold text-gray-700">
                  Non-monetary description
                </span>
                <textarea
                  value={form.non_monetary_description}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      non_monetary_description: e.target.value,
                    }))
                  }
                  rows={2}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                />
              </label>
            ) : form.comp_model !== "de_full_time_salary" ? (
              <>
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">
                    Amount
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">
                    Currency
                  </span>
                  <input
                    value={form.currency}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, currency: e.target.value }))
                    }
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  />
                </label>
              </>
            ) : (
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">
                  Currency
                </span>
                <input
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currency: e.target.value }))
                  }
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                />
              </label>
            )}

            {form.spanKind === "recurring" ? (
              <label className="flex items-center gap-2 sm:col-span-2 pt-1">
                <input
                  type="checkbox"
                  checked={form.openEnded}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, openEnded: e.target.checked }))
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-[12px] text-gray-700">
                  Open-ended after {MONTH_SHORT[Math.max(form.startMonth, form.endMonth) - 1]}{" "}
                  (no end date)
                </span>
              </label>
            ) : null}

            <ProjectLinkSelect
              className="sm:col-span-2"
              value={form.project_id}
              onChange={(project_id) => setForm((f) => ({ ...f, project_id }))}
              required={prefersProjectLink(
                form.comp_model,
                form.spanKind === "one_off" ? "one_off" : form.frequency
              )}
              hint={
                prefersProjectLink(
                  form.comp_model,
                  form.spanKind === "one_off" ? "one_off" : form.frequency
                )
                  ? "Recommended for hourly invoice and per-project pay — links this fee to project cost."
                  : "Optionally attribute this compensation to a project."
              }
            />

            <label className="block sm:col-span-2">
              <span className="text-[12px] font-semibold text-gray-700">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={2}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              />
            </label>
          </div>

          {form.comp_model === "de_full_time_salary" ? (
            <SalaryBreakdownForm
              value={form.salary}
              onChange={(salary) => setForm((f) => ({ ...f, salary }))}
            />
          ) : null}

          <p className="text-[11px] text-gray-400">
            Saves as {firstDayOfMonth(year, Math.min(form.startMonth, form.endMonth))}
            {" → "}
            {form.openEnded && form.spanKind === "recurring"
              ? "open"
              : lastDayOfMonth(
                  year,
                  form.spanKind === "one_off"
                    ? form.startMonth
                    : Math.max(form.startMonth, form.endMonth)
                )}
          </p>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setRangeAnchor(null);
              }}
              className="px-3 py-1.5 border border-gray-200 rounded text-[12px] text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveWithGuard()}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save period"}
            </button>
          </div>
        </div>
      ) : null}

      {!loading && yearRows.length > 0 ? (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
            Periods in {year}
          </div>
          <ul className="divide-y divide-gray-50">
            {yearRows.map((r) => {
              const months = monthsCoveredInYear(r, year);
              const span =
                months.length === 0
                  ? "—"
                  : months.length === 1
                    ? MONTH_SHORT[months[0] - 1]
                    : `${MONTH_SHORT[months[0] - 1]} – ${MONTH_SHORT[months[months.length - 1] - 1]}`;
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2.5 text-[13px]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      {compModelLabel(r.comp_model)} · {shortCompValue(r)}
                    </p>
                    <p className="text-[12px] text-gray-500">
                      {span}
                      {r.frequency === "one_off" ? " · one-off" : ` · ${r.frequency}`}
                      {!r.effective_to ? " · open-ended" : ""}
                      {r.projects?.title
                        ? ` · ${r.projects.title}`
                        : r.project_id
                          ? " · linked project"
                          : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="p-1.5 text-gray-500 hover:text-blue-600"
                    aria-label="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(r.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600"
                    aria-label="Delete"
                  >
                    <Trash size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!loading && yearRows.length === 0 && !editing ? (
        <p className="text-[13px] text-gray-500">
          No compensation in {year}. Click months to add a recurring stretch or a
          one-off.
        </p>
      ) : null}
    </div>
  );
}
