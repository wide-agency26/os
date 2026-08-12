"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Filter, Loader2, Plus } from "lucide-react";
import {
  BD_LEGITIMACY_LABELS,
  BD_MAIN_STAGES,
  BD_SIDE_LANES,
  BD_SOURCE_LABELS,
  BD_STAGE_LABELS,
} from "@/lib/bd/constants";
import type {
  BdLegitimacyStatus,
  BdRecord,
  BdSource,
  BdStage,
  BdStaffOption,
} from "@/lib/bd/types";
import { moveBdRecordStage } from "@/app/actions/bd";
import { BdKanbanCard } from "@/components/bd/BdKanbanCard";
import { BdQuickAddModal } from "@/components/bd/BdQuickAddModal";

function StageColumn({
  stage,
  label,
  records,
  draggingId,
  onDragStart,
  onDrop,
  muted,
}: {
  stage: BdStage;
  label: string;
  records: BdRecord[];
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDrop: (stage: BdStage) => void;
  muted?: boolean;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`flex w-[260px] shrink-0 flex-col rounded-2xl border ${
        muted ? "border-gray-200 bg-gray-50/80" : "border-gray-200 bg-gray-50"
      } ${over ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDrop(stage);
      }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200/80">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-600">
          {label}
        </h3>
        <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
          {records.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 p-2 min-h-[120px] max-h-[calc(100vh-260px)] overflow-y-auto">
        {records.map((r) => (
          <BdKanbanCard
            key={r.id}
            record={r}
            dragging={draggingId === r.id}
            onDragStart={onDragStart}
          />
        ))}
        {records.length === 0 && (
          <p className="text-[11px] text-gray-400 text-center py-6 px-2">
            Drop cards here
          </p>
        )}
      </div>
    </div>
  );
}

export function BdBoard({
  initialRecords,
  staff,
  currentUserId,
}: {
  initialRecords: BdRecord[];
  staff: BdStaffOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [legitimacyFilter, setLegitimacyFilter] = useState<string>("all");

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (ownerFilter !== "all" && r.owner_id !== ownerFilter) return false;
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (stageFilter !== "all" && r.stage !== stageFilter) return false;
      if (legitimacyFilter === "unset" && r.legitimacy_status != null) return false;
      if (
        legitimacyFilter !== "all" &&
        legitimacyFilter !== "unset" &&
        r.legitimacy_status !== legitimacyFilter
      ) {
        return false;
      }
      return true;
    });
  }, [records, ownerFilter, sourceFilter, stageFilter, legitimacyFilter]);

  const byStage = useMemo(() => {
    const map = new Map<BdStage, BdRecord[]>();
    for (const col of [...BD_MAIN_STAGES, ...BD_SIDE_LANES]) {
      map.set(col.id, []);
    }
    for (const r of filtered) {
      const list = map.get(r.stage) ?? [];
      list.push(r);
      map.set(r.stage, list);
    }
    return map;
  }, [filtered]);

  function handleDrop(targetStage: BdStage) {
    const id = draggingId;
    setDraggingId(null);
    if (!id) return;
    const record = records.find((r) => r.id === id);
    if (!record || record.stage === targetStage) return;

    let reason: string | null = null;
    if (targetStage === "archived" || targetStage === "declined") {
      reason = window.prompt(
        `Reason for moving to ${BD_STAGE_LABELS[targetStage]} (required):`
      );
      if (!reason?.trim()) {
        setMessage("Move cancelled — reason is required.");
        return;
      }
    } else if (targetStage === "on_hold") {
      reason = window.prompt("Optional note for On Hold:") || null;
    }

    const prevStage = record.stage;
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              stage: targetStage,
              stage_entered_at: new Date().toISOString(),
              archived_reason:
                targetStage === "archived" || targetStage === "declined"
                  ? reason
                  : r.archived_reason,
            }
          : r
      )
    );

    startTransition(async () => {
      const res = await moveBdRecordStage({
        id,
        stage: targetStage,
        note: reason,
        archived_reason: reason,
      });
      if (!res.ok) {
        setMessage(res.error || "Could not move card");
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, stage: prevStage } : r))
        );
        return;
      }
      setMessage(
        `Moved to ${BD_STAGE_LABELS[targetStage]} — timeline updated.`
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">BD Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Prospects through won — drag cards between stages. Records are never
            deleted; archive with a reason instead.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold px-3 py-2 hover:bg-black"
        >
          <Plus size={14} /> Add prospect
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <Filter size={14} className="text-gray-400" />
        <select
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white"
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
        >
          <option value="all">All owners</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name || s.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="all">All sources</option>
          {(Object.keys(BD_SOURCE_LABELS) as BdSource[]).map((s) => (
            <option key={s} value={s}>
              {BD_SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="all">All stages</option>
          {[...BD_MAIN_STAGES, ...BD_SIDE_LANES].map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white"
          value={legitimacyFilter}
          onChange={(e) => setLegitimacyFilter(e.target.value)}
        >
          <option value="all">All legitimacy</option>
          <option value="unset">Not set</option>
          {(Object.keys(BD_LEGITIMACY_LABELS) as BdLegitimacyStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {BD_LEGITIMACY_LABELS[s]}
              </option>
            )
          )}
        </select>
        {pending && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Loader2 size={12} className="animate-spin" /> Saving…
          </span>
        )}
        {message && (
          <span className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded px-2 py-1">
            {message}
          </span>
        )}
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {BD_MAIN_STAGES.map((col) => (
            <StageColumn
              key={col.id}
              stage={col.id}
              label={col.label}
              records={byStage.get(col.id) ?? []}
              draggingId={draggingId}
              onDragStart={setDraggingId}
              onDrop={handleDrop}
            />
          ))}
          <div className="w-px self-stretch bg-gray-200 mx-1" />
          {BD_SIDE_LANES.map((col) => (
            <StageColumn
              key={col.id}
              stage={col.id}
              label={col.label}
              records={byStage.get(col.id) ?? []}
              draggingId={draggingId}
              onDragStart={setDraggingId}
              onDrop={handleDrop}
              muted
            />
          ))}
        </div>
      </div>

      <BdQuickAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        staff={staff}
        defaultOwnerId={currentUserId || staff[0]?.id || ""}
      />
    </div>
  );
}
