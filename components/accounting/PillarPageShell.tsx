"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Calendar as CalendarIcon,
  List,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  DateMonthFilter,
  defaultFyFilter,
  isMonthInFilter,
  type DateMonthFilterValue,
} from "./DateMonthFilter";
import { Scorecard } from "./Scorecard";
import { LedgerEntryForm } from "./LedgerEntryForm";
import {
  aggregateMonthly,
  fetchLedgerEntries,
  groupByCategory,
  groupByProjectOrSource,
  totals,
} from "@/lib/accounting/queries";
import { formatEuro, isAutoSource, type LedgerEntry, type LedgerPillar } from "@/lib/accounting/types";
import {
  deleteManualLedgerEntry,
  runAccountingHygiene,
  updateLedgerCategory,
} from "@/app/actions/accounting";

type ViewMode = "calendar" | "table";
type TypeView = "revenue" | "cost" | "both";

type PillarPageShellProps = {
  pillar: LedgerPillar;
  title: string;
  description?: string;
  /** Runs orphan prune + HR/overhead sync once on mount. */
  runSyncOnMount?: boolean;
  showConfidence?: boolean;
  groupMode?: "project" | "category";
  headerExtra?: ReactNode;
  footerExtra?: ReactNode;
};

export function PillarPageShell({
  pillar,
  title,
  description,
  runSyncOnMount = false,
  showConfidence = false,
  groupMode = "project",
  headerExtra,
  footerExtra,
}: PillarPageShellProps) {
  const [filter, setFilter] = useState<DateMonthFilterValue>(() => defaultFyFilter());
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [typeView, setTypeView] = useState<TypeView>("both");
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [formDefaults, setFormDefaults] = useState<{ month?: number; year?: number }>({});
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const rows = await fetchLedgerEntries(supabase, {
      pillar,
      startDate: filter.startDate,
      endDate: filter.endDate,
    });
    setEntries(rows);
    setLoading(false);
  }, [pillar, filter.startDate, filter.endDate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!runSyncOnMount) return;
    (async () => {
      setSyncing(true);
      await runAccountingHygiene();
      setSyncing(false);
      void reload();
    })();
    // Only run once on mount, regardless of subsequent filter/reload changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEntries = useMemo(
    () => entries.filter((e) => isMonthInFilter(filter.months, e.entry_date)),
    [entries, filter.months]
  );

  const summary = useMemo(() => totals(filteredEntries), [filteredEntries]);
  const monthly = useMemo(() => aggregateMonthly(filteredEntries), [filteredEntries]);
  const monthCards = useMemo(
    () => (filter.months.length ? monthly.filter((m) => filter.months.includes(m.month)) : monthly),
    [monthly, filter.months]
  );

  const viewEntries = useMemo(
    () => (typeView === "both" ? filteredEntries : filteredEntries.filter((e) => e.type === typeView)),
    [filteredEntries, typeView]
  );

  const groups = useMemo(
    () => (groupMode === "category" ? groupByCategory(viewEntries) : groupByProjectOrSource(viewEntries)),
    [viewEntries, groupMode]
  );

  const entriesByMonth = useMemo(() => {
    const map = new Map<number, LedgerEntry[]>();
    for (const e of viewEntries) {
      if (!e.entry_date) continue;
      const m = Number(e.entry_date.slice(5, 7));
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(e);
    }
    return map;
  }, [viewEntries]);

  function openAddForm(defaults?: { month?: number; year?: number }) {
    setEditingEntry(null);
    setFormDefaults(defaults || {});
    setShowForm(true);
  }

  function openEditForm(entry: LedgerEntry) {
    setEditingEntry(entry);
    setFormDefaults({});
    setShowForm(true);
  }

  async function handleDelete(entry: LedgerEntry) {
    if (!confirm("Delete this manual entry?")) return;
    const result = await deleteManualLedgerEntry(entry.id);
    if (!result.ok) {
      alert(result.error || "Could not delete entry.");
      return;
    }
    void reload();
  }

  function startCategoryEdit(entry: LedgerEntry) {
    setEditingCategoryId(entry.id);
    setCategoryDraft(entry.category);
  }

  function cancelCategoryEdit() {
    setEditingCategoryId(null);
  }

  async function commitCategoryEdit(entry: LedgerEntry) {
    const draft = categoryDraft.trim();
    setEditingCategoryId(null);
    if (draft && draft !== entry.category) {
      await updateLedgerCategory(entry.id, draft);
      void reload();
    }
  }

  const maxMonthVal = Math.max(1, ...monthly.flatMap((m) => [m.revenue, m.cost]));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {description && (
            <p className="text-gray-500 mt-1 text-[13px] max-w-2xl">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {syncing && (
            <span className="flex items-center gap-1.5 text-[12px] text-gray-400">
              <RefreshCw size={12} className="animate-spin" /> Syncing HR &amp; overhead…
            </span>
          )}
          <button
            type="button"
            onClick={() => openAddForm()}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-md text-[13px] font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Add entry
          </button>
        </div>
      </div>

      {headerExtra}

      <DateMonthFilter value={filter} onChange={setFilter} />

      <Scorecard
        title={title}
        revenue={summary.revenue}
        cost={summary.cost}
        profit={summary.profit}
        monthlySeries={monthly}
        pillarStyle={pillar}
        defaultExpanded
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
              viewMode === "calendar" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <CalendarIcon size={13} /> Calendar
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
              viewMode === "table" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <List size={13} /> Table
          </button>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
          {(["revenue", "cost", "both"] as TypeView[]).map((tv) => (
            <button
              key={tv}
              type="button"
              onClick={() => setTypeView(tv)}
              className={`px-3 py-1.5 rounded text-[12px] font-medium capitalize transition-colors ${
                typeView === tv ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tv}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-gray-400 text-[13px] gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading ledger…
        </div>
      ) : viewMode === "calendar" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {monthCards.map((m) => {
            const monthEntries = entriesByMonth.get(m.month) || [];
            const isOpen = expandedMonth === m.month;
            const net = m.revenue - m.cost;
            return (
              <div
                key={m.month}
                className={`col-span-1 rounded-lg border bg-white transition-all ${
                  isOpen
                    ? "border-blue-300 shadow-sm ring-1 ring-blue-100 sm:col-span-2 lg:col-span-2 xl:col-span-3"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedMonth(isOpen ? null : m.month)}
                  className="w-full text-left px-3 py-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-gray-900">{m.label}</span>
                    <span className="text-[10px] text-gray-400">{monthEntries.length} entries</span>
                  </div>
                  <div className="mt-1.5 flex items-end gap-1 h-10">
                    <div
                      className="w-2 rounded-sm bg-emerald-500/80"
                      style={{ height: `${Math.max(2, (m.revenue / maxMonthVal) * 100)}%` }}
                    />
                    <div
                      className="w-2 rounded-sm bg-red-400/80"
                      style={{ height: `${Math.max(2, (m.cost / maxMonthVal) * 100)}%` }}
                    />
                    <div className="flex-1 text-right">
                      <p className="text-[12px] font-semibold text-gray-900 tabular-nums">{formatEuro(net)}</p>
                      <p className="text-[10px] text-gray-400">net</p>
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100 max-h-72 overflow-y-auto">
                    <div className="p-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => openAddForm({ month: m.month })}
                        className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                      >
                        <Plus size={11} /> Add to {m.label}
                      </button>
                    </div>
                    {monthEntries.length === 0 ? (
                      <p className="p-3 text-[12px] text-gray-400">No entries this month.</p>
                    ) : (
                      monthEntries.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          editingCategoryId={editingCategoryId}
                          categoryDraft={categoryDraft}
                          onCategoryDraftChange={setCategoryDraft}
                          onStartCategoryEdit={startCategoryEdit}
                          onCommitCategoryEdit={commitCategoryEdit}
                          onCancelCategoryEdit={cancelCategoryEdit}
                          onEdit={openEditForm}
                          onDelete={handleDelete}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-[13px]">No entries in this range.</div>
          ) : (
            groups.map((group) => {
              const isOpen = expandedGroups[group.key] ?? true;
              return (
                <div key={group.key} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.key]: !isOpen }))}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {group.badge}
                      </span>
                      <span className="text-[13px] font-semibold text-gray-900">{group.label}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[12px]">
                      {group.revenue > 0 && (
                        <span className="text-green-600 tabular-nums">+{formatEuro(group.revenue)}</span>
                      )}
                      {group.cost > 0 && (
                        <span className="text-red-500 tabular-nums">-{formatEuro(group.cost)}</span>
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-100">
                      {group.entries.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          showDate
                          editingCategoryId={editingCategoryId}
                          categoryDraft={categoryDraft}
                          onCategoryDraftChange={setCategoryDraft}
                          onStartCategoryEdit={startCategoryEdit}
                          onCommitCategoryEdit={commitCategoryEdit}
                          onCancelCategoryEdit={cancelCategoryEdit}
                          onEdit={openEditForm}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {footerExtra}

      {showForm && (
        <LedgerEntryForm
          pillar={pillar}
          initialEntry={editingEntry}
          showConfidence={showConfidence}
          defaultMonth={formDefaults.month}
          defaultYear={formDefaults.year}
          onClose={() => setShowForm(false)}
          onSaved={() => void reload()}
        />
      )}
    </div>
  );
}

type EntryRowProps = {
  entry: LedgerEntry;
  showDate?: boolean;
  editingCategoryId: string | null;
  categoryDraft: string;
  onCategoryDraftChange: (v: string) => void;
  onStartCategoryEdit: (entry: LedgerEntry) => void;
  onCommitCategoryEdit: (entry: LedgerEntry) => void;
  onCancelCategoryEdit: () => void;
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
};

function EntryRow({
  entry,
  showDate,
  editingCategoryId,
  categoryDraft,
  onCategoryDraftChange,
  onStartCategoryEdit,
  onCommitCategoryEdit,
  onCancelCategoryEdit,
  onEdit,
  onDelete,
}: EntryRowProps) {
  const auto = isAutoSource(entry.source);
  const isEditingCategory = editingCategoryId === entry.id;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isEditingCategory ? (
            <input
              autoFocus
              value={categoryDraft}
              onChange={(e) => onCategoryDraftChange(e.target.value)}
              onBlur={() => onCommitCategoryEdit(entry)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCommitCategoryEdit(entry);
                if (e.key === "Escape") onCancelCategoryEdit();
              }}
              className="border border-blue-300 rounded px-1.5 py-0.5 text-[12px] focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => auto && onStartCategoryEdit(entry)}
              className={`text-gray-800 truncate text-left ${auto ? "hover:underline decoration-dotted" : ""}`}
              title={auto ? "Click to rename category" : undefined}
            >
              {entry.category || "Untitled"}
            </button>
          )}
          {auto ? (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
              <Lock size={9} /> auto
            </span>
          ) : (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
              manual
            </span>
          )}
          {entry.confidence && (
            <span className="text-[9px] font-medium uppercase tracking-wider text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded shrink-0">
              {entry.confidence}
            </span>
          )}
        </div>
        {showDate && entry.entry_date && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            {new Date(entry.entry_date).toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </div>
      <span
        className={`tabular-nums font-medium shrink-0 ${
          entry.type === "revenue" ? "text-green-600" : "text-red-500"
        }`}
      >
        {entry.type === "revenue" ? "+" : "-"}
        {formatEuro(entry.amount)}
      </span>
      {!auto && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry)}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
