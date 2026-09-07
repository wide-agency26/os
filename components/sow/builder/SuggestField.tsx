"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, MoreHorizontal, X } from "lucide-react";
import type { SowSuggestion } from "@/lib/sow/assist";

export function SuggestField({
  label,
  field,
  value,
  suggestion,
  multiline,
  pending,
  onChange,
  onBlur,
  onAccept,
  onSkip,
  onRewrite,
}: {
  label: string;
  field: string;
  value: string;
  suggestion?: SowSuggestion;
  multiline?: boolean;
  pending?: boolean;
  onChange: (v: string) => void;
  onBlur?: () => void;
  onAccept: (field: string, text: string) => void;
  onSkip: (field: string) => void;
  onRewrite: (field: string, current: string, mode: "rewrite" | "shorter" | "template") => void;
}) {
  const suggested = Boolean(suggestion);
  const [draft, setDraft] = useState(suggested ? suggestion!.proposed : value);

  useEffect(() => {
    setDraft(suggested ? suggestion!.proposed : value);
  }, [suggested, suggestion?.proposed, suggestion?.id, value]);

  const cls = `w-full rounded-lg border px-3 py-2 text-sm text-gray-800 ${
    suggested
      ? "border-amber-400 bg-amber-50/60 ring-1 ring-amber-200"
      : "border-gray-200 bg-white"
  }`;

  function handleChange(v: string) {
    setDraft(v);
    if (!suggested) onChange(v);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </span>
        <div className="flex items-center gap-1">
          {suggested && (
            <>
              <button
                type="button"
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md bg-amber-500 text-black px-2 py-0.5 text-[10px] font-bold disabled:opacity-50"
                onClick={() => onAccept(field, draft)}
              >
                {pending ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                Accept
              </button>
              <button
                type="button"
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600 disabled:opacity-50"
                onClick={() => onSkip(field)}
              >
                <X size={10} /> Skip
              </button>
            </>
          )}
          <details className="relative">
            <summary className="list-none cursor-pointer rounded-md p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-50">
              <MoreHorizontal size={14} />
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white shadow-lg p-1 text-xs">
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50"
                onClick={() => onRewrite(field, draft, "rewrite")}
              >
                Rewrite from context
              </button>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50"
                onClick={() => onRewrite(field, draft, "shorter")}
              >
                Shorter
              </button>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50"
                onClick={() => onRewrite(field, draft, "template")}
              >
                Keep template
              </button>
            </div>
          </details>
        </div>
      </div>
      {multiline ? (
        <textarea
          className={`${cls} min-h-[88px]`}
          value={draft}
          disabled={pending}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={suggested ? undefined : onBlur}
        />
      ) : (
        <input
          className={cls}
          value={draft}
          disabled={pending}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={suggested ? undefined : onBlur}
        />
      )}
      {suggested && (
        <p className="text-[10px] text-amber-800">
          Suggestion — edit then Accept, or Skip to keep the current copy.
        </p>
      )}
    </div>
  );
}
