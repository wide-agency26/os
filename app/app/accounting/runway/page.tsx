"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  Gauge,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  fetchCashBalances,
  fetchLedgerEntries,
  monthlySeriesChronological,
} from "@/lib/accounting/queries";
import { formatEuro, formatEuroExact, type LedgerEntry } from "@/lib/accounting/types";
import { deleteCashBalance, saveCashBalance } from "@/app/actions/accounting";

type Scenario = "conservative" | "base" | "optimistic";

type CashRow = {
  id: string;
  balance_date: string;
  amount: number;
  source: string;
  notes: string | null;
};

const SCENARIOS: { value: Scenario; label: string; hint: string }[] = [
  { value: "conservative", label: "Conservative", hint: "Actual run-rate only" },
  { value: "base", label: "Base", hint: "Actual + 50% of identified pipeline" },
  { value: "optimistic", label: "Optimistic", hint: "Actual + identified + 50% unidentified" },
];

function avgMonthlyNetActual(entries: LedgerEntry[], trailingMonths = 3): number {
  const series = monthlySeriesChronological(entries);
  const last = series.slice(-trailingMonths);
  if (last.length === 0) return 0;
  const sum = last.reduce((s, m) => s + (m.revenue - m.cost), 0);
  return sum / last.length;
}

function avgMonthlyNetPipeline(entries: LedgerEntry[]): number {
  const series = monthlySeriesChronological(entries);
  if (series.length === 0) return 0;
  const sum = series.reduce((s, m) => s + (m.revenue - m.cost), 0);
  return sum / 12;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1 + months, d || 1));
  return date.toISOString().slice(0, 10);
}

