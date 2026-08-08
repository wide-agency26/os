"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  COMP_MODELS,
  COMP_FREQUENCIES,
  type CompFrequency,
  type CompModel,
} from "@/lib/hr/types";

type Props = {
  projectId: string;
  projectTitle?: string | null;
  personId: string;
  personName: string | null;
  defaultModel?: CompModel;
  onCancel: () => void;
  onSaved: (compensationRecordId: string) => void;
};

/**
 * Shown when assigning an external/freelancer person to a project task
 * who does not yet have compensation linked to this project.
 */
export function AssignWithProjectCompensationModal({
  projectId,
  projectTitle,
  personId,
  personName,
  defaultModel = "hourly_invoice",
  onCancel,
  onSaved,
}: Props) {
  const [compModel, setCompModel] = useState<CompModel>(defaultModel);
  const [frequency, setFrequency] = useState<CompFrequency>(
    defaultModel === "hourly_invoice" ? "per_hour" : "per_project"
  );
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!amount.trim() && compModel !== "non_monetary" && compModel !== "equity") {
      alert("Enter the amount for this project compensation.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await (supabase as any)
      .from("compensation_records")
      .insert([
        {
          person_id: personId,
          project_id: projectId,
          comp_model: compModel,
          amount: amount ? Number(amount) : null,
          currency: currency || "EUR",
          frequency,
          effective_from: today,
          effective_to: null,
          notes:
            notes.trim() ||
            `Linked from project task assign${projectTitle ? ` — ${projectTitle}` : ""}`,
        },
      ])
      .select("id")
      .single();

    setSaving(false);
    if (error || !data?.id) {
      alert(error?.message || "Could not save compensation");
      return;
    }

    // Keep people.hourly_rate_cost in sync for hourly models (project cost fallback)
    if (
      (compModel === "hourly_invoice" || frequency === "per_hour") &&
      amount
    ) {
      await (supabase as any)
        .from("people")
        .update({
          hourly_rate_cost: Number(amount),
          updated_at: new Date().toISOString(),
        })
        .eq("id", personId);
    }

    onSaved(data.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-comp-title"
        className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-5 space-y-4"
      >
        <div>
          <h3
            id="assign-comp-title"
            className="text-[15px] font-bold text-gray-900"
          >
            Project compensation required
          </h3>
          <p className="text-[13px] text-gray-600 mt-1">
            <span className="font-medium text-gray-900">
              {personName || "This person"}
            </span>{" "}
            is outside core org staffing. Enter how they are paid on{" "}
            <span className="font-medium text-gray-900">
              {projectTitle || "this project"}
            </span>{" "}
            before assigning the task.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2 sm:col-span-1">
            <span className="text-[12px] font-semibold text-gray-700">Model</span>
            <select
              value={compModel}
              onChange={(e) => {
                const m = e.target.value as CompModel;
                setCompModel(m);
                if (m === "hourly_invoice") setFrequency("per_hour");
                else if (m === "retainer") setFrequency("monthly");
                else setFrequency("per_project");
              }}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
            >
              {COMP_MODELS.filter(
                (m) =>
                  m.value !== "de_full_time_salary" &&
                  m.value !== "equity" &&
                  m.value !== "referral_percentage"
              ).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block col-span-2 sm:col-span-1">
            <span className="text-[12px] font-semibold text-gray-700">
              Frequency
            </span>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as CompFrequency)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
            >
              {COMP_FREQUENCIES.filter((f) => f.value !== "n/a").map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-gray-700">
              Amount
            </span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={
                frequency === "per_hour" ? "e.g. 65" : "e.g. 2500"
              }
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-gray-700">
              Currency
            </span>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
            />
          </label>
          <label className="block col-span-2">
            <span className="text-[12px] font-semibold text-gray-700">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              placeholder="Optional — scope, deliverables, invoice terms"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
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
            {saving ? "Saving…" : "Save & assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
