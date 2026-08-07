"use client";

import { useEffect, useRef, useState } from "react";
import {
  GateIcon,
  RecurringIcon,
  EmailSourceIcon,
  TaskStatusBadge,
} from "@/components/pm/PmBadges";
import type { PmTaskStatus } from "@/lib/pm/types";

export type TaskRowProfile = {
  id: string;
  full_name: string | null;
};

export type TaskRowTask = {
  id: string;
  title: string;
  status: PmTaskStatus;
  assignee_id: string | null;
  is_gate?: boolean;
  cycle_key?: string | null;
  source?: string | null;
  default_role?: string | null;
  phase_label?: string | null;
};

export type TaskRowProps = {
  task: TaskRowTask;
  profiles: TaskRowProfile[];
  phaseOptions: string[];
  disabled?: boolean;
  /** Open Notion-style task detail peek (not inline edit). */
  onOpen: (taskId: string) => void;
  onToggleDone: (taskId: string, done: boolean) => void;
  onTitleChange: (taskId: string, title: string) => void;
  onAssigneeChange: (taskId: string, assigneeId: string | null) => void;
  onDelete: (taskId: string) => void;
  onDuplicate: (taskId: string) => void;
  onMovePhase: (taskId: string, phaseLabel: string) => void;
  onDragStart: (taskId: string) => void;
  onDragOver: (taskId: string) => void;
  onDrop: (taskId: string) => void;
};

function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

/**
 * Compact structured task row — no BlockNote. Row click opens TaskDetailPage.
 */
export function TaskRow({
  task,
  profiles,
  phaseOptions,
  disabled,
  onOpen,
  onToggleDone,
  onTitleChange,
  onAssigneeChange,
  onDelete,
  onDuplicate,
  onMovePhase,
  onDragStart,
  onDragOver,
  onDrop,
}: TaskRowProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const assignee = profiles.find((p) => p.id === task.assignee_id);
  const isDone = task.status === "done";

  useEffect(() => {
    setTitleDraft(task.title);
  }, [task.title]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (!assigneeOpen && !menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (assigneeOpen && assigneeRef.current && !assigneeRef.current.contains(t)) {
        setAssigneeOpen(false);
      }
      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) {
        setMenuOpen(false);
        setMoveOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [assigneeOpen, menuOpen]);

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
      className="group relative flex items-center gap-1.5 px-2 py-1.5 text-sm hover:bg-gray-50/80"
      draggable={false}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(task.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(task.id);
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("[data-row-control]")) return;
        onOpen(task.id);
      }}
    >
      <button
        type="button"
        data-row-control
        draggable
        disabled={disabled}
        aria-label="Drag to reorder"
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 px-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", task.id);
          onDragStart(task.id);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        ⋮⋮
      </button>

      <input
        data-row-control
        type="checkbox"
        disabled={disabled}
        checked={isDone}
        aria-label={isDone ? "Mark not done" : "Mark done"}
        className="shrink-0 rounded border-gray-300"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          onToggleDone(task.id, e.target.checked);
        }}
      />

      {task.is_gate ? <GateIcon cleared={isDone} /> : null}
      {task.cycle_key ? <RecurringIcon /> : null}
      {task.source === "email" ? <EmailSourceIcon /> : null}

      {editingTitle ? (
        <input
          ref={titleRef}
          data-row-control
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
          className={`flex-1 min-w-0 truncate text-left ${
            isDone ? "text-gray-400 line-through" : "text-gray-900"
          }`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingTitle(true);
          }}
        >
          {task.title}
        </span>
      )}

      {task.default_role ? (
        <span className="hidden sm:inline text-xs text-gray-400 shrink-0">
          {task.default_role}
        </span>
      ) : null}

      <TaskStatusBadge status={task.status} />

      <div ref={assigneeRef} className="relative shrink-0" data-row-control>
        <button
          type="button"
          disabled={disabled}
          aria-label="Change assignee"
          className="w-7 h-7 rounded-full bg-gray-200 text-[10px] font-medium text-gray-700 flex items-center justify-center hover:ring-2 hover:ring-gray-300"
          onClick={(e) => {
            e.stopPropagation();
            setAssigneeOpen((o) => !o);
            setMenuOpen(false);
          }}
          title={assignee?.full_name || "Unassigned"}
        >
          {initials(assignee?.full_name)}
        </button>
        {assigneeOpen ? (
          <div className="absolute right-0 top-full mt-1 z-40 w-48 max-h-56 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg py-1">
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
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                  p.id === task.assignee_id ? "bg-gray-50 font-medium" : "text-gray-800"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAssigneeChange(task.id, p.id);
                  setAssigneeOpen(false);
                }}
              >
                {p.full_name || p.id.slice(0, 8)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div ref={menuRef} className="relative shrink-0" data-row-control>
        <button
          type="button"
          disabled={disabled}
          aria-label="Task actions"
          className="w-7 h-7 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
            setMoveOpen(false);
            setAssigneeOpen(false);
          }}
        >
          ···
        </button>
        {menuOpen ? (
          <div className="absolute right-0 top-full mt-1 z-40 w-44 rounded-md border border-gray-200 bg-white shadow-lg py-1 text-xs">
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-800"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDuplicate(task.id);
              }}
            >
              Duplicate
            </button>
            <div className="relative">
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-800 flex justify-between"
                onClick={(e) => {
                  e.stopPropagation();
                  setMoveOpen((o) => !o);
                }}
              >
                Move to <span>›</span>
              </button>
              {moveOpen ? (
                <div className="absolute right-full top-0 mr-1 w-40 max-h-48 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg py-1">
                  {phaseOptions.map((phase) => (
                    <button
                      key={phase}
                      type="button"
                      className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMovePhase(task.id, phase);
                        setMenuOpen(false);
                        setMoveOpen(false);
                      }}
                    >
                      {phase}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-700"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete(task.id);
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
