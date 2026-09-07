"use client";

import React, { useState } from "react";
import { KeyedListEditor, blankKeyedRow } from "./KeyedListEditor";
import { SidePanelShell, PanelField, panelInputClass } from "./SidePanelShell";
import type { CiLinkItem, CiTokenScaleItem, CiLogoMark, CiTypeScaleRole } from "@/lib/ci-builder/types";
import { enrichSwatch } from "@/lib/ci-builder/view-model";
import type { ColorSwatch } from "@/lib/ci-builder/types";
import { CopyableValue } from "@/components/ci-builder/primitives/CopyableValue";

const TYPE_ROLES: Array<{ id: CiTypeScaleRole | ""; label: string }> = [
  { id: "", label: "None" },
  { id: "heading-primary", label: "heading-primary" },
  { id: "heading-secondary", label: "heading-secondary" },
  { id: "heading-tertiary", label: "heading-tertiary" },
  { id: "copy-body", label: "copy-body" },
  { id: "copy-caption", label: "copy-caption" },
  { id: "surface-neutral", label: "surface-neutral" },
];

export function LinkListPanel({
  links,
  onChange,
  isAdmin = true,
}: {
  links: CiLinkItem[];
  onChange: (next: CiLinkItem[]) => void;
  isAdmin?: boolean;
}) {
  const [editing, setEditing] = useState<CiLinkItem | null>(null);
  return (
    <>
      <KeyedListEditor
        items={links}
        isAdmin={isAdmin}
        addLabel="Add link"
        createBlank={() => blankKeyedRow({ label: "", url: "" })}
        onChange={onChange}
        renderItem={(item) => (
          <button type="button" className="w-full text-left text-sm" onClick={() => isAdmin && setEditing(item)}>
            <span className="font-medium">{item.label || "Untitled"}</span>
            <span className="mt-0.5 block truncate text-xs text-[var(--ci-text-muted,#888)]">
              {item.url || "—"}
            </span>
          </button>
        )}
      />
      <SidePanelShell open={!!editing} title="Edit link" onClose={() => setEditing(null)}>
        {editing ? (
          <>
            <PanelField label="Label">
              <input
                className={panelInputClass}
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              />
            </PanelField>
            <PanelField label="URL">
              <input
                className={panelInputClass}
                value={editing.url}
                placeholder="https://…"
                onChange={(e) => setEditing({ ...editing, url: e.target.value })}
              />
            </PanelField>
            <button
              type="button"
              className="rounded-lg bg-[var(--ci-accent,#4c3e5e)] px-4 py-2.5 text-sm font-semibold text-white"
              onClick={() => {
                onChange(links.map((l) => (l.id === editing.id ? editing : l)));
                setEditing(null);
              }}
            >
              Save
            </button>
          </>
        ) : null}
      </SidePanelShell>
    </>
  );
}

export function TokenScalePanel({
  tokens,
  onChange,
  isAdmin = true,
  previewKind = "spacing",
}: {
  tokens: CiTokenScaleItem[];
  onChange: (next: CiTokenScaleItem[]) => void;
  isAdmin?: boolean;
  previewKind?: "spacing" | "radius";
}) {
  const [editing, setEditing] = useState<CiTokenScaleItem | null>(null);
  return (
    <>
      <KeyedListEditor
        items={tokens}
        isAdmin={isAdmin}
        addLabel="Add token"
        createBlank={() => blankKeyedRow({ label: "", value: "", preview: "" })}
        onChange={onChange}
        renderItem={(item) => (
          <button
            type="button"
            className="flex w-full items-center gap-3 text-left text-sm"
            onClick={() => isAdmin && setEditing(item)}
          >
            <span
              className="shrink-0 rounded bg-[var(--ci-accent,#4c3e5e)]/15"
              style={
                previewKind === "radius"
                  ? { width: 36, height: 36, borderRadius: item.value || "0" }
                  : { width: Math.min(64, parseInt(item.value || "8", 10) || 8), height: 12 }
              }
            />
            <span>
              <span className="font-mono text-xs">{item.label || "token"}</span>
              <span className="mt-0.5 block text-[var(--ci-text-muted,#888)]">{item.value || "—"}</span>
            </span>
          </button>
        )}
      />
      <SidePanelShell open={!!editing} title="Edit token" onClose={() => setEditing(null)}>
        {editing ? (
          <>
            <PanelField label="Label">
              <input
                className={panelInputClass}
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              />
            </PanelField>
            <PanelField label="Value">
              <input
                className={panelInputClass}
                value={editing.value}
                placeholder="16px"
                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
              />
            </PanelField>
            <button
              type="button"
              className="rounded-lg bg-[var(--ci-accent,#4c3e5e)] px-4 py-2.5 text-sm font-semibold text-white"
              onClick={() => {
                onChange(tokens.map((t) => (t.id === editing.id ? editing : t)));
                setEditing(null);
              }}
            >
              Save
            </button>
          </>
        ) : null}
      </SidePanelShell>
    </>
  );
}

