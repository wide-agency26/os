"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  List,
  Loader2,
  Pencil,
  Plus,
  Trash,
  X,
} from "lucide-react";
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
  RESOURCE_SCOPES,
  formatMoney,
  monthlyOverheadAmount,
  overheadAmountForCoveredMonth,
  isRecurringOverheadFrequency,
  type OverheadCostCategory,
  type OverheadFrequency,
  type ResourceScope,
} from "@/lib/hr/types";
import { deleteResourceCost, saveResourceCost } from "@/app/actions/resource-costs";
import { ProjectLinkSelect } from "@/components/hr/ProjectLinkSelect";

type OverheadRow = {
  id: string;
  person_id: string | null;
  scope: ResourceScope;
  cost_category: OverheadCostCategory;
  label: string;
  amount: number;
  currency: string;
  frequency: OverheadFrequency;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  project_id?: string | null;
  people?: { id: string; full_name: string } | null;
  projects?: { id: string; title: string | null } | null;
};

type PersonOpt = { id: string; full_name: string };
type Tab = "all" | ResourceScope;
type ViewMode = "calendar" | "list";

type FormState = {
  id?: string;
  scope: ResourceScope;
  person_id: string;
  cost_category: OverheadCostCategory;
  label: string;
  amount: string;
  currency: string;
  frequency: OverheadFrequency;
  effective_from: string;
  effective_to: string;
  notes: string;
  project_id: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(opts?: {
  scope?: ResourceScope;
  effective_from?: string;
}): FormState {
  const scope = opts?.scope || "office";
  return {
    scope,
    person_id: "",
    cost_category: scope === "marketing" ? "marketing" : "equipment",
    label: "",
    amount: "",
    currency: "EUR",
    frequency: "monthly",
    effective_from: opts?.effective_from || todayIso(),
    effective_to: "",
    notes: "",
    project_id: "",
  };
}

function fromRow(r: OverheadRow): FormState {
  return {
    id: r.id,
    scope: r.scope || (r.person_id ? "person" : "unassigned"),
    person_id: r.person_id || "",
    cost_category: r.cost_category,
    label: r.label,
    amount: String(r.amount ?? ""),
    currency: r.currency || "EUR",
    frequency: r.frequency,
    effective_from: r.effective_from,
    effective_to: r.effective_to || "",
    notes: r.notes || "",
    project_id: r.project_id || "",
  };
}

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "person", label: "People" },
  { id: "project", label: "Projects" },
  { id: "office", label: "Office" },
  { id: "marketing", label: "Marketing" },
  { id: "unassigned", label: "Unassigned" },
];

const SCOPE_TONE: Record<ResourceScope, string> = {
  person: "bg-teal-50 text-teal-800",
  project: "bg-blue-50 text-blue-800",
  office: "bg-slate-100 text-slate-700",
  marketing: "bg-violet-50 text-violet-800",
  unassigned: "bg-amber-50 text-amber-800",
};

function scopeLabel(scope: ResourceScope | string) {
  return RESOURCE_SCOPES.find((s) => s.value === scope)?.label || scope;
}

function categoryLabel(key: string) {
  return OVERHEAD_CATEGORIES.find((c) => c.value === key)?.label || key;
}

