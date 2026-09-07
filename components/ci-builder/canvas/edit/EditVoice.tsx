"use client";

import React, { useEffect, useState } from "react";
import { generateUUID } from "@/lib/ci-builder/types";
import { asTextItems } from "@/lib/ci-builder/canvas/lists";
import { useCanvas } from "../CiCanvasContext";
import { ModuleFigmaResync } from "../ModuleFigmaResync";
import { AddRow, Card, CopyPromptLink, DrawerActions, DrawerShell, ModuleHero, RowActions, SectionTitle, ToggleGroup } from "../ui";

type Axis = { id: string; left: string; right: string; value: number };

function axesOf(data: any): Axis[] {
  const raw = Array.isArray(data?.axes) ? data.axes : [];
  return raw.map((a: any) => ({
    id: String(a.id || generateUUID()),
    left: String(a.left || "Left"),
    right: String(a.right || "Right"),
    value: Number(a.value ?? a.pos ?? 50),
  }));
}

export function EditVoice() {
  const c = useCanvas();
  const tone = c.sectionByType("tone_matrix");
  const examples = c.sectionByType("copywriting_examples");
  const promptSec = c.sectionByType("ai_system_prompt");
  const axes = axesOf(tone?.data);
  const approved = asTextItems((examples?.data as any)?.approved);
  const forbidden = asTextItems((examples?.data as any)?.forbidden);
  const prompt = String((promptSec?.data as any)?.prompt || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <ModuleHero
        eyebrow="02 · Brand Voice"
        title="Voice & AI Texting."
        blurb="How the brand sounds — dialed in with sliders, examples, and a reusable AI system prompt."
        editMode={c.editMode}
        onToggleEdit={() => c.setEditMode(!c.editMode)}
      />

      <ModuleFigmaResync moduleKey="voice" />

      <div className="tool-section" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Tone Matrix</SectionTitle>
        <Card>
          <div className="sortable-list" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {axes.map((axis) => (
              <div key={axis.id} className="sortable-item" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--tool-text-primary)" }}>
                    <span>{axis.left}</span>
                    <span>{axis.right}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: "var(--tool-border-input)", position: "relative" }}>
                    <div
                      className="tone-dot"
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "var(--tool-accent-primary)",
                        position: "absolute",
                        left: `${axis.value}%`,
                        top: -4,
                      }}
                    />
                  </div>
                </div>
                <RowActions
                  onEdit={() => c.openDrawer({ kind: "tone", axisId: axis.id })}
                  onDup={() =>
                    void c.patchType("tone_matrix", (d) => ({
                      ...d,
                      axes: [...axesOf(d), { ...axis, id: generateUUID() }],
                    }))
                  }
                  onDelete={() =>
                    void c.patchType("tone_matrix", (d) => ({
                      ...d,
                      axes: axesOf(d).filter((x) => x.id !== axis.id),
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <AddRow label="Add tone axis" onClick={() => c.openDrawer({ kind: "tone" })} />
        </Card>
      </div>

      <div className="tool-section" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Voice Examples</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <VoiceCol
              title="On-brand"
              color="var(--tool-accent-success)"
              items={approved}
              addLabel="Add on-brand example"
              moveLabel="Off"
              onAdd={() => c.openDrawer({ kind: "voice", side: "on" })}
              onEdit={(id) => c.openDrawer({ kind: "voice", side: "on", itemId: id })}
              onDup={(item) =>
                void c.patchType("copywriting_examples", (d) => ({
                  ...d,
                  approved: [...asTextItems(d.approved), { id: generateUUID(), text: item.text }],
                }))
              }
              onDelete={(id) =>
                void c.patchType("copywriting_examples", (d) => ({
                  ...d,
                  approved: asTextItems(d.approved).filter((x) => x.id !== id),
                }))
              }
              onMoveToOther={(item) =>
                void c.patchType("copywriting_examples", (d) => ({
                  ...d,
                  approved: asTextItems(d.approved).filter((x) => x.id !== item.id),
                  forbidden: [...asTextItems(d.forbidden), item],
                }))
              }
            />
            <VoiceCol
              title="Off-brand"
              color="var(--tool-accent-danger)"
              items={forbidden}
              addLabel="Add off-brand example"
              moveLabel="On"
              onAdd={() => c.openDrawer({ kind: "voice", side: "off" })}
              onEdit={(id) => c.openDrawer({ kind: "voice", side: "off", itemId: id })}
              onDup={(item) =>
                void c.patchType("copywriting_examples", (d) => ({
                  ...d,
                  forbidden: [...asTextItems(d.forbidden), { id: generateUUID(), text: item.text }],
                }))
              }
              onDelete={(id) =>
                void c.patchType("copywriting_examples", (d) => ({
                  ...d,
                  forbidden: asTextItems(d.forbidden).filter((x) => x.id !== id),
                }))
              }
              onMoveToOther={(item) =>
                void c.patchType("copywriting_examples", (d) => ({
                  ...d,
                  forbidden: asTextItems(d.forbidden).filter((x) => x.id !== item.id),
                  approved: [...asTextItems(d.approved), item],
                }))
              }
            />
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>AI System Prompt</SectionTitle>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span
              className="mono ai-editable"
              contentEditable={c.editMode}
              suppressContentEditableWarning
              onBlur={(e) => {
                const text = e.currentTarget.textContent || "";
                void c.patchType("ai_system_prompt", (d) => ({ ...d, prompt: text }));
              }}
              style={{ fontSize: 14, color: "var(--tool-text-primary)", lineHeight: 1.6, outline: "none" }}
            >
              {prompt || "You are the brand voice…"}
            </span>
            <CopyPromptLink text={prompt} />
          </div>
        </Card>
      </div>
      <VoiceDrawers axes={axes} />
    </div>
  );
}

function VoiceCol(props: {
  title: string;
  color: string;
  items: { id: string; text: string }[];
  addLabel: string;
  moveLabel: string;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDup: (item: { id: string; text: string }) => void;
  onDelete: (id: string) => void;
  onMoveToOther: (item: { id: string; text: string }) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 16 }}>
      <span style={{ fontSize: 20, color: props.color, fontWeight: 500 }}>{props.title}</span>
      <div className="sortable-list" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {props.items.map((item) => (
          <div key={item.id} className="sortable-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 16, color: "var(--tool-text-primary)" }}>&ldquo;{item.text}&rdquo;</span>
            <div style={{ display: "flex", gap: 4 }}>
              <RowActions onEdit={() => props.onEdit(item.id)} onDup={() => props.onDup(item)} onDelete={() => props.onDelete(item.id)} />
              <span
                className="icon-btn"
                title={`Move to ${props.moveLabel}`}
                onClick={() => props.onMoveToOther(item)}
                style={{ fontSize: 10, width: "auto", padding: "0 6px" }}
              >
                {props.moveLabel}
              </span>
            </div>
          </div>
        ))}
      </div>
      <AddRow label={props.addLabel} onClick={props.onAdd} />
    </div>
  );
}

