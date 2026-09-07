"use client";

import React from "react";
import { generateUUID } from "@/lib/ci-builder/types";
import { useCanvas } from "../CiCanvasContext";
import { ModuleFigmaResync } from "../ModuleFigmaResync";
import { AddRow, Card, ImageWell, ModuleHero, SectionTitle, assetSrc } from "../ui";

export function EditUi() {
  const c = useCanvas();
  const buttons = ((c.sectionByType("ui_primary")?.data as any)?.variants || []) as {
    id: string;
    label: string;
    bg?: string;
    text?: string;
    border?: string;
    radius?: string;
    padding?: string;
    assetId?: string;
  }[];
  const forms = ((c.sectionByType("form_controls")?.data as any)?.controls || []) as {
    id: string;
    label: string;
    notes?: string;
    assetId?: string;
  }[];
  const badges = ((c.sectionByType("status_badges")?.data as any)?.badges ||
    (c.sectionByType("status_badges")?.data as any)?.swatches ||
    []) as { id: string; label?: string; name?: string; bg?: string; hex?: string; text?: string }[];
  const empty = (c.sectionByType("ui_empty_error")?.data || {}) as {
    emptyTitle?: string;
    emptyBody?: string;
    emptyAssetId?: string;
    errorTitle?: string;
    errorBody?: string;
    errorAssetId?: string;
    states?: { id: string; name?: string; message?: string; assetId?: string }[];
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <ModuleHero
        eyebrow="07 · UI Elements"
        title="UI Elements."
        blurb="Buttons, forms, badges, and empty/error states — live against saved data."
        editMode={c.editMode}
        onToggleEdit={() => c.setEditMode(!c.editMode)}
      />

      <ModuleFigmaResync moduleKey="ui" />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Buttons</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {buttons.map((b) => (
              <div key={b.id} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                {b.assetId ? (
                  <img src={assetSrc(c.assets, b.assetId)} alt={b.label} style={{ height: 40, objectFit: "contain" }} />
                ) : (
                  <button
                    type="button"
                    style={{
                      background: b.bg || "var(--tool-accent-primary)",
                      color: b.text || "#fff",
                      border: b.border ? `1px solid ${b.border}` : "none",
                      borderRadius: b.radius || 8,
                      padding: b.padding || "10px 18px",
                      fontSize: 14,
                    }}
                  >
                    {b.label}
                  </button>
                )}
                <input
                  className="field-input"
                  value={b.label}
                  onChange={(e) =>
                    void c.patchType("ui_primary", (d) => ({
                      ...d,
                      variants: (d.variants || []).map((v: any) =>
                        v.id === b.id ? { ...v, label: e.target.value } : v
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>
          {c.guideline?.id
            ? buttons.map((b) => (
                <div key={`well-${b.id}`} style={{ marginTop: 12 }}>
                  <span className="field-label">{b.label} capture</span>
                  <ImageWell
                    url={assetSrc(c.assets, b.assetId)}
                    guidelineId={c.guideline.id}
                    assets={c.assets}
                    onAddAsset={(a) => void c.addAsset(a)}
                    onSelect={(a) =>
                      void c.patchType("ui_primary", (d) => ({
                        ...d,
                        variants: (d.variants || []).map((v: any) =>
                          v.id === b.id ? { ...v, assetId: a.id } : v
                        ),
                      }))
                    }
                    size="100%"
                    label="Optional frame"
                  />
                </div>
              ))
            : null}
          <AddRow
            label="Add button"
            onClick={() =>
              void c.patchType("ui_primary", (d) => ({
                ...d,
                variants: [
                  ...(d.variants || []),
                  { id: generateUUID(), label: "Button", bg: "", text: "", assetId: "" },
                ],
              }))
            }
          />
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Form Controls</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {forms.map((f) => (
              <div key={f.id} style={{ minWidth: 180 }}>
                <span className="field-label">{f.label}</span>
                {f.assetId ? (
                  <img src={assetSrc(c.assets, f.assetId)} alt={f.label} style={{ width: "100%", borderRadius: 8 }} />
                ) : (
                  <input className="field-input" placeholder={f.label} readOnly />
                )}
                {c.guideline?.id ? (
                  <ImageWell
                    url={assetSrc(c.assets, f.assetId)}
                    guidelineId={c.guideline.id}
                    assets={c.assets}
                    onAddAsset={(a) => void c.addAsset(a)}
                    onSelect={(a) =>
                      void c.patchType("form_controls", (d) => ({
                        ...d,
                        controls: (d.controls || []).map((x: any) =>
                          x.id === f.id ? { ...x, assetId: a.id } : x
                        ),
                      }))
                    }
                    size="100%"
                    label="Capture"
                  />
                ) : null}
              </div>
            ))}
          </div>
          <AddRow
            label="Add form control"
            onClick={() =>
              void c.patchType("form_controls", (d) => ({
                ...d,
                controls: [...(d.controls || []), { id: generateUUID(), label: "Control", assetId: "", notes: "" }],
              }))
            }
          />
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Badges & Containers</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {badges.map((b) => (
              <span
                key={b.id}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: b.bg || b.hex || "var(--tool-surface-card)",
                  color: b.text || "var(--tool-text-primary)",
                  fontSize: 12,
                }}
              >
                {b.label || b.name || "Badge"}
              </span>
            ))}
          </div>
          <AddRow
            label="Add badge"
            onClick={() =>
              void c.patchType("status_badges", (d) => ({
                ...d,
                badges: [...(d.badges || []), { id: generateUUID(), label: "Badge", bg: "#323233", text: "#fff" }],
              }))
            }
          />
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Empty / Error</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <span className="field-label">Empty</span>
              <input
                className="field-input"
                placeholder="Title"
                value={empty.emptyTitle || ""}
                onChange={(e) => void c.patchType("ui_empty_error", (d) => ({ ...d, emptyTitle: e.target.value }))}
              />
              <textarea
                className="field-input"
                rows={3}
                style={{ resize: "vertical", marginTop: 8 }}
                placeholder="Body"
                value={empty.emptyBody || ""}
                onChange={(e) => void c.patchType("ui_empty_error", (d) => ({ ...d, emptyBody: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <span className="field-label">Error</span>
              <input
                className="field-input"
                placeholder="Title"
                value={empty.errorTitle || ""}
                onChange={(e) => void c.patchType("ui_empty_error", (d) => ({ ...d, errorTitle: e.target.value }))}
              />
              <textarea
                className="field-input"
                rows={3}
                style={{ resize: "vertical", marginTop: 8 }}
                placeholder="Body"
                value={empty.errorBody || ""}
                onChange={(e) => void c.patchType("ui_empty_error", (d) => ({ ...d, errorBody: e.target.value }))}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
