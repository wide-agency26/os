"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus, Trash } from "lucide-react";
import {
  RACI_OPTIONS,
  type EngagementType,
  type RaciCode,
  type Skill,
} from "@/lib/hr/types";

type RoleRow = {
  id: string;
  task_template_id: string;
  raci: RaciCode;
  required_skill_id: string | null;
  required_engagement_type_id: string | null;
};

type Props = { taskTemplateId: string };

export function PlaybookStepRaci({ taskTemplateId }: Props) {
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [engagementTypes, setEngagementTypes] = useState<EngagementType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: roleRows }, { data: skillRows }, { data: types }] =
      await Promise.all([
        (supabase as any)
          .from("playbook_step_roles")
          .select("*")
          .eq("task_template_id", taskTemplateId)
          .order("created_at"),
        (supabase as any).from("skills").select("id, label").order("label"),
        (supabase as any)
          .from("engagement_types")
          .select("*")
          .order("sort_order"),
      ]);
    setRows((roleRows || []) as RoleRow[]);
    setSkills(skillRows || []);
    setEngagementTypes(types || []);
    setLoading(false);
  }, [taskTemplateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addRow = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await (supabase as any).from("playbook_step_roles").insert([
      {
        task_template_id: taskTemplateId,
        raci: "responsible",
        required_skill_id: null,
        required_engagement_type_id: null,
      },
    ]);
    setSaving(false);
    if (error) {
      alert("Error adding role: " + error.message);
      return;
    }
    await load();
  };

  const updateRow = async (
    id: string,
    patch: Partial<
      Pick<RoleRow, "raci" | "required_skill_id" | "required_engagement_type_id">
    >
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("playbook_step_roles")
      .update(patch)
      .eq("id", id);
    if (error) {
      alert("Error updating: " + error.message);
      await load();
    }
  };

  const removeRow = async (id: string) => {
    if (!confirm("Remove this RACI row?")) return;
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("playbook_step_roles")
      .delete()
      .eq("id", id);
    if (error) {
      alert("Error deleting: " + error.message);
      return;
    }
    await load();
  };

  if (loading) {
    return <p className="text-[13px] text-gray-500">Loading RACI…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold text-gray-900">RACI roles</h3>
        <button
          type="button"
          disabled={saving}
          onClick={() => void addRow()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          <Plus size={14} />
          Add row
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-[13px] text-gray-500">No RACI rows for this template.</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">RACI</th>
                <th className="text-left px-3 py-2">Skill</th>
                <th className="text-left px-3 py-2">Engagement</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-50">
                  <td className="px-3 py-2">
                    <select
                      value={r.raci}
                      onChange={(e) =>
                        void updateRow(r.id, {
                          raci: e.target.value as RaciCode,
                        })
                      }
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[12px]"
                    >
                      {RACI_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.required_skill_id || ""}
                      onChange={(e) =>
                        void updateRow(r.id, {
                          required_skill_id: e.target.value || null,
                        })
                      }
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[12px]"
                    >
                      <option value="">Any skill</option>
                      {skills.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.required_engagement_type_id || ""}
                      onChange={(e) =>
                        void updateRow(r.id, {
                          required_engagement_type_id: e.target.value || null,
                        })
                      }
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[12px]"
                    >
                      <option value="">Any engagement</option>
                      {engagementTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void removeRow(r.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600"
                      aria-label="Remove"
                    >
                      <Trash size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
