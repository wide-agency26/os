"use client";

import Link from "next/link";
import { workPaths } from "@/lib/work/paths";
import {
  BD_LEGITIMACY_LABELS,
  daysInStage,
  initialsFromName,
} from "@/lib/bd/constants";
import { formatEuro, stagePillarLabel } from "@/lib/accounting/types";
import type { BdRecord } from "@/lib/bd/types";
import { OfferingChips } from "@/components/offerings/OfferingChips";

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
    <div
      draggable
      onDragStart={(e) => {
        if ((e.target as HTMLElement).closest("[data-no-card-drag]")) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("text/bd-record-id", record.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(record.id);
      }}
      className={`rounded-lg border bg-surface p-3 hover:border-text-muted transition-colors cursor-grab active:cursor-grabbing ${
        dragging ? "opacity-50 border-accent" : "border-border"
      }`}
    >
      <Link href={workPaths.pipelineId(record.id)} className="block min-w-0">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-bold text-white">
            {initialsFromName(record.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {record.project_title || record.company_name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {record.project_title && record.project_title !== record.company_name
                ? record.company_name
                : record.name}
            </p>
            {record.position && (
              <p className="text-[11px] text-gray-400 truncate mt-0.5">
                {record.position}
              </p>
            )}
          </div>
        </div>
      </Link>

      <div className="mt-2">
        <OfferingChips
          value={record.offerings ?? []}
          projectId={record.project_id}
          bdRecordId={record.id}
          compact
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
          {record.owner?.full_name || "Unassigned"}
        </span>
        <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          {days}d
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
        ) : null}
        {typeof record.deal_value === "number" && record.deal_value > 0 ? (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
            {formatEuro(record.deal_value)}
            {record.project_stage
              ? ` · ${stagePillarLabel(record.project_stage)}`
              : " · Unidentified"}
          </span>
        ) : null}
        {record.project_id ? (
          <Link
            href={record.project_id ? workPaths.project(record.project_id) : "#"}
            className="inline-flex items-center rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-black"
          >
            Project
          </Link>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-400">
            No project
          </span>
        )}
      </div>

      {(record.next_action_due || record.next_action_label) && (
        <p className="mt-2 text-[11px] text-blue-700 truncate">
          Next: {record.next_action_label || "Follow up"}
          {record.next_action_due ? ` · ${record.next_action_due}` : ""}
        </p>
      )}
    </div>
  );
}
