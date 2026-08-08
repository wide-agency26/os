"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  companyLabel,
  fetchCompanyOptions,
  fetchProjectsByClient,
  type CompanyOption,
  type ProjectOption,
} from "@/lib/accounting/queries";
import {
  MONTH_SHORT,
  firstOfMonth,
  type LedgerEntry,
  type LedgerPillar,
  type LedgerType,
} from "@/lib/accounting/types";
import {
  deleteManualLedgerEntry,
  saveManualLedgerEntry,
} from "@/app/actions/accounting";
import { Loader2, Trash2, X } from "lucide-react";

const CONFIDENCE_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

type Props = {
  pillar: LedgerPillar;
  onClose: () => void;
  onSaved: () => void;
  initialEntry?: LedgerEntry | null;
  showConfidence?: boolean;
  /** Pre-select a month (1-12) / year, e.g. when adding from a calendar card. */
  defaultMonth?: number;
  defaultYear?: number;
};

export function LedgerEntryForm({
  pillar,
  onClose,
  onSaved,
  initialEntry,
  showConfidence,
  defaultMonth,
  defaultYear,
}: Props) {
  const now = new Date();
  const isEdit = Boolean(initialEntry?.id);

  const [type, setType] = useState<LedgerType>(initialEntry?.type || "cost");
  const [category, setCategory] = useState(initialEntry?.category || "");
  const [amount, setAmount] = useState(
    initialEntry?.amount != null ? String(initialEntry.amount) : ""
  );
  const [month, setMonth] = useState<number>(
    initialEntry?.entry_date
      ? Number(initialEntry.entry_date.slice(5, 7))
      : defaultMonth || now.getMonth() + 1
  );
  const [year, setYear] = useState<number>(
    initialEntry?.entry_date
      ? Number(initialEntry.entry_date.slice(0, 4))
      : defaultYear || now.getFullYear()
  );
  const [confidence, setConfidence] = useState(initialEntry?.confidence || "");

  const [companyId, setCompanyId] = useState(initialEntry?.company_id || "");
  const [clientId, setClientId] = useState(initialEntry?.client_id || "");
  const [projectId, setProjectId] = useState(initialEntry?.project_id || "");
  const [projectLocked, setProjectLocked] = useState(Boolean(initialEntry?.project_id));

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    fetchCompanyOptions(supabase).then(setCompanies);
  }, []);

  const scopeId = clientId || companyId;

  useEffect(() => {
    if (!scopeId) {
      setProjects([]);
      return;
    }
    let active = true;
    setLoadingProjects(true);
    const supabase = createClient();
    fetchProjectsByClient(supabase, scopeId).then((rows) => {
      if (active) {
        setProjects(rows);
        setLoadingProjects(false);
      }
    });
    return () => {
      active = false;
    };
  }, [scopeId]);

  const companyOptions = useMemo(
    () =>
      [...companies].sort((a, b) => companyLabel(a).localeCompare(companyLabel(b))),
    [companies]
  );

  function handleCompanyChange(id: string) {
    setCompanyId(id);
    if (clientId && clientId !== id) setClientId("");
    setProjectId("");
    setProjectLocked(false);
  }

  function handleClientChange(id: string) {
    setClientId(id);
    if (id) setCompanyId(id);
    setProjectId("");
    setProjectLocked(false);
  }

  function handleProjectChange(id: string) {
    setProjectId(id);
    if (!id) {
      setProjectLocked(false);
      return;
    }
    const proj = projects.find((p) => p.id === id);
    if (proj?.client_id) {
      setCompanyId(proj.client_id);
      setClientId(proj.client_id);
    }
    setProjectLocked(true);
  }

  function unlockProject() {
    setProjectId("");
    setProjectLocked(false);
  }

  async function handleSave() {
    if (!category.trim()) {
      setError("Category is required.");
      return;
    }
    const numericAmount = Number(amount);
    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    setError(null);
    setSaving(true);
    const result = await saveManualLedgerEntry({
      id: initialEntry?.id,
      pillar,
      type,
      amount: numericAmount,
      entry_date: firstOfMonth(year, month),
      company_id: companyId || null,
      client_id: clientId || companyId || null,
      project_id: projectId || null,
      category: category.trim(),
      confidence: showConfidence ? confidence || null : null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error || "Could not save entry.");
      return;
    }
    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!initialEntry?.id) return;
    if (!confirm("Delete this manual entry? This cannot be undone.")) return;
    setDeleting(true);
    const result = await deleteManualLedgerEntry(initialEntry.id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error || "Could not delete entry.");
      return;
    }
    onSaved();
    onClose();
  }

  const yearOptions = useMemo(() => {
    const base = now.getFullYear();
    return [base - 1, base, base + 1, base + 2];
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ledger-entry-form-title"
        className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 id="ledger-entry-form-title" className="text-[15px] font-bold text-gray-900">
            {isEdit ? "Edit entry" : "New entry"}{" "}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 ml-1">
              {pillar}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("revenue")}
              className={`flex-1 px-3 py-2 rounded-md text-[13px] font-medium border transition-colors ${
                type === "revenue"
                  ? "bg-green-50 text-green-700 border-green-300"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              Revenue
            </button>
            <button
              type="button"
              onClick={() => setType("cost")}
              className={`flex-1 px-3 py-2 rounded-md text-[13px] font-medium border transition-colors ${
                type === "cost"
                  ? "bg-red-50 text-red-700 border-red-300"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              Cost
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-medium text-gray-700">Category</span>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Retainer, Software, Ad spend"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-gray-700">Amount (€)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-medium text-gray-700">Month</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {MONTH_SHORT.map((label, idx) => (
                  <option key={label} value={idx + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-gray-700">Year</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {showConfidence && (
            <label className="block">
              <span className="text-[12px] font-medium text-gray-700">Confidence</span>
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Unspecified</option>
                {CONFIDENCE_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="pt-2 border-t border-gray-100 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Attribution (optional)
            </p>

            <label className="block">
              <span className="text-[12px] font-medium text-gray-700">Company</span>
              <select
                value={companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                disabled={projectLocked}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">No company</option>
                {companyOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {companyLabel(c)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] font-medium text-gray-700">
                Client{" "}
                <span className="text-gray-400 font-normal">
                  (optional — locks company to the same record)
                </span>
              </span>
              <select
                value={clientId}
                onChange={(e) => handleClientChange(e.target.value)}
                disabled={projectLocked}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Same as company</option>
                {companyOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {companyLabel(c)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-gray-700">Project</span>
                {projectLocked && (
                  <button
                    type="button"
                    onClick={unlockProject}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <select
                value={projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                disabled={!scopeId || loadingProjects}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {!scopeId
                    ? "Select a company or client first"
                    : loadingProjects
                      ? "Loading projects…"
                      : "No project"}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || "Untitled project"}
                  </option>
                ))}
              </select>
              {projectLocked && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Company &amp; client locked from the selected project.
                </p>
              )}
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <div>
            {isEdit && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex items-center gap-1.5 text-[12px] text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-gray-200 rounded text-[12px] text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? "Saving…" : "Save entry"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
