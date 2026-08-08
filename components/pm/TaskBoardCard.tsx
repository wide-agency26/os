"use client";

import { useEffect, useRef, useState } from "react";
import {
  GateIcon,
  RecurringIcon,
  EmailSourceIcon,
} from "@/components/pm/PmBadges";
import type { PmTaskStatus } from "@/lib/pm/types";
import type { TaskRowProfile, TaskRowTask } from "@/components/pm/TaskRow";

const MOVE_COLUMNS: { key: PmTaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export type TaskBoardCardProps = {
  task: TaskRowTask;
  profiles: TaskRowProfile[];
  disabled?: boolean;
  onOpen: (taskId: string) => void;
  onTitleChange: (taskId: string, title: string) => void;
  onAssigneeChange: (taskId: string, assigneeId: string | null) => void;
  onStatusChange: (taskId: string, status: PmTaskStatus) => void;
  onToggleDone: (taskId: string, done: boolean) => void;
};

function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

/**
 * Kanban card — compact quick-edit, no BlockNote.
 * Card click opens the same TaskDetailPage peek as list rows.
 */
export function TaskBoardCard({
  task,
  profiles,
  disabled,
  onOpen,
  onTitleChange,
  onAssigneeChange,
  onStatusChange,
  onToggleDone,
}: TaskBoardCardProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);

  const assignee = profiles.find(
    (p) => p.id === (task.assignee_person_id || task.assignee_id)
  );
  const isDone = task.status === "done";

  useEffect(() => {
    setTitleDraft(task.title);
  }, [task.title]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (!assigneeOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) {
        setAssigneeOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [assigneeOpen]);

  const commitTitle = () => {
    setEditingTitle(false);
    const next = titleDraft.trim();
    if (!next || next === task.title) {
      setTitleDraft(task.title);
      return;
    }
    onTitleChange(task.id, next);
  };

  return (
    <li
      className="group bg-white border border-gray-200 rounded-md p-2.5 text-sm shadow-sm hover:border-gray-300 hover:shadow cursor-pointer"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-card-control]")) return;
        onOpen(task.id);
      }}
    >
      <div className="flex items-start gap-2">
        <input
          data-card-control
          type="checkbox"
          disabled={disabled}
          checked={isDone}
          aria-label={isDone ? "Mark not done" : "Mark done"}
          className="mt-0.5 shrink-0 rounded border-gray-300"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            onToggleDone(task.id, e.target.checked);
          }}
        />

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-1.5">
            {task.is_gate ? <GateIcon cleared={isDone} /> : null}
            {task.cycle_key ? <RecurringIcon /> : null}
            {task.source === "email" ? <EmailSourceIcon /> : null}

            {editingTitle ? (
              <input
                ref={titleRef}
                data-card-control
                value={titleDraft}
                disabled={disabled}
                className="flex-1 min-w-0 text-sm text-gray-900 border border-gray-300 rounded px-1.5 py-0.5"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTitle();
                  }
                  if (e.key === "Escape") {
                    setTitleDraft(task.title);
                    setEditingTitle(false);
                  }
                }}
              />
            ) : (
              <span
                title="Click to open · double-click to rename"
                className={`flex-1 min-w-0 text-gray-900 leading-snug ${
                  isDone ? "line-through text-gray-400" : ""
                }`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTitle(true);
                }}
              >
                {task.title}
              </span>
            )}
          </div>

          {task.phase_label ? (
            <p className="text-[10px] text-gray-400 truncate">{task.phase_label}</p>
          ) : null}

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap gap-1" data-card-control>
              {MOVE_COLUMNS.filter((c) => c.key !== task.status).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(task.id, c.key);
                  }}
                  className="text-[10px] text-gray-500 hover:text-gray-900 underline"
                >
                  → {c.label}
                </button>
              ))}
            </div>

            <div ref={assigneeRef} className="relative shrink-0" data-card-control>
              <button
                type="button"
                disabled={disabled}
                aria-label="Change assignee"
                title={assignee?.full_name || "Unassigned"}
                className="w-6 h-6 rounded-full bg-gray-200 text-[9px] font-medium text-gray-700 flex items-center justify-center hover:ring-2 hover:ring-gray-300"
                onClick={(e) => {
                  e.stopPropagation();
                  setAssigneeOpen((o) => !o);
                }}
              >
                {initials(assignee?.full_name)}
              </button>
              {assigneeOpen ? (
                <div className="absolute right-0 top-full mt-1 z-40 w-52 max-h-48 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg py-1">
                  <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    HR roster
                  </p>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssigneeChange(task.id, null);
                      setAssigneeOpen(false);
                    }}
                  >
                    Unassigned
                  </button>
                  {profiles.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-gray-500">
                      No assignable people in HR.
                    </p>
                  ) : (
                    profiles.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                          p.id === (task.assignee_person_id || task.assignee_id)
                            ? "bg-gray-50 font-medium"
                            : "text-gray-800"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssigneeChange(task.id, p.id);
                          setAssigneeOpen(false);
                        }}
                      >
                        {p.full_name || p.id.slice(0, 8)}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
