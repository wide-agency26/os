"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus, Pencil, Trash } from "lucide-react";
import { SalaryBreakdownForm } from "@/components/hr/SalaryBreakdownForm";
import {
  COMP_FREQUENCIES,
  COMP_MODELS,
  deriveSalaryTotals,
  emptySalaryBreakdown,
  formatMoney,
  type CompFrequency,
  type CompModel,
  type CompensationRecord,
  type SalaryBreakdown,
} from "@/lib/hr/types";

type Props = { personId: string };

type FormState = {
  id?: string;
  comp_model: CompModel;
  amount: string;
  currency: string;
  frequency: CompFrequency;
  non_monetary_description: string;
  referral_percentage: string;
  effective_from: string;
  effective_to: string;
  notes: string;
  salary: SalaryBreakdown;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(model: CompModel = "hourly_invoice"): FormState {
  return {
    comp_model: model,
    amount: "",
    currency: "EUR",
    frequency: model === "non_monetary" || model === "equity" ? "n/a" : "monthly",
    non_monetary_description: "",
    referral_percentage: "",
    effective_from: todayIso(),
    effective_to: "",
    notes: "",
    salary: emptySalaryBreakdown(),
  };
}

export function PersonCompensationPanel({ personId }: Props) {
  const [rows, setRows] = useState<CompensationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await (supabase as any)
      .from("compensation_records")
      .select("*, salary_breakdowns (*)")
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

  const startCreate = () => {
    setForm(emptyForm());
    setEditing(true);
  };

  const startEdit = (row: CompensationRecord) => {
    const sb = row.salary_breakdowns?.[0];
    setForm({
      id: row.id,
      comp_model: row.comp_model,
      amount: row.amount != null ? String(row.amount) : "",
      currency: row.currency || "EUR",
      frequency: row.frequency,
      non_monetary_description: row.non_monetary_description || "",
      referral_percentage:
        row.referral_percentage != null ? String(row.referral_percentage) : "",
      effective_from: row.effective_from || todayIso(),
      effective_to: row.effective_to || "",
      notes: row.notes || "",
      salary: sb
        ? { ...emptySalaryBreakdown(), ...sb }
        : emptySalaryBreakdown(),
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
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
      frequency: form.frequency,
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
      effective_from: form.effective_from,
      effective_to: form.effective_to || null,
      notes: form.notes.trim() || null,
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
        period_month: form.salary.period_month,
        period_year: form.salary.period_year,
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

    setSaving(false);
    setEditing(false);
    await load();
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
    await load();
  };

  const modelLabel = (m: CompModel) =>
    COMP_MODELS.find((x) => x.value === m)?.label || m;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-bold text-gray-900">Compensation</h3>
        {!editing ? (
          <button
            type="button"
            onClick={startCreate}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium hover:bg-blue-700 inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            Add record
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-white">
          <div className="grid sm:grid-cols-2 gap-3">
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
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">
                Frequency
              </span>
              <select
                value={form.frequency}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    frequency: e.target.value as CompFrequency,
                  }))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              >
                {COMP_FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

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

            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">
                Effective from
              </span>
              <input
                type="date"
                value={form.effective_from}
                onChange={(e) =>
                  setForm((f) => ({ ...f, effective_from: e.target.value }))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">
                Effective to
              </span>
              <input
                type="date"
                value={form.effective_to}
                onChange={(e) =>
                  setForm((f) => ({ ...f, effective_to: e.target.value }))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              />
            </label>
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

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 border border-gray-200 rounded text-[12px] text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-[13px] text-gray-500">Loading compensation…</p>
      ) : rows.length === 0 && !editing ? (
        <p className="text-[13px] text-gray-500">No compensation records yet.</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">Model</th>
                <th className="text-left px-3 py-2">Value</th>
                <th className="text-left px-3 py-2">Frequency</th>
                <th className="text-left px-3 py-2">From</th>
                <th className="text-right px-3 py-2 w-24"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                let valueLabel = "—";
                if (r.comp_model === "referral_percentage") {
                  valueLabel =
                    r.referral_percentage != null
                      ? `${r.referral_percentage}%`
                      : "—";
                } else if (r.comp_model === "non_monetary") {
                  valueLabel = r.non_monetary_description || "—";
                } else if (r.comp_model === "de_full_time_salary") {
                  const sb = r.salary_breakdowns?.[0];
                  valueLabel = sb
                    ? formatMoney(
                        deriveSalaryTotals(sb).total_employer_cost,
                        r.currency
                      )
                    : "—";
                } else {
                  valueLabel = formatMoney(r.amount, r.currency);
                }
                return (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {modelLabel(r.comp_model)}
                    </td>
                    <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate">
                      {valueLabel}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.frequency}</td>
                    <td className="px-3 py-2 text-gray-600">{r.effective_from}</td>
                    <td className="px-3 py-2 text-right">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
