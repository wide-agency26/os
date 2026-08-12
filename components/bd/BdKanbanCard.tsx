"use client";

import Link from "next/link";
import {
  BD_LEGITIMACY_LABELS,
  daysInStage,
  initialsFromName,
} from "@/lib/bd/constants";
import type { BdRecord } from "@/lib/bd/types";

export function BdKanbanCard({
  record,
  dragging,
  onDragStart,
}: {
  record: BdRecord;
  dragging?: boolean;
  onDragStart: (id: string) => void;
}) {
  const days = daysInStage(record.stage_entered_at);
  const legitimacy = record.legitimacy_status
    ? BD_LEGITIMACY_LABELS[record.legitimacy_status]
    : null;

  return (
    <Link
      href={`/app/bd/${record.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/bd-record-id", record.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(record.id);
      }}
      className={`block rounded-xl border bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
        dragging ? "opacity-50 border-blue-300" : "border-gray-200"
      }`}
      onClick={(e) => {
        // Allow drag without accidental navigation if user is dragging
        if (dragging) e.preventDefault();
      }}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-bold text-white">
          {initialsFromName(record.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{record.name}</p>
          <p className="text-xs text-gray-500 truncate">{record.company_name}</p>
          {record.position && (
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{record.position}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
          {record.owner?.full_name || "Unassigned"}
        </span>
        <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          {days}d in stage
        </span>
        {legitimacy ? (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              record.legitimacy_status === "pass"
                ? "bg-emerald-50 text-emerald-700"
                : record.legitimacy_status === "fail"
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            {legitimacy}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-400">
            Legitimacy —
          </span>
        )}
      </div>

      {(record.next_action_due || record.next_action_label) && (
        <p className="mt-2 text-[11px] text-blue-700 truncate">
          Next: {record.next_action_label || "Follow up"}
          {record.next_action_due ? ` · ${record.next_action_due}` : ""}
        </p>
      )}
    </Link>
  );
}
