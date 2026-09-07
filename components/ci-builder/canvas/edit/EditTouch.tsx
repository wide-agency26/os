"use client";

import React from "react";
import { generateUUID } from "@/lib/ci-builder/types";
import { useCanvas } from "../CiCanvasContext";
import { ModuleFigmaResync } from "../ModuleFigmaResync";
import { AddRow, Card, ImageWell, ModuleHero, RowActions, SectionTitle, assetSrc } from "../ui";
import { DownloadLinks } from "./EditLogo";
import { useLinkDrawer } from "../CiCanvasDrawers";

export function EditTouch() {
  const c = useCanvas();
  const social4 = itemsOf(c.sectionByType("social_4x5")?.data, "4:5");
  const social9 = itemsOf(c.sectionByType("social_9x16")?.data, "9:16");
  const emails = emailItems(c.sectionByType("email_signatures")?.data);
  const decks = deckItems(c.sectionByType("presentation_deck")?.data);
  const links = ((c.sectionByType("touchpoints_download_links")?.data as any)?.links || []) as any[];
  const linkDrawer = useLinkDrawer();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <ModuleHero
        eyebrow="09 · Touchpoints"
        title="Touchpoints."
        blurb="Social, email, and deck templates — blank add with image upload."
        editMode={c.editMode}
        onToggleEdit={() => c.setEditMode(!c.editMode)}
      />

      <ModuleFigmaResync moduleKey="touch" />

      <TouchList
        title="Social"
        items={[...social4.map((i) => ({ ...i, type: "social_4x5" as const })), ...social9.map((i) => ({ ...i, type: "social_9x16" as const }))]}
        onAdd={(type) =>
          void c.patchType(type, (d) => ({
            ...d,
            items: [
              ...itemsOf(d, type === "social_4x5" ? "4:5" : "9:16"),
              { id: generateUUID(), label: "New template", dims: type === "social_4x5" ? "1080×1350" : "1080×1920", assetId: "" },
            ],
          }))
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Email</SectionTitle>
        <Card>
          {emails.map((e) => (
            <div key={e.id} style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
              {c.guideline?.id ? (
                <ImageWell
                  url={assetSrc(c.assets, e.assetId)}
                  guidelineId={c.guideline.id}
                  assets={c.assets}
                  onAddAsset={(a) => void c.addAsset(a)}
                  onSelect={(a) =>
                    void c.patchType("email_signatures", (d) => ({
                      ...d,
                      signatures: emailItems(d).map((x) => (x.id === e.id ? { ...x, assetId: a.id } : x)),
                      assetId: d.assetId || a.id,
                    }))
                  }
                  size={64}
                />
              ) : null}
              <div style={{ flex: 1 }}>
                <input
                  className="field-input"
                  placeholder="Name"
                  value={e.name}
                  onChange={(ev) =>
                    void c.patchType("email_signatures", (d) => ({
                      ...d,
                      signatures: emailItems(d).map((x) => (x.id === e.id ? { ...x, name: ev.target.value } : x)),
                    }))
                  }
                />
                <input
                  className="field-input"
                  style={{ marginTop: 8 }}
                  placeholder="Title"
                  value={e.title}
                  onChange={(ev) =>
                    void c.patchType("email_signatures", (d) => ({
                      ...d,
                      signatures: emailItems(d).map((x) => (x.id === e.id ? { ...x, title: ev.target.value } : x)),
                    }))
                  }
                />
              </div>
              <RowActions
                onDelete={() =>
                  void c.patchType("email_signatures", (d) => ({
                    ...d,
                    signatures: emailItems(d).filter((x) => x.id !== e.id),
                  }))
                }
              />
            </div>
          ))}
          <AddRow
            label="Add email signature"
            onClick={() =>
              void c.patchType("email_signatures", (d) => ({
                ...d,
                signatures: [...emailItems(d), { id: generateUUID(), name: "", title: "", assetId: "" }],
              }))
            }
          />
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionTitle>Deck</SectionTitle>
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {decks.map((s) => (
              <div key={s.id}>
                {c.guideline?.id ? (
                  <ImageWell
                    url={assetSrc(c.assets, s.assetId)}
                    guidelineId={c.guideline.id}
                    assets={c.assets}
                    onAddAsset={(a) => void c.addAsset(a)}
                    onSelect={(a) =>
                      void c.patchType("presentation_deck", (d) => ({
                        ...d,
                        slides: deckItems(d).map((x) => (x.id === s.id ? { ...x, assetId: a.id } : x)),
                      }))
                    }
                    size="100%"
                    label="Slide"
                  />
                ) : null}
                <input
                  className="field-input"
                  style={{ marginTop: 8 }}
                  value={s.label}
                  onChange={(e) =>
                    void c.patchType("presentation_deck", (d) => ({
                      ...d,
                      slides: deckItems(d).map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)),
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <AddRow
            label="Add deck slide"
            onClick={() =>
              void c.patchType("presentation_deck", (d) => ({
                ...d,
                slides: [...deckItems(d), { id: generateUUID(), label: "Slide", assetId: "" }],
              }))
            }
          />
        </Card>
      </div>

      <DownloadLinks
        links={links}
        onAdd={() => c.openDrawer({ kind: "link", sectionType: "touchpoints_download_links" })}
        onEdit={(id) => c.openDrawer({ kind: "link", sectionType: "touchpoints_download_links", linkId: id })}
        onDelete={(id) =>
          void c.patchType("touchpoints_download_links", (d) => ({
            ...d,
            links: (d.links || []).filter((l: any) => l.id !== id),
          }))
        }
      />
      {linkDrawer}
    </div>
  );
}

function itemsOf(data: any, dims: string) {
  if (Array.isArray(data?.items) && data.items.length) return data.items as { id: string; label: string; dims?: string; assetId?: string }[];
  if (data?.assetId) {
    return [{ id: "main", label: data.label || "Template", dims, assetId: data.assetId }];
  }
  return [];
}

function emailItems(data: any) {
  if (Array.isArray(data?.signatures) && data.signatures.length) return data.signatures as { id: string; name: string; title: string; assetId?: string }[];
  if (data?.assetId || data?.html) {
    return [{ id: "main", name: data.name || "", title: data.title || "", assetId: data.assetId }];
  }
  return [];
}

function deckItems(data: any) {
  if (Array.isArray(data?.slides)) return data.slides as { id: string; label: string; assetId?: string }[];
  return [];
}

function TouchList({
  title,
  items,
  onAdd,
}: {
  title: string;
  items: { id: string; label: string; dims?: string; assetId?: string; type: "social_4x5" | "social_9x16" }[];
  onAdd: (type: "social_4x5" | "social_9x16") => void;
}) {
  const c = useCanvas();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionTitle>{title}</SectionTitle>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
          {items.map((item) => (
            <div key={`${item.type}-${item.id}`}>
              {c.guideline?.id ? (
                <ImageWell
                  url={assetSrc(c.assets, item.assetId)}
                  guidelineId={c.guideline.id}
                  assets={c.assets}
                  onAddAsset={(a) => void c.addAsset(a)}
                  onSelect={(a) =>
                    void c.patchType(item.type, (d) => {
                      const list = itemsOf(d, item.dims || "");
                      const next = list.length
                        ? list.map((x) => (x.id === item.id ? { ...x, assetId: a.id } : x))
                        : [{ id: item.id, label: item.label, dims: item.dims, assetId: a.id }];
                      return { ...d, items: next, assetId: d.assetId || a.id };
                    })
                  }
                  size="100%"
                  label={item.dims || "Preview"}
                />
              ) : null}
              <input
                className="field-input"
                style={{ marginTop: 8 }}
                value={item.label}
                onChange={(e) =>
                  void c.patchType(item.type, (d) => ({
                    ...d,
                    items: itemsOf(d, item.dims || "").map((x) =>
                      x.id === item.id ? { ...x, label: e.target.value } : x
                    ),
                  }))
                }
              />
              <span className="mono" style={{ fontSize: 11, color: "var(--tool-text-muted)" }}>
                {item.dims}
              </span>
            </div>
          ))}
        </div>
        <AddRow label="Add 4:5 template" onClick={() => onAdd("social_4x5")} />
        <AddRow label="Add 9:16 template" onClick={() => onAdd("social_9x16")} />
      </Card>
    </div>
  );
}
