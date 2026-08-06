"use client";

import React, { useState } from "react";
import { CISection, CIAsset, ColorsSectionData, ColorGroup, ColorSwatch } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";
import { EditableText, EditableColor, EditableListItem, AddItemButton } from "../primitives";
import { ciFieldClass, ciFieldMonoClass } from "../primitives/formStyles";
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
  const [addColorGroupIdx, setAddColorGroupIdx] = useState<number | null>(null);
  const [newHex, setNewHex] = useState("#3B82F6");
  const [newName, setNewName] = useState("New Swatch");

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

  const openAddColor = (groupIdx: number) => {
    setAddColorGroupIdx(groupIdx);
    setNewHex("#3B82F6");
    setNewName("New Swatch");
  };

  const commitAddColor = () => {
    if (addColorGroupIdx === null) return;
    const hex = /^#[0-9a-fA-F]{6}$/.test(newHex.trim())
      ? newHex.trim().toLowerCase()
      : "#3b82f6";
    const name = newName.trim() || "New Swatch";
    const id = `c_${Date.now()}`;
    const cssVar = `--color-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const newSwatch: ColorSwatch = { id, name, hex, cssVar };
    const updated = groups.map((g, i) => {
      if (i === addColorGroupIdx) {
        return { ...g, swatches: [...g.swatches, newSwatch] };
      }
      return g;
    });
    if (onUpdateData) onUpdateData({ ...data, groups: updated });
    setEditingSwatchId(id);
    setAddColorGroupIdx(null);
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
                    startEditing={editingSwatchId === swatch.id}
                    onEditingHandled={() => setEditingSwatchId(null)}
                  />
                </EditableListItem>
              ))}

              <AddItemButton
                label="+ Add Color"
                onClick={() => openAddColor(groupIdx)}
                isAdmin={isAdmin}
                variant="dashed-card"
                className="min-h-[180px]"
              />
            </div>

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

      {addColorGroupIdx !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white text-gray-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4 border border-gray-100">
            <h4 className="font-semibold text-gray-900 text-sm">Add Color</h4>
            <p className="text-xs text-gray-500">Pick a color or paste a HEX value, then save.</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(newHex) ? newHex : "#3B82F6"}
                  onChange={(e) => setNewHex(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={newHex}
                  onChange={(e) => setNewHex(e.target.value)}
                  className={`flex-1 uppercase ${ciFieldMonoClass}`}
                  placeholder="#3B82F6"
                  autoFocus
                />
              </div>
              <div
                className="mt-2 h-8 rounded-lg border border-gray-200"
                style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(newHex) ? newHex : "#3B82F6" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={`w-full ${ciFieldClass}`}
                placeholder="Primary Accent"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAddColorGroupIdx(null)}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitAddColor}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
              >
                Add Color
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionContainer>
  );
}
