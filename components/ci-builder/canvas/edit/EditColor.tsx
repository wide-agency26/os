"use client";

import React, { useEffect, useState } from "react";
import { generateUUID } from "@/lib/ci-builder/types";
import { hexToRgb, hexToCmykToken, toHexColor, isCompleteHex } from "@/lib/ci-builder/color-utils";
import { COLOR_ROLE_OPTIONS } from "@/lib/ci-builder/canvas/lists";
import { getSubModule } from "@/lib/ci-builder/modules-catalog";
import { triggerToast } from "@/components/ci-builder/Toast";
import { useCanvas } from "../CiCanvasContext";
import { ModuleFigmaResync } from "../ModuleFigmaResync";
import { AddRow, Card, DrawerActions, DrawerShell, ModuleHero, RowActions, SectionTitle } from "../ui";

type FamilyData = {
  name?: string;
  tokenKey?: string;
  hex?: string;
  pantone?: string;
  proportion?: number;
  swatches?: { id: string; name: string; hex: string }[];
  scale?: { id: string; step: string; hex: string; contrastNote?: string }[];
};

function familyHex(data: FamilyData): string {
  const raw =
    data.hex ||
    data.swatches?.find((s) => (s as { isCanonical?: boolean }).isCanonical)?.hex ||
    data.swatches?.find((s) => s.hex)?.hex ||
    "";
  return isCompleteHex(raw) ? toHexColor(raw) : raw || "#000000";
}

