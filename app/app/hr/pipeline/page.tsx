"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { createClient } from "@/utils/supabase/client";
import { Plus, UserCheck } from "lucide-react";
import {
  PIPELINE_STAGES,
  legacyPersonType,
  type PipelineStage,
} from "@/lib/hr/types";

type PipelineCard = {
  id: string;
  name: string;
  source: string | null;
  notes: string | null;
  stage: PipelineStage;
  converted_person_id: string | null;
  created_at?: string;
};

const ACTIVE_STAGES = PIPELINE_STAGES.map((s) => s.value);

export default function HrPipelinePage() {
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await (supabase as any)
      .from("roster_pipeline")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      setCards([]);
    } else {
      setCards((data || []) as PipelineCard[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byStage = useMemo(() => {
    const map: Record<PipelineStage, PipelineCard[]> = {
      met: [],
      testing: [],
      onboarding: [],
      converted: [],
      passed: [],
    };
    for (const c of cards) {
      if (map[c.stage]) map[c.stage].push(c);
      else map.met.push(c);
    }
    return map;
  }, [cards]);

  const handleAdd = async () => {
    if (!newName.trim()) {
      alert("Name is required.");
      return;
    }
    setAdding(true);
    const supabase = createClient();
    const { error } = await (supabase as any).from("roster_pipeline").insert([
      {
        name: newName.trim(),
        source: newSource.trim() || null,
        notes: newNotes.trim() || null,
        stage: "met",
      },
    ]);
    setAdding(false);
    if (error) {
      alert("Error adding: " + error.message);
      return;
    }
    setNewName("");
    setNewSource("");
    setNewNotes("");
    await load();
  };

  const moveStage = async (id: string, stage: PipelineStage) => {
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("roster_pipeline")
      .update({ stage, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      alert("Error updating stage: " + error.message);
      return;
    }
    await load();
  };

  const convertToPerson = async (card: PipelineCard) => {
    if (card.converted_person_id) {
      alert("Already converted.");
      return;
    }
    if (!confirm(`Create roster person for "${card.name}" and mark converted?`)) {
      return;
    }
    const supabase = createClient();
    const { data: types } = await (supabase as any)
      .from("engagement_types")
      .select("id, key")
      .eq("key", "project_freelancer")
      .maybeSingle();

    const { data: person, error: pErr } = await (supabase as any)
      .from("people")
      .insert([
        {
          full_name: card.name,
          name: card.name,
          roster_status: "active",
          engagement_type_id: types?.id || null,
          person_type: legacyPersonType(types?.key || "project_freelancer"),
          bio_notes: card.notes,
          rate_notes: card.source ? `Pipeline source: ${card.source}` : null,
        },
      ])
      .select("id")
      .single();

    if (pErr || !person?.id) {
      alert("Error creating person: " + (pErr?.message || "unknown"));
      return;
    }

    const { error } = await (supabase as any)
      .from("roster_pipeline")
      .update({
        stage: "converted",
        converted_person_id: person.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", card.id);

    if (error) {
      alert("Person created but pipeline update failed: " + error.message);
      return;
    }
    await load();
  };

  return (
    <Workspace wide>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Talent pipeline</h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Track candidates before they join the roster
          </p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl p-4 mb-6 bg-white space-y-3">
        <p className="text-[13px] font-bold text-gray-900">Add candidate</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            className="border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
          />
          <input
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            placeholder="Source"
            className="border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
          />
          <input
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes"
            className="border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
          />
        </div>
        <button
          type="button"
          disabled={adding}
          onClick={() => void handleAdd()}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          <Plus size={16} />
          {adding ? "Adding…" : "Add card"}
        </button>
      </div>

      {loading ? (
        <p className="text-[13px] text-gray-500">Loading pipeline…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {ACTIVE_STAGES.map((stage) => {
            const label =
              PIPELINE_STAGES.find((s) => s.value === stage)?.label || stage;
            const column = byStage[stage];
            return (
              <div
                key={stage}
                className="rounded-xl border border-gray-200 bg-gray-50/60 min-h-[240px] flex flex-col"
              >
                <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wide text-gray-700">
                    {label}
                  </span>
                  <span className="text-[11px] text-gray-500 tabular-nums">
                    {column.length}
                  </span>
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {column.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm space-y-2"
                    >
                      <p className="text-[13px] font-semibold text-gray-900">
                        {card.name}
                      </p>
                      {card.source ? (
                        <p className="text-[11px] text-gray-500">{card.source}</p>
                      ) : null}
                      {card.notes ? (
                        <p className="text-[12px] text-gray-600 line-clamp-2">
                          {card.notes}
                        </p>
                      ) : null}
                      <select
                        value={card.stage}
                        onChange={(e) =>
                          void moveStage(card.id, e.target.value as PipelineStage)
                        }
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[12px]"
                      >
                        {PIPELINE_STAGES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-1">
                        {PIPELINE_STAGES.filter((s) => s.value !== card.stage)
                          .slice(0, 2)
                          .map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => void moveStage(card.id, s.value)}
                              className="px-2 py-0.5 text-[11px] rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                            >
                              → {s.label}
                            </button>
                          ))}
                      </div>
                      {card.stage !== "converted" && !card.converted_person_id ? (
                        <button
                          type="button"
                          onClick={() => void convertToPerson(card)}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-[12px] font-medium rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                        >
                          <UserCheck size={14} />
                          Convert to person
                        </button>
                      ) : card.converted_person_id ? (
                        <Link
                          href={`/app/hr/${card.converted_person_id}`}
                          className="block text-center text-[12px] text-blue-700 hover:underline"
                        >
                          Open person
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Workspace>
  );
}
