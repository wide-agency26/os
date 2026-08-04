"use client";

import React, { useState } from "react";
import { CISection, CIAsset, BackgroundsSectionData, BackgroundGroup, BackgroundAsset } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";
import { EditableText, EditableImage, EditableListItem, AddItemButton } from "../primitives";
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

export function BackgroundsSection({
  section,
  assets = [],
  allAssets = [],
  allSections = [],
  isAdmin,
  onUpdateData,
  onEditSectionFields,
  onAddAssetRecord,
  onDeleteAssetRecord,
  guidelineId = ""
}: SectionProps) {
  const data = (section.data || {}) as BackgroundsSectionData;
  const groups = data.groups || [];
  const availableAssets = assets.length > 0 ? assets : allAssets;
  const [deleteGroupIndex, setDeleteGroupIndex] = useState<number | null>(null);

  const addGroup = () => {
    const newGroup: BackgroundGroup = {
      id: `bg_grp_${Date.now()}`,
      groupLabel: "Web & Digital Backgrounds",
      assets: []
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

  const addBackgroundAsset = (groupIdx: number, selectedAsset: Partial<CIAsset>) => {
    const newBgAsset: BackgroundAsset = {
      id: `bg_${Date.now()}`,
      assetId: selectedAsset.id || "",
      label: selectedAsset.label || "Background Element"
    };

    const updated = groups.map((g, i) => {
      if (i === groupIdx) {
        return { ...g, assets: [...g.assets, newBgAsset] };
      }
      return g;
    });
    if (onUpdateData) onUpdateData({ ...data, groups: updated });
  };

  const updateBackgroundAsset = (groupIdx: number, assetIdx: number, updates: Partial<BackgroundAsset>) => {
    const updated = groups.map((g, i) => {
      if (i === groupIdx) {
        const newAssets = g.assets.map((a, ai) => ai === assetIdx ? { ...a, ...updates } : a);
        return { ...g, assets: newAssets };
      }
      return g;
    });
    if (onUpdateData) onUpdateData({ ...data, groups: updated });
  };

  const handleDeleteBackgroundAsset = (groupIdx: number, bgAsset: BackgroundAsset) => {
    const assetId = bgAsset.assetId;
    let count = 0;
    allSections.forEach(sec => {
      const dStr = JSON.stringify(sec.data || {});
      if (assetId && dStr.includes(assetId)) {
        count += (dStr.match(new RegExp(assetId, 'g')) || []).length;
      }
    });

    const updated = groups.map((g, i) => {
      if (i === groupIdx) {
        return { ...g, assets: g.assets.filter(a => a.id !== bgAsset.id) };
      }
      return g;
    });
    if (onUpdateData) onUpdateData({ ...data, groups: updated });

    if (count <= 1 && assetId && onDeleteAssetRecord) {
      onDeleteAssetRecord(assetId);
    }
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
                placeholder="Background Group Label"
                onSave={(val) => updateGroupLabel(groupIdx, val)}
                isAdmin={isAdmin}
                className="text-xl font-bold text-[var(--ci-text,#111)]"
              />

              {isAdmin && (
                <button
                  onClick={() => setDeleteGroupIndex(groupIdx)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded opacity-0 group-hover/group:opacity-100 transition-opacity"
                  title="Delete Background Group"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Background Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {group.assets.map((bgAsset, assetIdx) => (
                <EditableListItem
                  key={bgAsset.id || assetIdx}
                  onDelete={() => handleDeleteBackgroundAsset(groupIdx, bgAsset)}
                  deleteConfirmTitle="Delete background asset?"
                  isAdmin={isAdmin}
                  className="bg-white border border-[var(--ci-border,#eaeaea)] rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
                >
                  <div className="h-36 bg-gray-50 p-2 flex items-center justify-center border-b border-gray-100 relative">
                    <EditableImage
                      assetId={bgAsset.assetId}
                      onSelectAsset={(ast) => updateBackgroundAsset(groupIdx, assetIdx, { assetId: ast.id })}
                      guidelineId={guidelineId}
                      availableAssets={availableAssets}
                      compatibleKind="backgrounds"
                      isAdmin={isAdmin}
                      onAddAssetRecord={onAddAssetRecord}
                      className="w-full h-full flex items-center justify-center"
                      imageClassName="max-w-full max-h-full object-cover rounded-lg"
                    />
                  </div>

                  <div className="p-3">
                    <EditableText
                      tag="p"
                      value={bgAsset.label || ""}
                      placeholder="Background Label"
                      onSave={(val) => updateBackgroundAsset(groupIdx, assetIdx, { label: val })}
                      isAdmin={isAdmin}
                      className="text-xs font-semibold text-[var(--ci-text,#111)] truncate"
                    />
                  </div>
                </EditableListItem>
              ))}

              {isAdmin && (
                <EditableImage
                  onSelectAsset={(ast) => addBackgroundAsset(groupIdx, ast)}
                  guidelineId={guidelineId}
                  availableAssets={availableAssets}
                  compatibleKind="backgrounds"
                  isAdmin={isAdmin}
                  onAddAssetRecord={onAddAssetRecord}
                  className="min-h-[160px]"
                >
                  <div className="w-full h-full min-h-[160px] flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gray-50/50 rounded-2xl text-gray-500 hover:text-blue-600 transition-colors">
                    <span className="text-xs font-semibold">+ Add Background</span>
                  </div>
                </EditableImage>
              )}
            </div>

            {/* Group Delete Confirm Modal */}
            {deleteGroupIndex === groupIdx && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4 border border-gray-100">
                  <div className="flex items-center gap-3 text-red-600">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">Delete Background Group</h4>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Delete group <strong>&quot;{group.groupLabel}&quot;</strong> and its {group.assets.length} assets? This can&apos;t be undone.
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
                      Delete Group & Assets
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="pt-4">
          <AddItemButton
            label="+ Add Background Group"
            onClick={addGroup}
            isAdmin={isAdmin}
            variant="button"
          />
        </div>
      </div>
    </SectionContainer>
  );
}