export default function RunwayPage() {
  const currentYear = new Date().getFullYear();
  const rangeStart = `${currentYear - 1}-01-01`;
  const rangeEnd = `${currentYear + 1}-12-31`;

  const [cashRows, setCashRows] = useState<CashRow[]>([]);
  const [actualEntries, setActualEntries] = useState<LedgerEntry[]>([]);
  const [identifiedEntries, setIdentifiedEntries] = useState<LedgerEntry[]>([]);
  const [unidentifiedEntries, setUnidentifiedEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState<Scenario>("base");

  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState<CashRow | null>(null);
  const [formDate, setFormDate] = useState(todayIso());
  const [formAmount, setFormAmount] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [cash, actual, identified, unidentified] = await Promise.all([
      fetchCashBalances(supabase, rangeStart, rangeEnd),
      fetchLedgerEntries(supabase, { pillar: "actual", startDate: rangeStart, endDate: rangeEnd }),
      fetchLedgerEntries(supabase, { pillar: "identified", startDate: rangeStart, endDate: rangeEnd }),
      fetchLedgerEntries(supabase, { pillar: "unidentified", startDate: rangeStart, endDate: rangeEnd }),
    ]);
    setCashRows(cash as CashRow[]);
    setActualEntries(actual);
    setIdentifiedEntries(identified);
    setUnidentifiedEntries(unidentified);
    setLoading(false);
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const latestCash = useMemo(() => {
    if (cashRows.length === 0) return 0;
    return Number(cashRows[cashRows.length - 1].amount || 0);
  }, [cashRows]);

  const actualNet = useMemo(() => avgMonthlyNetActual(actualEntries), [actualEntries]);
  const identifiedNet = useMemo(() => avgMonthlyNetPipeline(identifiedEntries), [identifiedEntries]);
  const unidentifiedNet = useMemo(() => avgMonthlyNetPipeline(unidentifiedEntries), [unidentifiedEntries]);

  const scenarioNet = useMemo(() => {
    switch (scenario) {
      case "conservative":
        return actualNet;
      case "optimistic":
        return actualNet + identifiedNet + unidentifiedNet * 0.5;
      case "base":
      default:
        return actualNet + identifiedNet * 0.5;
    }
  }, [scenario, actualNet, identifiedNet, unidentifiedNet]);

  const monthsRunway = useMemo(() => {
    if (scenarioNet >= 0) return null; // infinite / growing
    if (latestCash <= 0) return 0;
    return Math.floor(latestCash / Math.abs(scenarioNet));
  }, [scenarioNet, latestCash]);

  const chart = useMemo(() => {
    const historical = [...cashRows]
      .sort((a, b) => (a.balance_date < b.balance_date ? -1 : 1))
      .map((r) => ({
        date: r.balance_date,
        amount: Number(r.amount || 0),
        projected: false,
      }));

    const lastDate = historical.length
      ? historical[historical.length - 1].date
      : todayIso();
    const projected = Array.from({ length: 12 }, (_, i) => ({
      date: addMonthsIso(lastDate, i + 1),
      amount: latestCash + scenarioNet * (i + 1),
      projected: true,
    }));

    const points = [...historical, ...projected];
    const values = points.map((p) => p.amount);
    const maxVal = Math.max(0, ...values);
    const minVal = Math.min(0, ...values);
    const span = Math.max(1, maxVal - minVal);

    const width = 100;
    const height = 100;
    const step = points.length > 1 ? width / (points.length - 1) : width;

    const toXY = (i: number, amount: number) => ({
      x: i * step,
      y: height - ((amount - minVal) / span) * height,
    });

    const historicalPoints = historical.map((p, i) => toXY(i, p.amount));
    const projectedPoints = projected.map((p, i) => toXY(historical.length - 1 + i + (historical.length ? 1 : 0), p.amount));
    // Ensure projected line connects from the last historical point (or origin if no history).
    const bridgePoint = historical.length
      ? historicalPoints[historicalPoints.length - 1]
      : toXY(0, latestCash);
    const projectedPath = [bridgePoint, ...projectedPoints]
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
    const historicalPath = historicalPoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
    const zeroY = toXY(0, 0).y;

    return { points, historicalPath, projectedPath, historicalPoints, projectedPoints, zeroY, width, height };
  }, [cashRows, latestCash, scenarioNet]);

  function openAddForm() {
    setEditingRow(null);
    setFormDate(todayIso());
    setFormAmount("");
    setFormNotes("");
    setFormError(null);
    setShowForm(true);
  }

  function openEditForm(row: CashRow) {
    setEditingRow(row);
    setFormDate(row.balance_date);
    setFormAmount(String(row.amount));
    setFormNotes(row.notes || "");
    setFormError(null);
    setShowForm(true);
  }

  async function handleSaveCash() {
    const amount = Number(formAmount);
    if (!formDate || Number.isNaN(amount)) {
      setFormError("Enter a valid date and amount.");
      return;
    }
    setSaving(true);
    const result = await saveCashBalance({
      id: editingRow?.id,
      balance_date: formDate,
      amount,
      notes: formNotes,
    });
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error || "Could not save cash balance.");
      return;
    }
    setShowForm(false);
    void reload();
  }

  async function handleDeleteCash(row: CashRow) {
    if (!confirm("Delete this cash balance entry?")) return;
    const result = await deleteCashBalance(row.id);
    if (!result.ok) {
      alert(result.error || "Could not delete entry.");
      return;
    }
    void reload();
  }

  return (
    <Workspace wide>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Runway</h2>
          <p className="text-gray-500 mt-1 text-[13px]">
            Cash balance, burn rate, and months of runway across scenarios.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-md text-[13px] font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} /> Add cash balance
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-gray-400 text-[13px] gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading runway…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-lg border border-gray-200 bg-white">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Current cash
              </p>
              <p className="text-2xl font-semibold text-gray-900 tabular-nums">
                {formatEuroExact(latestCash)}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {cashRows.length > 0
                  ? `As of ${new Date(cashRows[cashRows.length - 1].balance_date).toLocaleDateString()}`
                  : "No cash balances recorded yet"}
              </p>
            </div>
            <div className="p-5 rounded-lg border border-gray-200 bg-white">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Monthly net ({scenario})
              </p>
              <p
                className={`text-2xl font-semibold tabular-nums flex items-center gap-1.5 ${
                  scenarioNet >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {scenarioNet >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                {formatEuroExact(scenarioNet)}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Actual {formatEuro(actualNet)} · Identified {formatEuro(identifiedNet)} · Unidentified{" "}
                {formatEuro(unidentifiedNet)}
              </p>
            </div>
            <div className="p-5 rounded-lg border border-gray-200 bg-white flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1">
                  <Gauge size={12} /> Runway
                </p>
                <p className="text-2xl font-semibold text-gray-900 tabular-nums">
                  {monthsRunway === null ? "∞" : `${monthsRunway} mo`}
                </p>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {monthsRunway === null
                  ? "Net positive — cash growing under this scenario."
                  : "Months until cash reaches €0 at this burn rate."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1 w-fit mb-4">
            {SCENARIOS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setScenario(s.value)}
                title={s.hint}
                className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                  scenario === s.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="p-5 rounded-lg border border-gray-200 bg-white mb-8">
            <div className="flex items-center gap-4 mb-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-blue-600 inline-block" /> Historical
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-blue-300 inline-block" style={{ borderTop: "2px dashed" }} /> Projected ({scenario})
              </span>
            </div>
            <svg
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              preserveAspectRatio="none"
              className="w-full h-56"
            >
              <line
                x1={0}
                x2={chart.width}
                y1={chart.zeroY}
                y2={chart.zeroY}
                stroke="#e5e7eb"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
              {chart.projectedPath && (
                <path
                  d={chart.projectedPath}
                  fill="none"
                  stroke="#93c5fd"
                  strokeWidth={0.8}
                  strokeDasharray="2,1.5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {chart.historicalPath && (
                <path
                  d={chart.historicalPath}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {chart.historicalPoints.map((p, i) => (
                <circle key={`h${i}`} cx={p.x} cy={p.y} r={0.8} fill="#2563eb" />
              ))}
            </svg>
            {cashRows.length === 0 && (
              <p className="text-center text-[12px] text-gray-400 mt-2">
                Add a cash balance entry to start tracking historical runway.
              </p>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h4 className="text-[13px] font-bold text-gray-900">Cash balance history</h4>
            </div>
            {cashRows.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-gray-400">No cash balances yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {[...cashRows]
                  .sort((a, b) => (a.balance_date < b.balance_date ? 1 : -1))
                  .map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                      <div className="min-w-0 flex-1">
                        <p className="text-gray-800">
                          {new Date(row.balance_date).toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })}
                        </p>
                        {row.notes && <p className="text-[11px] text-gray-400 truncate">{row.notes}</p>}
                      </div>
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                        {row.source === "manual" ? "manual" : "auto"}
                      </span>
                      <span className="font-medium text-gray-900 tabular-nums shrink-0">
                        {formatEuroExact(row.amount)}
                      </span>
                      {row.source === "manual" && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditForm(row)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCash(row)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl bg-white shadow-xl border border-gray-200"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-[15px] font-bold text-gray-900">
                {editingRow ? "Edit cash balance" : "New cash balance"}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {formError && (
                <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {formError}
                </div>
              )}
              <label className="block">
                <span className="text-[12px] font-medium text-gray-700">Date</span>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-gray-700">Balance (€)</span>
                <input
                  type="number"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-gray-700">Notes</span>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 border border-gray-200 rounded text-[12px] text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveCash()}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Workspace>
  );
}
