"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CISection,
  CIAsset,
  CITheme,
  ColorSwatch,
  generateUUID,
  sectionPresentationIsEmpty,
} from "@/lib/ci-builder/types";
import {
  layoutPresentationIsEmpty,
  mergeModuleScopedSectionPresentation,
  moduleScopedSectionPresentationIsEmpty,
  pickLayoutPresentation,
} from "@/lib/ci-builder/module-presentation";
import { supportsSideImageLayout } from "@/lib/ci-builder/modules-catalog";
import {
  collectPresentationPalette,
} from "@/components/ci-builder/SectionPresentation";
import {
  getSubModule,
  type CiRendererKind,
} from "@/lib/ci-builder/modules-catalog";
import {
  LinkListPanel,
  TokenScalePanel,
  LogoMarksPanel,
  TypeScaleRowPanel,
} from "@/components/ci-builder/panels";
import type { CiLinkItem, CiLogoMark, CiTokenScaleItem } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";
import {
  EditableText,
  EditableImage,
  EditableColor,
  PresentationSwatch,
  EditableListItem,
  AddItemButton,
  CopyableValue,
  AdminDownloadsStrip,
  AssetDownloadButtons,
  AssetClickDownload,
  AssetPickerModal,
  FontFilesField,
} from "../primitives";
import { Moon, Sun, X } from "lucide-react";
import { ciFieldMonoClass } from "../primitives/formStyles";
import { ensureKeyedList, sanitizeListFields } from "@/lib/ci-builder/keyed-list";
import { nextShadeFromLast, toHexColor } from "@/lib/ci-builder/color-utils";
import {
  parseDownloads,
  primaryAssetIdFromData,
  rendererHasDownloads,
} from "@/lib/ci-builder/downloads";
import { sectionHasClientValue } from "@/lib/ci-builder/section-value";
import {
  clientSwatchLabel,
  familyKeyFromSwatch,
  groupSwatchesByFamily,
} from "@/lib/ci-builder/color-families";
import { cssLength, typeSpecCss } from "@/lib/ci-builder/type-css";
import {
  isColorRoleSection,
  COLOR_ROLE_SECTION_TYPES,
  colorRoleLabel,
} from "@/lib/ci-builder/color-cleanup";
import { getCiAssetDragId } from "@/lib/ci-builder/asset-drag";

export type ClientViewMode = "presentation" | "elements";

export interface SubModuleSectionProps {
  section: Partial<CISection>;
  assets?: Partial<CIAsset>[];
  allAssets?: Partial<CIAsset>[];
  allSections?: Partial<CISection>[];
  isAdmin?: boolean;
  viewMode?: ClientViewMode;
  hidePromptActions?: boolean;
  compact?: boolean;
  clustered?: boolean;
  headlineScale?: "h2" | "h3";
  followOn?: boolean;
  onUpdateData?: (newData: any) => void;
  onEditSectionFields?: (fields: Partial<CISection>) => void;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
  onDeleteAssetRecord?: (assetId: string) => void;
  onDeleteSection?: () => void;
  onMoveColorSwatches?: (swatchIds: string[], toSectionType: string) => void;
  guidelineId?: string;
  /** Brand book admin: show presentation controls on each section. */
  presentationEdit?: boolean;
  /** Module block owns module chrome; section can still override colors. */
  moduleScoped?: boolean;
  /** Guideline theme — used for presentation color chips. */
  theme?: CITheme | null;
  /** Template-specific presentation variant from view-model. */
  layoutVariant?: string;
}

function variantTileGridClass(count: number): string {
  if (count <= 1) return "grid grid-cols-1 max-w-sm gap-4";
  if (count === 2) return "grid grid-cols-2 gap-4 md:gap-5";
  if (count === 3) return "grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5";
  if (count === 4) return "grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5";
  return "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5";
}

function brandBookLogoGridClass(count: number): string {
  const cols = Math.min(4, Math.max(1, count));
  return `bb-logo-grid bb-logo-cols-${cols}`;
}

function dualItemGridClass(columns: number): string {
  if (columns <= 1) return "grid grid-cols-1 gap-3";
  if (columns === 2) return "grid grid-cols-1 sm:grid-cols-2 gap-3";
  return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3";
}

type ImageVariant = {
  id: string;
  assetId: string;
  label: string;
  stageColor?: string;
};

