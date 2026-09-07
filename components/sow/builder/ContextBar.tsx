"use client";

import { Loader2, Sparkles } from "lucide-react";
import type { SowAssistAnswers, SowAssistContext } from "@/lib/sow/assist";

export function ContextBar({
  context,
  bdRecords,
  pending,
  suggestionCount,
  onSave,
  onGenerate,
  onApplyAll,
}: {
  context: SowAssistContext;
  bdRecords: { id: string; label: string }[];
  pending: boolean;
  suggestionCount: number;
  onSave: (patch: {
    rawText?: string;
    appendNote?: string;
    bdRecordId?: string | null;
    answers?: SowAssistAnswers;
  }) => void;
  onGenerate: () => void;
  onApplyAll: () => void;
}) {
  const notesCount = context.notes.length + (context.raw_text.trim() ? 1 : 0);

  return (
    <div className="border-b border-gray-200 bg-[#FAFAF8] px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={14} className="text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-gray-900">
            Context pack
            <span className="ml-2 text-xs font-normal text-gray-500">
              {notesCount} note{notesCount === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {suggestionCount > 0 && (
            <>
              <span className="text-xs text-amber-800 bg-amber-100 rounded-full px-2 py-0.5 font-medium">
                {suggestionCount} suggestion{suggestionCount === 1 ? "" : "s"} — review below
              </span>
              <button
                type="button"
                disabled={pending}
                className="text-xs font-semibold text-amber-900 underline disabled:opacity-50"
                onClick={onApplyAll}
              >
                Apply all
              </button>
            </>
          )}
          <button
            type="button"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
            onClick={onGenerate}
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generate suggestions
          </button>
        </div>
      </div>

      <textarea
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm min-h-[72px]"
        placeholder="Paste discovery notes, email, or transcript…"
        defaultValue={context.raw_text}
        key={context.updated_at || "ctx"}
        disabled={pending}
        onBlur={(e) => {
          if (e.target.value !== context.raw_text) onSave({ rawText: e.target.value });
        }}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
        <select
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
          value={context.bd_record_id || ""}
          disabled={pending}
          onChange={(e) => onSave({ bdRecordId: e.target.value || null })}
        >
          <option value="">BD record (optional)</option>
          {bdRecords.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
          placeholder="Services in / out"
          defaultValue={context.answers.services || ""}
          disabled={pending}
          onBlur={(e) => onSave({ answers: { services: e.target.value } })}
        />
        <input
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
          placeholder="Budget band"
          defaultValue={context.answers.budgetBand || ""}
          disabled={pending}
          onBlur={(e) => onSave({ answers: { budgetBand: e.target.value } })}
        />
        <input
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
          placeholder="Timeline"
          defaultValue={context.answers.timeline || ""}
          disabled={pending}
          onBlur={(e) => onSave({ answers: { timeline: e.target.value } })}
        />
        <input
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
          placeholder="In / out of scope"
          defaultValue={context.answers.inOut || ""}
          disabled={pending}
          onBlur={(e) => onSave({ answers: { inOut: e.target.value } })}
        />
        <select
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
          value={context.answers.tone || "sharp"}
          disabled={pending}
          onChange={(e) =>
            onSave({
              answers: { tone: e.target.value as "sharp" | "conservative" },
            })
          }
        >
          <option value="sharp">Tone: sharp</option>
          <option value="conservative">Tone: conservative</option>
        </select>
      </div>
      <input
        className="w-full rounded-lg border border-dashed border-gray-300 px-2 py-1.5 text-xs"
        placeholder="Inject more context later (Enter to append — never overwrites)"
        disabled={pending}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = (e.target as HTMLInputElement).value.trim();
            if (!v) return;
            onSave({
              appendNote: v,
            });
            (e.target as HTMLInputElement).value = "";
          }
        }}
      />
    </div>
  );
}
