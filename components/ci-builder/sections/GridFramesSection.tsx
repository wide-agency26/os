"use client";

import React, { useState } from "react";
import { CISection, CIAsset, GridFramesSectionData, FrameCard } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";
import { EditableText, EditableImage, EditableListItem, AddItemButton, CopyableValue } from "../primitives";
import { Settings } from "lucide-react";

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

export function GridFramesSection({
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
  const data = (section.data || {}) as GridFramesSectionData;
  const frames = data.frames || [];
  const availableAssets = assets.length > 0 ? assets : allAssets;
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const handleDeleteFrame = (frame: FrameCard) => {
    const assetId = frame.assetId;
    let count = 0;
    allSections.forEach(sec => {
      const dStr = JSON.stringify(sec.data || {});
      if (assetId && dStr.includes(assetId)) {
        count += (dStr.match(new RegExp(assetId, 'g')) || []).length;
      }
    });

    const updated = frames.filter(f => f.id !== frame.id);
    if (onUpdateData) onUpdateData({ ...data, frames: updated });

    if (count <= 1 && assetId && onDeleteAssetRecord) {
      onDeleteAssetRecord(assetId);
    }
  };

  const addFrameTemplate = (selectedAsset: Partial<CIAsset>) => {
    const newFrame: FrameCard = {
      id: `frame_${Date.now()}`,
      label: selectedAsset.label || "Social Frame Template",
      sublabel: "1080 x 1080 px",
      aspectRatio: "1:1",
      assetId: selectedAsset.id || ""
    };
    if (onUpdateData) onUpdateData({ ...data, frames: [...frames, newFrame] });
  };

  const updateFrame = (id: string, updates: Partial<FrameCard>) => {
    const updated = frames.map(f => f.id === id ? { ...f, ...updates } : f);
    if (onUpdateData) onUpdateData({ ...data, frames: updated });
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin} onEditSectionFields={onEditSectionFields}>
      <div className="space-y-12">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-6">
          Grid System & Aspect Ratio Frames
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {frames.map((frame) => {
            const aspectStyle = frame.aspectRatio === "16:9" 
              ? "aspect-video"
              : frame.aspectRatio === "9:16"
              ? "aspect-[9/16]"
              : frame.aspectRatio === "4:5"
              ? "aspect-[4/5]"
              : "aspect-square";

            return (
              <EditableListItem
                key={frame.id}
                onDelete={() => handleDeleteFrame(frame)}
                deleteConfirmTitle="Delete frame template card?"
                isAdmin={isAdmin}
                className="bg-white border border-[var(--ci-border,#eaeaea)] rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
              >
                {/* Frame Image & Container */}
                <div className={`w-full bg-gray-50 p-4 flex items-center justify-center relative border-b border-[var(--ci-border,#eaeaea)] ${aspectStyle}`}>
                  <EditableImage
                    assetId={frame.assetId}
                    onSelectAsset={(ast) => updateFrame(frame.id, { assetId: ast.id })}
                    guidelineId={guidelineId}
                    availableAssets={availableAssets}
                    compatibleKind="grid_frames"
                    isAdmin={isAdmin}
                    onAddAssetRecord={onAddAssetRecord}
                    className="w-full h-full flex items-center justify-center"
                    imageClassName="max-w-full max-h-full object-contain"
                  />

                  {isAdmin && (
                    <button
                      onClick={() => setEditingCardId(editingCardId === frame.id ? null : frame.id)}
                      className="absolute bottom-2 right-2 p-1.5 bg-white/90 text-gray-700 rounded-full shadow hover:bg-white z-10"
                      title="Aspect Ratio Settings"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Aspect Ratio Config Drawer */}
                {isAdmin && editingCardId === frame.id && (
                  <div className="p-3 bg-gray-100 border-b border-gray-200 text-xs flex items-center justify-between">
                    <label className="font-semibold text-gray-700">Aspect Ratio:</label>
                    <select
                      value={frame.aspectRatio || "1:1"}
                      onChange={(e) => updateFrame(frame.id, { aspectRatio: e.target.value })}
                      className="bg-white text-gray-900 border rounded px-2 py-1"
                    >
                      <option value="1:1">1:1 (Square)</option>
                      <option value="4:5">4:5 (Portrait)</option>
                      <option value="9:16">9:16 (Story/Reel)</option>
                      <option value="16:9">16:9 (Landscape)</option>
                    </select>
                  </div>
                )}

                {/* Label & Sublabel Footer */}
                <div className="p-4">
                  <div className="flex items-baseline justify-between mb-1">
                    <EditableText
                      tag="h4"
                      value={frame.label}
                      placeholder="Frame Title"
                      onSave={(val) => updateFrame(frame.id, { label: val })}
                      isAdmin={isAdmin}
                      className="font-bold text-sm text-[var(--ci-text,#111)]"
                    />

                    <span className="text-xs font-mono font-bold text-[var(--ci-accent,#0066ff)] bg-blue-50 px-2 py-0.5 rounded">
                      <CopyableValue value={frame.aspectRatio || "1:1"} label={`${frame.label} ratio`} />
                    </span>
                  </div>

                  {frame.sublabel && (
                    <EditableText
                      tag="p"
                      value={frame.sublabel}
                      placeholder="Dimensions / Notes"
                      onSave={(val) => updateFrame(frame.id, { sublabel: val })}
                      isAdmin={isAdmin}
                      className="text-xs text-[var(--ci-text-muted,#666)]"
                    />
                  )}
                </div>
              </EditableListItem>
            );
          })}

          {isAdmin && (
            <EditableImage
              onSelectAsset={addFrameTemplate}
              guidelineId={guidelineId}
              availableAssets={availableAssets}
              compatibleKind="grid_frames"
              isAdmin={isAdmin}
              onAddAssetRecord={onAddAssetRecord}
              className="min-h-[240px]"
            >
              <div className="w-full h-full min-h-[240px] flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gray-50/50 rounded-2xl text-gray-500 hover:text-blue-600 transition-colors">
                <span className="text-xs font-semibold">+ Add Frame Template</span>
              </div>
            </EditableImage>
          )}
        </div>
      </div>
    </SectionContainer>
  );
}
