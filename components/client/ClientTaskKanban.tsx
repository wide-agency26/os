"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { PmTaskStatus } from "@/lib/pm/types";
import { initialClientBlocksForTask, isBlockNoteDocument } from "@/lib/pm/blocknote";

const TaskContentEditor = dynamic(
  () =>
    import("@/components/pm/TaskContentEditor").then((m) => m.TaskContentEditor),
  {
    ssr: false,
    loading: () => (
      <p className="text-[13px] text-text-muted px-2 py-4">Loading brief…</p>
    ),
  }
);

const COLUMNS: { key: PmTaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export type ClientTaskCard = {
  id: string;
  title: string;
  status: PmTaskStatus;
  phase_label: string | null;
  is_gate: boolean;
  description?: string | null;
  client_content_blocks?: unknown;
};

function hasClientBrief(task: ClientTaskCard) {
  return (
    isBlockNoteDocument(task.client_content_blocks) &&
    (task.client_content_blocks as unknown[]).length > 0
  );
}

export function ClientTaskKanban({ tasks }: { tasks: ClientTaskCard[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = tasks.find((t) => t.id === openId) || null;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.key);
          return (
            <section
              key={col.key}
              className="rounded-xl border border-border bg-surface-raised/60 min-w-0"
            >
              <h2 className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted flex items-center justify-between">
                {col.label}
                <span className="tabular-nums font-medium text-text-secondary">
                  {items.length}
                </span>
              </h2>
              <ul className="space-y-2 p-2 min-h-[6rem]">
                {items.length === 0 ? (
                  <li className="text-[12px] text-text-muted px-2 py-6 text-center">
                    Nothing here
                  </li>
                ) : (
                  items.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(t.id)}
                        className="w-full text-left rounded-lg border border-border bg-surface px-3 py-2.5 min-h-11 hover:border-text-muted/40"
                      >
                        <span
                          className={`block text-[13px] font-medium leading-snug ${
                            t.status === "done"
                              ? "text-text-muted line-through"
                              : "text-text-primary"
                          }`}
                        >
                          {t.title}
                        </span>
                        {t.phase_label ? (
                          <span className="mt-1 block text-[11px] text-text-muted truncate">
                            {t.phase_label}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
          );
        })}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex justify-end bg-black/20"
          onClick={() => setOpenId(null)}
        >
          <aside
            className="h-full w-full max-w-md bg-surface shadow-xl border-l border-border overflow-y-auto pb-[var(--os-bottom-nav)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-surface border-b border-border px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-text-muted">
                  {COLUMNS.find((c) => c.key === open.status)?.label || open.status}
                  {open.phase_label ? ` · ${open.phase_label}` : ""}
                </p>
                <h3 className="text-[16px] font-semibold text-text-primary mt-0.5">
                  {open.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="text-[12px] text-text-muted hover:text-text-primary px-2 py-1 rounded-md min-h-11"
              >
                Close
              </button>
            </div>
            <div className="p-4">
              {hasClientBrief(open) ? (
                <TaskContentEditor
                  key={open.id}
                  taskId={open.id}
                  initialContent={initialClientBlocksForTask(open)}
                  onSave={() => {}}
                  editable={false}
                  className="border-0 shadow-none"
                />
              ) : open.description?.trim() ? (
                <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {open.description}
                </p>
              ) : (
                <p className="text-[13px] text-text-muted">
                  Status updates as your account manager moves this work forward.
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
