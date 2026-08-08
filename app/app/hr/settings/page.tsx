"use client";

import { useCallback, useEffect, useState } from "react";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { createClient } from "@/utils/supabase/client";
import { Plus, Save } from "lucide-react";
import {
  COMP_MODELS,
  type CompModel,
  type EngagementType,
  type Skill,
} from "@/lib/hr/types";

export default function HrSettingsPage() {
  const [types, setTypes] = useState<EngagementType[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [addingSkill, setAddingSkill] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: typeRows }, { data: skillRows }] = await Promise.all([
      (supabase as any)
        .from("engagement_types")
        .select("*")
        .order("sort_order"),
      (supabase as any).from("skills").select("id, label").order("label"),
    ]);
    setTypes(typeRows || []);
    setSkills(skillRows || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchType = (id: string, patch: Partial<EngagementType>) => {
    setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const saveType = async (t: EngagementType) => {
    setSavingId(t.id);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("engagement_types")
      .update({
        label: t.label,
        default_comp_model: t.default_comp_model,
        assignable_to_tasks: t.assignable_to_tasks,
        requires_contract_doc: t.requires_contract_doc,
        sort_order: t.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", t.id);
    setSavingId(null);
    if (error) {
      alert("Error saving engagement type: " + error.message);
      await load();
    }
  };

  const addSkill = async () => {
    const label = newSkill.trim();
    if (!label) return;
    setAddingSkill(true);
    const supabase = createClient();
    const { error } = await (supabase as any).from("skills").insert([{ label }]);
    setAddingSkill(false);
    if (error) {
      alert("Error adding skill: " + error.message);
      return;
    }
    setNewSkill("");
    await load();
  };

  if (loading) {
    return (
      <Workspace>
        <p className="text-[13px] text-gray-500">Loading settings…</p>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">HR settings</h2>
        <p className="text-[13px] text-gray-500 mt-1">
          Engagement types and skills catalog
        </p>
      </div>

      <Section title="Engagement types">
        <div className="space-y-4">
          {types.map((t) => (
            <div
              key={t.id}
              className="border border-gray-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[12px] font-mono text-gray-500">{t.key}</p>
                <button
                  type="button"
                  disabled={savingId === t.id}
                  onClick={() => void saveType(t)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  <Save size={14} />
                  {savingId === t.id ? "Saving…" : "Save"}
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">
                    Label
                  </span>
                  <input
                    value={t.label}
                    onChange={(e) => patchType(t.id, { label: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">
                    Default comp model
                  </span>
                  <select
                    value={t.default_comp_model}
                    onChange={(e) =>
                      patchType(t.id, {
                        default_comp_model: e.target.value as CompModel,
                      })
                    }
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  >
                    {COMP_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">
                    Sort order
                  </span>
                  <input
                    type="number"
                    value={t.sort_order}
                    onChange={(e) =>
                      patchType(t.id, {
                        sort_order: Number(e.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  />
                </label>
                <div className="flex flex-col gap-2 justify-end pb-1">
                  <label className="flex items-center gap-2 text-[13px] text-gray-800">
                    <input
                      type="checkbox"
                      checked={t.assignable_to_tasks}
                      onChange={(e) =>
                        patchType(t.id, {
                          assignable_to_tasks: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    Assignable to tasks
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-gray-800">
                    <input
                      type="checkbox"
                      checked={t.requires_contract_doc}
                      onChange={(e) =>
                        patchType(t.id, {
                          requires_contract_doc: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    Requires contract doc
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Skills">
        <div className="flex flex-wrap gap-2 mb-4">
          {skills.map((s) => (
            <span
              key={s.id}
              className="px-2.5 py-1 rounded-full text-[12px] border border-gray-200 bg-white text-gray-700"
            >
              {s.label}
            </span>
          ))}
          {skills.length === 0 ? (
            <p className="text-[13px] text-gray-500">No skills yet.</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 max-w-md">
          <input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="New skill label"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") void addSkill();
            }}
          />
          <button
            type="button"
            disabled={addingSkill}
            onClick={() => void addSkill()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </Section>
    </Workspace>
  );
}
