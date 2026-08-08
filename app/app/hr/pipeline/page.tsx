"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { createClient } from "@/utils/supabase/client";
import { Pencil, Plus, Trash, UserCheck, X } from "lucide-react";
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

type EditForm = {
  id: string;
  name: string;
  source: string;
  notes: string;
  stage: PipelineStage;
};

const ACTIVE_STAGES = PIPELINE_STAGES.map((s) => s.value);

export default function HrPipelinePage() {
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);

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
    const prev = cards;
    setCards((list) =>
      list.map((c) => (c.id === id ? { ...c, stage } : c))
    );
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("roster_pipeline")
      .update({ stage, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setCards(prev);
      alert("Error moving card: " + error.message);
      return;
    }
  };

  const startEdit = (card: PipelineCard) => {
    setEditing({
      id: card.id,
      name: card.name,
      source: card.source || "",
      notes: card.notes || "",
      stage: card.stage,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      alert("Name is required.");
      return;
    }
    setSavingEdit(true);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("roster_pipeline")
      .update({
        name: editing.name.trim(),
        source: editing.source.trim() || null,
        notes: editing.notes.trim() || null,
        stage: editing.stage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editing.id);
    setSavingEdit(false);
    if (error) {
      alert("Error saving: " + error.message);
      return;
    }
    setEditing(null);
    await load();
  };

  const handleDelete = async (card: PipelineCard) => {
    if (
      !confirm(
        `Delete pipeline card “${card.name}”? This does not delete a converted person.`
      )
    ) {
      return;
    }
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("roster_pipeline")
      .delete()
      .eq("id", card.id);
    if (error) {
      alert("Error deleting: " + error.message);
      return;
    }
    if (editing?.id === card.id) setEditing(null);
    setCards((list) => list.filter((c) => c.id !== card.id));
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

  const onDropToStage = (stage: PipelineStage) => {
    if (!draggingId) return;
    const card = cards.find((c) => c.id === draggingId);
    setDraggingId(null);
    setDragOverStage(null);
    if (!card || card.stage === stage) return;
    void moveStage(card.id, stage);
  };

  return (
    <Workspace wide>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Talent pipeline</h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Drag cards between columns · edit or delete from each card
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

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipeline-edit-title"
            className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h3
                id="pipeline-edit-title"
                className="text-[15px] font-bold text-gray-900"
              >
                Edit candidate
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1 text-gray-500 hover:text-gray-800"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">Name</span>
                <input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing((f) => (f ? { ...f, name: e.target.value } : f))
                  }
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">
                  Source
                </span>
                <input
                  value={editing.source}
                  onChange={(e) =>
                    setEditing((f) => (f ? { ...f, source: e.target.value } : f))
                  }
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">Stage</span>
                <select
                  value={editing.stage}
                  onChange={(e) =>
                    setEditing((f) =>
                      f ? { ...f, stage: e.target.value as PipelineStage } : f
                    )
                  }
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">Notes</span>
                <textarea
                  value={editing.notes}
                  onChange={(e) =>
                    setEditing((f) => (f ? { ...f, notes: e.target.value } : f))
                  }
                  rows={3}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                />
              </label>
            </div>
            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const card = cards.find((c) => c.id === editing.id);
                  if (card) void handleDelete(card);
                }}
                className="px-3 py-1.5 text-[12px] text-red-700 border border-red-200 rounded hover:bg-red-50"
              >
                Delete
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-3 py-1.5 border border-gray-200 rounded text-[12px] text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => void saveEdit()}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingEdit ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-[13px] text-gray-500">Loading pipeline…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {ACTIVE_STAGES.map((stage) => {
            const label =
              PIPELINE_STAGES.find((s) => s.value === stage)?.label || stage;
            const column = byStage[stage];
            const isDropTarget = dragOverStage === stage && draggingId != null;
            return (
              <div
                key={stage}
                className={[
                  "rounded-xl border bg-gray-50/60 min-h-[280px] flex flex-col transition-colors",
                  isDropTarget
                    ? "border-blue-400 ring-2 ring-blue-100 bg-blue-50/40"
                    : "border-gray-200",
                ].join(" ")}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverStage(stage);
                }}
                onDragLeave={() => {
                  setDragOverStage((s) => (s === stage ? null : s));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  onDropToStage(stage);
                }}
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
                  {column.length === 0 ? (
                    <p className="text-[11px] text-gray-400 text-center py-6 px-2">
                      Drop cards here
                    </p>
                  ) : null}
                  {column.map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(card.id);
                        e.dataTransfer.setData("text/plain", card.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStage(null);
                      }}
                      className={[
                        "rounded-lg border border-gray-200 bg-white p-3 shadow-sm space-y-2 cursor-grab active:cursor-grabbing",
                        draggingId === card.id ? "opacity-50" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-gray-900 min-w-0">
                          {card.name}
                        </p>
                        <div className="flex items-center shrink-0 -mr-1 -mt-0.5">
                          <button
                            type="button"
                            onClick={() => startEdit(card)}
                            className="p-1 text-gray-500 hover:text-blue-700"
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(card)}
                            className="p-1 text-gray-500 hover:text-red-600"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                      {card.source ? (
                        <p className="text-[11px] text-gray-500">{card.source}</p>
                      ) : null}
                      {card.notes ? (
                        <p className="text-[12px] text-gray-600 line-clamp-2">
                          {card.notes}
                        </p>
                      ) : null}

                      <label className="block">
                        <span className="sr-only">Move to stage</span>
                        <select
                          value={card.stage}
                          onChange={(e) =>
                            void moveStage(
                              card.id,
                              e.target.value as PipelineStage
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] bg-white"
                        >
                          {PIPELINE_STAGES.map((s) => (
                            <option key={s.value} value={s.value}>
                              Move to {s.label}
                            </option>
                          ))}
                        </select>
                      </label>

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