export function ColorSwatchPanel({
  swatches,
  onChange,
  isAdmin = true,
}: {
  swatches: ColorSwatch[];
  onChange: (next: ColorSwatch[]) => void;
  isAdmin?: boolean;
}) {
  const [editing, setEditing] = useState<ColorSwatch | null>(null);
  return (
    <>
      <KeyedListEditor
        items={swatches}
        isAdmin={isAdmin}
        addLabel="Add swatch"
        createBlank={() =>
          blankKeyedRow({
            name: "",
            hex: "#000000",
            proportion: null,
          }) as ColorSwatch
        }
        onChange={onChange}
        renderItem={(item) => {
          const enriched = enrichSwatch(item);
          return (
            <button
              type="button"
              className="flex w-full items-center gap-3 text-left"
              onClick={() => isAdmin && setEditing(item)}
            >
              <span
                className="h-10 w-10 shrink-0 rounded-lg border border-black/10"
                style={{ background: enriched.hex }}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.name || "Untitled"}</span>
                <span className="font-mono text-xs text-[var(--ci-text-muted,#888)]">
                  {enriched.hex}
                  {typeof item.proportion === "number" ? ` · ${item.proportion}%` : ""}
                </span>
              </span>
            </button>
          );
        }}
      />
      <SidePanelShell open={!!editing} title="Edit color" onClose={() => setEditing(null)} widthClass="w-[400px]">
        {editing ? (
          <>
            <PanelField label="Name">
              <input
                className={panelInputClass}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </PanelField>
            <PanelField label="Hex">
              <input
                className={panelInputClass}
                value={editing.hex}
                onChange={(e) => {
                  const hex = e.target.value;
                  const enriched = enrichSwatch({ ...editing, hex });
                  setEditing({
                    ...editing,
                    hex,
                    rgb: enriched.rgbComputed,
                    cmyk: enriched.cmykComputed,
                  });
                }}
              />
            </PanelField>
            {(() => {
              const e = enrichSwatch(editing);
              return (
                <div className="space-y-2 text-sm">
                  <CopyableValue label="RGB" value={e.rgbComputed} />
                  <CopyableValue label="CMYK" value={e.cmykComputed} />
                  <CopyableValue label="HEX" value={e.hex} />
                </div>
              );
            })()}
            <PanelField label="Usage proportion (0–100, optional)">
              <input
                type="number"
                min={0}
                max={100}
                className={panelInputClass}
                value={editing.proportion ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    proportion: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </PanelField>
            <button
              type="button"
              className="rounded-lg bg-[var(--ci-accent,#4c3e5e)] px-4 py-2.5 text-sm font-semibold text-white"
              onClick={() => {
                const enriched = enrichSwatch(editing);
                onChange(
                  swatches.map((s) =>
                    s.id === editing.id
                      ? {
                          ...editing,
                          hex: enriched.hex,
                          rgb: enriched.rgbComputed,
                          cmyk: enriched.cmykComputed,
                        }
                      : s
                  )
                );
                setEditing(null);
              }}
            >
              Save
            </button>
          </>
        ) : null}
      </SidePanelShell>
    </>
  );
}

