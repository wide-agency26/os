"use client";

import React, { useEffect, useState } from "react";
import type { TypeScaleEntry } from "@/lib/ci-builder/types";
import { generateUUID } from "@/lib/ci-builder/types";
import { PROTOTYPE_FONTS, TYPE_ROLE_OPTIONS } from "@/lib/ci-builder/canvas/lists";
import { useCanvas } from "../CiCanvasContext";
import { ModuleFigmaResync } from "../ModuleFigmaResync";
import { AddRow, Card, DrawerActions, DrawerShell, ModuleHero, RowActions, SectionTitle } from "../ui";
import { DownloadLinks } from "./EditLogo";
import { useLinkDrawer } from "../CiCanvasDrawers";

function scaleOf(data: any): TypeScaleEntry[] {
  return Array.isArray(data?.scale) ? data.scale : [];
}

export function EditType() {
  const c = useCanvas();
  const sec = c.sectionByType("typography_scale");
  const linksSec = c.sectionByType("type_download_links");
  const scale = scaleOf(sec?.data);
  const fonts = Array.from(
    new Set([...(c.theme.availableFonts || []), ...PROTOTYPE_FONTS, ...scale.map((r) => r.fontFamily || "")].filter(Boolean))
  );
  const primary = scale.find((r) => r.role === "heading-primary");
  const linkDrawer = useLinkDrawer();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <ModuleHero
        eyebrow="05 · Typography"
        title="Typography."
        blurb="One type scale. Role keys drive every View template. Primary typeface is heading-primary only."
        editMode={c.editMode}
        onToggleEdit={() => c.setEditMode(!c.editMode)}
      />

      <ModuleFigmaResync moduleKey="type" />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="field-label">Primary Typeface</span>
        <span style={{ fontSize: 28, fontWeight: 600 }}>{primary?.fontFamily || "not set"}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Type Scale</SectionTitle>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {scale.map((row) => (
              <div key={row.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: row.fontFamily || "var(--font-primary)",
                      fontWeight: row.fontWeight || 400,
                      fontStyle: row.fontStyle || "normal",
                      fontSize: row.value || (row.px ? `${row.px}px` : 32),
                      lineHeight: row.lineHeight || 1.1,
                      letterSpacing: row.letterSpacing,
                      textTransform: (row.textTransform as any) || "none",
                      textAlign: (row.align as any) || "left",
                    }}
                  >
                    {row.name || row.token || "Aa"}
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: "var(--tool-text-muted)" }}>
                    {row.role || "no role"} · {row.fontFamily} · {row.value || `${row.px}px`}
                  </span>
                </div>
                <RowActions
                  onEdit={() => c.openDrawer({ kind: "type", rowId: row.id })}
                  onDup={() =>
                    void c.patchType("typography_scale", (d) => ({
                      ...d,
                      scale: [...scaleOf(d), { ...row, id: generateUUID(), role: "" }],
                    }))
                  }
                  onDelete={() =>
                    void c.patchType("typography_scale", (d) => ({
                      ...d,
                      scale: scaleOf(d).filter((r) => r.id !== row.id),
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <AddRow label="Add type style" onClick={() => c.openDrawer({ kind: "type" })} />
        </Card>
      </div>

      <DownloadLinks
        links={((linksSec?.data as any)?.links || []) as any}
        onAdd={() => c.openDrawer({ kind: "link", sectionType: "type_download_links" })}
        onEdit={(id) => c.openDrawer({ kind: "link", sectionType: "type_download_links", linkId: id })}
        onDelete={(id) =>
          void c.patchType("type_download_links", (d) => ({
            ...d,
            links: (d.links || []).filter((l: any) => l.id !== id),
          }))
        }
      />
      <TypeDrawer fonts={fonts} />
      {linkDrawer}
    </div>
  );
}

function TypeDrawer({ fonts }: { fonts: string[] }) {
  const c = useCanvas();
  const d = c.drawer?.kind === "type" ? c.drawer : null;
  const scale = scaleOf(c.sectionByType("typography_scale")?.data);
  const row = d?.rowId ? scale.find((r) => r.id === d.rowId) : null;
  const [name, setName] = useState("Heading");
  const [role, setRole] = useState("");
  const [family, setFamily] = useState(fonts[0] || "Switzer Variable");
  const [weight, setWeight] = useState("600");
  const [style, setStyle] = useState("normal");
  const [size, setSize] = useState("32");
  const [lh, setLh] = useState("1.1");
  const [track, setTrack] = useState("0");
  const [transform, setTransform] = useState("none");
  const [align, setAlign] = useState("left");
  const [colorToken, setColorToken] = useState("");

  useEffect(() => {
    if (!d) return;
    setName(row?.name || row?.token || "Heading");
    setRole(String(row?.role || ""));
    setFamily(row?.fontFamily || fonts[0] || "Switzer Variable");
    setWeight(String(row?.fontWeight || "600"));
    setStyle(row?.fontStyle || "normal");
    setSize(String(row?.px || parseInt(String(row?.value || "32"), 10) || 32));
    setLh(String(row?.lineHeight || "1.1"));
    setTrack(String(row?.letterSpacing || "0"));
    setTransform(row?.textTransform || "none");
    setAlign(row?.align || "left");
    setColorToken(row?.colorToken || "");
  }, [d?.rowId]);

  if (!d) return null;
  const px = Number(size) || 32;
  return (
    <DrawerShell title={d.rowId ? "Edit type style" : "Add type style"} wide onClose={c.closeDrawer}>
      <div
        style={{
          padding: 24,
          borderRadius: "var(--radius-m)",
          border: "1px solid var(--tool-border-input)",
          fontFamily: family,
          fontWeight: weight,
          fontStyle: style,
          fontSize: Math.min(px, 56),
          lineHeight: lh,
          letterSpacing: track.includes("px") || track.includes("em") ? track : `${track}px`,
          textTransform: transform as any,
          textAlign: align as any,
        }}
      >
        Aa
      </div>
      <div>
        <span className="field-label">Name</span>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <span className="field-label">Role / Token Key</span>
        <select className="field-select" value={role} onChange={(e) => setRole(e.target.value)}>
          {TYPE_ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <span className="field-label">Family</span>
        <select className="field-select" value={family} onChange={(e) => setFamily(e.target.value)}>
          {fonts.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <div>
          <span className="field-label">Style</span>
          <select className="field-select" value={`${weight}:${style}`} onChange={(e) => {
            const [w, s] = e.target.value.split(":");
            setWeight(w);
            setStyle(s);
          }}>
            <option value="400:normal">Regular</option>
            <option value="500:normal">Medium</option>
            <option value="600:normal">Semibold</option>
            <option value="700:normal">Bold</option>
            <option value="400:italic">Italic</option>
          </select>
        </div>
        <div>
          <span className="field-label">Size (px)</span>
          <input className="field-input" type="number" value={size} onChange={(e) => setSize(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div>
          <span className="field-label">Line-height</span>
          <input className="field-input" value={lh} onChange={(e) => setLh(e.target.value)} />
        </div>
        <div>
          <span className="field-label">Tracking</span>
          <input className="field-input" value={track} onChange={(e) => setTrack(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div>
          <span className="field-label">Transform</span>
          <select className="field-select" value={transform} onChange={(e) => setTransform(e.target.value)}>
            <option value="none">None</option>
            <option value="uppercase">Uppercase</option>
            <option value="lowercase">Lowercase</option>
            <option value="capitalize">Capitalize</option>
          </select>
        </div>
        <div>
          <span className="field-label">Align</span>
          <select className="field-select" value={align} onChange={(e) => setAlign(e.target.value)}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>
      <div>
        <span className="field-label">Color token</span>
        <input className="field-input" value={colorToken} onChange={(e) => setColorToken(e.target.value)} placeholder="text-primary" />
      </div>
      <DrawerActions
        onCancel={c.closeDrawer}
        onSave={() => {
          const next: TypeScaleEntry = {
            id: d.rowId || generateUUID(),
            name,
            token: role || name,
            role,
            fontFamily: family,
            fontWeight: weight,
            fontStyle: style,
            px,
            value: `${px}px`,
            lineHeight: lh,
            letterSpacing: track,
            textTransform: transform,
            align,
            colorToken,
          };
          void c.patchType("typography_scale", (data) => {
            const prev = scaleOf(data);
            if (d.rowId) return { ...data, scale: prev.map((r) => (r.id === d.rowId ? next : r)) };
            return { ...data, scale: [...prev, next] };
          });
          c.closeDrawer();
        }}
      />
    </DrawerShell>
  );
}
