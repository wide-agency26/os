"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Block } from "@blocknote/core";
import {
  GateIcon,
  RecurringIcon,
  EmailSourceIcon,
  TaskStatusBadge,
} from "@/components/pm/PmBadges";
import { initialBlocksForTask, initialClientBlocksForTask } from "@/lib/pm/blocknote";
import type { PmTaskStatus } from "@/lib/pm/types";
import type { TaskRowProfile } from "@/components/pm/TaskRow";
import { AssigneeSuggestBanner } from "@/components/hr/AssigneeSuggestBanner";
import type { RosterSuggestPerson } from "@/lib/hr/suggest";

const TaskContentEditor = dynamic(
  () =>
    import("@/components/pm/TaskContentEditor").then((m) => m.TaskContentEditor),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-gray-400 px-2 py-6">Loading editor…</p>
    ),
  }
);

const STATUS_OPTIONS: PmTaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "blocked",
  "cancelled",
];

export type TaskDetailTask = {
  id: string;
  title: string;
  status: PmTaskStatus;
  assignee_id: string | null;
  assignee_person_id?: string | null;
  description?: string | null;
  content_blocks?: unknown;
  client_content_blocks?: unknown;
  is_gate?: boolean;
  cycle_key?: string | null;
  source?: string | null;
  waiting_on?: "us" | "them" | null;
  last_evidence?: string | null;
  default_role?: string | null;
  phase_label?: string | null;
  task_template_id?: string | null;
};

export type TaskDetailPageProps = {
  task: TaskDetailTask;
  profiles: TaskRowProfile[];
  open: boolean;
  onClose: () => void;
  onTitleChange: (taskId: string, title: string) => void;
  onAssigneeChange: (taskId: string, assigneeId: string | null) => void;
  onStatusChange: (taskId: string, status: PmTaskStatus) => void;
  onContentSave: (taskId: string, blocks: Block[]) => void;
  onClientContentSave: (taskId: string, blocks: Block[]) => void;
  /** RACI-matched roster suggestions (confirm manually). */
  suggestions?: RosterSuggestPerson[];
};

/**
 * Notion-style page peek. BlockNote mounts only here — never in the list row.
 */
export function TaskDetailPage({
  task,
  profiles,
  open,
  onClose,
  onTitleChange,
  onAssigneeChange,
  onStatusChange,
  onContentSave,
  onClientContentSave,
  suggestions = [],
}: TaskDetailPageProps) {
  const [titleDraft, setTitleDraft] = useState(task.title);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleDraft(task.title);
  }, [task.id, task.title]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (!next || next === task.title) {
      setTitleDraft(task.title);
      return;
    }
    onTitleChange(task.id, next);
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close task detail"
        className="absolute inset-0 bg-black/25"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl border-l border-gray-200 animate-in slide-in-from-right pb-[var(--os-bottom-nav)]"
      >
        <header className="shrink-0 border-b border-gray-100 px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 pt-1">
              {task.is_gate ? <GateIcon cleared={task.status === "done"} /> : null}
              {task.cycle_key ? <RecurringIcon /> : null}
              {task.source === "email" ? <EmailSourceIcon /> : null}
              {task.phase_label ? (
                <span className="text-[11px] text-gray-400 truncate">
                  {task.phase_label}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
            >
              Close
            </button>
          </div>

          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-full text-xl font-semibold text-gray-900 border-0 outline-none focus:ring-0 placeholder:text-gray-300"
            placeholder="Untitled"
          />

          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <select
              className="text-xs border border-gray-200 rounded px-2 py-1"
              value={task.status}
              onChange={(e) =>
                onStatusChange(task.id, e.target.value as PmTaskStatus)
              }
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
            <select
              className="text-xs border border-gray-200 rounded px-2 py-1 max-w-[14rem]"
              value={task.assignee_person_id || ""}
              onChange={(e) =>
                onAssigneeChange(task.id, e.target.value || null)
              }
            >
              <option value="">Unassigned</option>
              <optgroup label="HR roster">
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.id.slice(0, 8)}
                    {p.engagement_label ? ` · ${p.engagement_label}` : ""}
                  </option>
                ))}
              </optgroup>
            </select>
            {task.default_role ? (
              <span className="text-xs text-gray-400">{task.default_role}</span>
            ) : null}
          </div>
        </header>

        {!task.assignee_person_id && suggestions.length > 0 ? (
          <AssigneeSuggestBanner
            suggestions={suggestions}
            onAssign={(personId) => onAssigneeChange(task.id, personId)}
          />
        ) : null}

        {task.waiting_on || task.last_evidence ? (
          <div className="px-3 py-2 border-b border-gray-100 text-xs text-gray-600 space-y-1">
            {task.waiting_on ? (
              <p>
                Waiting on{" "}
                <span className="font-semibold text-gray-900">{task.waiting_on}</span>
              </p>
            ) : null}
            {task.last_evidence ? (
              <p className="leading-relaxed">
                <span className="text-gray-400">Evidence · </span>
                {task.last_evidence}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-6">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2 px-2">
              Internal brief
            </h3>
            <TaskContentEditor
              key={`${task.id}-internal`}
              taskId={task.id}
              initialContent={initialBlocksForTask(task)}
              onSave={(blocks) => onContentSave(task.id, blocks)}
              className="border-0 shadow-none"
            />
          </section>
          <section className="border-t border-gray-100 pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1 px-2">
              Client view
            </h3>
            <p className="text-[11px] text-gray-400 mb-2 px-2">
              Shown on the client Tasks tab only. Never copied from the internal brief.
            </p>
            <TaskContentEditor
              key={`${task.id}-client`}
              taskId={`${task.id}-client`}
              initialContent={initialClientBlocksForTask(task)}
              onSave={(blocks) => onClientContentSave(task.id, blocks)}
              className="border-0 shadow-none"
            />
          </section>
        </div>
      </div>
    </div>
  );
}