export function TypeScaleRowPanel({
  rows,
  onChange,
  isAdmin = true,
}: {
  rows: Array<{
    id: string;
    token: string;
    role?: string;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    value?: string;
    lineHeight?: string;
    letterSpacing?: string;
    textTransform?: string;
    textAlign?: string;
    colorToken?: string;
  }>;
  onChange: (next: typeof rows) => void;
  isAdmin?: boolean;
}) {
  type Row = (typeof rows)[number];
  const [editing, setEditing] = useState<Row | null>(null);
  return (
    <>
      <KeyedListEditor
        items={rows}
        isAdmin={isAdmin}
        addLabel="Add type style"
        createBlank={() =>
          blankKeyedRow({
            token: "",
            role: "",
            fontFamily: "",
            fontWeight: "400",
            fontStyle: "normal",
            value: "16px",
            lineHeight: "1.4",
            letterSpacing: "0",
            textTransform: "none",
            textAlign: "left",
            colorToken: "",
          })
        }
        onChange={onChange}
        renderItem={(item) => (
          <button type="button" className="w-full text-left" onClick={() => isAdmin && setEditing(item)}>
            <span className="font-mono text-xs text-[var(--ci-text-muted,#888)]">
              {item.token || "style"}
              {item.role ? ` · ${item.role}` : ""}
            </span>
            <span
              className="mt-1 block truncate"
              style={{
                fontFamily: item.fontFamily || "inherit",
                fontWeight: item.fontWeight || 400,
                fontSize: Math.min(28, parseFloat(item.value || "16") || 16),
              }}
            >
              {item.token || "Aa"}
            </span>
          </button>
        )}
      />
      <SidePanelShell open={!!editing} title="Edit type style" onClose={() => setEditing(null)} widthClass="w-[400px]">
        {editing ? (
          <>
            <PanelField label="Style name">
              <input
                className={panelInputClass}
                value={editing.token}
                onChange={(e) => setEditing({ ...editing, token: e.target.value })}
              />
            </PanelField>
            <PanelField label="Role / token key">
              <select
                className={panelInputClass}
                value={editing.role || ""}
                onChange={(e) => setEditing({ ...editing, role: e.target.value })}
              >
                {TYPE_ROLES.map((r) => (
                  <option key={r.id || "none"} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </PanelField>
            <div className="grid grid-cols-2 gap-3">
              <PanelField label="Font family">
                <input
                  className={panelInputClass}
                  value={editing.fontFamily || ""}
                  onChange={(e) => setEditing({ ...editing, fontFamily: e.target.value })}
                />
              </PanelField>
              <PanelField label="Weight">
                <input
                  className={panelInputClass}
                  value={editing.fontWeight || ""}
                  onChange={(e) => setEditing({ ...editing, fontWeight: e.target.value })}
                />
              </PanelField>
              <PanelField label="Size">
                <input
                  className={panelInputClass}
                  value={editing.value || ""}
                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                />
              </PanelField>
              <PanelField label="Line height">
                <input
                  className={panelInputClass}
                  value={editing.lineHeight || ""}
                  onChange={(e) => setEditing({ ...editing, lineHeight: e.target.value })}
                />
              </PanelField>
              <PanelField label="Letter spacing">
                <input
                  className={panelInputClass}
                  value={editing.letterSpacing || ""}
                  onChange={(e) => setEditing({ ...editing, letterSpacing: e.target.value })}
                />
              </PanelField>
              <PanelField label="Transform">
                <input
                  className={panelInputClass}
                  value={editing.textTransform || ""}
                  onChange={(e) => setEditing({ ...editing, textTransform: e.target.value })}
                />
              </PanelField>
            </div>
            <button
              type="button"
              className="rounded-lg bg-[var(--ci-accent,#4c3e5e)] px-4 py-2.5 text-sm font-semibold text-white"
              onClick={() => {
                onChange(rows.map((r) => (r.id === editing.id ? editing : r)));
                setEditing(null);
              }}
            >
              Save
            </button>
          </>
        ) : null}
      </SidePanelShell>
    </>
  );
}

export function LogoMarksPanel({
  marks,
  onChange,
  isAdmin = true,
}: {
  marks: CiLogoMark[];
  onChange: (next: CiLogoMark[]) => void;
  isAdmin?: boolean;
}) {
  const [editing, setEditing] = useState<CiLogoMark | null>(null);
  return (
    <>
      <KeyedListEditor
        items={marks}
        isAdmin={isAdmin}
        addLabel="Add mark"
        createBlank={() =>
          blankKeyedRow({
            name: "",
            isMain: false,
            lightAssetId: "",
            darkAssetId: "",
            sortOrder: marks.length,
          }) as CiLogoMark
        }
        onChange={onChange}
        renderItem={(item) => (
          <button type="button" className="w-full text-left text-sm" onClick={() => isAdmin && setEditing(item)}>
            <span className="font-medium">
              {item.name || "Untitled mark"}
              {item.isMain ? (
                <span className="ml-2 rounded bg-[var(--ci-accent,#4c3e5e)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Main
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-xs text-[var(--ci-text-muted,#888)]">
              Light {item.lightAssetId ? "✓" : "—"} · Dark {item.darkAssetId ? "✓" : "—"}
            </span>
          </button>
        )}
      />
      <SidePanelShell open={!!editing} title="Edit logo mark" onClose={() => setEditing(null)}>
        {editing ? (
          <>
            <PanelField label="Name">
              <input
                className={panelInputClass}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </PanelField>
            <PanelField label="MAIN flag">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!editing.isMain}
                  onChange={(e) => setEditing({ ...editing, isMain: e.target.checked })}
                />
                Use as primary / MAIN lockup
              </label>
            </PanelField>
            <PanelField label="Light asset id">
              <input
                className={panelInputClass}
                value={editing.lightAssetId || ""}
                onChange={(e) => setEditing({ ...editing, lightAssetId: e.target.value })}
              />
            </PanelField>
            <PanelField label="Dark asset id">
              <input
                className={panelInputClass}
                value={editing.darkAssetId || ""}
                onChange={(e) => setEditing({ ...editing, darkAssetId: e.target.value })}
              />
            </PanelField>
            <button
              type="button"
              className="rounded-lg bg-[var(--ci-accent,#4c3e5e)] px-4 py-2.5 text-sm font-semibold text-white"
              onClick={() => {
                let next = marks.map((m) => (m.id === editing.id ? editing : m));
                if (editing.isMain) {
                  next = next.map((m) =>
                    m.id === editing.id ? { ...m, isMain: true } : { ...m, isMain: false }
                  );
                }
                onChange(next);
                setEditing(null);
              }}
            >
              Save
            </button>
          </>
        ) : null}
      </SidePanelShell>
    </>
  );
}
