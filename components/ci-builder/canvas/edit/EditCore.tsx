"use client";

import React, { useEffect, useState } from "react";
import { generateUUID } from "@/lib/ci-builder/types";
import { asTextItems, linesToItems } from "@/lib/ci-builder/canvas/lists";
import { useCanvas } from "../CiCanvasContext";
import { ModuleFigmaResync } from "../ModuleFigmaResync";
import { AddRow, Card, DrawerActions, DrawerShell, ImageWell, ModuleHero, RowActions, SectionTitle, ValuePill, assetSrc } from "../ui";
import { ToggleGroup } from "../ui";

export function EditCore() {
  const c = useCanvas();
  const mission = c.sectionByType("mission");
  const claim = c.sectionByType("claim_pitch");
  const values = c.sectionByType("core_values");
  const arch = c.sectionByType("brand_personality");
  const editorial = c.sectionByType("editorial_guidelines");

  const missionBody = String((mission?.data as any)?.body || "");
  const claimText = String((claim?.data as any)?.claim || (claim?.data as any)?.pitch || "");
  const claimLabel = String((claim?.data as any)?.claimLabel || "Claim / Pitch");
  const missionLabel = String((mission?.data as any)?.label || "Mission");
  const valueItems = asTextItems((values?.data as any)?.items);
  const archetype = String((arch?.data as any)?.archetype || "");
  const traits = asTextItems((arch?.data as any)?.traits);
  const photoUrl = assetSrc(c.assets, (arch?.data as any)?.assetId);
  const dos = asTextItems((editorial?.data as any)?.dos);
  const donts = asTextItems((editorial?.data as any)?.donts);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <ModuleHero
        eyebrow="01 · Brand Core"
        title="Brand Core & Strategy."
        blurb="The foundation everything else derives from — mission, values, and editorial rules."
        editMode={c.editMode}
        onToggleEdit={() => c.setEditMode(!c.editMode)}
      />

      <ModuleFigmaResync moduleKey="core" />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle onPencil={() => c.openDrawer({ kind: "core", mode: "mission" })}>
          Mission & Positioning
        </SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minWidth: 260 }}>
              <span style={{ fontSize: 20, color: "var(--tool-text-primary)", fontWeight: 500 }}>{missionLabel}</span>
              <span style={{ fontSize: 16, color: "var(--tool-text-primary)" }}>{missionBody || "—"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minWidth: 260 }}>
              <span style={{ fontSize: 20, color: "var(--tool-text-primary)", fontWeight: 500 }}>{claimLabel}</span>
              <span style={{ fontSize: 16, color: "var(--tool-text-primary)" }}>{claimText || "—"}</span>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle onPencil={() => c.openDrawer({ kind: "core", mode: "values" })}>Core Values</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {valueItems.length ? valueItems.map((v) => <ValuePill key={v.id}>{v.text}</ValuePill>) : <span style={{ color: "var(--tool-text-muted)" }}>No values yet</span>}
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle onPencil={() => c.openDrawer({ kind: "core", mode: "archetype" })}>Brand Archetype</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
            {c.guideline?.id ? (
              <ImageWell
                url={photoUrl}
                guidelineId={c.guideline.id}
                assets={c.assets}
                onAddAsset={(a) => void c.addAsset(a)}
                onSelect={(a) => void c.patchType("brand_personality", (d) => ({ ...d, assetId: a.id }))}
                size={96}
              />
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minWidth: 220 }}>
              <span style={{ fontSize: 20, color: "var(--tool-text-primary)", fontWeight: 500 }}>Archetype</span>
              <span style={{ fontSize: 16, color: "var(--tool-text-primary)" }}>{archetype || "—"}</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {traits.map((t) => (
                  <ValuePill key={t.id} small>
                    {t.text}
                  </ValuePill>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="tool-section" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Editorial Do&apos;s / Don&apos;ts</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <PairedCol
              title="Do"
              color="var(--tool-accent-success)"
              items={dos}
              addLabel="Add do example"
              onAdd={() => c.openDrawer({ kind: "editorial", side: "do" })}
              onEdit={(id) => c.openDrawer({ kind: "editorial", side: "do", itemId: id })}
              onDup={(item) =>
                void c.patchType("editorial_guidelines", (d) => ({
                  ...d,
                  dos: [...asTextItems(d.dos), { id: generateUUID(), text: item.text }],
                }))
              }
              onDelete={(id) =>
                void c.patchType("editorial_guidelines", (d) => ({
                  ...d,
                  dos: asTextItems(d.dos).filter((x) => x.id !== id),
                }))
              }
              onMoveToOther={(item) =>
                void c.patchType("editorial_guidelines", (d) => ({
                  ...d,
                  dos: asTextItems(d.dos).filter((x) => x.id !== item.id),
                  donts: [...asTextItems(d.donts), item],
                }))
              }
            />
            <PairedCol
              title="Don't"
              color="var(--tool-accent-danger)"
              items={donts}
              addLabel="Add don't example"
              onAdd={() => c.openDrawer({ kind: "editorial", side: "dont" })}
              onEdit={(id) => c.openDrawer({ kind: "editorial", side: "dont", itemId: id })}
              onDup={(item) =>
                void c.patchType("editorial_guidelines", (d) => ({
                  ...d,
                  donts: [...asTextItems(d.donts), { id: generateUUID(), text: item.text }],
                }))
              }
              onDelete={(id) =>
                void c.patchType("editorial_guidelines", (d) => ({
                  ...d,
                  donts: asTextItems(d.donts).filter((x) => x.id !== id),
                }))
              }
              onMoveToOther={(item) =>
                void c.patchType("editorial_guidelines", (d) => ({
                  ...d,
                  donts: asTextItems(d.donts).filter((x) => x.id !== item.id),
                  dos: [...asTextItems(d.dos), item],
                }))
              }
            />
          </div>
        </Card>
      </div>
      <CoreDrawers />
    </div>
  );
}

function PairedCol({
  title,
  color,
  items,
  addLabel,
  onAdd,
  onEdit,
  onDup,
  onDelete,
  onMoveToOther,
}: {
  title: string;
  color: string;
  items: { id: string; text: string }[];
  addLabel: string;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDup: (item: { id: string; text: string }) => void;
  onDelete: (id: string) => void;
  onMoveToOther: (item: { id: string; text: string }) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 16 }}>
      <span style={{ fontSize: 20, color, fontWeight: 500 }}>{title}</span>
      <div className="sortable-list" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((item) => (
          <div key={item.id} className="sortable-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 16, color: "var(--tool-text-primary)" }}>{item.text}</span>
            <div style={{ display: "flex", gap: 4, flex: "none" }}>
            <RowActions
              onEdit={() => onEdit(item.id)}
              onDup={() => onDup(item)}
              onDelete={() => onDelete(item.id)}
            />
            <span
              className="icon-btn"
              title={title === "Do" ? "Move to Don't" : "Move to Do"}
              onClick={() => onMoveToOther(item)}
              style={{ fontSize: 10, width: "auto", padding: "0 6px" }}
            >
              {title === "Do" ? "Don't" : "Do"}
            </span>
            </div>
          </div>
        ))}
      </div>
      <AddRow label={addLabel} onClick={onAdd} />
    </div>
  );
}

