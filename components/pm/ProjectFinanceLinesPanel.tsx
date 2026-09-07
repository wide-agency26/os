"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatEuro } from "@/lib/accounting/types";
import {
  asFinanceFrequency,
  financeYearBooked,
  type FinanceFrequency,
} from "@/lib/accounting/finance";
import type { ProjectFinanceLineInput } from "@/app/actions/accounting";

export type FinanceLine = {
  id: string;
  label: string;
  amount: number;
  entry_date: string;
  category: string;
  notes: string | null;
  frequency?: string | null;
  effective_to?: string | null;
  overhead_cost_id?: string | null;
  person_id?: string | null;
  person_name?: string | null;
};

type FormState = {
  id?: string;
  label: string;
  amount: string;
  entry_date: string;
  frequency: FinanceFrequency;
  effective_to: string;
  person_id: string;
  overhead_cost_id: string;
};

function emptyForm(): FormState {
  return {
    label: "",
    amount: "",
    entry_date: new Date().toISOString().slice(0, 10),
    frequency: "one_off",
    effective_to: "",
    person_id: "",
    overhead_cost_id: "",
  };
}

function fromLine(line: FinanceLine): FormState {
  return {
    id: line.id,
    label: line.label,
    amount: String(line.amount ?? ""),
    entry_date: line.entry_date,
    frequency: asFinanceFrequency(line.frequency),
    effective_to: line.effective_to || "",
    person_id: line.person_id || "",
    overhead_cost_id: line.overhead_cost_id || "",
  };
}

export function FrequencyToggle({
  value,
  onChange,
}: {
  value: FinanceFrequency;
  onChange: (next: FinanceFrequency) => void;
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange("one_off")}
        className={[
          "px-2.5 py-1.5 rounded text-[12px] font-medium border",
          value === "one_off"
            ? "bg-amber-50 border-amber-300 text-amber-900"
            : "border-gray-200 text-gray-600 hover:bg-gray-50",
        ].join(" ")}
      >
        One-off
      </button>
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={[
          "px-2.5 py-1.5 rounded text-[12px] font-medium border",
          value === "monthly"
            ? "bg-sky-50 border-sky-300 text-sky-900"
            : "border-gray-200 text-gray-600 hover:bg-gray-50",
        ].join(" ")}
      >
        Monthly
      </button>
    </div>
  );
}