function readCanvasPalette(): string[] {
  if (typeof document === "undefined") return ["#FFFFFF", "#111111"];
  const el = document.querySelector(".ci-canvas") as HTMLElement | null;
  const src = el || document.documentElement;
  const s = getComputedStyle(src);
  const tokens = [
    s.getPropertyValue("--ci-bg").trim(),
    s.getPropertyValue("--ci-accent").trim(),
    s.getPropertyValue("--ci-accent-2").trim(),
    "#FFFFFF",
    "#111111",
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (!t) continue;
    if (!/^#[0-9a-fA-F]{3,8}$/.test(t)) continue;
    const hex = toHexColor(t);
    if (!seen.has(hex)) {
      seen.add(hex);
      out.push(hex);
    }
  }
  return out.length ? out : ["#FFFFFF", "#111111"];
}

function StageColorChips({
  value,
  palette,
  onChange,
}: {
  value?: string;
  palette: string[];
  onChange: (hex: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 pt-1">
      {palette.map((hex) => {
        const active = (value || "").toUpperCase() === hex.toUpperCase();
        return (
          <button
            key={hex}
            type="button"
            title={hex}
            aria-label={`Stage ${hex}`}
            className={`h-5 w-5 rounded-full border border-black/15 shrink-0 ${
              active ? "ring-2 ring-offset-1 ring-[var(--ci-text,#111)]" : ""
            }`}
            style={{ background: hex }}
            onClick={() => onChange(active ? undefined : hex)}
          />
        );
      })}
    </div>
  );
}

function findAsset(
  assets: Partial<CIAsset>[],
  assetId?: string
): Partial<CIAsset> | undefined {
  if (!assetId) return undefined;
  return assets.find((a) => a.id === assetId);
}

function keyed<T>(
  raw: unknown,
  textKey: string,
  aliases?: Record<string, string>
): T[] {
  return ensureKeyedList(raw, textKey, aliases ? { aliases } : undefined)
    .items as T[];
}


function LocalImage({
  assetId,
  assets,
  isAdmin,
  guidelineId,
  compatibleKind,
  onSelect,
  onAddAssetRecord,
  className,
}: {
  assetId?: string;
  assets: Partial<CIAsset>[];
  isAdmin?: boolean;
  guidelineId?: string;
  compatibleKind?: string;
  onSelect: (a: Partial<CIAsset>) => void;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
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
      onAddAssetRecord={onAddAssetRecord}
      className={className}
      imageClassName="ci-logo-media max-w-full max-h-full w-auto h-auto object-contain"
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
  allSections = [],
  isAdmin,
  viewMode = "presentation",
  hidePromptActions = false,
  compact = false,
  clustered = false,
  headlineScale = "h3",
  followOn = false,
  onUpdateData,
  onEditSectionFields,
  onAddAssetRecord,
  onDeleteSection,
  onMoveColorSwatches,
  guidelineId = "",
  presentationEdit = false,
  moduleScoped = false,
  theme = null,
  layoutVariant: _layoutVariant,
}: SubModuleSectionProps) {
  const def = getSubModule(section.section_type);
  const data = (section.data || {}) as Record<string, any>;
  const pool = assets.length > 0 ? assets : allAssets;
  const elements = !isAdmin && viewMode === "elements";
  const book = !isAdmin && viewMode === "presentation";
  const [stage, setStage] = useState<"light" | "dark">(
    data.stage === "dark" ? "dark" : "light"
  );
  const [editingSwatchId, setEditingSwatchId] = useState<string | null>(null);
  const [slotPicker, setSlotPicker] = useState<string | "new" | null>(null);
  const [addDropActive, setAddDropActive] = useState(false);
  const [stagePalette, setStagePalette] = useState<string[]>([
    "#FFFFFF",
    "#111111",
  ]);

  useEffect(() => {
    setStagePalette(readCanvasPalette());
  }, []);

  const presentationPalette = useMemo(
    () =>
      collectPresentationPalette({
        theme,
        sections: allSections.length > 0 ? allSections : [section],
      }),
    [theme, allSections, section]
  );

  useEffect(() => {
    if (data.stage === "dark" || data.stage === "light") setStage(data.stage);
  }, [data.stage]);

  const update = (patch: Record<string, any>) => {
    if (onUpdateData) onUpdateData({ ...data, ...patch });
  };

  const kind: CiRendererKind | "generic" = def?.renderer || "text";

  useEffect(() => {
    if (!onUpdateData) return;
    const fields =
      kind === "list"
        ? [{ field: "items", textKey: "title", aliases: { label: "title" } }]
        : kind === "archetype"
          ? [{ field: "traits", textKey: "word" }]
        : kind === "dual_list"
          ? [
              { field: "dos", textKey: "text" },
              { field: "donts", textKey: "text" },
            ]
        : kind === "copy_examples"
          ? [
              { field: "approved", textKey: "text" },
              { field: "forbidden", textKey: "text" },
            ]
        : kind === "sliders"
          ? [{ field: "axes", textKey: "left" }]
        : kind === "image_dual"
          ? [{ field: "items", textKey: "caption" }]
        : kind === "prompt_cards"
          ? [{ field: "prompts", textKey: "title" }]
        : kind === "ui_states"
          ? [{ field: "states", textKey: "label" }]
        : kind === "icon_set"
          ? [{ field: "icons", textKey: "label" }]
        : kind === "color_group"
          ? [{ field: "swatches", textKey: "name" }]
        : kind === "type_scale"
          ? [{ field: "scale", textKey: "token" }]
        : kind === "type_tokens"
          ? [{ field: "tokens", textKey: "name" }]
        : [];
    if (!fields.length) return;
    const patch = sanitizeListFields(data, fields);
    if (patch) onUpdateData({ ...data, ...patch });
    // One-shot per section so imported strings/blank ids become unique rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id, kind]);

  const hint = useMemo(() => {
    if (!def || !isAdmin || compact) return null;
    return (
      <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
        <span className="font-semibold text-gray-700">{def.inputType}</span>
        {" · "}
        {def.tier}
        {" — "}
        {def.adminEdit}
      </p>
    );
  }, [def, isAdmin, compact]);

  const emptyForClients =
    isAdmin && !sectionHasClientValue(section, pool);

  const body = (() => {
    switch (kind) {
      case "text":
        return (
          <div
            className={
              elements
                ? "space-y-3"
                : book
                  ? "max-w-3xl"
                  : "p-6 md:p-8 rounded-2xl border border-[var(--ci-border,#eaeaea)] bg-[var(--ci-surface,#fff)] backdrop-blur"
            }
          >
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
                  : book
                    ? "bb-prose text-xl md:text-2xl leading-relaxed font-medium text-[var(--ci-text,#111)] whitespace-pre-wrap"
                    : "text-xl md:text-2xl leading-relaxed font-medium text-[var(--ci-text,#111)] whitespace-pre-wrap"
              }
            />
            {elements && data.body ? (
              <CopyableValue hideValue label="Copy text" value={data.body} />
            ) : null}
          </div>
        );

      case "claim_pitch":
        return (
          <div className="space-y-6">
            <div
              className={
                book
                  ? "bb-claim"
                  : "border-l-4 border-[var(--ci-accent,#0066FF)] pl-6"
              }
            >
              <EditableText
                tag="h3"
                multiline
                value={data.claim || ""}
                placeholder="1-liner claim…"
                onSave={(claim) => update({ claim })}
                isAdmin={isAdmin}
                className={
                  book
                    ? "bb-claim-text whitespace-pre-wrap"
                    : "text-3xl md:text-4xl font-bold tracking-tight whitespace-pre-wrap"
                }
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
                className={
                  book
                    ? "bb-pitch whitespace-pre-wrap"
                    : "text-base text-gray-600 leading-relaxed whitespace-pre-wrap"
                }
              />
            )}
            {elements && (
              <div className="flex flex-wrap gap-3">
                {data.claim ? (
                  <CopyableValue hideValue label="Copy claim" value={data.claim} />
                ) : null}
                {data.pitch ? (
                  <CopyableValue hideValue label="Copy pitch" value={data.pitch} />
                ) : null}
              </div>
            )}
          </div>
        );

      case "list": {
        const items = ensureKeyedList(data.items, "title", {
          aliases: { label: "title" },
        }).items as { id: string; title: string; description: string }[];
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
                  <div className="p-5 rounded-xl border border-[var(--ci-border,#eaeaea)] bg-[var(--ci-surface,#fff)] h-full">
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
                      className="text-sm text-gray-600 whitespace-pre-wrap"
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
            {elements && items.length > 0 && (
              <div className="mt-4">
                <CopyableValue
                  hideValue
                  label="Copy values list"
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
        const traits = ensureKeyedList(data.traits, "word").items as {
          id: string;
          word: string;
        }[];
        const pillClass =
          "inline-flex items-center px-3 py-1.5 rounded-full bg-[var(--ci-accent)]/10 text-[var(--ci-accent)] text-sm font-semibold";
        return (
          <div className="space-y-4">
            <EditableText
              value={data.archetype || ""}
              placeholder="Archetype (e.g. Magician, Rebel)…"
              onSave={(archetype) => update({ archetype })}
              isAdmin={isAdmin}
              variant="chip"
              className="inline-flex px-4 py-2 rounded-full bg-[var(--ci-accent)]/10 text-[var(--ci-accent)] font-bold text-sm"
            />
            <div className="flex flex-wrap gap-2 items-center">
              {traits.map((t) => (
                <EditableListItem
                  key={t.id}
                  variant="chip"
                  isAdmin={isAdmin}
                  className={pillClass}
                  onDelete={() =>
                    update({ traits: traits.filter((x) => x.id !== t.id) })
                  }
                  deleteConfirmTitle="Remove this trait?"
                >
                  <EditableText
                    value={String(t.word || "")}
                    placeholder="Trait"
                    onSave={(word) =>
                      update({
                        traits: traits.map((x) =>
                          x.id === t.id ? { ...x, word } : x
                        ),
                      })
                    }
                    isAdmin={isAdmin}
                    variant="chip"
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
                  className="rounded-full"
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
        const left: { id: string; text: string }[] = ensureKeyedList(
          data[leftKey],
          "text"
        ).items as { id: string; text: string }[];
        const right: { id: string; text: string }[] = ensureKeyedList(
          data[rightKey],
          "text"
        ).items as { id: string; text: string }[];
        const col = (
          key: string,
          items: { id: string; text: string }[],
          title: string,
          tone: "good" | "bad"
        ) => (
          <div
            className={
              book
                ? tone === "good"
                  ? "bb-do"
                  : "bb-dont"
                : `rounded-xl border p-4 ${
                    tone === "good"
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-rose-200 bg-rose-50/50"
                  }`
            }
          >
            <h4
              className={
                book
                  ? "bb-dual-label"
                  : "text-xs font-bold uppercase tracking-wider mb-3"
              }
            >
              {title}
            </h4>
            <div className="space-y-2">
              {items.map((item) => (
                <EditableListItem
                  key={item.id}
                  variant="row"
                  isAdmin={isAdmin}
                  onDelete={() =>
                    update({
                      [key]: items.filter((i) => i.id !== item.id),
                    })
                  }
                  deleteConfirmTitle="Remove this item?"
                >
                  <EditableText
                    multiline
                    value={String(item.text || "")}
                    placeholder="Rule or example…"
                    onSave={(text) =>
                      update({
                        [key]: items.map((i) =>
                          i.id === item.id ? { ...i, text } : i
                        ),
                      })
                    }
                    isAdmin={isAdmin}
                    className="text-sm whitespace-pre-wrap"
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
        const axes = keyed<{
          id: string;
          left: string;
          right: string;
          value: number;
        }>(data.axes, "left");
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
          <div className="rounded-xl bg-[var(--ci-code-well-bg,#0a0a0a)] text-[var(--ci-code-well-fg,#f3f3f0)] p-4 font-mono text-sm">
            <EditableText
              tag="pre"
              multiline
              value={data.prompt || ""}
              placeholder="System prompt with {brand_name}, {tone}, {mission}…"
              onSave={(prompt) => update({ prompt })}
              isAdmin={isAdmin}
              className="whitespace-pre-wrap leading-relaxed min-h-[120px]"
            />
            {elements && data.prompt ? (
              <div className="mt-3">
                <CopyableValue
                  hideValue
                  label="Copy prompt"
                  value={data.prompt}
                />
              </div>
            ) : null}
          </div>
        );

      case "image_slot":
      case "clearspace":
      case "ui_button":
      case "email_sig":
      case "container_spec": {
        const variants: ImageVariant[] =
          Array.isArray(data.variants) && data.variants.length > 0
            ? data.variants.map((v: ImageVariant) => ({
                id: v.id,
                assetId: v.assetId,
                label: v.label || "",
                stageColor: v.stageColor,
              }))
            : data.assetId
              ? [
                  {
                    id: "main",
                    assetId: data.assetId,
                    label: data.label || "",
                    stageColor: data.stageColor,
                  },
                ]
              : [];
        const stageBg = stage === "dark" ? "bg-gray-900" : "bg-gray-50";
        const allowVariants = kind === "image_slot";
        const tiles: ImageVariant[] =
          variants.length > 0
            ? variants
            : [
                {
                  id: "main",
                  assetId: data.assetId || "",
                  label: data.label || "",
                  stageColor: data.stageColor,
                },
              ];
        const visibleTiles = isAdmin
          ? tiles
          : tiles.filter((t) => t.assetId);
        const writeTiles = (next: ImageVariant[]) => {
          update({
            variants: next,
            assetId: next[0]?.assetId || "",
            label: next[0]?.label || data.label || "",
          });
        };
        const tileStage = (v: ImageVariant) =>
          v.stageColor
            ? { className: "", style: { background: v.stageColor } as React.CSSProperties }
            : { className: stageBg, style: undefined };
        const assignIfUnassigned = (selected: Partial<CIAsset>) => {
          if (!selected.id || selected.section_id || !section.id) return;
          onAddAssetRecord?.({ ...selected, section_id: section.id });
        };
        const applyToTile = (
          tileId: string | "new",
          selected: Partial<CIAsset>
        ) => {
          assignIfUnassigned(selected);
          if (tileId === "new") {
            writeTiles([
              ...tiles.filter((t) => t.assetId || t.label),
              {
                id: generateUUID(),
                assetId: selected.id || "",
                label: selected.label || "",
              },
            ]);
            return;
          }
          const next = tiles.map((x) =>
            x.id === tileId
              ? {
                  ...x,
                  assetId: selected.id || "",
                  label: x.label || selected.label || "",
                }
              : x
          );
          writeTiles(next);
        };
        const imagePool = allAssets.length ? allAssets : pool;
        return (
          <div className="space-y-4 h-full flex flex-col">
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
            <div
              className={
                book && (kind === "image_slot" || kind === "ui_button")
                  ? brandBookLogoGridClass(visibleTiles.length || 1)
                  : variantTileGridClass(
                      visibleTiles.length + (isAdmin && allowVariants ? 1 : 0)
                    )
              }
            >
              {visibleTiles.map((v) => {
                const tileAsset = findAsset(imagePool, v.assetId);
                const image = (
                  <LocalImage
                    assetId={v.assetId}
                    assets={imagePool}
                    isAdmin={isAdmin}
                    guidelineId={guidelineId}
                    compatibleKind={section.section_type || "all"}
                    onAddAssetRecord={onAddAssetRecord}
                    onSelect={(selected) => applyToTile(v.id, selected)}
                    className="w-full h-full min-h-0"
                  />
                );
                if (book && (kind === "image_slot" || kind === "ui_button")) {
                  const well = tileStage(v);
                  return (
                    <div key={v.id} className="bb-logo-card">
                      <div
                        className={`bb-logo-stage ${well.className}`}
                        style={well.style}
                      >
                        {!isAdmin ? (
                          <AssetClickDownload
                            asset={tileAsset}
                            filename={v.label || data.label || def?.defaultHeadline}
                          >
                            {image}
                          </AssetClickDownload>
                        ) : (
                          image
                        )}
                      </div>
                      {v.label ? (
                        <div className="bb-logo-meta">{v.label}</div>
                      ) : null}
                    </div>
                  );
                }
                return (
                <div
                  key={v.id}
                  className="relative rounded-2xl border border-[var(--ci-border,#eaeaea)] overflow-hidden flex flex-col"
                >
                  {isAdmin && allowVariants && tiles.length > 1 ? (
                    <button
                      type="button"
                      className="absolute top-2 right-2 z-10 p-1 rounded-md text-gray-400 hover:text-red-700 hover:bg-white/80"
                      title="Remove variation"
                      onClick={() => writeTiles(tiles.filter((x) => x.id !== v.id))}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                  <div
                    className={`ci-logo-stage w-full min-h-0 ${tileStage(v).className}`}
                    style={tileStage(v).style}
                  >
                    {!isAdmin ? (
                      <AssetClickDownload
                        asset={tileAsset}
                        filename={v.label || data.label || def?.defaultHeadline}
                      >
                        {image}
                      </AssetClickDownload>
                    ) : (
                      image
                    )}
                  </div>
                  {isAdmin && kind === "image_slot" ? (
                    <StageColorChips
                      value={v.stageColor}
                      palette={stagePalette}
                      onChange={(hex) =>
                        writeTiles(
                          tiles.map((x) =>
                            x.id === v.id ? { ...x, stageColor: hex } : x
                          )
                        )
                      }
                    />
                  ) : null}
                  {(v.label || isAdmin) && (visibleTiles.length > 1 || allowVariants) ? (
                    <EditableText
                      value={v.label}
                      placeholder="Label"
                      onSave={(label) => {
                        writeTiles(
                          tiles.map((x) =>
                            x.id === v.id ? { ...x, label } : x
                          )
                        );
                      }}
                      isAdmin={isAdmin}
                      className="font-semibold text-sm px-4 py-3 w-full"
                    />
                  ) : null}
                </div>
                );
              })}
              {isAdmin && allowVariants ? (
                <button
                  type="button"
                  onClick={() => setSlotPicker("new")}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setAddDropActive(true);
                  }}
                  onDragLeave={() => setAddDropActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setAddDropActive(false);
                    const id = getCiAssetDragId(e);
                    const dropped = imagePool.find((a) => a.id === id);
                    if (dropped) applyToTile("new", dropped);
                  }}
                  className={`aspect-[4/3] w-full rounded-2xl border-[1.5px] border-dashed flex flex-col items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
                    addDropActive
                      ? "border-gray-900 text-gray-900 bg-gray-50"
                      : "border-[var(--ci-text,#111)]/20 text-[var(--ci-muted,#8e8e9f)] hover:border-[var(--ci-text,#111)]/45 hover:text-[var(--ci-text,#111)]"
                  }`}
                >
                  <span className="text-lg leading-none">+</span>
                  {addDropActive ? "Drop Figma asset" : "Add variation"}
                </button>
              ) : null}
            </div>
            {book && kind === "ui_button" ? (
              <div className="flex flex-wrap gap-3">
                {(visibleTiles.length
                  ? visibleTiles
                  : [{ id: "pill", label: data.label || section.headline || "Button" }]
                ).map((v) => (
                  <span
                    key={`pill-${v.id}`}
                    className="bb-pill"
                    style={{
                      background: data.bg || "var(--ci-accent)",
                      color: data.text || "var(--ci-bg)",
                    }}
                  >
                    {v.label || data.label || "Button"}
                  </span>
                ))}
              </div>
            ) : null}
            {visibleTiles.length <= 1 && (data.label || isAdmin) && !allowVariants && (
              <EditableText
                value={data.label || ""}
                placeholder="Label / usage note"
                onSave={(label) => update({ label })}
                isAdmin={isAdmin}
                className="text-sm font-medium"
              />
            )}
            {isAdmin && allowVariants ? (
              <AssetPickerModal
                isOpen={slotPicker !== null}
                onClose={() => setSlotPicker(null)}
                onSelectAsset={(selected) => {
                  applyToTile(slotPicker || "new", selected);
                  setSlotPicker(null);
                }}
                guidelineId={guidelineId}
                availableAssets={imagePool}
                compatibleKind={section.section_type || "all"}
                onAddAssetRecord={onAddAssetRecord}
              />
            ) : null}
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
          </div>
        );
      }

      case "image_dual": {
        const items = keyed<{
          id: string;
          type: "do" | "dont";
          assetId: string;
          caption: string;
        }>(data.items, "caption");
        const columns = [1, 2, 3].includes(Number(data.columns))
          ? Number(data.columns)
          : 3;
        const renderGroup = (type: "do" | "dont") => {
          const group = items.filter((i) => i.type === type);
          return (
            <div>
              <h4
                className={`text-xs font-bold uppercase tracking-wider mb-3 ${
                  type === "do" ? "text-emerald-800" : "text-rose-800"
                }`}
              >
                {type === "do" ? "Do" : "Don't"}
              </h4>
              <div className={dualItemGridClass(columns)}>
                {group.map((item) => {
                  const asset = findAsset(pool, item.assetId);
                  return (
                    <EditableListItem
                      key={item.id}
                      isAdmin={isAdmin}
                      className="min-w-0"
                      onDelete={() =>
                        update({
                          items: items.filter((x) => x.id !== item.id),
                        })
                      }
                    >
                      <div className={`rounded-xl overflow-hidden min-w-0 ${book ? "bb-dual-card" : "border border-[var(--ci-border,#eaeaea)] bg-[var(--ci-surface,#fff)]"}`}>
                        <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center p-3 min-h-0">
                          <LocalImage
                            assetId={item.assetId}
                            assets={allAssets.length ? allAssets : pool}
                            isAdmin={isAdmin}
                            guidelineId={guidelineId}
                            compatibleKind="all"
                            onAddAssetRecord={onAddAssetRecord}
                            onSelect={(selected) => {
                              if (selected.id && !selected.section_id && section.id) {
                                onAddAssetRecord?.({
                                  ...selected,
                                  section_id: section.id,
                                });
                              }
                              update({
                                items: items.map((x) =>
                                  x.id === item.id
                                    ? { ...x, assetId: selected.id || "" }
                                    : x
                                ),
                              });
                            }}
                            className="w-full h-full min-h-0"
                          />
                        </div>
                        <div className="px-2.5 py-2 space-y-1 min-w-0">
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
                            className={
                              isAdmin
                                ? "text-xs leading-snug break-words"
                                : "text-xs leading-snug break-words line-clamp-3"
                            }
                          />
                          {elements && parseDownloads(data).showOnSubmodule ? (
                            <AssetDownloadButtons
                              asset={asset}
                              config={parseDownloads(data)}
                              filename={
                                item.caption || (type === "do" ? "Do" : "Dont")
                              }
                              compact
                              mode="files"
                            />
                          ) : null}
                        </div>
                      </div>
                    </EditableListItem>
                  );
                })}
              </div>
              {isAdmin && (
                <div className="mt-3">
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
                </div>
              )}
            </div>
          );
        };
        return (
          <div className="space-y-4">
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Columns
                </span>
                <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
                  {([1, 2, 3] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => update({ columns: n })}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                        columns === n
                          ? "bg-gray-900 text-white"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
              {renderGroup("do")}
              {renderGroup("dont")}
            </div>
          </div>
        );
      }

      case "color_group":
      case "color_format": {
        const swatches: ColorSwatch[] = keyed(data.swatches, "name");
        const format =
          section.section_type === "rgb"
            ? "rgb"
            : section.section_type === "cmyk"
              ? "cmyk"
              : "hex";
        const families = groupSwatchesByFamily(swatches);
        const persistSwatch = (id: string, updated: ColorSwatch) =>
          update({
            swatches: swatches.map((x) =>
              x.id === id
                ? {
                    ...x,
                    name: updated.name,
                    hex: updated.hex,
                    cssVar: updated.cssVar,
                    rgb: updated.rgb ?? x.rgb,
                    cmyk: updated.cmyk ?? x.cmyk,
                    isCanonical: updated.isCanonical ?? x.isCanonical,
                  }
                : x
            ),
          });
        const setFamilyMain = (id: string) => {
          const target = swatches.find((s) => s.id === id);
          if (!target) return;
          const key = familyKeyFromSwatch(target);
          update({
            swatches: swatches.map((x) =>
              familyKeyFromSwatch(x) === key
                ? { ...x, isCanonical: x.id === id }
                : x
            ),
          });
        };
        const paletteOptions = COLOR_ROLE_SECTION_TYPES.map((t) => ({
          id: t,
          label: colorRoleLabel(t),
        }));
        const canMovePalette = Boolean(
          isAdmin &&
            onMoveColorSwatches &&
            isColorRoleSection(section.section_type)
        );
        const paletteMoveFor = (ids: string[], scopeLabel: string) =>
          canMovePalette
            ? {
                currentId: String(section.section_type),
                options: paletteOptions,
                onMove: (to: string) => onMoveColorSwatches!(ids, to),
                scopeLabel,
              }
            : undefined;
        const renderFamily = (fam: (typeof families)[number]) => {
          const scale = fam.swatches.filter((s) => s.id !== fam.hero?.id);
          const familyName = (
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="bb-family-label" style={{ margin: 0 }}>
                {fam.label || "\u00a0"}
              </p>
              {canMovePalette ? (
                <label className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ci-text-muted,#666)]">
                    Palette
                  </span>
                  <select
                    value={String(section.section_type)}
                    onChange={(e) => {
                      const to = e.target.value;
                      if (!to || to === section.section_type) return;
                      onMoveColorSwatches!(
                        fam.swatches.map((s) => s.id),
                        to
                      );
                    }}
                    className="text-[11px] font-medium rounded-md border border-[var(--ci-border,#eaeaea)] bg-[var(--ci-surface,#fff)] text-[var(--ci-text,#111)] px-1.5 py-1 max-w-[9.5rem]"
                    aria-label={`Move ${fam.label || "color"} to another palette`}
                  >
                    {paletteOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          );
          if (book) {
            return (
              <div key={fam.key}>
                {familyName}
                {fam.hero ? (
                  <div className="bb-swatch-grid">
                    <PresentationSwatch
                      swatch={{
                        ...fam.hero,
                        name: clientSwatchLabel(fam.hero, "hero"),
                      }}
                    />
                  </div>
                ) : null}
                {scale.length > 0 ? (
                  <details className="bb-scale">
                    <summary>
                      Scale
                      <span>{scale.length}</span>
                    </summary>
                    <div className="bb-swatch-grid mt-3">
                      {scale.map((s) => (
                        <PresentationSwatch
                          key={s.id}
                          swatch={{
                            ...s,
                            name: clientSwatchLabel(s, "scale"),
                          }}
                        />
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            );
          }
          return (
            <div key={fam.key} className="min-w-0 overflow-visible">
              {familyName}
              {fam.hero ? (
                <div className="flex flex-wrap gap-3 overflow-visible">
                  <EditableColor
                    swatch={{
                      ...fam.hero,
                      name: clientSwatchLabel(fam.hero, "hero"),
                    }}
                    isAdmin={isAdmin}
                    initialFormat={format}
                    startEditing={editingSwatchId === fam.hero.id}
                    onEditingHandled={() => setEditingSwatchId(null)}
                    onSetMain={isAdmin ? () => setFamilyMain(fam.hero.id) : undefined}
                    paletteMove={paletteMoveFor(
                      fam.swatches.map((s) => s.id),
                      "this color"
                    )}
                    onDelete={
                      isAdmin
                        ? () =>
                            update({
                              swatches: swatches.filter((x) => x.id !== fam.hero.id),
                            })
                        : undefined
                    }
                    onUpdate={(updated) => persistSwatch(fam.hero.id, updated)}
                  />
                  {isAdmin ? (
                    <AddItemButton
                      isAdmin={isAdmin}
                      label="Add shade"
                      variant="shade"
                      onClick={() => {
                        const last =
                          fam.swatches[fam.swatches.length - 1] ||
                          swatches[swatches.length - 1];
                        const shade = nextShadeFromLast(last);
                        const id = generateUUID();
                        update({
                          swatches: [...swatches, { id, ...shade }],
                        });
                        setEditingSwatchId(id);
                      }}
                    />
                  ) : null}
                </div>
              ) : isAdmin ? (
                <AddItemButton
                  isAdmin={isAdmin}
                  label="Add shade"
                  variant="shade"
                  onClick={() => {
                    const shade = nextShadeFromLast(undefined);
                    const id = generateUUID();
                    update({ swatches: [...swatches, { id, ...shade }] });
                    setEditingSwatchId(id);
                  }}
                />
              ) : null}
              {scale.length > 0 ? (
                isAdmin ? (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ci-text-muted,#666)] mb-2">
                      Scale
                      <span className="ml-1.5 font-medium tabular-nums opacity-70">
                        {scale.length}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-3 overflow-visible">
                      {scale.map((s) => (
                        <EditableColor
                          key={s.id}
                          swatch={{
                            ...s,
                            name: clientSwatchLabel(s, "scale"),
                          }}
                          isAdmin
                          initialFormat={format}
                          startEditing={editingSwatchId === s.id}
                          onEditingHandled={() => setEditingSwatchId(null)}
                          onSetMain={() => setFamilyMain(s.id)}
                          paletteMove={paletteMoveFor([s.id], "this shade")}
                          onDelete={() =>
                            update({
                              swatches: swatches.filter((x) => x.id !== s.id),
                            })
                          }
                          onUpdate={(updated) => persistSwatch(s.id, updated)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <details className="mt-3 group">
                    <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ci-text-muted,#666)] select-none list-none [&::-webkit-details-marker]:hidden inline-flex items-center gap-1.5 hover:text-[var(--ci-text,#111)]">
                      Scale
                      <span className="text-[10px] font-medium tabular-nums opacity-70">
                        {scale.length}
                      </span>
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {scale.map((s) => (
                        <EditableColor
                          key={s.id}
                          swatch={{
                            ...s,
                            name: clientSwatchLabel(s, "scale"),
                          }}
                          isAdmin={false}
                          initialFormat={format}
                        />
                      ))}
                    </div>
                  </details>
                )
              ) : null}
            </div>
          );
        };
        return (
          <div className={clustered || book ? "space-y-4" : "space-y-10"}>
            {families.map(renderFamily)}
            {isAdmin && families.length === 0 ? (
              <AddItemButton
                isAdmin={isAdmin}
                label="Add shade"
                variant="shade"
                onClick={() => {
                  const shade = nextShadeFromLast(undefined);
                  const id = generateUUID();
                  update({ swatches: [{ id, ...shade }] });
                  setEditingSwatchId(id);
                }}
              />
            ) : null}
          </div>
        );
      }

      case "color_scale": {
        const scales: {
          id: string;
          token: string;
          shades: { step: string; hex: string }[];
        }[] = keyed(data.scales, "token");
        return (
          <div className="space-y-5">
            {scales.map((scale) => (
              <div
                key={scale.id}
                className="rounded-2xl border border-[var(--ci-border,#eaeaea)] p-4 bg-[var(--ci-surface,#fff)]"
              >
                <div className="flex items-center justify-between gap-3 mb-3">
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
                    className="font-semibold"
                  />
                  {isAdmin && (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-red-600 hover:underline"
                      onClick={() =>
                        update({
                          scales: scales.filter((s) => s.id !== scale.id),
                        })
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex rounded-lg overflow-hidden h-12 border border-black/5">
                  {(scale.shades || []).map((sh) => (
                    <div
                      key={sh.step}
                      className="flex-1"
                      style={{ background: sh.hex }}
                      title={`${sh.step}: ${sh.hex}`}
                    />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {(scale.shades || []).map((sh, idx) => (
                    <div key={`${scale.id}-${sh.step}-${idx}`} className="space-y-1">
                      <EditableText
                        value={sh.step}
                        placeholder="500"
                        onSave={(step) =>
                          update({
                            scales: scales.map((s) =>
                              s.id === scale.id
                                ? {
                                    ...s,
                                    shades: s.shades.map((x, i) =>
                                      i === idx ? { ...x, step } : x
                                    ),
                                  }
                                : s
                            ),
                          })
                        }
                        isAdmin={isAdmin}
                        className="text-[10px] uppercase tracking-wide text-gray-400"
                      />
                      {isAdmin ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={/^#[0-9a-fA-F]{6}$/.test(sh.hex) ? sh.hex : "#000000"}
                            onChange={(e) =>
                              update({
                                scales: scales.map((s) =>
                                  s.id === scale.id
                                    ? {
                                        ...s,
                                        shades: s.shades.map((x, i) =>
                                          i === idx ? { ...x, hex: e.target.value } : x
                                        ),
                                      }
                                    : s
                                ),
                              })
                            }
                            className="h-8 w-8 rounded border border-gray-200 cursor-pointer bg-white p-0.5 shrink-0"
                          />
                          <input
                            type="text"
                            value={sh.hex}
                            onChange={(e) =>
                              update({
                                scales: scales.map((s) =>
                                  s.id === scale.id
                                    ? {
                                        ...s,
                                        shades: s.shades.map((x, i) =>
                                          i === idx ? { ...x, hex: e.target.value } : x
                                        ),
                                      }
                                    : s
                                ),
                              })
                            }
                            className={`flex-1 min-w-0 ${ciFieldMonoClass}`}
                          />
                          <button
                            type="button"
                            className="text-[10px] font-semibold text-red-600 hover:underline shrink-0"
                            onClick={() =>
                              update({
                                scales: scales.map((s) =>
                                  s.id === scale.id
                                    ? {
                                        ...s,
                                        shades: s.shades.filter((_, i) => i !== idx),
                                      }
                                    : s
                                ),
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] font-mono text-gray-500">{sh.hex}</div>
                      )}
                    </div>
                  ))}
                </div>
                {isAdmin && (
                  <AddItemButton
                    isAdmin={isAdmin}
                    label="Add shade"
                    onClick={() =>
                      update({
                        scales: scales.map((s) =>
                          s.id === scale.id
                            ? {
                                ...s,
                                shades: [
                                  ...s.shades,
                                  { step: "500", hex: "#0066FF" },
                                ],
                              }
                            : s
                        ),
                      })
                    }
                  />
                )}
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
                        token: "Palette",
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
        }[] = keyed(data.pairs, "bg");
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

      case "type_spec": {
        const italic =
          data.fontStyle === "italic" ||
          /italic|oblique/i.test(String(data.fontWeight || ""));
        const specimen = (
          <EditableText
            value={data.sampleText || ""}
            placeholder="Sample headline…"
            onSave={(sampleText) => update({ sampleText })}
            isAdmin={isAdmin}
            className="tracking-tight"
            style={typeSpecCss(data)}
          />
        );
        if (book) {
          return (
            <div className="space-y-4">
              <div className="bb-type-row">
                <div className="bb-type-label">
                  <strong>{data.fontFamily || "Type"}</strong>
                  <span>
                    {[data.fontWeight, data.fontStyle, data.fontSize]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <div>{specimen}</div>
              </div>
              <FontFilesField
                files={Array.isArray(data.fontFiles) ? data.fontFiles : []}
                assets={allAssets.length ? allAssets : pool}
                isAdmin={isAdmin}
                elements={elements}
                guidelineId={guidelineId}
                sectionId={section.id}
                family={data.fontFamily}
                onChange={(fontFiles) => update({ fontFiles })}
                onAddAssetRecord={onAddAssetRecord}
              />
            </div>
          );
        }
        return (
          <div className="space-y-4">
            {specimen}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {(
                [
                  "fontFamily",
                  "fontWeight",
                  "fontStyle",
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
                    onSave={(v) => {
                      const kind =
                        field === "lineHeight"
                          ? "leading"
                          : field === "letterSpacing"
                            ? "tracking"
                            : field === "fontSize"
                              ? "size"
                              : null;
                      update({
                        [field]: kind ? cssLength(v, kind) || v : v,
                      });
                    }}
                    isAdmin={isAdmin}
                    className="text-sm font-mono"
                  />
                </div>
              ))}
            </div>
            {elements && (
              <CopyableValue
                label="CSS"
                value={`font-family: ${data.fontFamily || "inherit"}; font-size: ${data.fontSize || "16px"}; font-weight: ${data.fontWeight || 400}; font-style: ${italic ? "italic" : "normal"}; line-height: ${data.lineHeight || 1.4};`}
              />
            )}
            <FontFilesField
              files={Array.isArray(data.fontFiles) ? data.fontFiles : []}
              assets={allAssets.length ? allAssets : pool}
              isAdmin={isAdmin}
              elements={elements}
              guidelineId={guidelineId}
              sectionId={section.id}
              family={data.fontFamily}
              onChange={(fontFiles) => update({ fontFiles })}
              onAddAssetRecord={onAddAssetRecord}
            />
          </div>
        );
      }

      case "font_stack":
        return (
          <div className="space-y-4">
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
            <FontFilesField
              files={Array.isArray(data.fontFiles) ? data.fontFiles : []}
              assets={allAssets.length ? allAssets : pool}
              isAdmin={isAdmin}
              elements={elements}
              guidelineId={guidelineId}
              sectionId={section.id}
              family={String(data.stack || "").split(",")[0]?.trim()}
              onChange={(fontFiles) => update({ fontFiles })}
              onAddAssetRecord={onAddAssetRecord}
            />
          </div>
        );

      case "type_scale": {
        const rows: {
          id: string;
          token: string;
          role?: string;
          value?: string;
          px?: number;
          fontFamily?: string;
          fontWeight?: string;
          fontStyle?: string;
          lineHeight?: string;
          letterSpacing?: string;
          paragraphSpacing?: string;
        }[] = keyed(data.scale, "token");
        const primaryRow = rows.find((r) => r.role === "heading-primary");
        return (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--ci-border,#eaeaea)] p-5">
              <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-2">
                Primary Typeface
              </div>
              {primaryRow ? (
                <div
                  style={{
                    fontFamily: primaryRow.fontFamily || "inherit",
                    fontWeight: primaryRow.fontWeight || 600,
                    fontSize: Math.min(
                      48,
                      Number.parseFloat(primaryRow.value || "") ||
                        primaryRow.px ||
                        32
                    ),
                  }}
                >
                  {primaryRow.token || primaryRow.fontFamily || "Aa"}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Not set in Typography yet — tag a Type Scale row with role{" "}
                  <code className="text-xs">heading-primary</code>.
                </p>
              )}
            </div>
            <TypeScaleRowPanel
              rows={rows}
              isAdmin={!!isAdmin}
              onChange={(next) => update({ scale: next })}
            />
          </div>
        );
      }

      case "type_tokens": {
        const rows: { id: string; token: string; value: string }[] =
          keyed(data.tokens, "token");
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rows.map((row) => (
              <EditableListItem
                key={row.id}
                isAdmin={isAdmin}
                onDelete={() =>
                  update({
                    tokens: rows.filter((r) => r.id !== row.id),
                  })
                }
                deleteConfirmTitle="Remove this token?"
              >
              <div
                className="rounded-xl border border-[var(--ci-border,#eaeaea)] px-4 py-3"
              >
                <EditableText
                  value={row.token}
                  placeholder="token"
                  onSave={(token) =>
                    update({
                      tokens: rows.map((r) =>
                        r.id === row.id ? { ...r, token } : r
                      ),
                    })
                  }
                  isAdmin={isAdmin}
                  className="font-mono text-xs text-gray-500"
                />
                <EditableText
                  value={row.value}
                  placeholder="value"
                  onSave={(value) =>
                    update({
                      tokens: rows.map((r) =>
                        r.id === row.id ? { ...r, value } : r
                      ),
                    })
                  }
                  isAdmin={isAdmin}
                  className="mt-1 text-sm font-mono"
                />
              </div>
              </EditableListItem>
            ))}
            {isAdmin && (
              <AddItemButton
                isAdmin={isAdmin}
                label="Add token"
                onClick={() =>
                  update({
                    tokens: [
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
                className="p-3 rounded-lg border text-center min-w-[88px]"
              >
                <div className="text-[10px] uppercase text-gray-400">{k}</div>
                {isAdmin ? (
                  <input
                    type="number"
                    value={Number(v) || 0}
                    onChange={(e) =>
                      update({
                        scale: { ...scale, [k]: Number(e.target.value) },
                      })
                    }
                    className={`mt-1 w-full text-center ${ciFieldMonoClass}`}
                  />
                ) : (
                  <div className="font-bold">{String(v)}px</div>
                )}
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
        }[] = keyed(data.states, "name");
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {states.map((st) => {
              const asset = findAsset(pool, st.assetId);
              return (
                <EditableListItem
                  key={st.id}
                  isAdmin={isAdmin}
                  onDelete={() =>
                    update({
                      states: states.filter((s) => s.id !== st.id),
                    })
                  }
                  deleteConfirmTitle="Remove this state?"
                >
                <div className="rounded-xl border p-3 space-y-2">
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
                </EditableListItem>
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
          keyed(data.icons, "label");
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
                    {elements && parseDownloads(data).showOnSubmodule ? (
                      <AssetDownloadButtons
                        asset={asset}
                        config={parseDownloads(data)}
                        filename={icon.label || "icon"}
                        compact
                        mode="files"
                      />
                    ) : null}
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
        }[] = keyed(data.prompts, "title");
        return (
          <div className="space-y-3">
            {prompts.map((p) => (
              <EditableListItem
                key={p.id}
                isAdmin={isAdmin}
                onDelete={() =>
                  update({
                    prompts: prompts.filter((x) => x.id !== p.id),
                  })
                }
                deleteConfirmTitle="Remove this prompt?"
              >
              <div
                className="rounded-xl bg-[var(--ci-code-well-bg,#0a0a0a)] text-[var(--ci-code-well-fg,#f3f3f0)] p-4 space-y-2"
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
              </EditableListItem>
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
        }[] = keyed(data.slides, "label");
        return (
          <div className={variantTileGridClass(slides.length || 1)}>
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
                    {elements && parseDownloads(data).showOnSubmodule ? (
                      <AssetDownloadButtons
                        asset={asset}
                        config={parseDownloads(data)}
                        filename={slide.label || "slide"}
                        compact
                        mode="files"
                      />
                    ) : null}
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

      case "logo_mark_list": {
        const marks = (Array.isArray(data.marks) ? data.marks : []) as CiLogoMark[];
        const main = marks.find((m) => m.isMain) || marks[0];
        return (
          <div className="space-y-6">
            {main && !isAdmin ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {(["light", "dark"] as const).map((stage) => {
                  const assetId = stage === "light" ? main.lightAssetId : main.darkAssetId;
                  return (
                    <div
                      key={stage}
                      className={`rounded-xl p-10 ${stage === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
                    >
                      <LocalImage
                        assetId={assetId || ""}
                        assets={allAssets.length ? allAssets : pool}
                        isAdmin={false}
                        guidelineId={guidelineId}
                        onSelect={() => {}}
                        className="mx-auto max-h-24 object-contain"
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
            <LogoMarksPanel
              marks={marks}
              isAdmin={isAdmin}
              onChange={(next) => update({ marks: next })}
            />
            {!isAdmin && marks.filter((m) => !m.isMain).length > 0 ? (
              <div className={variantTileGridClass(marks.filter((m) => !m.isMain).length)}>
                {marks
                  .filter((m) => !m.isMain)
                  .map((m) => (
                    <div key={m.id} className="rounded-xl border p-4 text-center">
                      <LocalImage
                        assetId={m.lightAssetId || m.darkAssetId || ""}
                        assets={allAssets.length ? allAssets : pool}
                        isAdmin={false}
                        guidelineId={guidelineId}
                        onSelect={() => {}}
                        className="mx-auto max-h-16 object-contain"
                      />
                      <div className="mt-2 text-xs text-gray-500">{m.name}</div>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        );
      }

      case "link_list": {
        const links = (Array.isArray(data.links) ? data.links : []) as CiLinkItem[];
        if (!isAdmin) {
          return (
            <div className="flex flex-wrap gap-2">
              {links.map((l) => (
                <a
                  key={l.id}
                  href={l.url || "#"}
                  className="rounded-full border px-3 py-1.5 text-sm hover:bg-black/5"
                  target="_blank"
                  rel="noreferrer"
                >
                  {l.label || "Link"}
                </a>
              ))}
            </div>
          );
        }
        return (
          <LinkListPanel links={links} isAdmin={isAdmin} onChange={(next) => update({ links: next })} />
        );
      }

      case "token_scale_list": {
        const tokens = (Array.isArray(data.tokens) ? data.tokens : []) as CiTokenScaleItem[];
        const previewKind =
          section.section_type === "radius_system" ? "radius" : "spacing";
        return (
          <TokenScalePanel
            tokens={tokens}
            isAdmin={isAdmin}
            previewKind={previewKind}
            onChange={(next) => update({ tokens: next })}
          />
        );
      }

      case "ui_buttons": {
        const variants: {
          id: string;
          label: string;
          bg?: string;
          text?: string;
          border?: string;
          radius?: string;
          padding?: string;
          assetId?: string;
        }[] = keyed(data.variants, "label");
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {variants.map((v) => (
                <div key={v.id} className="space-y-2">
                  {v.assetId ? (
                    <LocalImage
                      assetId={v.assetId}
                      assets={allAssets.length ? allAssets : pool}
                      isAdmin={isAdmin}
                      guidelineId={guidelineId}
                      onSelect={(selected) =>
                        update({
                          variants: variants.map((x) =>
                            x.id === v.id ? { ...x, assetId: selected.id || "" } : x
                          ),
                        })
                      }
                      className="h-12 object-contain"
                    />
                  ) : (
                    <button
                      type="button"
                      className="rounded-lg px-4 py-2 text-sm font-medium"
                      style={{
                        background: v.bg || "#111",
                        color: v.text || "#fff",
                        border: v.border ? `1px solid ${v.border}` : undefined,
                        borderRadius: v.radius || "8px",
                        padding: v.padding || undefined,
                      }}
                    >
                      {v.label || "Button"}
                    </button>
                  )}
                  {isAdmin ? (
                    <EditableText
                      value={v.label}
                      placeholder="Label"
                      onSave={(label) =>
                        update({
                          variants: variants.map((x) =>
                            x.id === v.id ? { ...x, label } : x
                          ),
                        })
                      }
                      isAdmin={isAdmin}
                      className="text-xs text-gray-500"
                    />
                  ) : null}
                </div>
              ))}
            </div>
            {isAdmin ? (
              <AddItemButton
                label="Add button variant"
                onClick={() =>
                  update({
                    variants: [
                      ...variants,
                      {
                        id: generateUUID(),
                        label: "Button",
                        bg: "",
                        text: "",
                        border: "",
                        radius: "8px",
                        padding: "",
                        assetId: "",
                      },
                    ],
                  })
                }
              />
            ) : null}
          </div>
        );
      }

      case "ui_form_controls": {
        const controls: {
          id: string;
          label: string;
          assetId?: string;
          notes?: string;
        }[] = keyed(data.controls, "label");
        return (
          <div className="grid gap-4 sm:grid-cols-3">
            {controls.map((c) => (
              <div key={c.id} className="rounded-xl border p-4 space-y-2">
                <LocalImage
                  assetId={c.assetId || ""}
                  assets={allAssets.length ? allAssets : pool}
                  isAdmin={isAdmin}
                  guidelineId={guidelineId}
                  onSelect={(selected) =>
                    update({
                      controls: controls.map((x) =>
                        x.id === c.id ? { ...x, assetId: selected.id || "" } : x
                      ),
                    })
                  }
                  className="aspect-[4/3] w-full object-contain bg-gray-50 rounded-lg"
                />
                <EditableText
                  value={c.label}
                  placeholder="Control"
                  onSave={(label) =>
                    update({
                      controls: controls.map((x) =>
                        x.id === c.id ? { ...x, label } : x
                      ),
                    })
                  }
                  isAdmin={isAdmin}
                  className="text-sm font-medium"
                />
              </div>
            ))}
            {isAdmin ? (
              <AddItemButton
                label="Add control"
                onClick={() =>
                  update({
                    controls: [
                      ...controls,
                      { id: generateUUID(), label: "Control", assetId: "", notes: "" },
                    ],
                  })
                }
              />
            ) : null}
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
      hidePromptActions={hidePromptActions}
      compact={compact}
      clustered={clustered}
      headlineScale={headlineScale}
      followOn={followOn}
      editorReminder={emptyForClients}
      onEditSectionFields={onEditSectionFields}
      onDeleteSection={onDeleteSection}
      presentationEdit={presentationEdit}
      moduleScoped={moduleScoped}
      theme={theme}
      allSections={allSections}
      guidelineId={guidelineId}
      onAddAssetRecord={onAddAssetRecord}
      presentationAssets={allAssets.length > 0 ? allAssets : assets}
      presentationPalette={presentationPalette}
      onPatchPresentation={
        onUpdateData
          ? (presentation) => {
              const nextPresentation = moduleScoped
                ? mergeModuleScopedSectionPresentation({
                    ...presentation,
                    ...(supportsSideImageLayout(section.section_type)
                      ? pickLayoutPresentation(presentation)
                      : {}),
                  })
                : supportsSideImageLayout(section.section_type)
                  ? pickLayoutPresentation(presentation)
                  : presentation;
              const empty = moduleScoped
                ? moduleScopedSectionPresentationIsEmpty(nextPresentation)
                : supportsSideImageLayout(section.section_type)
                  ? layoutPresentationIsEmpty(nextPresentation)
                  : sectionPresentationIsEmpty(nextPresentation);
              if (empty) {
                const next = { ...data };
                delete next.presentation;
                onUpdateData(next);
              } else {
                onUpdateData({ ...data, presentation: nextPresentation });
              }
            }
          : undefined
      }
      headerExtra={
        compact && isAdmin && rendererHasDownloads(kind) ? (
          <AdminDownloadsStrip
            popover
            sectionType={section.section_type}
            config={parseDownloads(data)}
            asset={findAsset(pool, primaryAssetIdFromData(data) || undefined)}
            filename={
              section.headline || data.label || def?.defaultHeadline || "asset"
            }
            onChange={(downloads) => update({ downloads })}
          />
        ) : null
      }
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
      {body}
      {rendererHasDownloads(kind) && isAdmin && !compact ? (
        <div className="mt-6 max-w-xl">
          <AdminDownloadsStrip
            sectionType={section.section_type}
            config={parseDownloads(data)}
            asset={findAsset(pool, primaryAssetIdFromData(data) || undefined)}
            filename={
              section.headline ||
              data.label ||
              def?.defaultHeadline ||
              "asset"
            }
            onChange={(downloads) => update({ downloads })}
          />
        </div>
      ) : null}
      {rendererHasDownloads(kind) &&
      elements &&
      parseDownloads(data).showOnSubmodule ? (
        <div className="mt-3">
          {kind === "icon_set" ||
          kind === "image_dual" ||
          kind === "deck" ||
          (kind === "image_slot" &&
            Array.isArray(data.variants) &&
            data.variants.length > 1) ? (
            <AssetDownloadButtons
              config={parseDownloads(data)}
              mode="drive"
            />
          ) : (
            <AssetDownloadButtons
              asset={findAsset(pool, primaryAssetIdFromData(data) || undefined)}
              config={parseDownloads(data)}
              filename={
                section.headline ||
                data.label ||
                def?.defaultHeadline ||
                "asset"
              }
            />
          )}
        </div>
      ) : null}
    </SectionContainer>
  );
}
