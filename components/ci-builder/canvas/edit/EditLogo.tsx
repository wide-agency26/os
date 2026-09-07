"use client";

import React, { useEffect, useState } from "react";
import type { CiLogoMark, CiLinkItem } from "@/lib/ci-builder/types";
import { generateUUID } from "@/lib/ci-builder/types";
import { useCanvas } from "../CiCanvasContext";
import { ModuleFigmaResync } from "../ModuleFigmaResync";
import { AddRow, Card, DrawerActions, DrawerShell, ImageWell, ModuleHero, RowActions, SectionTitle, assetSrc } from "../ui";
import { StarIcon } from "../icons";
import { useLinkDrawer } from "../CiCanvasDrawers";

function marksOf(data: any): CiLogoMark[] {
  const marks = Array.isArray(data?.marks) ? data.marks : [];
  return marks
    .slice()
    .sort((a: CiLogoMark, b: CiLogoMark) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function EditLogo() {
  const c = useCanvas();
  const logo = c.sectionByType("logo_marks");
  const clear = c.sectionByType("clear_space");
  const misuse = c.sectionByType("misuse_examples");
  const linksSec = c.sectionByType("logo_download_links");
  const marks = marksOf(logo?.data);
  const clearUrl = assetSrc(c.assets, (clear?.data as any)?.assetId);
  const items = Array.isArray((misuse?.data as any)?.items) ? (misuse?.data as any).items : [];
  const dos = items.filter((i: any) => i.type === "do");
  const donts = items.filter((i: any) => i.type !== "do");
  const links = ((linksSec?.data as { links?: CiLinkItem[] })?.links || []) as CiLinkItem[];
  const linkDrawer = useLinkDrawer();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <ModuleHero
        eyebrow="03 · Logo System"
        title="Logo System."
        blurb="Marks, clear space, and usage rules — one list, light and dark slots, a single MAIN."
        editMode={c.editMode}
        onToggleEdit={() => c.setEditMode(!c.editMode)}
      />

      <ModuleFigmaResync moduleKey="logo" />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Logo Marks</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {marks.map((mark) => (
            <Card key={mark.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 20, fontWeight: 500 }}>{mark.name || "Untitled mark"}</span>
                <RowActions
                  onEdit={() => c.openDrawer({ kind: "rename", markId: mark.id })}
                  onDup={() =>
                    void c.patchType("logo_marks", (d) => ({
                      ...d,
                      marks: [...marksOf(d), { ...mark, id: generateUUID(), isMain: false, name: `${mark.name} copy` }],
                    }))
                  }
                  onDelete={() =>
                    void c.patchType("logo_marks", (d) => ({
                      ...d,
                      marks: marksOf(d).filter((m) => m.id !== mark.id),
                    }))
                  }
                />
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {c.guideline?.id ? (
                  <>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <span className="field-label">Light</span>
                      <ImageWell
                        url={assetSrc(c.assets, mark.lightAssetId)}
                        guidelineId={c.guideline.id}
                        assets={c.assets}
                        onAddAsset={(a) => void c.addAsset(a)}
                        onSelect={(a) =>
                          void c.patchType("logo_marks", (d) => ({
                            ...d,
                            marks: marksOf(d).map((m) => (m.id === mark.id ? { ...m, lightAssetId: a.id } : m)),
                          }))
                        }
                        size="100%"
                        label="Light"
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 180, background: "#141414", borderRadius: "var(--radius-m)", padding: 8 }}>
                      <span className="field-label" style={{ color: "#cac8cc" }}>
                        Dark
                      </span>
                      <ImageWell
                        url={assetSrc(c.assets, mark.darkAssetId)}
                        guidelineId={c.guideline.id}
                        assets={c.assets}
                        onAddAsset={(a) => void c.addAsset(a)}
                        onSelect={(a) =>
                          void c.patchType("logo_marks", (d) => ({
                            ...d,
                            marks: marksOf(d).map((m) => (m.id === mark.id ? { ...m, darkAssetId: a.id } : m)),
                          }))
                        }
                        size="100%"
                        label="Dark"
                      />
                    </div>
                  </>
                ) : null}
                <span
                  className="icon-btn"
                  style={{ display: "flex", color: mark.isMain ? "var(--tool-accent-success)" : undefined }}
                  title="MAIN"
                  onClick={() =>
                    void c.patchType("logo_marks", (d) => ({
                      ...d,
                      marks: marksOf(d).map((m) => ({ ...m, isMain: m.id === mark.id })),
                    }))
                  }
                >
                  <StarIcon filled={mark.isMain} />
                </span>
              </div>
            </Card>
          ))}
          <AddRow
            label="Add logo mark"
            onClick={() =>
              void c.patchType("logo_marks", (d) => ({
                ...d,
                marks: [
                  ...marksOf(d),
                  {
                    id: generateUUID(),
                    name: "New mark",
                    isMain: marksOf(d).length === 0,
                    sortOrder: marksOf(d).length,
                  },
                ],
              }))
            }
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Clear Space</SectionTitle>
        <Card>
          {c.guideline?.id ? (
            <ImageWell
              url={clearUrl}
              guidelineId={c.guideline.id}
              assets={c.assets}
              onAddAsset={(a) => void c.addAsset(a)}
              onSelect={(a) => void c.patchType("clear_space", (d) => ({ ...d, assetId: a.id }))}
              size="100%"
              label="Clear space diagram"
            />
          ) : null}
          <div style={{ marginTop: 12 }}>
            <span className="field-label">Multiplier</span>
            <input
              className="field-input"
              type="number"
              step="0.1"
              value={Number((clear?.data as any)?.multiplier || 1.5)}
              onChange={(e) =>
                void c.patchType("clear_space", (d) => ({ ...d, multiplier: Number(e.target.value) }))
              }
            />
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Logo Do / Don&apos;t</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <DoDontCol
              title="Do"
              color="var(--tool-accent-success)"
              items={dos}
              onAdd={() => c.openDrawer({ kind: "photo", sectionType: "misuse_examples", side: "do" })}
              onEdit={(id) => c.openDrawer({ kind: "photo", sectionType: "misuse_examples", itemId: id, side: "do" })}
            />
            <DoDontCol
              title="Don't"
              color="var(--tool-accent-danger)"
              items={donts}
              onAdd={() => c.openDrawer({ kind: "photo", sectionType: "misuse_examples", side: "dont" })}
              onEdit={(id) => c.openDrawer({ kind: "photo", sectionType: "misuse_examples", itemId: id, side: "dont" })}
            />
          </div>
        </Card>
      </div>

      <DownloadLinks
        links={links}
        onAdd={() => c.openDrawer({ kind: "link", sectionType: "logo_download_links" })}
        onEdit={(id) => c.openDrawer({ kind: "link", sectionType: "logo_download_links", linkId: id })}
        onDelete={(id) =>
          void c.patchType("logo_download_links", (d) => ({
            ...d,
            links: (d.links || []).filter((l: CiLinkItem) => l.id !== id),
          }))
        }
      />
      <RenameDrawer />
      <PhotoExampleDrawer />
      {linkDrawer}
    </div>
  );
}