function CoreDrawers() {
  const c = useCanvas();
  const mission = c.sectionByType("mission");
  const claim = c.sectionByType("claim_pitch");
  const values = c.sectionByType("core_values");
  const arch = c.sectionByType("brand_personality");
  const editorial = c.sectionByType("editorial_guidelines");

  const [missionLabel, setMissionLabel] = useState("Mission");
  const [missionBody, setMissionBody] = useState("");
  const [claimLabel, setClaimLabel] = useState("Claim / Pitch");
  const [claimBody, setClaimBody] = useState("");
  const [valuesText, setValuesText] = useState("");
  const [archText, setArchText] = useState("");
  const [traitsText, setTraitsText] = useState("");
  const [quote, setQuote] = useState("");
  const [side, setSide] = useState<"do" | "dont">("do");

  useEffect(() => {
    if (c.drawer?.kind !== "core") return;
    setMissionLabel(String((mission?.data as any)?.label || "Mission"));
    setMissionBody(String((mission?.data as any)?.body || ""));
    setClaimLabel(String((claim?.data as any)?.claimLabel || "Claim / Pitch"));
    setClaimBody(String((claim?.data as any)?.claim || (claim?.data as any)?.pitch || ""));
    setValuesText(asTextItems((values?.data as any)?.items).map((i) => i.text).join("\n"));
    setArchText(String((arch?.data as any)?.archetype || ""));
    setTraitsText(asTextItems((arch?.data as any)?.traits).map((i) => i.text).join("\n"));
  }, [c.drawer, mission, claim, values, arch]);

  useEffect(() => {
    if (c.drawer?.kind !== "editorial") return;
    const d = c.drawer;
    const list = asTextItems((editorial?.data as any)?.[d.side === "do" ? "dos" : "donts"]);
    const hit = list.find((x) => x.id === d.itemId);
    setQuote(hit?.text || "");
    setSide(d.side);
  }, [c.drawer, editorial]);

  if (c.drawer?.kind === "core") {
    const mode = c.drawer.mode;
    return (
      <DrawerShell
        title={mode === "mission" ? "Edit Mission & Positioning" : mode === "values" ? "Edit Core Values" : "Edit Brand Archetype"}
        onClose={c.closeDrawer}
      >
        {mode === "mission" ? (
          <>
            <div>
              <span className="field-label">Mission label</span>
              <input className="field-input" value={missionLabel} onChange={(e) => setMissionLabel(e.target.value)} />
            </div>
            <div>
              <span className="field-label">Mission</span>
              <textarea className="field-input" rows={4} style={{ resize: "vertical" }} value={missionBody} onChange={(e) => setMissionBody(e.target.value)} />
            </div>
            <div>
              <span className="field-label">Claim label</span>
              <input className="field-input" value={claimLabel} onChange={(e) => setClaimLabel(e.target.value)} />
            </div>
            <div>
              <span className="field-label">Claim / Pitch</span>
              <textarea className="field-input" rows={4} style={{ resize: "vertical" }} value={claimBody} onChange={(e) => setClaimBody(e.target.value)} />
            </div>
          </>
        ) : null}
        {mode === "values" ? (
          <div>
            <span className="field-label">Values (one per line)</span>
            <textarea className="field-input" rows={8} style={{ resize: "vertical" }} value={valuesText} onChange={(e) => setValuesText(e.target.value)} />
          </div>
        ) : null}
        {mode === "archetype" ? (
          <>
            <div>
              <span className="field-label">Archetype</span>
              <textarea className="field-input" rows={3} style={{ resize: "vertical" }} value={archText} onChange={(e) => setArchText(e.target.value)} />
            </div>
            <div>
              <span className="field-label">Traits (one per line)</span>
              <textarea className="field-input" rows={5} style={{ resize: "vertical" }} value={traitsText} onChange={(e) => setTraitsText(e.target.value)} />
            </div>
            {c.guideline?.id ? (
              <div>
                <span className="field-label">Photo</span>
                <ImageWell
                  url={assetSrc(c.assets, (arch?.data as any)?.assetId)}
                  guidelineId={c.guideline.id}
                  assets={c.assets}
                  onAddAsset={(a) => void c.addAsset(a)}
                  onSelect={(a) => void c.patchType("brand_personality", (d) => ({ ...d, assetId: a.id }))}
                  size="100%"
                  label="Click to upload"
                />
              </div>
            ) : null}
          </>
        ) : null}
        <DrawerActions
          onCancel={c.closeDrawer}
          onSave={() => {
            if (mode === "mission") {
              void c.patchType("mission", (d) => ({ ...d, label: missionLabel, body: missionBody }));
              void c.patchType("claim_pitch", (d) => ({ ...d, claimLabel, claim: claimBody, pitch: d.pitch || "" }));
            } else if (mode === "values") {
              void c.patchType("core_values", (d) => ({ ...d, items: linesToItems(valuesText) }));
            } else {
              void c.patchType("brand_personality", (d) => ({
                ...d,
                archetype: archText,
                traits: linesToItems(traitsText),
              }));
            }
            c.closeDrawer();
          }}
        />
      </DrawerShell>
    );
  }

  if (c.drawer?.kind === "editorial") {
    return (
      <DrawerShell title={c.drawer.itemId ? "Edit Example" : "Add Example"} onClose={c.closeDrawer}>
        <div>
          <span className="field-label">Type</span>
          <ToggleGroup
            value={side}
            options={[
              { value: "do", label: "Do" },
              { value: "dont", label: "Don't" },
            ]}
            onChange={(v) => setSide(v as "do" | "dont")}
          />
        </div>
        <div>
          <span className="field-label">Quote</span>
          <textarea className="field-input" rows={4} style={{ resize: "vertical" }} value={quote} onChange={(e) => setQuote(e.target.value)} />
        </div>
        <DrawerActions
          onCancel={c.closeDrawer}
          onSave={() => {
            const itemId = c.drawer?.kind === "editorial" ? c.drawer.itemId : undefined;
            void c.patchType("editorial_guidelines", (d) => {
              let dos = asTextItems(d.dos);
              let donts = asTextItems(d.donts);
              dos = dos.filter((x) => x.id !== itemId);
              donts = donts.filter((x) => x.id !== itemId);
              const row = { id: itemId || generateUUID(), text: quote };
              if (side === "do") dos = [...dos, row];
              else donts = [...donts, row];
              return { ...d, dos, donts };
            });
            c.closeDrawer();
          }}
        />
      </DrawerShell>
    );
  }

  return null;
}