export function ResourcesCatalog({ initialTab = "all" }: { initialTab?: Tab }) {
  const now = new Date();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [year, setYear] = useState(now.getFullYear());
  const [openMonth, setOpenMonth] = useState<number | null>(now.getMonth() + 1);
  const [rows, setRows] = useState<OverheadRow[]>([]);
  const [people, setPeople] = useState<PersonOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data, error: qErr }, { data: peopleRows }] = await Promise.all([
      (supabase as any)
        .from("person_overhead_costs")
        .select("*, people:person_id ( id, full_name ), projects:project_id ( id, title )")
        .order("effective_from", { ascending: false }),
      (supabase as any)
        .from("people")
        .select("id, full_name")
        .eq("roster_status", "active")
        .order("full_name"),
    ]);
    if (qErr) {
      console.error(qErr);
      setRows([]);
    } else {
      setRows((data || []) as OverheadRow[]);
    }
    setPeople(peopleRows || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (tab === "all") return rows;
    if (tab === "project") return rows.filter((r) => !!r.project_id);
    return rows.filter((r) => r.scope === tab);
  }, [rows, tab]);

  const yearRows = useMemo(
    () => visible.filter((r) => recordTouchesYear(r, year)),
    [visible, year]
  );

  const byMonth = useMemo(() => {
    const map = new Map<number, OverheadRow[]>();
    for (let m = 1; m <= 12; m++) map.set(m, []);
    for (const r of yearRows) {
      for (let m = 1; m <= 12; m++) {
        if (recordCoversMonth(r, year, m)) map.get(m)!.push(r);
      }
    }
    return map;
  }, [yearRows, year]);

  const monthTotals = useMemo(() => {
    const totals: { month: number; label: string; amount: number; count: number }[] =
      [];
    for (let m = 1; m <= 12; m++) {
      const list = byMonth.get(m) || [];
      totals.push({
        month: m,
        label: MONTH_SHORT[m - 1],
        count: list.length,
        amount: list.reduce(
          (s, r) => s + overheadAmountForCoveredMonth(r.amount, r.frequency),
          0
        ),
      });
    }
    return totals;
  }, [byMonth]);

  const maxMonthVal = Math.max(1, ...monthTotals.map((m) => m.amount));
  const yearTotal = monthTotals.reduce((s, m) => s + m.amount, 0);
  const runRate = useMemo(
    () =>
      visible
        .filter((r) => !r.effective_to || r.effective_to >= todayIso())
        .reduce((s, r) => s + monthlyOverheadAmount(r.amount, r.frequency), 0),
    [visible]
  );

  const openMonthRows = useMemo(() => {
    if (openMonth == null) return [];
    return [...(byMonth.get(openMonth) || [])].sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [byMonth, openMonth]);

  const groupedList = useMemo(() => {
    const groups: { scope: ResourceScope; rows: OverheadRow[] }[] = [];
    for (const s of RESOURCE_SCOPES) {
      const list = yearRows.filter((r) => r.scope === s.value);
      if (list.length) groups.push({ scope: s.value, rows: list });
    }
    return groups;
  }, [yearRows]);

  const defaultScope = (tab === "all" ? "office" : tab) as ResourceScope;

  function startCreate(month?: number) {
    const m = month ?? openMonth ?? now.getMonth() + 1;
    setOpenMonth(m);
    setError(null);
    setForm(
      emptyForm({
        scope: defaultScope,
        effective_from: firstDayOfMonth(year, m),
      })
    );
  }

  function startEdit(r: OverheadRow, month?: number) {
    if (month) setOpenMonth(month);
    setError(null);
    setForm(fromRow(r));
  }

  async function handleSave() {
    if (!form) return;
    if (!form.label.trim()) {
      setError("Label is required.");
      return;
    }
    if (form.scope === "person" && !form.person_id) {
      setError("Pick a person for a People-scoped cost.");
      return;
    }
    if (form.scope === "project" && !form.project_id) {
      setError("Pick a project for a project cost.");
      return;
    }
    setSaving(true);
    setError(null);
    const from = form.effective_from || todayIso();
    const oneOffEnd =
      form.frequency === "one_off"
        ? lastDayOfMonth(Number(from.slice(0, 4)), Number(from.slice(5, 7)))
        : null;
    const res = await saveResourceCost({
      id: form.id,
      scope: form.scope,
      person_id: form.person_id || null,
      project_id: form.project_id || null,
      cost_category: form.cost_category,
      label: form.label.trim(),
      amount: form.amount ? Number(form.amount) : 0,
      currency: form.currency || "EUR",
      frequency: form.frequency,
      effective_from: from,
      effective_to: form.effective_to || oneOffEnd,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Failed to save");
      return;
    }
    setForm(null);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this resource cost?")) return;
    const res = await deleteResourceCost(id);
    if (!res.ok) {
      setError(res.error || "Failed to delete");
      return;
    }
    if (form?.id === id) setForm(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Resources</h2>
          <p className="text-gray-500 mt-1 text-[13px] max-w-2xl">
            Non-compensation costs by month. Attach a person (HR cost center)
            and/or a project — same line, not a copy. Accounting posts it once.
          </p>
        </div>
        <button
          type="button"
          onClick={() => startCreate()}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white rounded-md text-[13px] font-medium hover:bg-accent-hover transition-colors"
        >
          <Plus size={14} /> Add cost
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Active run-rate
          </p>
          <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">
            {formatMoney(runRate)}
            <span className="text-[12px] font-medium text-gray-400"> /mo</span>
          </p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {year} loaded
          </p>
          <p className="text-xl font-bold text-red-500 mt-1 tabular-nums">
            {formatMoney(yearTotal)}
          </p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4 bg-white col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Lines
          </p>
          <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">
            {yearRows.length}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setForm(null);
              }}
              className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                tab === t.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => {
                setYear((y) => y - 1);
                setForm(null);
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
                setForm(null);
              }}
              className="p-2 text-gray-600 hover:bg-gray-50"
              aria-label="Next year"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                viewMode === "calendar"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <CalendarIcon size={13} /> Calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <List size={13} /> List
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-gray-400 text-[13px] gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading resources…
        </div>
      ) : viewMode === "calendar" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {monthTotals.map((m) => {
            const monthRows = byMonth.get(m.month) || [];
            const isOpen = openMonth === m.month;
            return (
              <div
                key={m.month}
                className={`col-span-1 rounded-lg border bg-white transition-all ${
                  isOpen
                    ? "border-blue-300 shadow-sm ring-1 ring-blue-100 sm:col-span-2 lg:col-span-2 xl:col-span-3"
                    : monthRows.length
                      ? "border-gray-300 hover:border-gray-400"
                      : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenMonth(isOpen ? null : m.month);
                    if (!isOpen) setForm(null);
                  }}
                  className="w-full text-left px-3 py-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-gray-900">
                      {m.label}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {m.count} cost{m.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  {monthRows.length > 0 && (
                    <p className="mt-1 text-[10px] text-gray-500 truncate">
                      {[...new Set(monthRows.map((r) => r.label))].slice(0, 2).join(" · ")}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-end gap-1 h-10">
                    <div
                      className="w-2 rounded-sm bg-red-400/80"
                      style={{
                        height: `${Math.max(2, (m.amount / maxMonthVal) * 100)}%`,
                      }}
                    />
                    <div className="flex-1 text-right">
                      <p className="text-[12px] font-semibold text-gray-900 tabular-nums">
                        {formatMoney(m.amount)}
                      </p>
                      <p className="text-[10px] text-gray-400">in month</p>
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100">
                    <div className="p-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => startCreate(m.month)}
                        className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                      >
                        <Plus size={11} /> Add to {m.label}
                      </button>
                    </div>
                    {form && (form.id ? openMonthRows.some((r) => r.id === form.id) : !form.id) ? (
                      <div className="px-3 pb-3">
                        <CostForm
                          form={form}
                          setForm={setForm}
                          people={people}
                          saving={saving}
                          error={error}
                          year={year}
                          month={m.month}
                          onSave={() => void handleSave()}
                          onCancel={() => {
                            setForm(null);
                            setError(null);
                          }}
                        />
                      </div>
                    ) : null}
                    <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                      {monthRows.length === 0 && !form ? (
                        <p className="p-3 text-[12px] text-gray-400">
                          No costs covering {m.label}. Add a seat, office line, or
                          one-off.
                        </p>
                      ) : (
                        monthRows.map((r) => (
                          <CostRow
                            key={r.id}
                            row={r}
                            onEdit={() => startEdit(r, m.month)}
                            onDelete={() => void handleDelete(r.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {form ? (
            <CostForm
              form={form}
              setForm={setForm}
              people={people}
              saving={saving}
              error={error}
              year={year}
              month={openMonth ?? now.getMonth() + 1}
              onSave={() => void handleSave()}
              onCancel={() => {
                setForm(null);
                setError(null);
              }}
            />
          ) : null}
          {groupedList.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-8 text-center">
              <p className="text-sm text-gray-600">No costs in {year} for this tab.</p>
              <button
                type="button"
                onClick={() => startCreate()}
                className="mt-2 text-[13px] font-semibold text-blue-700 hover:underline"
              >
                Add a cost
              </button>
            </div>
          ) : (
            groupedList.map((g) => {
              const sum = g.rows.reduce(
                (s, r) => s + overheadAmountForCoveredMonth(r.amount, r.frequency),
                0
              );
              return (
                <div
                  key={g.scope}
                  className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${SCOPE_TONE[g.scope]}`}
                      >
                        {scopeLabel(g.scope)}
                      </span>
                      <span className="text-[13px] font-semibold text-gray-900">
                        {g.rows.length} line{g.rows.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <span className="text-[12px] text-red-500 tabular-nums">
                      {formatMoney(sum)}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {g.rows.map((r) => (
                      <CostRow
                        key={r.id}
                        row={r}
                        showDates
                        onEdit={() => startEdit(r)}
                        onDelete={() => void handleDelete(r.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function CostRow({
  row,
  showDates,
  onEdit,
  onDelete,
}: {
  row: OverheadRow;
  showDates?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const recurring = isRecurringOverheadFrequency(row.frequency);
  const active = !recurring || !row.effective_to || row.effective_to >= todayIso();
  const booked = overheadAmountForCoveredMonth(row.amount, row.frequency);
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[12px] ${
        active ? "" : "opacity-50"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-gray-800 font-medium truncate">{row.label}</span>
          <span
            className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${SCOPE_TONE[row.scope] || SCOPE_TONE.unassigned}`}
          >
            {scopeLabel(row.scope)}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {categoryLabel(row.cost_category)}
          {row.people?.full_name ? ` · ${row.people.full_name}` : ""}
          {row.projects?.title ? ` · ${row.projects.title}` : ""}
          {" · "}
          {row.frequency}
          {showDates
            ? ` · ${row.effective_from} → ${row.effective_to || "ongoing"}`
            : ""}
        </p>
      </div>
      <span className="tabular-nums font-medium shrink-0 text-red-500">
        −{formatMoney(booked)}
        {recurring ? (
          <span className="text-gray-400 font-normal"> /mo</span>
        ) : null}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
          title="Edit"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
          title="Delete"
        >
          <Trash size={12} />
        </button>
      </div>
    </div>
  );
}

function CostForm({
  form,
  setForm,
  people,
  saving,
  error,
  year,
  month,
  onSave,
  onCancel,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState | null>>;
  people: PersonOpt[];
  saving: boolean;
  error: string | null;
  year: number;
  month: number;
  onSave: () => void;
  onCancel: () => void;
}) {
  const patch = (partial: Partial<FormState>) =>
    setForm((prev) => (prev ? { ...prev, ...partial } : prev));

  return (
    <div className="border border-blue-200 rounded-lg p-3 space-y-3 bg-blue-50/40">
      <div className="flex items-center justify-between">
        <h5 className="text-[12px] font-bold text-gray-900">
          {form.id ? "Edit cost" : `New cost · ${MONTH_SHORT[month - 1]} ${year}`}
        </h5>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-700">
          <X size={14} />
        </button>
      </div>
      {error ? (
        <p className="text-[12px] text-red-600 bg-white border border-red-100 rounded px-2 py-1">
          {error}
        </p>
      ) : null}
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-600">Scope</span>
          <select
            value={form.scope}
            onChange={(e) => {
              const scope = e.target.value as ResourceScope;
              patch({
                scope,
                person_id: scope === "person" ? form.person_id : "",
              });
            }}
            className="mt-0.5 w-full border border-gray-200 rounded-md px-2 py-1.5 text-[13px] bg-white"
          >
            {RESOURCE_SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-600">
            Person{form.scope === "person" ? "" : " (optional)"}
          </span>
          <select
            value={form.person_id}
            onChange={(e) => {
              const person_id = e.target.value;
              patch({
                person_id,
                scope: person_id ? "person" : form.scope === "person" ? "unassigned" : form.scope,
              });
            }}
            className="mt-0.5 w-full border border-gray-200 rounded-md px-2 py-1.5 text-[13px] bg-white"
          >
            <option value="">{form.scope === "person" ? "Select…" : "— Not on an HR person —"}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-600">Category</span>
          <select
            value={form.cost_category}
            onChange={(e) =>
              patch({ cost_category: e.target.value as OverheadCostCategory })
            }
            className="mt-0.5 w-full border border-gray-200 rounded-md px-2 py-1.5 text-[13px] bg-white"
          >
            {OVERHEAD_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <ProjectLinkSelect
          className="sm:col-span-2"
          value={form.project_id}
          onChange={(project_id) =>
            patch({
              project_id,
              scope:
                !form.person_id && project_id && (form.scope === "unassigned" || form.scope === "project")
                  ? "project"
                  : form.scope,
            })
          }
          hint="Same cost appears on that project’s cost center. Ledger posts it once."
        />
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-600">Frequency</span>
          <select
            value={form.frequency}
            onChange={(e) => {
              const frequency = e.target.value as OverheadFrequency;
              patch({
                frequency,
                effective_to:
                  frequency === "one_off" && !form.effective_to
                    ? lastDayOfMonth(year, month)
                    : form.effective_to,
              });
            }}
            className="mt-0.5 w-full border border-gray-200 rounded-md px-2 py-1.5 text-[13px] bg-white"
          >
            {OVERHEAD_FREQUENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] font-semibold text-gray-600">Label</span>
          <input
            value={form.label}
            onChange={(e) => patch({ label: e.target.value })}
            className="mt-0.5 w-full border border-gray-200 rounded-md px-2 py-1.5 text-[13px] bg-white"
            placeholder="Meta ads · Office cameras · Google Workspace seat"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-600">Amount</span>
          <input
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => patch({ amount: e.target.value })}
            className="mt-0.5 w-full border border-gray-200 rounded-md px-2 py-1.5 text-[13px] bg-white"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-600">From</span>
          <input
            type="date"
            value={form.effective_from}
            onChange={(e) => patch({ effective_from: e.target.value })}
            className="mt-0.5 w-full border border-gray-200 rounded-md px-2 py-1.5 text-[13px] bg-white"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] font-semibold text-gray-600">
            To (empty = ongoing)
          </span>
          <input
            type="date"
            value={form.effective_to}
            onChange={(e) => patch({ effective_to: e.target.value })}
            className="mt-0.5 w-full border border-gray-200 rounded-md px-2 py-1.5 text-[13px] bg-white"
          />
        </label>
      </div>
      <p className="text-[10px] text-gray-500">
        One-off stays in {MONTH_SHORT[month - 1]} only. Monthly covers this month
        forward until you set an end date. Assign a person and/or a project — HR
        and the project cost center show the same line.
        {form.frequency === "one_off" ? (
          <span className="block mt-0.5">
            Ends {lastDayOfMonth(year, month)} unless you pick another date.
          </span>
        ) : null}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="px-3 py-1.5 bg-accent text-white rounded-md text-[12px] font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 border border-gray-200 rounded text-[12px] text-gray-700 bg-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