export function ProjectFinanceLinesPanel({
  kind,
  projectId,
  lines,
  pillarLabel,
  onSave,
  onDelete,
}: {
  kind: "revenue" | "cost";
  projectId: string;
  lines: FinanceLine[];
  pillarLabel: string;
  onSave: (input: ProjectFinanceLineInput) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (id: string, projectId: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState<{ id: string; full_name: string }[]>([]);
  const isRevenue = kind === "revenue";
  const year = new Date().getFullYear();

  useEffect(() => {
    if (kind !== "cost") return;
    const supabase = createClient();
    void (supabase as any)
      .from("people")
      .select("id, full_name")
      .eq("roster_status", "active")
      .order("full_name")
      .then(({ data }: { data: { id: string; full_name: string }[] | null }) => {
        setPeople(data || []);
      });
  }, [kind]);

  const submit = async () => {
    const amount = Number(form.amount.replace(",", "."));
    if (!form.label.trim() || !Number.isFinite(amount) || amount === 0) {
      alert("Enter a label and a non-zero amount.");
      return;
    }
    setSaving(true);
    const res = await onSave({
      id: form.id,
      project_id: projectId,
      label: form.label,
      amount,
      entry_date: form.entry_date,
      frequency: form.frequency,
      effective_to: form.effective_to || null,
      category: isRevenue ? "Revenue" : "Actual cost",
      person_id: isRevenue ? null : form.person_id || null,
      overhead_cost_id: form.overhead_cost_id || null,
    });
    setSaving(false);
    if (!res.ok) {
      alert(res.error || "Failed to save");
      return;
    }
    setForm(emptyForm());
  };

  const remove = async (id: string) => {
    if (!confirm(isRevenue ? "Delete this revenue line?" : "Delete this cost line?")) {
      return;
    }
    setSaving(true);
    const res = await onDelete(id, projectId);
    setSaving(false);
    if (!res.ok) alert(res.error || "Failed to delete");
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 font-semibold flex items-center justify-between gap-2">
        <span>{isRevenue ? "Additional revenue lines" : "Real costs"}</span>
        {form.id ? (
          <span className="normal-case font-medium text-blue-700">Editing</span>
        ) : null}
      </div>
      <div className="p-3 border-b border-gray-100 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FrequencyToggle
            value={form.frequency}
            onChange={(frequency) =>
              setForm((f) => ({
                ...f,
                frequency,
                effective_to: frequency === "one_off" ? "" : f.effective_to,
              }))
            }
          />
          {form.id ? (
            <button
              type="button"
              onClick={() => setForm(emptyForm())}
              className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-800"
            >
              <X className="w-3.5 h-3.5" />
              Cancel edit
            </button>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-6">
          <input
            type="text"
            placeholder={isRevenue ? "Label (e.g. Phase 2 retainer)" : "Label"}
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            className="sm:col-span-2 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Amount €"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
          />
          <input
            type="date"
            value={form.entry_date}
            onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
            title="From"
          />
          {form.frequency === "monthly" ? (
            <input
              type="date"
              value={form.effective_to}
              onChange={(e) =>
                setForm((f) => ({ ...f, effective_to: e.target.value }))
              }
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
              title="To (empty = through Dec)"
              placeholder="To"
            />
          ) : (
            <div className="hidden sm:block" />
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold px-3 py-2 hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : form.id ? (
              <Pencil className="w-3.5 h-3.5" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {form.id ? "Save" : "Add"}
          </button>
        </div>
        {!isRevenue ? (
          <select
            value={form.person_id}
            onChange={(e) => setForm((f) => ({ ...f, person_id: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white"
          >
            <option value="">— Not on an HR person —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        ) : null}
        <p className="text-[11px] text-gray-400">
          {form.frequency === "monthly"
            ? "Monthly posts every covered month this year into accounting. Leave end empty for open-ended through December."
            : "One-off posts once in the From month."}{" "}
          Syncs immediately to {pillarLabel}
          {!isRevenue ? " · same line as Resources / HR" : ""}.
        </p>
      </div>
      {lines.length === 0 ? (
        <p className="px-3 py-4 text-[13px] text-gray-500">
          {isRevenue
            ? `Optional add-ons beyond deal value. Each line syncs into ${pillarLabel} revenue.`
            : `No actual cost lines yet. Add here or in Resources — they are the same cost, posted once to ${pillarLabel}.`}
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {lines.map((line) => {
            const freq = asFinanceFrequency(line.frequency);
            const booked = financeYearBooked(
              Number(line.amount || 0),
              line.frequency,
              line.entry_date,
              line.effective_to,
              year
            );
            return (
              <li
                key={line.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{line.label}</p>
                  <p className="text-[11px] text-gray-400">
                    {freq === "monthly" ? "Monthly" : "One-off"} · {line.entry_date}
                    {freq === "monthly"
                      ? ` → ${line.effective_to || "ongoing"}`
                      : ""}
                    {line.person_name ? ` · ${line.person_name}` : ""}
                    {freq === "monthly" ? ` · ${formatEuro(booked)} in ${year}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`tabular-nums font-semibold ${
                      isRevenue ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {isRevenue ? "+" : "−"}
                    {formatEuro(line.amount)}
                    {freq === "monthly" ? (
                      <span className="text-gray-400 font-normal"> /mo</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setForm(fromLine(line))}
                    className="p-1.5 text-gray-400 hover:text-blue-600"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void remove(line.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