export function DownloadLinks({
  links,
  onAdd,
  onEdit,
  onDelete,
}: {
  links: CiLinkItem[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionTitle>Download Links</SectionTitle>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {links.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <a href={l.url} target="_blank" rel="noreferrer" style={{ fontSize: 16 }}>
                {l.label || l.url}
              </a>
              <RowActions onEdit={() => onEdit(l.id)} onDelete={() => onDelete(l.id)} />
            </div>
          ))}
        </div>
        <AddRow label="Add download link" onClick={onAdd} />
      </Card>
    </div>
  );
}

function DoDontCol({
  title,
  color,
  items,
  onAdd,
  onEdit,
}: {
  title: string;
  color: string;
  items: any[];
  onAdd: () => void;
  onEdit: (id: string) => void;
}) {
  const c = useCanvas();
  return (
    <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 20, color, fontWeight: 500 }}>{title}</span>
      {items.map((item) => (
        <div key={item.id} onClick={() => onEdit(item.id)} style={{ cursor: "pointer" }}>
          <div
            style={{
              height: 140,
              borderRadius: "var(--radius-m)",
              background: item.assetId
                ? `url(${assetSrc(c.assets, item.assetId)}) center/contain no-repeat`
                : "var(--tool-surface-card)",
              border: "1px dashed var(--tool-border-input)",
            }}
          />
          <span style={{ fontSize: 13, color: "var(--tool-text-muted)" }}>{item.caption || ""}</span>
        </div>
      ))}
      <AddRow label={`Add ${title.toLowerCase()} example`} onClick={onAdd} />
    </div>
  );
}

