"use client";

import React, { useMemo, useState } from "react";
import {
  CISection,
  CIAsset,
  generateUUID,
} from "@/lib/ci-builder/types";
import {
  getSubModule,
  type CiRendererKind,
} from "@/lib/ci-builder/modules-catalog";
import { SectionContainer } from "./SectionContainer";
import {
  EditableText,
  EditableImage,
  EditableColor,
  EditableListItem,
  AddItemButton,
  CopyableValue,
} from "../primitives";
import { Download, Moon, Sun } from "lucide-react";

export type ClientViewMode = "presentation" | "elements";

export interface SubModuleSectionProps {
  section: Partial<CISection>;
  assets?: Partial<CIAsset>[];
  allAssets?: Partial<CIAsset>[];
  allSections?: Partial<CISection>[];
  isAdmin?: boolean;
  viewMode?: ClientViewMode;
  onUpdateData?: (newData: any) => void;
  onEditSectionFields?: (fields: Partial<CISection>) => void;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
  onDeleteAssetRecord?: (assetId: string) => void;
  guidelineId?: string;
}

function findAsset(
  assets: Partial<CIAsset>[],
  assetId?: string
): Partial<CIAsset> | undefined {
  if (!assetId) return undefined;
  return assets.find((a) => a.id === assetId);
}


function LocalImage({
  assetId,
  assets,
  isAdmin,
  guidelineId,
  compatibleKind,
  onSelect,
  className,
}: {
  assetId?: string;
  assets: Partial<CIAsset>[];
  isAdmin?: boolean;
  guidelineId?: string;
  compatibleKind?: string;
  onSelect: (a: Partial<CIAsset>) => void;
  className?: string;
}) {
  const matched = assets.find((a) => a.id === assetId);
  return (
    <EditableImage
      assetId={assetId}
      currentUrl={matched?.public_url}
      availableAssets={assets}
      isAdmin={isAdmin}
      guidelineId={guidelineId}
      compatibleKind={compatibleKind}
      onSelectAsset={onSelect}
      className={className}
      imageClassName={className}
    />
  );
}

function LocalColor({
  id,
  name,
  hex,
  cssVar,
  isAdmin,
  onUpdate,
}: {
  id: string;
  name: string;
  hex: string;
  cssVar?: string;
  isAdmin?: boolean;
  onUpdate: (s: { id: string; name: string; hex: string; cssVar?: string }) => void;
}) {
  return (
    <EditableColor
      swatch={{ id, name, hex, cssVar }}
      isAdmin={isAdmin}
      onUpdate={(updated) =>
        onUpdate({
          id: updated.id,
          name: updated.name,
          hex: updated.hex,
          cssVar: updated.cssVar,
        })
      }
    />
  );
}