function VoiceDrawers({ axes }: { axes: Axis[] }) {
  const c = useCanvas();
  const examples = c.sectionByType("copywriting_examples");
  const [left, setLeft] = useState("Formal");
  const [right, setRight] = useState("Casual");
  const [pos, setPos] = useState(50);
  const [quote, setQuote] = useState("");
  const [side, setSide] = useState<"on" | "off">("on");

  useEffect(() => {
    if (c.drawer?.kind !== "tone") return;
    const axisId = c.drawer.axisId;
    const hit = axes.find((a) => a.id === axisId);
    setLeft(hit?.left || "Formal");
    setRight(hit?.right || "Casual");
    setPos(hit?.value ?? 50);
  }, [c.drawer, axes]);

  useEffect(() => {
    if (c.drawer?.kind !== "voice") return;
    const d = c.drawer;
    const list = asTextItems((examples?.data as any)?.[d.side === "on" ? "approved" : "forbidden"]);
    setQuote(list.find((x) => x.id === d.itemId)?.text || "");
    setSide(d.side);
  }, [c.drawer, examples]);

  if (c.drawer?.kind === "tone") {
    return (
      <DrawerShell title={c.drawer.axisId ? "Edit Tone Axis" : "Add Tone Axis"} onClose={c.closeDrawer}>
        <div style={{ border: "1px solid var(--tool-surface-card)", borderRadius: "var(--radius-m)", padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
            <span>{left}</span>
            <span>{right}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "var(--tool-border-input)", position: "relative" }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "var(--tool-accent-primary)",
                position: "absolute",
                left: `${pos}%`,
                top: -4,
              }}
            />
          </div>
        </div>
        <div className="field-row">
          <div>
            <span className="field-label">Left Label</span>
            <input className="field-input" value={left} onChange={(e) => setLeft(e.target.value)} />
          </div>
          <div>
            <span className="field-label">Right Label</span>
            <input className="field-input" value={right} onChange={(e) => setRight(e.target.value)} />
          </div>
        </div>
        <div>
          <span className="field-label">Position (0–100)</span>
          <input className="field-input" type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} />
        </div>
        <DrawerActions
          onCancel={c.closeDrawer}
          onSave={() => {
            const id = c.drawer?.kind === "tone" ? c.drawer.axisId : undefined;
            void c.patchType("tone_matrix", (d) => {
              const list = axesOf(d);
              if (id) {
                return { ...d, axes: list.map((a) => (a.id === id ? { ...a, left, right, value: pos } : a)) };
              }
              return { ...d, axes: [...list, { id: generateUUID(), left, right, value: pos }] };
            });
            c.closeDrawer();
          }}
        />
      </DrawerShell>
    );
  }

  if (c.drawer?.kind === "voice") {
    return (
      <DrawerShell title={c.drawer.itemId ? "Edit Example" : "Add Example"} onClose={c.closeDrawer}>
        <div>
          <span className="field-label">Type</span>
          <ToggleGroup
            value={side}
            options={[
              { value: "on", label: "On-brand" },
              { value: "off", label: "Off-brand" },
            ]}
            onChange={(v) => setSide(v as "on" | "off")}
          />
        </div>
        <div>
          <span className="field-label">Quote</span>
          <textarea className="field-input" rows={4} style={{ resize: "vertical" }} value={quote} onChange={(e) => setQuote(e.target.value)} />
        </div>
        <DrawerActions
          onCancel={c.closeDrawer}
          onSave={() => {
            const itemId = c.drawer?.kind === "voice" ? c.drawer.itemId : undefined;
            void c.patchType("copywriting_examples", (d) => {
              let approved = asTextItems(d.approved).filter((x) => x.id !== itemId);
              let forbidden = asTextItems(d.forbidden).filter((x) => x.id !== itemId);
              const row = { id: itemId || generateUUID(), text: quote };
              if (side === "on") approved = [...approved, row];
              else forbidden = [...forbidden, row];
              return { ...d, approved, forbidden };
            });
            c.closeDrawer();
          }}
        />
      </DrawerShell>
    );
  }

  return null;
}
