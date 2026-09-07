"use client";

import React, { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { generateUUID } from "@/lib/ci-builder/types";

export type KeyedRow = { id: string } & Record<string, unknown>;

/**
 * Drag-reorderable list with **blank-add** contract.
 * Never clones the last item — `createBlank` always supplies a fresh row.
 */
export function KeyedListEditor<T extends KeyedRow>({
  items,
  onChange,
  createBlank,
  renderItem,
  addLabel = "Add",
  isAdmin = true,
  emptyHint,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  /** Must return a brand-new blank row (with unique id). Never clone last. */
  createBlank: () => T;
  renderItem: (item: T, index: number, helpers: {
    update: (patch: Partial<T>) => void;
    remove: () => void;
  }) => React.ReactNode;
  addLabel?: string;
  isAdmin?: boolean;
  emptyHint?: string;
}) {
  const [dragId, setDragId] = useState<string | null>(null);

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const next = [...items];
    const from = next.findIndex((i) => i.id === fromId);
    const to = next.findIndex((i) => i.id === toId);
    if (from < 0 || to < 0) return;
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  };

  if (!isAdmin) {
    return (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id}>{renderItem(item, index, { update: () => {}, remove: () => {} })}</div>
        ))}
        {!items.length && emptyHint ? (
          <p className="text-sm text-[var(--ci-text-muted,#666)]">{emptyHint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => setDragId(item.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) reorder(dragId, item.id);
              setDragId(null);
            }}
            className={`flex items-start gap-2 rounded-xl border border-[var(--ci-border,#eaeaea)] bg-[var(--ci-surface,#fff)] p-3 ${
              dragId === item.id ? "opacity-40" : ""
            }`}
          >
            <span className="mt-1 cursor-grab text-[var(--ci-text-muted,#999)]" aria-hidden>
              <GripVertical className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              {renderItem(item, index, {
                update: (patch) =>
                  onChange(
                    items.map((row) =>
                      row.id === item.id ? ({ ...row, ...patch } as T) : row
                    )
                  ),
                remove: () => onChange(items.filter((row) => row.id !== item.id)),
              })}
            </div>
            <button
              type="button"
              onClick={() => onChange(items.filter((row) => row.id !== item.id))}
              className="rounded-md p-1 text-[var(--ci-text-muted,#666)] hover:bg-red-50 hover:text-red-600"
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {!items.length && emptyHint ? (
        <p className="text-sm text-[var(--ci-text-muted,#666)]">{emptyHint}</p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          const blank = createBlank();
          if (!blank.id) blank.id = generateUUID();
          onChange([...items, blank]);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--ci-border,#ccc)] px-3 py-2 text-sm text-[var(--ci-text-muted,#555)] hover:border-[var(--ci-accent,#70657e)] hover:text-[var(--ci-text,#111)]"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}

/** Helper for blank keyed rows. */
export function blankKeyedRow<T extends Record<string, unknown>>(
  fields: T
): T & { id: string } {
  return { id: generateUUID(), ...fields };
}
