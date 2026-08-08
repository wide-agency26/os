"use client";

import type { RosterSuggestPerson } from "@/lib/hr/suggest";

interface Props {
  suggestions: RosterSuggestPerson[];
  /** people.id from HR roster */
  onAssign: (personId: string) => void;
}

/**
 * Manual-confirm roster suggestions for a task (never auto-assigns).
 */
export function AssigneeSuggestBanner({ suggestions, onAssign }: Props) {
  const top = suggestions.slice(0, 5);
  if (!top.length) return null;

  return (
    <div className="mx-3 mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 space-y-2">
      <p className="text-[12px] font-semibold text-amber-900">Roster suggestions</p>
      <p className="text-[11px] text-amber-800/90">
        Matched from playbook RACI / skills. Confirm manually — nothing is auto-assigned.
      </p>
      <ul className="space-y-1.5">
        {top.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 text-[12px] text-gray-800"
          >
            <span className="min-w-0 truncate">
              <span className="font-medium">{s.full_name}</span>
              {s.engagement_label ? (
                <span className="text-gray-500"> · {s.engagement_label}</span>
              ) : null}
              <span className="block text-[10px] text-gray-500 truncate">{s.reason}</span>
            </span>
            <button
              type="button"
              className="shrink-0 px-2 py-1 rounded bg-white border border-amber-300 text-amber-900 text-[11px] font-medium hover:bg-amber-100"
              onClick={() => onAssign(s.id)}
            >
              Assign
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