export function SubModuleSection({
  section,
  assets = [],
  allAssets = [],
  isAdmin,
  viewMode = "presentation",
  onUpdateData,
  onEditSectionFields,
  onAddAssetRecord,
  guidelineId = "",
}: SubModuleSectionProps) {
  const def = getSubModule(section.section_type);
  const data = (section.data || {}) as Record<string, any>;
  const pool = assets.length > 0 ? assets : allAssets;
  const elements = !isAdmin && viewMode === "elements";
  const [stage, setStage] = useState<"light" | "dark">("light");

  const update = (patch: Record<string, any>) => {
    if (onUpdateData) onUpdateData({ ...data, ...patch });
  };

  const kind: CiRendererKind | "generic" = def?.renderer || "text";

  const hint = useMemo(() => {
    if (!def || !isAdmin) return null;
    return (
      <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
        <span className="font-semibold text-gray-700">{def.inputType}</span>
        {" · "}
        {def.tier}
        {" — "}
        {def.adminEdit}
      </p>
    );
  }, [def, isAdmin]);

  const elementsHint = useMemo(() => {
    if (!def || !elements) return null;
    return (
      <p className="text-[11px] text-gray-500 mb-4">{def.elementsView}</p>
    );
  }, [def, elements]);

  const body = (() => {
    switch (kind) {
      case "text":
        return (
          <div
            className={
              elements
                ? "space-y-3"
                : "p-6 md:p-8 rounded-2xl border border-[var(--ci-border,#eaeaea)] bg-white/60 backdrop-blur"
            }
          >
            {elements && (
              <CopyableValue label="Raw text" value={data.body || ""} />
            )}
            <EditableText
              tag="p"
              multiline
              value={data.body || ""}
              placeholder="Enter content…"
              onSave={(body) => update({ body })}
              isAdmin={isAdmin}
              className={
                elements
                  ? "text-sm text-gray-800 whitespace-pre-wrap"
                  : "text-xl md:text-2xl leading-relaxed font-medium text-[var(--ci-text,#111)]"
              }
            />
          </div>
        );

      case "claim_pitch":
        return (
          <div className="space-y-6">
            <div className="border-l-4 border-[var(--ci-accent,#0066FF)] pl-6">
              <EditableText
                tag="h3"
                value={data.claim || ""}
                placeholder="1-liner claim…"
                onSave={(claim) => update({ claim })}
                isAdmin={isAdmin}
                className="text-3xl md:text-4xl font-bold tracking-tight"
              />
            </div>
            {(data.pitch || isAdmin) && (
              <EditableText
                tag="p"
                multiline
                value={data.pitch || ""}
                placeholder="30-sec elevator pitch…"
                onSave={(pitch) => update({ pitch })}
                isAdmin={isAdmin}
                className="text-base text-gray-600 leading-relaxed"
              />
            )}
            {elements && (
              <div className="grid gap-2">
                <CopyableValue label="Claim" value={data.claim || ""} />
                <CopyableValue label="Pitch" value={data.pitch || ""} />
              </div>
            )}
          </div>
        );

      case "list": {
        const items: { id: string; title: string; description: string }[] =
          data.items || [];
        return (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {items.map((item, idx) => (
                <EditableListItem
                  key={item.id}
                  isAdmin={isAdmin}
                  onDelete={() =>
                    update({ items: items.filter((i) => i.id !== item.id) })
                  }
                  deleteConfirmTitle="Remove this value?"
                >
                  <div className="p-5 rounded-xl border border-[var(--ci-border,#eaeaea)] bg-white h-full">
                    <div className="text-xs font-bold text-[var(--ci-accent)] mb-2">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <EditableText
                      value={item.title}
                      placeholder="Title"
                      onSave={(title) =>
                        update({
                          items: items.map((i) =>
                            i.id === item.id ? { ...i, title } : i
                          ),
                        })
                      }
                      isAdmin={isAdmin}
                      className="font-semibold text-lg mb-2"
                    />
                    <EditableText
                      multiline
                      value={item.description}
                      placeholder="Description"
                      onSave={(description) =>
                        update({
                          items: items.map((i) =>
                            i.id === item.id ? { ...i, description } : i
                          ),
                        })
                      }
                      isAdmin={isAdmin}
                      className="text-sm text-gray-600"
                    />
                  </div>
                </EditableListItem>
              ))}
            </div>
            {isAdmin && (
              <AddItemButton
                isAdmin={isAdmin}
                label="Add Value"
                onClick={() =>
                  update({
                    items: [
                      ...items,
                      {
                        id: generateUUID(),
                        title: "New value",
                        description: "Describe this pillar…",
                      },
                    ],
                  })
                }
              />
            )}
            {elements && (
              <div className="mt-4">
                <CopyableValue
                  label="Values list"
                  value={items
                    .map((i) => `• ${i.title}: ${i.description}`)
                    .join("\n")}
                />
              </div>
            )}
          </div>
        );
      }

      case "archetype": {
        const traits: { id: string; word: string }[] = data.traits || [];
        return (
          <div className="space-y-4">
            <EditableText
              value={data.archetype || ""}
              placeholder="Archetype (e.g. Magician, Rebel)…"
              onSave={(archetype) => update({ archetype })}
              isAdmin={isAdmin}
              className="inline-flex px-4 py-2 rounded-full bg-[var(--ci-accent)]/10 text-[var(--ci-accent)] font-bold text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {traits.map((t) => (
                <EditableListItem
                  key={t.id}
                  isAdmin={isAdmin}
                  onDelete={() =>
                    update({ traits: traits.filter((x) => x.id !== t.id) })
                  }
                >
                  <EditableText
                    value={t.word}
                    placeholder="Trait"
                    onSave={(word) =>
                      update({
                        traits: traits.map((x) =>
                          x.id === t.id ? { ...x, word } : x
                        ),
                      })
                    }
                    isAdmin={isAdmin}
                    className="px-3 py-1 rounded-full border text-sm"
                  />
                </EditableListItem>
              ))}
              {isAdmin && (
                <AddItemButton
                isAdmin={isAdmin}
                  label="Add trait"
                  onClick={() =>
                    update({
                      traits: [
                        ...traits,
                        { id: generateUUID(), word: "Trait" },
                      ],
                    })
                  }
                />
              )}
            </div>
          </div>
        );
      }

      case "dual_list":
      case "copy_examples": {
        const leftKey = kind === "dual_list" ? "dos" : "approved";
        const rightKey = kind === "dual_list" ? "donts" : "forbidden";
        const left: { id: string; text: string }[] = data[leftKey] || [];
        const right: { id: string; text: string }[] = data[rightKey] || [];
        const col = (
          key: string,
          items: { id: string; text: string }[],
          title: string,
          tone: "good" | "bad"
        ) => (
          <div
            className={`rounded-xl border p-4 ${
              tone === "good"
                ? "border-emerald-200 bg-emerald-50/50"
                : "border-rose-200 bg-rose-50/50"
            }`}
          >
            <h4 className="text-xs font-bold uppercase tracking-wider mb-3">
              {title}
            </h4>
            <div className="space-y-2">
              {items.map((item) => (
                <EditableListItem
                  key={item.id}
                  isAdmin={isAdmin}
                  onDelete={() =>
                    update({
                      [key]: items.filter((i) => i.id !== item.id),
                    })
                  }
                >
                  <EditableText
                    multiline
                    value={item.text}
                    placeholder="Rule or example…"
                    onSave={(text) =>
                      update({
                        [key]: items.map((i) =>
                          i.id === item.id ? { ...i, text } : i
                        ),
                      })
                    }
                    isAdmin={isAdmin}
                    className="text-sm"
                  />
                </EditableListItem>
              ))}
            </div>
            {isAdmin && (
              <AddItemButton
                isAdmin={isAdmin}
                label="Add"
                onClick={() =>
                  update({
                    [key]: [
                      ...items,
                      { id: generateUUID(), text: "New item…" },
                    ],
                  })
                }
              />
            )}
          </div>
        );
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {col(leftKey, left, kind === "dual_list" ? "Do's" : "Approved", "good")}
            {col(
              rightKey,
              right,
              kind === "dual_list" ? "Don'ts" : "Forbidden",
              "bad"
            )}
          </div>
        );
      }

      case "sliders": {
        const axes: {
          id: string;
          left: string;
          right: string;
          value: number;
        }[] = data.axes || [];
        return (
          <div className="space-y-6 max-w-xl">
            {axes.map((axis) => (
              <div key={axis.id}>
                <div className="flex justify-between text-xs font-medium text-gray-500 mb-2">
                  <span>{axis.left}</span>
                  <span className="text-[var(--ci-accent)]">{axis.value}</span>
                  <span>{axis.right}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={axis.value}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    update({
                      axes: axes.map((a) =>
                        a.id === axis.id
                          ? { ...a, value: Number(e.target.value) }
                          : a
                      ),
                    })
                  }
                  className="w-full accent-[var(--ci-accent,#0066FF)]"
                />
                {elements && (
                  <CopyableValue
                    label={`${axis.left}↔${axis.right}`}
                    value={String(axis.value)}
                  />
                )}
              </div>
            ))}
          </div>
        );
      }

      case "code":
        return (
          <div className="rounded-xl bg-gray-950 text-gray-100 p-4 font-mono text-sm">
            {elements && (
              <div className="mb-3">
                <CopyableValue label="Master prompt" value={data.prompt || ""} />
              </div>
            )}
            <EditableText
              tag="pre"
              multiline
              value={data.prompt || ""}
              placeholder="System prompt with {brand_name}, {tone}, {mission}…"
              onSave={(prompt) => update({ prompt })}
              isAdmin={isAdmin}
              className="whitespace-pre-wrap leading-relaxed min-h-[120px]"
            />
          </div>
        );

      case "image_slot":
      case "clearspace":
      case "ui_button":
      case "email_sig":
      case "container_spec": {
        const variants: {
          id: string;
          assetId: string;
          label: string;
        }[] =
          Array.isArray(data.variants) && data.variants.length > 0
            ? data.variants
            : data.assetId
              ? [
                  {
                    id: "main",
                    assetId: data.assetId,
                    label: data.label || "",
                  },
                ]
              : [];
        const stageBg = stage === "dark" ? "bg-gray-900" : "bg-gray-50";
        if (variants.length > 1) {
          return (
            <div className="space-y-4">
              {!elements && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStage("light")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border ${
                      stage === "light" ? "bg-white border-gray-300" : "border-transparent"
                    }`}
                  >
                    <Sun size={12} /> Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage("dark")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border ${
                      stage === "dark"
                        ? "bg-gray-800 text-white border-gray-700"
                        : "border-transparent"
                    }`}
                  >
                    <Moon size={12} /> Dark
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {variants.map((v) => (
                  <div
                    key={v.id}
                    className={`rounded-2xl border border-[var(--ci-border,#eaeaea)] p-6 flex flex-col ${stageBg}`}
                  >
                    <div className="min-h-[140px] flex items-center justify-center mb-3">
                      <LocalImage
                        assetId={v.assetId}
                        assets={allAssets.length ? allAssets : pool}
                        isAdmin={isAdmin}
                        guidelineId={guidelineId}
                        compatibleKind={section.section_type || "logo"}
                        onSelect={(selected) => {
                          const next = variants.map((x) =>
                            x.id === v.id
                              ? {
                                  ...x,
                                  assetId: selected.id || "",
                                  label: selected.label || x.label,
                                }
                              : x
                          );
                          update({
                            variants: next,
                            assetId: next[0]?.assetId || "",
                            label: next[0]?.label || data.label || "",
                          });
                        }}
                        className="max-h-36 max-w-full object-contain"
                      />
                    </div>
                    <EditableText
                      value={v.label}
                      placeholder="Label"
                      onSave={(label) => {
                        const next = variants.map((x) =>
                          x.id === v.id ? { ...x, label } : x
                        );
                        update({
                          variants: next,
                          label: next[0]?.label || "",
                        });
                      }}
                      isAdmin={isAdmin}
                      className="font-semibold text-sm"
                    />
                  </div>
                ))}
              </div>
              {kind === "clearspace" && (data.notes || isAdmin) && (
                <EditableText
                  multiline
                  value={data.notes || ""}
                  placeholder="Clearspace notes…"
                  onSave={(notes) => update({ notes })}
                  isAdmin={isAdmin}
                  className="text-sm text-gray-600"
                />
              )}
            </div>
          );
        }
        const slotAsset = findAsset(pool, data.assetId);
        return (
          <div className="space-y-4">
            {!elements && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStage("light")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border ${
                    stage === "light" ? "bg-white border-gray-300" : "border-transparent"
                  }`}
                >
                  <Sun size={12} /> Light
                </button>
                <button
                  type="button"
                  onClick={() => setStage("dark")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border ${
                    stage === "dark" ? "bg-gray-800 text-white border-gray-700" : "border-transparent"
                  }`}
                >
                  <Moon size={12} /> Dark
                </button>
              </div>
            )}
            <div
              className={`rounded-2xl border border-[var(--ci-border,#eaeaea)] p-8 flex items-center justify-center min-h-[200px] ${stageBg}`}
            >
              <LocalImage
                assetId={data.assetId}
                assets={allAssets.length ? allAssets : pool}
                isAdmin={isAdmin}
                guidelineId={guidelineId}
                compatibleKind={section.section_type || "logo"}
                onSelect={(selected) => {
                  update({
                    assetId: selected.id || "",
                    label: selected.label || data.label || "",
                  });
                }}
                className="max-h-40 max-w-full object-contain"
              />
            </div>
            {(data.label || isAdmin) && (
              <EditableText
                value={data.label || ""}
                placeholder="Label / usage note"
                onSave={(label) => update({ label })}
                isAdmin={isAdmin}
                className="text-sm font-medium"
              />
            )}
            {kind === "clearspace" && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Clearspace multiplier</span>
                {isAdmin ? (
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={data.multiplier ?? 1.5}
                    onChange={(e) =>
                      update({ multiplier: Number(e.target.value) })
                    }
                    className="w-20 border rounded px-2 py-1 text-sm"
                  />
                ) : (
                  <span className="font-semibold">{data.multiplier ?? 1.5}×</span>
                )}
              </div>
            )}
            {elements && slotAsset?.public_url && (
              <div className="flex flex-wrap gap-2">
                <a
                  href={slotAsset.public_url}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-gray-50"
                >
                  <Download size={12} /> Download asset
                </a>
                <CopyableValue label="CDN URL" value={slotAsset.public_url} />
              </div>
            )}
            {kind === "ui_button" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {(["bg", "text", "border", "radius", "padding"] as const).map(
                  (field) =>
                    isAdmin || data[field] ? (
                      <div key={field}>
                        <div className="text-[10px] uppercase text-gray-400 mb-1">
                          {field}
                        </div>
                        {field === "bg" || field === "text" || field === "border" ? (
                          <LocalColor
                            id={field}
                            name={field}
                            hex={data[field] || "#000000"}
                            isAdmin={isAdmin}
                            onUpdate={(s) => update({ [field]: s.hex })}
                          />
                        ) : (
                          <EditableText
                            value={data[field] || ""}
                            placeholder={field}
                            onSave={(v) => update({ [field]: v })}
                            isAdmin={isAdmin}
                            className="text-sm"
                          />
                        )}
                      </div>
                    ) : null
                )}
              </div>
            )}
          </div>
        );
      }

      case "image_dual": {
        const items: {
          id: string;
          type: "do" | "dont";
          assetId: string;
          caption: string;
        }[] = data.items || [];
        const renderCol = (type: "do" | "dont") => (
          <div>
            <h4
              className={`text-xs font-bold uppercase mb-3 ${
                type === "do" ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {type === "do" ? "Do" : "Don't"}
            </h4>
            <div className="space-y-3">
              {items
                .filter((i) => i.type === type)
                .map((item) => {
                  const asset = findAsset(pool, item.assetId);
                  return (
                    <EditableListItem
                      key={item.id}
                      isAdmin={isAdmin}
                      onDelete={() =>
                        update({
                          items: items.filter((x) => x.id !== item.id),
                        })
                      }
                    >
                      <div className="rounded-xl border p-3 space-y-2">
                        <LocalImage
                          assetId={item.assetId}
                          assets={allAssets.length ? allAssets : pool}
                          isAdmin={isAdmin}
                          guidelineId={guidelineId}
                          onSelect={(selected) =>
                            update({
                              items: items.map((x) =>
                                x.id === item.id
                                  ? { ...x, assetId: selected.id || "" }
                                  : x
                              ),
                            })
                          }
                          className="w-full h-32 object-contain bg-gray-50 rounded"
                        />
                        <EditableText
                          value={item.caption}
                          placeholder="Caption"
                          onSave={(caption) =>
                            update({
                              items: items.map((x) =>
                                x.id === item.id ? { ...x, caption } : x
                              ),
                            })
                          }
                          isAdmin={isAdmin}
                          className="text-sm"
                        />
                      </div>
                    </EditableListItem>
                  );
                })}
            </div>
            {isAdmin && (
              <AddItemButton
                isAdmin={isAdmin}
                label={`Add ${type === "do" ? "Do" : "Don't"}`}
                onClick={() =>
                  update({
                    items: [
                      ...items,
                      {
                        id: generateUUID(),
                        type,
                        assetId: "",
                        caption: "",
                      },
                    ],
                  })
                }
              />
            )}
          </div>
        );
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderCol("do")}
            {renderCol("dont")}
          </div>
        );
      }

      case "color_group":
      case "color_format": {
        const swatches: {
          id: string;
          name: string;
          hex: string;
          cssVar?: string;
          rgb?: string;
          cmyk?: string;
        }[] = data.swatches || [];
        return (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {swatches.map((s) => (
                <EditableListItem
                  key={s.id}
                  isAdmin={isAdmin}
                  onDelete={() =>
                    update({
                      swatches: swatches.filter((x) => x.id !== s.id),
                    })
                  }
                >
                  <div className="rounded-xl overflow-hidden border">
                    <div
                      className="h-24"
                      style={{ background: s.hex || "#ccc" }}
                    />
                    <div className="p-3 space-y-1">
                      <EditableText
                        value={s.name}
                        placeholder="Name"
                        onSave={(name) =>
                          update({
                            swatches: swatches.map((x) =>
                              x.id === s.id ? { ...x, name } : x
                            ),
                          })
                        }
                        isAdmin={isAdmin}
                        className="font-semibold text-sm"
                      />
                      <LocalColor
                        id={s.id}
                        name={s.name}
                        hex={s.hex}
                        cssVar={s.cssVar}
                        isAdmin={isAdmin}
                        onUpdate={(updated) =>
                          update({
                            swatches: swatches.map((x) =>
                              x.id === s.id
                                ? {
                                    ...x,
                                    name: updated.name,
                                    hex: updated.hex,
                                    cssVar: updated.cssVar,
                                  }
                                : x
                            ),
                          })
                        }
                      />
                      {elements && (
                        <>
                          <CopyableValue label="HEX" value={s.hex} />
                          {s.cssVar && (
                            <CopyableValue label="CSS var" value={s.cssVar} />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </EditableListItem>
              ))}
            </div>
            {isAdmin && (
              <AddItemButton
                isAdmin={isAdmin}
                label="Add swatch"
                onClick={() =>
                  update({
                    swatches: [
                      ...swatches,
                      {
                        id: generateUUID(),
                        name: "Color",
                        hex: "#0066FF",
                        cssVar: "--color-token",
                      },
                    ],
                  })
                }
              />
            )}
          </div>
        );
      }

      case "color_scale": {
        const scales: {
          id: string;
          token: string;
          shades: { step: string; hex: string }[];
        }[] = data.scales || [];
        return (
          <div className="space-y-4">
            {scales.map((scale) => (
              <div key={scale.id}>
                <EditableText
                  value={scale.token}
                  placeholder="Token name"
                  onSave={(token) =>
                    update({
                      scales: scales.map((s) =>
                        s.id === scale.id ? { ...s, token } : s
                      ),
                    })
                  }
                  isAdmin={isAdmin}
                  className="font-semibold mb-2"
                />
                <div className="flex rounded-lg overflow-hidden h-12">
                  {(scale.shades || []).map((sh) => (
                    <div
                      key={sh.step}
                      className="flex-1"
                      style={{ background: sh.hex }}
                      title={`${sh.step}: ${sh.hex}`}
                    />
                  ))}
                </div>
              </div>
            ))}
            {isAdmin && (
              <AddItemButton
                isAdmin={isAdmin}
                label="Add scale"
                onClick={() =>
                  update({
                    scales: [
                      ...scales,
                      {
                        id: generateUUID(),
                        token: "blue",
                        shades: [
                          { step: "50", hex: "#eff6ff" },
                          { step: "500", hex: "#3b82f6" },
                          { step: "900", hex: "#1e3a8a" },
                        ],
                      },
                    ],
                  })
                }
              />
            )}
          </div>
        );
      }

      case "wcag": {
        const pairs: {
          id: string;
          bg: string;
          text: string;
          ratio: string;
          level: string;
        }[] = data.pairs || [];
        return (
          <div className="space-y-2">
            {pairs.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-lg border"
              >
                <div
                  className="w-16 h-10 rounded flex items-center justify-center text-xs font-bold"
                  style={{ background: p.bg, color: p.text }}
                >
                  Aa
                </div>
                <div className="text-sm flex-1">
                  {p.bg} on {p.text} · {p.ratio}:1 · {p.level}
                </div>
              </div>
            ))}
            {isAdmin && pairs.length === 0 && (
              <p className="text-sm text-gray-500">
                Add contrast pairs via import or manually in a follow-up.
              </p>
            )}
          </div>
        );
      }

      case "type_spec":
        return (
          <div className="space-y-4">
            <EditableText
              value={data.sampleText || ""}
              placeholder="Sample headline…"
              onSave={(sampleText) => update({ sampleText })}
              isAdmin={isAdmin}
              className="tracking-tight"
              style={{
                fontFamily: data.fontFamily || "inherit",
                fontWeight: data.fontWeight || 600,
                fontSize: data.fontSize || "2.5rem",
                lineHeight: data.lineHeight || 1.1,
                letterSpacing: data.letterSpacing || "normal",
              }}
            />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {(
                [
                  "fontFamily",
                  "fontWeight",
                  "fontSize",
                  "lineHeight",
                  "letterSpacing",
                ] as const
              ).map((field) => (
                <div key={field}>
                  <div className="text-[10px] uppercase text-gray-400 mb-1">
                    {field}
                  </div>
                  <EditableText
                    value={data[field] || ""}
                    placeholder={field}
                    onSave={(v) => update({ [field]: v })}
                    isAdmin={isAdmin}
                    className="text-sm font-mono"
                  />
                </div>
              ))}
            </div>
            {elements && (
              <CopyableValue
                label="CSS"
                value={`font-family: ${data.fontFamily || "inherit"}; font-size: ${data.fontSize || "16px"}; font-weight: ${data.fontWeight || 400}; line-height: ${data.lineHeight || 1.4};`}
              />
            )}
          </div>
        );

      case "font_stack":
        return (
          <div>
            <EditableText
              value={data.stack || ""}
              placeholder="Primary, system-ui, sans-serif"
              onSave={(stack) => update({ stack })}
              isAdmin={isAdmin}
              className="font-mono text-sm p-3 rounded-lg bg-gray-50 border"
            />
            {elements && (
              <div className="mt-2">
                <CopyableValue
                  label="font-family"
                  value={`font-family: ${data.stack};`}
                />
              </div>
            )}
          </div>
        );

      case "type_scale":
      case "type_tokens": {
        const rows: { id: string; token: string; value: string }[] =
          data.scale || data.tokens || [];
        const key = kind === "type_scale" ? "scale" : "tokens";
        return (
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-baseline gap-4 border-b py-2"
              >
                <EditableText
                  value={row.token}
                  placeholder="token"
                  onSave={(token) =>
                    update({
                      [key]: rows.map((r) =>
                        r.id === row.id ? { ...r, token } : r
                      ),
                    })
                  }
                  isAdmin={isAdmin}
                  className="w-32 font-mono text-xs text-gray-500"
                />
                <EditableText
                  value={row.value}
                  placeholder="value"
                  onSave={(value) =>
                    update({
                      [key]: rows.map((r) =>
                        r.id === row.id ? { ...r, value } : r
                      ),
                    })
                  }
                  isAdmin={isAdmin}
                  className="flex-1"
                  style={
                    kind === "type_scale"
                      ? { fontSize: row.value || "1rem" }
                      : undefined
                  }
                />
              </div>
            ))}
            {isAdmin && (
              <AddItemButton
                isAdmin={isAdmin}
                label="Add token"
                onClick={() =>
                  update({
                    [key]: [
                      ...rows,
                      { id: generateUUID(), token: "token", value: "16px" },
                    ],
                  })
                }
              />
            )}
          </div>
        );
      }

      case "layout_grid":
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {(["columns", "gutters", "margins", "maxWidth"] as const).map(
              (field) => (
                <div key={field} className="p-4 rounded-xl border">
                  <div className="text-[10px] uppercase text-gray-400 mb-1">
                    {field}
                  </div>
                  {isAdmin ? (
                    <input
                      type="number"
                      value={data[field] ?? ""}
                      onChange={(e) =>
                        update({ [field]: Number(e.target.value) })
                      }
                      className="w-full border rounded px-2 py-1"
                    />
                  ) : (
                    <div className="text-xl font-bold">{data[field]}</div>
                  )}
                </div>
              )
            )}
          </div>
        );

      case "spacing": {
        const scale = data.scale || {};
        return (
          <div className="flex flex-wrap gap-3">
            {Object.entries(scale).map(([k, v]) => (
              <div
                key={k}
                className="p-3 rounded-lg border text-center min-w-[72px]"
              >
                <div className="text-[10px] uppercase text-gray-400">{k}</div>
                <div className="font-bold">{String(v)}px</div>
                <div
                  className="mx-auto mt-2 bg-[var(--ci-accent)]/30"
                  style={{ width: Number(v), height: Number(v), maxWidth: 48, maxHeight: 48 }}
                />
              </div>
            ))}
          </div>
        );
      }

      case "ui_states": {
        const states: {
          id: string;
          name: string;
          assetId: string;
          note: string;
        }[] = data.states || [];
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {states.map((st) => {
              const asset = findAsset(pool, st.assetId);
              return (
                <div key={st.id} className="rounded-xl border p-3 space-y-2">
                  <EditableText
                    value={st.name}
                    placeholder="State"
                    onSave={(name) =>
                      update({
                        states: states.map((s) =>
                          s.id === st.id ? { ...s, name } : s
                        ),
                      })
                    }
                    isAdmin={isAdmin}
                    className="text-xs font-bold uppercase"
                  />
                  <LocalImage
                    assetId={st.assetId}
                    assets={allAssets.length ? allAssets : pool}
                    isAdmin={isAdmin}
                    guidelineId={guidelineId}
                    onSelect={(selected) =>
                      update({
                        states: states.map((s) =>
                          s.id === st.id
                            ? { ...s, assetId: selected.id || "" }
                            : s
                        ),
                      })
                    }
                    className="h-20 object-contain w-full"
                  />
                </div>
              );
            })}
            {isAdmin && (
              <AddItemButton
                isAdmin={isAdmin}
                label="Add state"
                onClick={() =>
                  update({
                    states: [
                      ...states,
                      {
                        id: generateUUID(),
                        name: "Hover",
                        assetId: "",
                        note: "",
                      },
                    ],
                  })
                }
              />
            )}
          </div>
        );
      }

      case "icon_set": {
        const icons: { id: string; assetId: string; label: string }[] =
          data.icons || [];
        return (
          <div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3 mb-4">
              {icons.map((icon) => {
                const asset = findAsset(pool, icon.assetId);
                return (
                  <EditableListItem
                    key={icon.id}
                    isAdmin={isAdmin}
                    onDelete={() =>
                      update({
                        icons: icons.filter((i) => i.id !== icon.id),
                      })
                    }
                  >
                    <LocalImage
                      assetId={icon.assetId}
                      assets={allAssets.length ? allAssets : pool}
                      isAdmin={isAdmin}
                      guidelineId={guidelineId}
                      onSelect={(selected) =>
                        update({
                          icons: icons.map((i) =>
                            i.id === icon.id
                              ? {
                                  ...i,
                                  assetId: selected.id || "",
                                  label: selected.label || i.label,
                                }
                              : i
                          ),
                        })
                      }
                      className="h-12 w-12 object-contain mx-auto"
                    />
                  </EditableListItem>
                );
              })}
            </div>
            {isAdmin && (
              <AddItemButton
                isAdmin={isAdmin}
                label="Add icon"
                onClick={() =>
                  update({
                    icons: [
                      ...icons,
                      { id: generateUUID(), assetId: "", label: "Icon" },
                    ],
                  })
                }
              />
            )}
          </div>
        );
      }

      case "prompt_cards": {
        const prompts: {
          id: string;
          title: string;
          prompt: string;
          negative: string;
        }[] = data.prompts || [];
        return (
          <div className="space-y-3">
            {prompts.map((p) => (
              <div
                key={p.id}
                className="rounded-xl bg-gray-950 text-gray-100 p-4 space-y-2"
              >
                <EditableText
                  value={p.title}
                  placeholder="Prompt title"
                  onSave={(title) =>
                    update({
                      prompts: prompts.map((x) =>
                        x.id === p.id ? { ...x, title } : x
                      ),
                    })
                  }
                  isAdmin={isAdmin}
                  className="font-semibold text-sm"
                />
                <EditableText
                  multiline
                  value={p.prompt}
                  placeholder="Prompt…"
                  onSave={(prompt) =>
                    update({
                      prompts: prompts.map((x) =>
                        x.id === p.id ? { ...x, prompt } : x
                      ),
                    })
                  }
                  isAdmin={isAdmin}
                  className="font-mono text-xs whitespace-pre-wrap"
                />
                {elements && (
                  <CopyableValue label="Copy prompt" value={p.prompt} />
                )}
              </div>
            ))}
            {isAdmin && (
              <AddItemButton
                isAdmin={isAdmin}
                label="Add prompt"
                onClick={() =>
                  update({
                    prompts: [
                      ...prompts,
                      {
                        id: generateUUID(),
                        title: "Image prompt",
                        prompt: "",
                        negative: "",
                      },
                    ],
                  })
                }
              />
            )}
          </div>
        );
      }

      case "deck": {
        const slides: {
          id: string;
          label: string;
          assetId: string;
        }[] = data.slides || [];
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {slides.map((slide) => {
              const asset = findAsset(pool, slide.assetId);
              return (
                <div key={slide.id} className="rounded-xl border overflow-hidden">
                  <LocalImage
                    assetId={slide.assetId}
                    assets={allAssets.length ? allAssets : pool}
                    isAdmin={isAdmin}
                    guidelineId={guidelineId}
                    onSelect={(selected) =>
                      update({
                        slides: slides.map((s) =>
                          s.id === slide.id
                            ? { ...s, assetId: selected.id || "" }
                            : s
                        ),
                      })
                    }
                    className="aspect-video object-cover w-full bg-gray-100"
                  />
                  <div className="p-2">
                    <EditableText
                      value={slide.label}
                      placeholder="Slide label"
                      onSave={(label) =>
                        update({
                          slides: slides.map((s) =>
                            s.id === slide.id ? { ...s, label } : s
                          ),
                        })
                      }
                      isAdmin={isAdmin}
                      className="text-sm font-medium"
                    />
                  </div>
                </div>
              );
            })}
            {isAdmin && (
              <AddItemButton
                isAdmin={isAdmin}
                label="Add slide"
                onClick={() =>
                  update({
                    slides: [
                      ...slides,
                      {
                        id: generateUUID(),
                        label: "Slide",
                        assetId: "",
                      },
                    ],
                  })
                }
              />
            )}
          </div>
        );
      }

      default:
        return (
          <div className="p-6 border border-dashed rounded-xl text-sm text-gray-500">
            Sub-module renderer pending for{" "}
            <code>{section.section_type}</code>
            {isAdmin && (
              <pre className="mt-3 text-[10px] overflow-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        );
    }
  })();

  return (
    <SectionContainer
      section={section}
      isAdmin={isAdmin}
      onEditSectionFields={onEditSectionFields}
      promptVars={{
        "Brand Name": "",
        "Mission Statement": String(data.body || data.claim || ""),
        "Vision Statement": String(data.body || ""),
        "Value List": Array.isArray(data.items)
          ? data.items.map((i: any) => i.title).join(", ")
          : "",
        Claim: String(data.claim || ""),
        Pitch: String(data.pitch || ""),
        Archetype: String(data.archetype || ""),
        "Traits List": Array.isArray(data.traits)
          ? data.traits.map((t: any) => t.word).join(", ")
          : "",
        "SVG URL": findAsset(pool, data.assetId)?.public_url || "",
        URL: findAsset(pool, data.assetId)?.public_url || "",
        Hex: data.swatches?.[0]?.hex || data.bg || "",
        "Color Name": data.swatches?.[0]?.name || "",
        Font: data.fontFamily || "",
        Weight: data.fontWeight || "",
        Px: data.fontSize || "",
        Leading: data.lineHeight || "",
      }}
    >
      {hint}
      {elementsHint}
      {body}
    </SectionContainer>
  );
}
