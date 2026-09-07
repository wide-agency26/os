"use client";

import React, { useState } from "react";
import { generateUUID } from "@/lib/ci-builder/types";
import { useCanvas } from "../CiCanvasContext";
import { ModuleFigmaResync } from "../ModuleFigmaResync";
import { AddRow, Card, ImageWell, ModuleHero, RowActions, SectionTitle, assetSrc } from "../ui";
import { DownloadLinks, PhotoExampleDrawer } from "./EditLogo";
import { useLinkDrawer } from "../CiCanvasDrawers";

export function EditImagery() {
  const c = useCanvas();
  const photos = Array.isArray((c.sectionByType("brand_photography")?.data as any)?.items)
    ? (c.sectionByType("brand_photography")?.data as any).items
    : [];
  const tags: string[] = Array.isArray((c.sectionByType("brand_photography")?.data as any)?.tags)
    ? (c.sectionByType("brand_photography")?.data as any).tags
    : [];
  const style = c.sectionByType("photography_style");
  const styleItems = Array.isArray((style?.data as any)?.items) ? (style?.data as any).items : [];
  const dos = styleItems.filter((i: any) => i.type === "do");
  const donts = styleItems.filter((i: any) => i.type !== "do");
  const links = ((c.sectionByType("imagery_download_links")?.data as any)?.links || []) as any[];
  const linkDrawer = useLinkDrawer();
  const [tagDraft, setTagDraft] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <ModuleHero
        eyebrow="08 · Imagery"
        title="Imagery."
        blurb="Photography grid with blank add, style tags, and do/don't examples."
        editMode={c.editMode}
        onToggleEdit={() => c.setEditMode(!c.editMode)}
      />

      <ModuleFigmaResync moduleKey="imagery" />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Brand Photography</SectionTitle>
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            {photos.map((p: any) => (
              <div key={p.id}>
                {c.guideline?.id ? (
                  <ImageWell
                    url={assetSrc(c.assets, p.assetId)}
                    guidelineId={c.guideline.id}
                    assets={c.assets}
                    onAddAsset={(a) => void c.addAsset(a)}
                    onSelect={(a) =>
                      void c.patchType("brand_photography", (d) => ({
                        ...d,
                        items: (d.items || []).map((x: any) => (x.id === p.id ? { ...x, assetId: a.id } : x)),
                      }))
                    }
                    size="100%"
                    label="Photo"
                  />
                ) : null}
                <input
                  className="field-input"
                  style={{ marginTop: 8 }}
                  placeholder="Caption"
                  value={p.caption || ""}
                  onChange={(e) =>
                    void c.patchType("brand_photography", (d) => ({
                      ...d,
                      items: (d.items || []).map((x: any) =>
                        x.id === p.id ? { ...x, caption: e.target.value } : x
                      ),
                    }))
                  }
                />
                <RowActions
                  onDelete={() =>
                    void c.patchType("brand_photography", (d) => ({
                      ...d,
                      items: (d.items || []).filter((x: any) => x.id !== p.id),
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <AddRow
            label="Add photo"
            onClick={() =>
              void c.patchType("brand_photography", (d) => ({
                ...d,
                items: [...(d.items || []), { id: generateUUID(), assetId: "", caption: "", type: "do" }],
              }))
            }
          />
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionTitle>Style tags</SectionTitle>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {tags.map((t) => (
            <span key={t} className="style-tag" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span className="value-pill" style={{ padding: "6px 12px", borderRadius: 999, background: "var(--tool-surface-card)" }}>
                {t}
              </span>
              <span
                className="icon-btn"
                onClick={() =>
                  void c.patchType("brand_photography", (d) => ({
                    ...d,
                    tags: (d.tags || []).filter((x: string) => x !== t),
                  }))
                }
              >
                ×
              </span>
            </span>
          ))}
          <input
            className="field-input"
            style={{ width: 160 }}
            placeholder="Add tag"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagDraft.trim()) {
                void c.patchType("brand_photography", (d) => ({
                  ...d,
                  tags: [...(d.tags || []), tagDraft.trim()],
                }));
                setTagDraft("");
              }
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Photo Do / Don&apos;t</SectionTitle>
        <Card>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {(["do", "dont"] as const).map((side) => (
              <div key={side} style={{ flex: 1, minWidth: 240 }}>
                <span
                  style={{
                    fontSize: 20,
                    color: side === "do" ? "var(--tool-accent-success)" : "var(--tool-accent-danger)",
                    fontWeight: 500,
                  }}
                >
                  {side === "do" ? "Do" : "Don't"}
                </span>
                {(side === "do" ? dos : donts).map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() =>
                      c.openDrawer({ kind: "photo", sectionType: "photography_style", itemId: item.id, side })
                    }
                    style={{ marginTop: 12, cursor: "pointer" }}
                  >
                    <div
                      style={{
                        height: 140,
                        borderRadius: 8,
                        background: item.assetId
                          ? `url(${assetSrc(c.assets, item.assetId)}) center/cover no-repeat`
                          : "var(--tool-surface-card)",
                      }}
                    />
                    <span style={{ fontSize: 13 }}>{item.caption}</span>
                  </div>
                ))}
                <AddRow
                  label={`Add ${side} example`}
                  onClick={() => c.openDrawer({ kind: "photo", sectionType: "photography_style", side })}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <DownloadLinks
        links={links}
        onAdd={() => c.openDrawer({ kind: "link", sectionType: "imagery_download_links" })}
        onEdit={(id) => c.openDrawer({ kind: "link", sectionType: "imagery_download_links", linkId: id })}
        onDelete={(id) =>
          void c.patchType("imagery_download_links", (d) => ({
            ...d,
            links: (d.links || []).filter((l: any) => l.id !== id),
          }))
        }
      />
      <PhotoExampleDrawer />
      {linkDrawer}
    </div>
  );
}
