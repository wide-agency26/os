"use client";

import React, { useEffect, useState } from "react";
import { generateUUID } from "@/lib/ci-builder/types";
import type { CiTokenScaleItem } from "@/lib/ci-builder/types";
import { useCanvas } from "../CiCanvasContext";
import { ModuleFigmaResync } from "../ModuleFigmaResync";
import { AddRow, Card, DrawerActions, DrawerShell, ModuleHero, RowActions, SectionTitle } from "../ui";

function tokensOf(data: any): CiTokenScaleItem[] {
  if (Array.isArray(data?.tokens)) return data.tokens;
  const scale = data?.scale;
  if (scale && typeof scale === "object" && !Array.isArray(scale)) {
    return Object.entries(scale).map(([label, value]) => ({
      id: label,
      label,
      value: `${value}px`,
    }));
  }
  return [];
}

export function EditTokens() {
  const c = useCanvas();
  const spacing = tokensOf(c.sectionByType("spacing_system")?.data);
  const radius = tokensOf(c.sectionByType("radius_system")?.data);
  const grid = (c.sectionByType("layout_grids")?.data || {}) as {
    columns?: number;
    gutters?: number;
    margins?: number;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <ModuleHero
        eyebrow="06 · Design Tokens"
        title="Design Tokens."
        blurb="Spacing, radius, and an editable layout grid used by every View template."
        editMode={c.editMode}
        onToggleEdit={() => c.setEditMode(!c.editMode)}
      />

      <ModuleFigmaResync moduleKey="tokens" />

      <TokenList
        title="Spacing"
        tokens={spacing}
        which="spacing"
        onAdd={() => c.openDrawer({ kind: "token", which: "spacing" })}
      />
      <TokenList
        title="Radius"
        tokens={radius}
        which="radius"
        onAdd={() => c.openDrawer({ kind: "token", which: "radius" })}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Layout Grid</SectionTitle>
        <Card>
          <div className="field-row">
            <div>
              <span className="field-label">Columns</span>
              <input
                className="field-input"
                type="number"
                value={grid.columns ?? 12}
                onChange={(e) => void c.patchType("layout_grids", (d) => ({ ...d, columns: Number(e.target.value) }))}
              />
            </div>
            <div>
              <span className="field-label">Gutter (px)</span>
              <input
                className="field-input"
                type="number"
                value={grid.gutters ?? 24}
                onChange={(e) => void c.patchType("layout_grids", (d) => ({ ...d, gutters: Number(e.target.value) }))}
              />
            </div>
            <div>
              <span className="field-label">Margin (px)</span>
              <input
                className="field-input"
                type="number"
                value={grid.margins ?? 32}
                onChange={(e) => void c.patchType("layout_grids", (d) => ({ ...d, margins: Number(e.target.value) }))}
              />
            </div>
          </div>
          <GridPreview columns={Number(grid.columns) || 12} gutter={Number(grid.gutters) || 24} />
        </Card>
      </div>
      <TokenDrawer />
    </div>
  );
}

function TokenList({
  title,
  tokens,
  which,
  onAdd,
}: {
  title: string;
  tokens: CiTokenScaleItem[];
  which: "spacing" | "radius";
  onAdd: () => void;
}) {
  const c = useCanvas();
  const type = which === "spacing" ? "spacing_system" : "radius_system";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionTitle>{title}</SectionTitle>
      <Card>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {tokens.map((t) => (
            <div key={t.id} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 72 }}>
              <div
                style={{
                  width: which === "radius" ? 48 : Math.min(80, parseInt(String(t.value), 10) || 16),
                  height: which === "radius" ? 48 : 16,
                  background: "var(--tool-accent-primary)",
                  borderRadius: which === "radius" ? t.value : 2,
                }}
              />
              <span className="mono" style={{ fontSize: 11 }}>
                {t.label} {t.value}
              </span>
              <RowActions
                onEdit={() => c.openDrawer({ kind: "token", which, tokenId: t.id })}
                onDelete={() =>
                  void c.patchType(type, (d) => ({
                    ...d,
                    tokens: tokensOf(d).filter((x) => x.id !== t.id),
                  }))
                }
              />
            </div>
          ))}
        </div>
        <AddRow label={`Add ${title.toLowerCase()} token`} onClick={onAdd} />
      </Card>
    </div>
  );
}

function GridPreview({ columns, gutter }: { columns: number; gutter: number }) {
  return (
    <div style={{ display: "flex", gap: gutter, marginTop: 20, height: 80 }}>
      {Array.from({ length: Math.min(columns, 16) }).map((_, i) => (
        <div key={i} style={{ flex: 1, background: "var(--tool-overlay-soft)", borderRadius: 2 }} />
      ))}
    </div>
  );
}

function TokenDrawer() {
  const c = useCanvas();
  const d = c.drawer?.kind === "token" ? c.drawer : null;
  const type = d?.which === "radius" ? "radius_system" : "spacing_system";
  const tokens = tokensOf(c.sectionByType(type)?.data);
  const current = d?.tokenId ? tokens.find((t) => t.id === d.tokenId) : null;
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("16");

  useEffect(() => {
    if (!d) return;
    setLabel(current?.label || "");
    setValue(String(parseInt(String(current?.value || "16"), 10) || 16));
  }, [d?.which, d?.tokenId, current?.label, current?.value]);

  if (!d) return null;
  return (
    <DrawerShell title={d.tokenId ? "Edit token" : "Add token"} onClose={c.closeDrawer}>
      <div>
        <span className="field-label">Name</span>
        <input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div>
        <span className="field-label">Value (px)</span>
        <input className="field-input" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <DrawerActions
        onCancel={c.closeDrawer}
        onSave={() => {
          void c.patchType(type, (data) => {
            const prev = tokensOf(data);
            const row = { id: d.tokenId || generateUUID(), label, value: `${Number(value) || 0}px` };
            if (d.tokenId) return { ...data, tokens: prev.map((t) => (t.id === d.tokenId ? row : t)) };
            return { ...data, tokens: [...prev, row] };
          });
          c.closeDrawer();
        }}
      />
    </DrawerShell>
  );
}
