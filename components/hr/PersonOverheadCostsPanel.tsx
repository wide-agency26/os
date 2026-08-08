"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus, Pencil, Trash } from "lucide-react";
import {
  OVERHEAD_CATEGORIES,
  OVERHEAD_FREQUENCIES,
  formatMoney,
  monthlyOverheadAmount,
  type OverheadCostCategory,
  type OverheadFrequency,
} from "@/lib/hr/types";

type OverheadRow = {
  id: string;
  person_id: string;
  cost_category: OverheadCostCategory;
  label: string;
  amount: number;
  currency: string;
  frequency: OverheadFrequency;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  accounting_ref_id: string | null;
};

type FormState = {
  id?: string;
  cost_category: OverheadCostCategory;
  label: string;
  amount: string;
  currency: string;
  frequency: OverheadFrequency;
  effective_from: string;
  effective_to: string;
  notes: string;
  accounting_ref_id: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return {
    cost_category: "desk",
    label: "",
    amount: "",
    currency: "EUR",
    frequency: "monthly",
    effective_from: todayIso(),
    effective_to: "",
    notes: "",
    accounting_ref_id: "",
  };
}

type Props = { personId: string };

export function PersonOverheadCostsPanel({ personId }: Props) {
  const [rows, setRows] = useState<OverheadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await (supabase as any)
      .from("person_overhead_costs")
      .select("*")
      .eq("person_id", personId)
      .order("effective_from", { ascending: false });
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data || []) as OverheadRow[]);
    }
    setLoading(false);
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthlyRunRate = useMemo(
    () =>
      rows
        .filter((r) => !r.effective_to || r.effective_to >= todayIso())
        .reduce((s, r) => s + monthlyOverheadAmount(r.amount, r.frequency), 0),
    [rows]
  );

  const startCreate = () => {
    setForm(emptyForm());
    setEditing(true);
  };

  const startEdit = (row: OverheadRow) => {
    setForm({
      id: row.id,
      cost_category: row.cost_category,
      label: row.label,
      amount: String(row.amount ?? ""),
      currency: row.currency || "EUR",
      frequency: row.frequency,
      effective_from: row.effective_from,
      effective_to: row.effective_to || "",
      notes: row.notes || "",
      accounting_ref_id: row.accounting_ref_id || "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!form.label.trim()) {
      alert("Label is required (e.g. Desk — WeWork Munich).");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      person_id: personId,
      cost_category: form.cost_category,
      label: form.label.trim(),
      amount: form.amount ? Number(form.amount) : 0,
      currency: form.currency || "EUR",
      frequency: form.frequency,
      effective_from: form.effective_from || todayIso(),
      effective_to: form.effective_to || null,
      notes: form.notes.trim() || null,
      accounting_ref_id: form.accounting_ref_id.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = form.id
      ? await (supabase as any)
          .from("person_overhead_costs")
          .update(payload)
          .eq("id", form.id)
      : await (supabase as any).from("person_overhead_costs").insert([payload]);

    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setEditing(false);
    setForm(emptyForm());
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this overhead cost line?")) return;
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("person_overhead_costs")
      .delete()
      .eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
  };

  if (loading) {
    return <p className="text-[13px] text-gray-500">Loading overhead costs…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-gray-900">Resource overhead</h3>
          <p className="text-[12px] text-gray-500 mt-1 max-w-xl">
            Costs that come with this person beyond pay — desk, office share, utilities,
            equipment seats. Not compensation.
          </p>
          <p className="text-[13px] text-gray-800 mt-2">
            Active monthly run-rate:{" "}
            <span className="font-semibold tabular-nums">
              {formatMoney(monthlyRunRate)}
            </span>
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={startCreate}
            className="px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={16} />
            Add cost
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">Category</span>
              <select
                value={form.cost_category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cost_category: e.target.value as OverheadCostCategory,
                  }))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
              >
                {OVERHEAD_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">Frequency</span>
              <select
                value={form.frequency}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    frequency: e.target.value as OverheadFrequency,
                  }))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
              >
                {OVERHEAD_FREQUENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[12px] font-semibold text-gray-700">Label</span>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
                placeholder="e.g. Desk — WeWork Munich / Office electricity share"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">Amount</span>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">Currency</span>
              <input
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">From</span>
              <input
                type="date"
                value={form.effective_from}
                onChange={(e) =>
                  setForm((f) => ({ ...f, effective_from: e.target.value }))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">
                To (empty = current)
              </span>
              <input
                type="date"
                value={form.effective_to}
                onChange={(e) =>
                  setForm((f) => ({ ...f, effective_to: e.target.value }))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[12px] font-semibold text-gray-700">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[12px] font-semibold text-gray-700">
                Accounting ref (optional)
              </span>
              <input
                value={form.accounting_ref_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, accounting_ref_id: e.target.value }))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
                placeholder="Invoice / cost-center key"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save cost"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setForm(emptyForm());
              }}
              className="px-3 py-2 border border-gray-200 rounded text-[13px] text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {rows.length === 0 && !editing ? (
        <p className="text-[13px] text-gray-500 border border-dashed border-gray-200 rounded-xl p-6 text-center">
          No overhead costs yet. Co-founders often carry desk + office bill shares here.
        </p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">Cost</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-left px-3 py-2">Freq</th>
                <th className="text-right px-3 py-2">≈ Monthly</th>
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cat =
                  OVERHEAD_CATEGORIES.find((c) => c.value === r.cost_category)?.label ||
                  r.cost_category;
                const active = !r.effective_to || r.effective_to >= todayIso();
                return (
                  <tr
                    key={r.id}
                    className={`border-t border-gray-50 ${active ? "" : "opacity-50"}`}
                  >
                    <td className="px-3 py-2.5 font-medium text-gray-900">
                      {r.label}
                      {!active ? (
                        <span className="ml-2 text-[10px] text-gray-400">ended</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{cat}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatMoney(r.amount, r.currency)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{r.frequency}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-800">
                      {formatMoney(monthlyOverheadAmount(r.amount, r.frequency), r.currency)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        className="p-1 text-gray-500 hover:text-gray-800"
                        onClick={() => startEdit(r)}
                        aria-label="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-red-500 hover:text-red-700"
                        onClick={() => void handleDelete(r.id)}
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