function RenameDrawer() {
  const c = useCanvas();
  const marks = marksOf(c.sectionByType("logo_marks")?.data);
  const d = c.drawer?.kind === "rename" ? c.drawer : null;
  const mark = d ? marks.find((m) => m.id === d.markId) : null;
  const [name, setName] = useState("");
  useEffect(() => {
    setName(mark?.name || "");
  }, [mark?.name, d?.markId]);
  if (!d) return null;
  return (
    <DrawerShell title="Rename mark" onClose={c.closeDrawer}>
      <div>
        <span className="field-label">Name</span>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <DrawerActions
        onCancel={c.closeDrawer}
        onSave={() => {
          void c.patchType("logo_marks", (data) => ({
            ...data,
            marks: marksOf(data).map((m) => (m.id === d.markId ? { ...m, name } : m)),
          }));
          c.closeDrawer();
        }}
      />
    </DrawerShell>
  );
}

export function PhotoExampleDrawer() {
  const c = useCanvas();
  const d = c.drawer?.kind === "photo" ? c.drawer : null;
  const sec = d ? c.sectionByType(d.sectionType) : null;
  const items = Array.isArray((sec?.data as any)?.items) ? (sec?.data as any).items : [];
  const current = d?.itemId ? items.find((i: any) => i.id === d.itemId) : null;
  const [caption, setCaption] = useState("");
  const [side, setSide] = useState<"do" | "dont">("do");
  const [assetId, setAssetId] = useState("");

  useEffect(() => {
    if (!d) return;
    setCaption(current?.caption || "");
    setSide((current?.type as "do" | "dont") || d.side || "do");
    setAssetId(current?.assetId || "");
  }, [d?.itemId, d?.sectionType, current?.caption, current?.type, current?.assetId]);

  if (!d) return null;
  return (
    <DrawerShell title={d.itemId ? "Edit example" : "Add example"} onClose={c.closeDrawer}>
      {c.guideline?.id ? (
        <ImageWell
          url={assetSrc(c.assets, assetId)}
          guidelineId={c.guideline.id}
          assets={c.assets}
          onAddAsset={(a) => void c.addAsset(a)}
          onSelect={(a) => setAssetId(a.id || "")}
          size="100%"
          label="Click to upload"
        />
      ) : null}
      <div>
        <span className="field-label">Caption</span>
        <input className="field-input" value={caption} onChange={(e) => setCaption(e.target.value)} />
      </div>
      <DrawerActions
        onCancel={c.closeDrawer}
        onSave={() => {
          void c.patchType(d.sectionType, (data) => {
            const prev = Array.isArray(data.items) ? data.items.slice() : [];
            if (d.itemId) {
              return {
                ...data,
                items: prev.map((i: any) =>
                  i.id === d.itemId ? { ...i, caption, type: side, assetId } : i
                ),
              };
            }
            return {
              ...data,
              items: [...prev, { id: generateUUID(), caption, type: side, assetId }],
            };
          });
          c.closeDrawer();
        }}
      />
    </DrawerShell>
  );
}
