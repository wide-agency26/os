"use client";

import React, { useState } from "react";
import { CISection, CIAsset, ColorsSectionData, ColorGroup, ColorSwatch } from "@/lib/ci-builder/types";
import { nextShadeFromLast } from "@/lib/ci-builder/color-utils";
import { SectionContainer } from "./SectionContainer";
import { EditableText, EditableColor, AddItemButton } from "../primitives";
import { Trash2, AlertTriangle } from "lucide-react";

export interface SectionProps {
  section: Partial<CISection>;
  assets?: Partial<CIAsset>[];
  allAssets?: Partial<CIAsset>[];
  allSections?: Partial<CISection>[];
  isAdmin?: boolean;
  onUpdateData?: (newData: any) => void;
  onEditSectionFields?: (fields: Partial<CISection>) => void;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
  onDeleteAssetRecord?: (assetId: string) => void;
  guidelineId?: string;
}

export function ColorsSection({
  section,
  isAdmin,
  onUpdateData,
  onEditSectionFields
}: SectionProps) {
  const data = (section.data || {}) as ColorsSectionData;
  const groups = data.groups || [];
  const [deleteGroupIndex, setDeleteGroupIndex] = useState<number | null>(null);
  const [editingSwatchId, setEditingSwatchId] = useState<string | null>(null);

  const addGroup = () => {
    const newGroup: ColorGroup = {
      id: `grp_${Date.now()}`,
      groupLabel: "New Color Palette",
      swatches: [
        { id: `c_${Date.now()}_1`, name: "Primary Accent", hex: "#0066FF", cssVar: "--color-primary-accent" },
        { id: `c_${Date.now()}_2`, name: "Neutral Dark", hex: "#111827", cssVar: "--color-neutral-dark" }
      ]
    };
    if (onUpdateData) onUpdateData({ ...data, groups: [...groups, newGroup] });
  };

  const updateGroupLabel = (groupIdx: number, groupLabel: string) => {
    const updated = groups.map((g, i) => i === groupIdx ? { ...g, groupLabel } : g);
    if (onUpdateData) onUpdateData({ ...data, groups: updated });
  };

  const confirmDeleteGroup = (groupIdx: number) => {
    const updated = groups.filter((_, i) => i !== groupIdx);
    if (onUpdateData) onUpdateData({ ...data, groups: updated });
    setDeleteGroupIndex(null);
  };

  const addShade = (groupIdx: number) => {
    const group = groups[groupIdx];
    const last = group?.swatches[group.swatches.length - 1];
    const shade = nextShadeFromLast(last);
    const id = `c_${Date.now()}`;
    const newSwatch: ColorSwatch = { id, ...shade };
    const updated = groups.map((g, i) =>
      i === groupIdx ? { ...g, swatches: [...g.swatches, newSwatch] } : g
    );
    if (onUpdateData) onUpdateData({ ...data, groups: updated });
    setEditingSwatchId(id);
  };

  const updateSwatch = (groupIdx: number, swatchIdx: number, updatedSwatch: ColorSwatch) => {
    const updated = groups.map((g, i) => {
      if (i === groupIdx) {
        const newSwatches = g.swatches.map((s, si) => si === swatchIdx ? updatedSwatch : s);
        return { ...g, swatches: newSwatches };
      }
      return g;
    });
    if (onUpdateData) onUpdateData({ ...data, groups: updated });
  };

  const deleteSwatch = (groupIdx: number, swatchIdx: number) => {
    const updated = groups.map((g, i) => {
      if (i === groupIdx) {
        return { ...g, swatches: g.swatches.filter((_, si) => si !== swatchIdx) };
      }
      return g;
    });
    if (onUpdateData) onUpdateData({ ...data, groups: updated });
  };

  const moveSwatchToGroup = (fromGroupIdx: number, swatchIdx: number, toGroupIdx: number) => {
    if (fromGroupIdx === toGroupIdx) return;
    const from = groups[fromGroupIdx];
    const to = groups[toGroupIdx];
    const swatch = from?.swatches[swatchIdx];
    if (!from || !to || !swatch) return;
    const updated = groups.map((g, i) => {
      if (i === fromGroupIdx) {
        return { ...g, swatches: g.swatches.filter((_, si) => si !== swatchIdx) };
      }
      if (i === toGroupIdx) {
        return { ...g, swatches: [...g.swatches, swatch] };
      }
      return g;
    });
    if (onUpdateData) onUpdateData({ ...data, groups: updated });
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin} onEditSectionFields={onEditSectionFields}>
      <div className="space-y-16">
        {groups.map((group, groupIdx) => (
          <div key={group.id || groupIdx} className="group/group relative">
            <div className="flex items-center justify-between border-b border-[var(--ci-border,#eaeaea)] pb-3 mb-6">
              <EditableText
                tag="h3"
                value={group.groupLabel}
                placeholder="Group Label (e.g., Primary Palette)"
                onSave={(val) => updateGroupLabel(groupIdx, val)}
                isAdmin={isAdmin}
                className="text-xl font-bold text-[var(--ci-text,#111)]"
              />

              {isAdmin && (
                <button
                  onClick={() => setDeleteGroupIndex(groupIdx)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded opacity-0 group-hover/group:opacity-100 transition-opacity"
                  title="Delete Color Group"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              {group.swatches.map((swatch, swatchIdx) => (
                <EditableColor
                  key={swatch.id || swatchIdx}
                  swatch={swatch}
                  onUpdate={(updated) => updateSwatch(groupIdx, swatchIdx, updated)}
                  onDelete={() => deleteSwatch(groupIdx, swatchIdx)}
                  isAdmin={isAdmin}
                  startEditing={editingSwatchId === swatch.id}
                  onEditingHandled={() => setEditingSwatchId(null)}
                  paletteMove={
                    isAdmin && groups.length > 1
                      ? {
                          currentId: String(groupIdx),
                          options: groups.map((g, i) => ({
                            id: String(i),
                            label: g.groupLabel || `Group ${i + 1}`,
                          })),
                          onMove: (targetId) =>
                            moveSwatchToGroup(groupIdx, swatchIdx, Number(targetId)),
                          scopeLabel: "this shade",
                        }
                      : undefined
                  }
                />
              ))}

              <AddItemButton
                label="Add shade"
                onClick={() => addShade(groupIdx)}
                isAdmin={isAdmin}
                variant="shade"
              />
            </div>

            {deleteGroupIndex === groupIdx && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="ci-chrome bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4 border border-gray-100 text-gray-900">
                  <div className="flex items-center gap-3 text-red-600">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">Delete Color Group</h4>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Delete group <strong>&quot;{group.groupLabel}&quot;</strong> and its {group.swatches.length} colors? This can&apos;t be undone.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setDeleteGroupIndex(null)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => confirmDeleteGroup(groupIdx)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 font-semibold"
                    >
                      Delete Group & Colors
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="pt-4">
          <AddItemButton
            label="+ Add Color Group"
            onClick={addGroup}
            isAdmin={isAdmin}
            variant="button"
          />
        </div>
      </div>
    </SectionContainer>
  );
}