export function EditColor() {
  const c = useCanvas();
  const families = c.sections.filter((s) => {
    const r = getSubModule(s.section_type || "")?.renderer;
    return r === "color_group" && s.section_type !== "functional";
  });
  const functional = c.sectionByType("functional");
  const status = ((functional?.data as FamilyData)?.swatches || []) as { id: string; name: string; hex: string }[];

  const bars = families
    .map((s) => {
      const d = (s.data || {}) as FamilyData;
      return { id: s.id!, name: d.name || s.headline || "Color", hex: familyHex(d), proportion: Number(d.proportion) || 0 };
    })
    .filter((b) => b.hex);
  const withPct = bars.filter((b) => b.proportion > 0);
  const displayBars =
    withPct.length > 0
      ? withPct
      : bars.slice(0, 3).map((b) => ({ ...b, proportion: bars.length ? 100 / Math.min(3, bars.length) : 0 }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <ModuleHero
        eyebrow="04 · Color Systems"
        title="Color Systems."
        blurb="Named families, computed RGB/CMYK, nested scale, and a status strip."
        editMode={c.editMode}
        onToggleEdit={() => c.setEditMode(!c.editMode)}
      />

      <ModuleFigmaResync moduleKey="color" />

      {displayBars.length > 0 ? (
        <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden" }}>
          {displayBars.map((b) => (
            <div key={b.id} style={{ width: `${b.proportion}%`, background: b.hex }} title={`${b.name} ${b.proportion}%`} />
          ))}
        </div>
      ) : null}

      {families.map((sec) => {
        const d = (sec.data || {}) as FamilyData;
        const hex = familyHex(d);
        const rgb = hexToRgb(hex);
        const rgbStr = d.swatches?.[0] && (sec.data as any)?.rgb ? String((sec.data as any).rgb) : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        const cmyk = String((sec.data as any)?.cmyk || hexToCmykToken(hex));
        return (
          <Card key={sec.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 20, fontWeight: 500 }}>{d.name || sec.headline || "Color family"}</span>
              <RowActions
                onEdit={() => c.openDrawer({ kind: "color", sectionId: sec.id! })}
                onDelete={() => {
                  if (sec.id) void c.removeSection(sec.id);
                }}
              />
            </div>
            <div
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(hex);
                  triggerToast("Copied hex");
                } catch {
                  /* ignore */
                }
              }}
              style={{
                height: 88,
                borderRadius: "var(--radius-m)",
                background: hex,
                cursor: "pointer",
                marginBottom: 12,
              }}
              title="Copy hex"
            />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "var(--tool-text-muted)" }}>
              <span>{hex}</span>
              <span>{rgbStr}</span>
              <span>{cmyk}</span>
              {d.tokenKey ? <span className="mono">{d.tokenKey}</span> : null}
              {d.pantone ? <span>{d.pantone}</span> : null}
              {d.proportion ? <span>{d.proportion}%</span> : null}
            </div>
            {d.scale && d.scale.length > 0 ? (
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                {d.scale.map((step) => (
                  <div
                    key={step.id}
                    onClick={() => c.openDrawer({ kind: "scale", sectionId: sec.id!, stepId: step.id })}
                    style={{ width: 48, textAlign: "center", cursor: "pointer" }}
                  >
                    <div style={{ height: 48, borderRadius: 6, background: step.hex }} />
                    <span style={{ fontSize: 10 }}>{step.step}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <AddRow
              label="Add scale step"
              onClick={() => c.openDrawer({ kind: "scale", sectionId: sec.id! })}
            />
          </Card>
        );
      })}

      <AddRow
        label="Add color family"
        onClick={() =>
          void c.insertSection("color_accent", {
            name: "New family",
            hex: "#888888",
            tokenKey: "",
            swatches: [{ id: generateUUID(), name: "New family", hex: "#888888" }],
            scale: [],
          })
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>System / Status</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {status.map((s) => (
              <div key={s.id} style={{ width: 72 }}>
                <div style={{ height: 40, borderRadius: 6, background: s.hex }} />
                <span style={{ fontSize: 11 }}>{s.name}</span>
              </div>
            ))}
          </div>
          <AddRow
            label="Add status color"
            onClick={() =>
              void c.patchType("functional", (d) => ({
                ...d,
                swatches: [
                  ...(d.swatches || []),
                  { id: generateUUID(), name: "Status", hex: "#2ad867" },
                ],
              }))
            }
          />
        </Card>
      </div>
      <ColorDrawers />
    </div>
  );
}

function ColorDrawers() {
  const c = useCanvas();
  const colorDrawer = c.drawer?.kind === "color" ? c.drawer : null;
  const scaleDrawer = c.drawer?.kind === "scale" ? c.drawer : null;
  const sec = colorDrawer
    ? c.sections.find((s) => s.id === colorDrawer.sectionId)
    : scaleDrawer
      ? c.sections.find((s) => s.id === scaleDrawer.sectionId)
      : null;
  const d = (sec?.data || {}) as FamilyData;

  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [hex, setHex] = useState("#000000");
  const [pantone, setPantone] = useState("");
  const [pct, setPct] = useState("0");
  const [step, setStep] = useState("500");
  const [stepHex, setStepHex] = useState("#000000");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!colorDrawer || !sec) return;
    setName(d.name || sec.headline || "");
    setToken(d.tokenKey || "");
    setHex(familyHex(d));
    setPantone(d.pantone || "");
    setPct(String(d.proportion || 0));
  }, [colorDrawer?.sectionId, d.name, d.tokenKey, d.hex, d.pantone, d.proportion]);

  useEffect(() => {
    if (!scaleDrawer) return;
    const hit = (d.scale || []).find((s) => s.id === scaleDrawer.stepId);
    setStep(hit?.step || "500");
    setStepHex(hit?.hex || "#000000");
    setNote(hit?.contrastNote || "");
  }, [scaleDrawer?.sectionId, scaleDrawer?.stepId, d.scale]);

  if (colorDrawer && sec?.id) {
    const rgb = hexToRgb(isCompleteHex(hex) ? toHexColor(hex) : hex);
    const cmyk = hexToCmykToken(hex);
    return (
      <DrawerShell title="Edit color family" onClose={c.closeDrawer}>
        <div>
          <span className="field-label">Name</span>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <span className="field-label">Role / Token Key</span>
          <select className="field-select" value={token} onChange={(e) => setToken(e.target.value)}>
            {COLOR_ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="field-label">Hex</span>
          <input className="field-input" value={hex} onChange={(e) => setHex(e.target.value)} />
        </div>
        <div className="field-row">
          <div>
            <span className="field-label">RGB (computed)</span>
            <input className="field-input" readOnly value={`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`} />
          </div>
          <div>
            <span className="field-label">CMYK (computed)</span>
            <input className="field-input" readOnly value={cmyk} />
          </div>
        </div>
        <div>
          <span className="field-label">Pantone</span>
          <input className="field-input" value={pantone} onChange={(e) => setPantone(e.target.value)} />
        </div>
        <div>
          <span className="field-label">Usage %</span>
          <input className="field-input" type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        <DrawerActions
          onCancel={c.closeDrawer}
          onSave={() => {
            const nextHex = isCompleteHex(hex) ? toHexColor(hex) : hex;
            const rgbV = hexToRgb(nextHex);
            const existing = Array.isArray(d.swatches) ? d.swatches.slice() : [];
            const heroId = existing.find((s) => (s as { isCanonical?: boolean }).isCanonical)?.id || existing[0]?.id || generateUUID();
            const mergedSwatches =
              existing.length > 0
                ? existing.map((s) =>
                    s.id === heroId
                      ? {
                          ...s,
                          name,
                          hex: nextHex,
                          isCanonical: true,
                          proportion: Number(pct) || 0,
                          cssVar: token,
                        }
                      : { ...s, isCanonical: false }
                  )
                : [
                    {
                      id: heroId,
                      name,
                      hex: nextHex,
                      isCanonical: true,
                      proportion: Number(pct) || 0,
                      cssVar: token,
                    },
                  ];
            c.patchSectionData(sec.id!, {
              ...d,
              name,
              tokenKey: token,
              hex: nextHex,
              rgb: `rgb(${rgbV.r}, ${rgbV.g}, ${rgbV.b})`,
              cmyk: hexToCmykToken(nextHex),
              pantone,
              proportion: Number(pct) || 0,
              swatches: mergedSwatches,
              scale: Array.isArray(d.scale) ? d.scale : [],
            });
            c.closeDrawer();
          }}
        />
      </DrawerShell>
    );
  }

  if (scaleDrawer && sec?.id) {
    return (
      <DrawerShell title={scaleDrawer.stepId ? "Edit scale step" : "Add scale step"} onClose={c.closeDrawer}>
        <div>
          <span className="field-label">Step</span>
          <input className="field-input" value={step} onChange={(e) => setStep(e.target.value)} />
        </div>
        <div>
          <span className="field-label">Hex</span>
          <input className="field-input" value={stepHex} onChange={(e) => setStepHex(e.target.value)} />
        </div>
        <div>
          <span className="field-label">Contrast Note</span>
          <input className="field-input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DrawerActions
          onCancel={c.closeDrawer}
          onDelete={
            scaleDrawer.stepId
              ? () => {
                  const scale = Array.isArray(d.scale) ? d.scale.slice() : [];
                  c.patchSectionData(sec.id!, {
                    ...d,
                    scale: scale.filter((s) => s.id !== scaleDrawer.stepId),
                  });
                  c.closeDrawer();
                }
              : undefined
          }
          deleteLabel="Delete step"
          onSave={() => {
            const scale = Array.isArray(d.scale) ? d.scale.slice() : [];
            if (scaleDrawer.stepId) {
              c.patchSectionData(sec.id!, {
                ...d,
                scale: scale.map((s) =>
                  s.id === scaleDrawer.stepId ? { ...s, step, hex: stepHex, contrastNote: note } : s
                ),
              });
            } else {
              c.patchSectionData(sec.id!, {
                ...d,
                scale: [...scale, { id: generateUUID(), step, hex: stepHex, contrastNote: note }],
              });
            }
            c.closeDrawer();
          }}
        />
      </DrawerShell>
    );
  }

  return null;
}
