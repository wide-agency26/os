"use client";

import React, { useState } from "react";
import { CISection, CIAsset, ColorsSectionData, ColorGroup, ColorSwatch } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";
import { EditableText, EditableColor, EditableListItem, AddItemButton } from "../primitives";
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

  const addGroup = () => {
    const newGroup: ColorGroup = {
      id: `grp_${Date.now()}`,
      groupLabel: "New Color Palette",
      swatches: [
        { id: `c_${Date.now()}_1`, name: "Primary Accent", hex: "#0066FF" },
        { id: `c_${Date.now()}_2`, name: "Neutral Dark", hex: "#111827" }
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

  const addSwatch = (groupIdx: number) => {
    const newSwatch: ColorSwatch = {
      id: `c_${Date.now()}`,
      name: "New Swatch",
      hex: "#3B82F6"
    };
    const updated = groups.map((g, i) => {
      if (i === groupIdx) {
        return { ...g, swatches: [...g.swatches, newSwatch] };
      }
      return g;
    });
    if (onUpdateData) onUpdateData({ ...data, groups: updated });
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

  return (
    <SectionContainer section={section} isAdmin={isAdmin} onEditSectionFields={onEditSectionFields}>
      <div className="space-y-16">
        {groups.map((group, groupIdx) => (
          <div key={group.id || groupIdx} className="group/group relative">
            {/* Group Header */}
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

            {/* Swatches Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {group.swatches.map((swatch, swatchIdx) => (
                <EditableListItem
                  key={swatch.id || swatchIdx}
                  onDelete={() => deleteSwatch(groupIdx, swatchIdx)}
                  deleteConfirmTitle={`Delete swatch '${swatch.name}'?`}
                  isAdmin={isAdmin}
                >
                  <EditableColor
                    swatch={swatch}
                    onUpdate={(updated) => updateSwatch(groupIdx, swatchIdx, updated)}
                    isAdmin={isAdmin}
                  />
                </EditableListItem>
              ))}

              <AddItemButton
                label="+ Add Color"
                onClick={() => addSwatch(groupIdx)}
                isAdmin={isAdmin}
                variant="dashed-card"
                className="min-h-[180px]"
              />
            </div>

            {/* Group Delete Confirm Modal */}
            {deleteGroupIndex === groupIdx && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4 border border-gray-100">
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
