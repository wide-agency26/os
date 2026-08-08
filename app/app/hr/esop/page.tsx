"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { createClient } from "@/utils/supabase/client";
import { Pencil, Plus, Trash } from "lucide-react";

type EsopRow = {
  id: string;
  person_id: string;
  pool_percentage: number;
  vesting_notes: string | null;
  granted_at: string;
  people?: { full_name: string } | null;
};

type PersonOption = { id: string; full_name: string };

type FormState = {
  id?: string;
  person_id: string;
  pool_percentage: string;
  vesting_notes: string;
  granted_at: string;
};

function emptyForm(): FormState {
  return {
    person_id: "",
    pool_percentage: "",
    vesting_notes: "",
    granted_at: new Date().toISOString().slice(0, 10),
  };
}

export default function HrEsopPage() {
  const [rows, setRows] = useState<EsopRow[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: allocations }, { data: personRows }] = await Promise.all([
      (supabase as any)
        .from("esop_allocations")
        .select("*, people ( full_name )")
        .order("granted_at", { ascending: false }),
      (supabase as any)
        .from("people")
        .select("id, full_name")
        .order("full_name"),
    ]);
    setRows((allocations || []) as EsopRow[]);
    setPeople(personRows || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPct = useMemo(
    () =>
      rows.reduce((sum, r) => sum + (Number(r.pool_percentage) || 0), 0),
    [rows]
  );

  const overAllocated = totalPct > 100;

  const startCreate = () => {
    setForm(emptyForm());
    setEditing(true);
  };

  const startEdit = (row: EsopRow) => {
    setForm({
      id: row.id,
      person_id: row.person_id,
      pool_percentage: String(row.pool_percentage ?? ""),
      vesting_notes: row.vesting_notes || "",
      granted_at: row.granted_at || new Date().toISOString().slice(0, 10),
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!form.person_id) {
      alert("Select a person.");
      return;
    }
    const pct = Number(form.pool_percentage);
    if (!Number.isFinite(pct) || pct < 0) {
      alert("Enter a valid pool percentage.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      person_id: form.person_id,
      pool_percentage: pct,
      vesting_notes: form.vesting_notes.trim() || null,
      granted_at: form.granted_at,
      updated_at: new Date().toISOString(),
    };

    if (form.id) {
      const { error } = await (supabase as any)
        .from("esop_allocations")
        .update(payload)
        .eq("id", form.id);
      setSaving(false);
      if (error) {
        alert("Error saving: " + error.message);
        return;
      }
    } else {
      const { error } = await (supabase as any)
        .from("esop_allocations")
        .insert([payload]);
      setSaving(false);
      if (error) {
        alert("Error creating: " + error.message);
        return;
      }
    }
    setEditing(false);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this ESOP allocation?")) return;
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("esop_allocations")
      .delete()
      .eq("id", id);
    if (error) {
      alert("Error deleting: " + error.message);
      return;
    }
    await load();
  };

  return (
    <Workspace>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ESOP allocations</h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Equity pool percentage by person
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700"
          >
            <Plus size={16} />
            Add allocation
          </button>
        ) : null}
      </div>

      <div
        className={`mb-6 rounded-xl border px-4 py-3 ${
          overAllocated
            ? "border-red-200 bg-red-50"
            : "border-gray-200 bg-gray-50"
        }`}
      >
        <p className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">
          Total allocated
        </p>
        <p
          className={`text-[20px] font-bold tabular-nums mt-0.5 ${
            overAllocated ? "text-red-700" : "text-gray-900"
          }`}
        >
          {totalPct.toFixed(2)}%
        </p>
        {overAllocated ? (
          <p className="text-[13px] text-red-700 mt-1 font-medium">
            Warning: total pool exceeds 100%.
          </p>
        ) : null}
      </div>

      {editing ? (
        <Section title={form.id ? "Edit allocation" : "New allocation"}>
          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
            <label className="block sm:col-span-2">
              <span className="text-[12px] font-semibold text-gray-700">Person</span>
              <select
                value={form.person_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, person_id: e.target.value }))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              >
                <option value="">Select…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">
                Pool %
              </span>
              <input
                type="number"
                step="0.01"
                value={form.pool_percentage}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pool_percentage: e.target.value }))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">
                Granted at
              </span>
              <input
                type="date"
                value={form.granted_at}
                onChange={(e) =>
                  setForm((f) => ({ ...f, granted_at: e.target.value }))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[12px] font-semibold text-gray-700">
                Vesting notes
              </span>
              <textarea
                value={form.vesting_notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vesting_notes: e.target.value }))
                }
                rows={2}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              />
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 border border-gray-200 rounded text-[12px] text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Section>
      ) : null}

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {loading ? (
          <div className="p-8 text-center text-[13px] text-gray-500">
            Loading ESOP…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-gray-500">
            No allocations yet.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-4 py-2.5">Person</th>
                <th className="text-left px-4 py-2.5">Pool %</th>
                <th className="text-left px-4 py-2.5">Granted</th>
                <th className="text-left px-4 py-2.5">Notes</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/app/hr/${r.person_id}`}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {r.people?.full_name || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-medium">
                    {Number(r.pool_percentage).toFixed(2)}%
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{r.granted_at}</td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-[240px] truncate">
                    {r.vesting_notes || "—"}
                  </td>
                  <td className="px-2 py-2.5 text-right">
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Workspace>
  );
}
