"use client";

import React, { useState } from "react";
import { KeyedListEditor, blankKeyedRow, type KeyedRow } from "./KeyedListEditor";
import { SidePanelShell, PanelField, panelInputClass } from "./SidePanelShell";

export type PairedItem = KeyedRow & {
  text: string;
  side: "left" | "right";
  imageAssetId?: string;
  caption?: string;
};

/**
 * Two parallel lists (Do/Don't, On/Off-brand). Toggle moves the row between lists.
 */
export function PairedListEditor({
  left,
  right,
  leftLabel = "Do",
  rightLabel = "Don't",
  onChange,
  isAdmin = true,
  withPhoto = false,
}: {
  left: PairedItem[];
  right: PairedItem[];
  leftLabel?: string;
  rightLabel?: string;
  onChange: (next: { left: PairedItem[]; right: PairedItem[] }) => void;
  isAdmin?: boolean;
  withPhoto?: boolean;
}) {
  const [editing, setEditing] = useState<PairedItem | null>(null);

  const all = [...left.map((i) => ({ ...i, side: "left" as const })), ...right.map((i) => ({ ...i, side: "right" as const }))];

  const commit = (item: PairedItem) => {
    const others = all.filter((x) => x.id !== item.id);
    const nextLeft: PairedItem[] = others
      .filter((x) => x.side === "left")
      .map((x) => ({ ...x, side: "left" as const }));
    const nextRight: PairedItem[] = others
      .filter((x) => x.side === "right")
      .map((x) => ({ ...x, side: "right" as const }));
    if (item.side === "left") nextLeft.push({ ...item, side: "left" });
    else nextRight.push({ ...item, side: "right" });
    onChange({ left: nextLeft, right: nextRight });
    setEditing(null);
  };

  const renderCol = (side: "left" | "right", items: PairedItem[], label: string) => (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ci-text-muted,#666)]">
        {label}
      </div>
      <KeyedListEditor
        items={items}
        isAdmin={isAdmin}
        addLabel={`Add ${label.toLowerCase()}`}
        createBlank={() =>
          blankKeyedRow({
            text: "",
            side,
            imageAssetId: "",
            caption: "",
          }) as PairedItem
        }
        onChange={(next) => {
          if (side === "left") onChange({ left: next, right });
          else onChange({ left, right: next });
        }}
        renderItem={(item) => (
          <button
            type="button"
            className="w-full text-left text-sm"
            onClick={() => isAdmin && setEditing(item)}
          >
            {item.text || <span className="text-[var(--ci-text-muted,#999)]">Untitled</span>}
            {withPhoto && item.caption ? (
              <span className="mt-1 block text-xs text-[var(--ci-text-muted,#888)]">{item.caption}</span>
            ) : null}
          </button>
        )}
      />
    </div>
  );

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        {renderCol("left", left, leftLabel)}
        {renderCol("right", right, rightLabel)}
      </div>
      <SidePanelShell
        open={!!editing}
        title={`Edit ${editing?.side === "left" ? leftLabel : rightLabel}`}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <>
            <PanelField label="Type">
              <div className="flex gap-2 rounded-lg bg-black/5 p-1">
                {(["left", "right"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    className={`flex-1 rounded-md px-3 py-2 text-sm ${
                      editing.side === side
                        ? "bg-[var(--ci-accent,#4c3e5e)] text-white"
                        : "text-[var(--ci-text-muted,#666)]"
                    }`}
                    onClick={() => setEditing({ ...editing, side })}
                  >
                    {side === "left" ? leftLabel : rightLabel}
                  </button>
                ))}
              </div>
            </PanelField>
            <PanelField label="Text">
              <textarea
                className={panelInputClass}
                rows={4}
                value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
              />
            </PanelField>
            {withPhoto ? (
              <PanelField label="Caption">
                <input
                  className={panelInputClass}
                  value={editing.caption || ""}
                  onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                />
              </PanelField>
            ) : null}
            <button
              type="button"
              className="rounded-lg bg-[var(--ci-accent,#4c3e5e)] px-4 py-2.5 text-sm font-semibold text-white"
              onClick={() => commit(editing)}
            >
              Save
            </button>
          </>
        ) : null}
      </SidePanelShell>
    </>
  );
}
