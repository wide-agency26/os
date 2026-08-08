"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash, X } from "lucide-react";
import { ProjectLinkSelect } from "@/components/hr/ProjectLinkSelect";
import {
  firstDayOfMonth,
  lastDayOfMonth,
  MONTH_SHORT,
  recordCoversMonth,
  recordTouchesYear,
} from "@/lib/hr/compensation";
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
  project_id?: string | null;
  projects?: { id: string; title: string | null } | null;
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
  project_id: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(defaults?: { effective_from?: string }): FormState {
  return {
    cost_category: "desk",
    label: "",
    amount: "",
    currency: "EUR",
    frequency: "monthly",
    effective_from: defaults?.effective_from || todayIso(),
    effective_to: "",
    notes: "",
    accounting_ref_id: "",
    project_id: "",
  };
}

function categoryLabel(key: OverheadCostCategory | string): string {
  return OVERHEAD_CATEGORIES.find((c) => c.value === key)?.label || key;
}

function monthCellTone(count: number): string {
  if (count === 0) return "border-dashed border-gray-200 bg-white text-gray-500";
  if (count === 1) return "bg-emerald-50 border-emerald-200 text-emerald-900";
  return "bg-teal-50 border-teal-200 text-teal-900";
}

type Props = { personId: string };

export function PersonOverheadCostsPanel({ personId }: Props) {
  const [rows, setRows] = useState<OverheadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [openMonth, setOpenMonth] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await (supabase as any)
      .from("person_overhead_costs")
      .select("*, projects:project_id ( id, title )")
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

  const yearRows = useMemo(
    () => rows.filter((r) => recordTouchesYear(r, year)),
    [rows, year]
  );

  const byMonth = useMemo(() => {
    const map: Record<number, OverheadRow[]> = {};
    for (let m = 1; m <= 12; m++) map[m] = [];
    for (const r of yearRows) {
      for (let m = 1; m <= 12; m++) {
        if (recordCoversMonth(r, year, m)) map[m].push(r);
      }
    }
    return map;
  }, [yearRows, year]);

  const openMonthRows = useMemo(() => {
    if (openMonth == null) return [];
    return [...(byMonth[openMonth] || [])].sort((a, b) =>
      a.effective_from < b.effective_from
        ? -1
        : a.effective_from > b.effective_from
          ? 1
          : a.label.localeCompare(b.label)
    );
  }, [byMonth, openMonth]);

  const openMonthTotal = useMemo(
    () =>
      openMonthRows.reduce(
        (s, r) => s + monthlyOverheadAmount(r.amount, r.frequency),
        0
      ),
    [openMonthRows]
  );

  const openMonthBlock = (month: number) => {
    setOpenMonth(month);
    setEditing(false);
    setForm(emptyForm({ effective_from: firstDayOfMonth(year, month) }));
  };

  const startCreateInMonth = () => {
    if (openMonth == null) return;
    const mid = Math.min(15, Number(lastDayOfMonth(year, openMonth).slice(-2)));
    const day = String(mid).padStart(2, "0");
    setForm(
      emptyForm({
        effective_from: `${year}-${String(openMonth).padStart(2, "0")}-${day}`,
      })
    );
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
      project_id: row.project_id || "",
    });
    setEditing(true);
    // Ensure the month that contains this cost's from-date (in year) is open
    const fromMonth = Number(row.effective_from.slice(5, 7));
    const fromYear = Number(row.effective_from.slice(0, 4));
    if (fromYear === year && fromMonth >= 1 && fromMonth <= 12) {
      setOpenMonth(fromMonth);
    } else if (openMonth == null) {
      const covered = Array.from({ length: 12 }, (_, i) => i + 1).find((m) =>
        recordCoversMonth(row, year, m)
      );
      if (covered) setOpenMonth(covered);
    }
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
      project_id: form.project_id || null,
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
    setForm(
      emptyForm(
        openMonth
          ? { effective_from: firstDayOfMonth(year, openMonth) }
          : undefined
      )
    );
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
    if (form.id === id) {
      setEditing(false);
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
          <p className="text-[12px] text-gray-500 mt-0.5">
            Financial year {year} · Jan 1 – Dec 31
          </p>
        </div>
        <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setYear((y) => y - 1);
              setOpenMonth(null);
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
              setOpenMonth(null);
              setEditing(false);
            }}
            className="p-2 text-gray-600 hover:bg-gray-50"
            aria-label="Next year"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <p className="text-[12px] text-gray-500">
        Click a month to open its costs. A month can hold several lines; exact dates
        appear inside the month.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {MONTH_SHORT.map((label, idx) => {
          const month = idx + 1;
          const covering = byMonth[month] || [];
          const isOpen = openMonth === month;
          const monthSum = covering.reduce(
            (s, r) => s + monthlyOverheadAmount(r.amount, r.frequency),
            0
          );
          const preview = covering.slice(0, 2);
          return (
            <button
              key={label}
              type="button"
              onClick={() => openMonthBlock(month)}
              className={[
                "text-left rounded-xl border p-3 min-h-[96px] transition-colors hover:border-teal-300",
                isOpen
                  ? "border-teal-500 ring-2 ring-teal-100 bg-teal-50/50"
                  : monthCellTone(covering.length),
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[12px] font-bold uppercase tracking-wide">
                  {label}
                </span>
                {covering.length > 0 ? (
                  <span className="text-[10px] font-semibold tabular-nums opacity-80">
                    {covering.length} cost{covering.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              {covering.length === 0 ? (
                <span className="text-[12px] text-gray-400">Empty</span>
              ) : (
                <div className="space-y-1">
                  <p className="text-[13px] font-semibold tabular-nums">
                    {formatMoney(monthSum)}
                    <span className="text-[10px] font-normal opacity-70"> ≈/mo</span>
                  </p>
                  {preview.map((r) => (
                    <p key={r.id} className="text-[11px] opacity-80 truncate">
                      {r.label}
                    </p>
                  ))}
                  {covering.length > 2 ? (
                    <p className="text-[10px] opacity-60">+{covering.length - 2} more</p>
                  ) : null}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {openMonth != null ? (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/80">
            <div>
              <h4 className="text-[13px] font-bold text-gray-900">
                {MONTH_SHORT[openMonth - 1]} {year}
              </h4>
              <p className="text-[12px] text-gray-500">
                {openMonthRows.length} cost{openMonthRows.length === 1 ? "" : "s"}
                {openMonthRows.length > 0
                  ? ` · ≈ ${formatMoney(openMonthTotal)} / month`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!editing ? (
                <button
                  type="button"
                  onClick={startCreateInMonth}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium hover:bg-blue-700 inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  Add cost
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setOpenMonth(null);
                  setEditing(false);
                }}
                className="p-1.5 text-gray-500 hover:text-gray-800 rounded hover:bg-gray-100"
                aria-label="Close month"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {editing ? (
              <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
                <h5 className="text-[12px] font-bold text-gray-900">
                  {form.id ? "Edit cost" : "New cost"}
                </h5>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[12px] font-semibold text-gray-700">
                      Category
                    </span>
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
                    <span className="text-[12px] font-semibold text-gray-700">
                      Frequency
                    </span>
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
                      onChange={(e) =>
                        setForm((f) => ({ ...f, label: e.target.value }))
                      }
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
                      placeholder="e.g. Desk — WeWork Munich / Office electricity share"
                    />
                  </label>
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
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
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
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[12px] font-semibold text-gray-700">
                      Exact from date
                    </span>
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
                      Exact to date (empty = ongoing)
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
                      onChange={(e) =>
                        setForm((f) => ({ ...f, notes: e.target.value }))
                      }
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
                  <ProjectLinkSelect
                    className="sm:col-span-2"
                    value={form.project_id}
                    onChange={(project_id) => setForm((f) => ({ ...f, project_id }))}
                    hint="Optionally charge this overhead to a specific project’s cost view."
                  />
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
                      setForm(
                        emptyForm({
                          effective_from: firstDayOfMonth(year, openMonth),
                        })
                      );
                    }}
                    className="px-3 py-2 border border-gray-200 rounded text-[13px] text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {openMonthRows.length === 0 && !editing ? (
              <p className="text-[13px] text-gray-500 border border-dashed border-gray-200 rounded-xl p-5 text-center">
                No costs covering {MONTH_SHORT[openMonth - 1]} {year}. Add desk, office
                bills, or one-offs with an exact date.
              </p>
            ) : openMonthRows.length > 0 ? (
              <ul className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                {openMonthRows.map((r) => {
                  const active = !r.effective_to || r.effective_to >= todayIso();
                  return (
                    <li
                      key={r.id}
                      className={`flex flex-wrap items-start gap-3 px-3 py-3 text-[13px] ${
                        active ? "" : "opacity-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">
                          {r.label}
                          {!active ? (
                            <span className="ml-2 text-[10px] text-gray-400">ended</span>
                          ) : null}
                        </p>
                        <p className="text-[12px] text-gray-500 mt-0.5">
                          {categoryLabel(r.cost_category)} · {r.frequency} ·{" "}
                          {formatMoney(r.amount, r.currency)}
                          <span className="text-gray-400">
                            {" "}
                            (≈ {formatMoney(
                              monthlyOverheadAmount(r.amount, r.frequency),
                              r.currency
                            )}
                            /mo)
                          </span>
                        </p>
                        <p className="text-[12px] text-gray-600 mt-1 tabular-nums">
                          {r.effective_from}
                          {" → "}
                          {r.effective_to || "ongoing"}
                          {r.projects?.title
                            ? ` · ${r.projects.title}`
                            : r.project_id
                              ? " · linked project"
                              : ""}
                        </p>
                      </div>
                      <div className="flex items-center shrink-0">
                        <button
                          type="button"
                          className="p-1.5 text-gray-500 hover:text-gray-800"
                          onClick={() => startEdit(r)}
                          aria-label="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 text-red-500 hover:text-red-700"
                          onClick={() => void handleDelete(r.id)}
                          aria-label="Delete"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      ) : yearRows.length === 0 ? (
        <p className="text-[13px] text-gray-500 border border-dashed border-gray-200 rounded-xl p-6 text-center">
          No overhead in {year}. Open a month to add desk, office share, or bill lines.
        </p>
      ) : null}
    </div>
  );
}
