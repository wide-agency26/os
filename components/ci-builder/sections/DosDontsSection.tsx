"use client";

import React from "react";
import { CISection, CIAsset, DosDontsSectionData, DoDontItem } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";
import { EditableText, EditableImage, EditableListItem } from "../primitives";
import { Check, X } from "lucide-react";

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

export function DosDontsSection({
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
  const data = (section.data || {}) as DosDontsSectionData;
  const items = data.items || [];
  const availableAssets = assets.length > 0 ? assets : allAssets;

  const doItems = items.filter(i => i.type === "do");
  const dontItems = items.filter(i => i.type === "dont");

  const handleDeleteItem = (item: DoDontItem) => {
    const assetId = item.assetId;
    let count = 0;
    allSections.forEach(sec => {
      const dStr = JSON.stringify(sec.data || {});
      if (assetId && dStr.includes(assetId)) {
        count += (dStr.match(new RegExp(assetId, 'g')) || []).length;
      }
    });

    const updated = items.filter(i => i.id !== item.id);
    if (onUpdateData) onUpdateData({ ...data, items: updated });

    if (count <= 1 && assetId && onDeleteAssetRecord) {
      onDeleteAssetRecord(assetId);
    }
  };

  const addItem = (type: "do" | "dont", selectedAsset: Partial<CIAsset>) => {
    const newItem: DoDontItem = {
      id: `dd_${Date.now()}`,
      type,
      assetId: selectedAsset.id || "",
      caption: type === "do" ? "DO: Keep proper clearspace and contrast." : "DON'T: Distort or change brand colors."
    };
    if (onUpdateData) onUpdateData({ ...data, items: [...items, newItem] });
  };

  const updateItemCaption = (id: string, caption: string) => {
    const updated = items.map(i => i.id === id ? { ...i, caption } : i);
    if (onUpdateData) onUpdateData({ ...data, items: updated });
  };

  const updateItemAsset = (id: string, assetId: string) => {
    const updated = items.map(i => i.id === id ? { ...i, assetId } : i);
    if (onUpdateData) onUpdateData({ ...data, items: updated });
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin} onEditSectionFields={onEditSectionFields}>
      <div className="space-y-16">
        {/* DO Group */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-6 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">✓</span>
            Approved Usage Examples (Do)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doItems.map((item) => (
              <EditableListItem
                key={item.id}
                onDelete={() => handleDeleteItem(item)}
                deleteConfirmTitle="Delete 'Do' example?"
                isAdmin={isAdmin}
                className="bg-white border-2 border-emerald-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
              >
                <div className="h-48 bg-emerald-50/40 p-4 flex items-center justify-center relative border-b border-emerald-100">
                  <EditableImage
                    assetId={item.assetId}
                    onSelectAsset={(ast) => updateItemAsset(item.id, ast.id!)}
                    guidelineId={guidelineId}
                    availableAssets={availableAssets}
                    compatibleKind="dos_donts"
                    isAdmin={isAdmin}
                    onAddAssetRecord={onAddAssetRecord}
                    className="w-full h-full flex items-center justify-center"
                    imageClassName="max-w-full max-h-full object-contain"
                  />
                  <div className="absolute top-3 left-3 bg-emerald-600 text-white rounded-full p-1 shadow-md">
                    <Check className="w-4 h-4" />
                  </div>
                </div>

                <div className="p-4 bg-white">
                  <EditableText
                    tag="p"
                    multiline
                    value={item.caption}
                    placeholder="Caption explaining why this usage is approved..."
                    onSave={(val) => updateItemCaption(item.id, val)}
                    isAdmin={isAdmin}
                    className="text-xs font-medium text-gray-800 leading-relaxed"
                  />
                </div>
              </EditableListItem>
            ))}

            {isAdmin && (
              <EditableImage
                onSelectAsset={(ast) => addItem("do", ast)}
                guidelineId={guidelineId}
                availableAssets={availableAssets}
                compatibleKind="dos_donts"
                isAdmin={isAdmin}
                onAddAssetRecord={onAddAssetRecord}
                className="min-h-[220px]"
              >
                <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/60 rounded-2xl text-emerald-700 font-semibold text-xs transition-colors">
                  <span>+ Add Do Example</span>
                </div>
              </EditableImage>
            )}
          </div>
        </div>

        {/* DON'T Group */}
        <div className="border-t border-[var(--ci-border,#eaeaea)] pt-12">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-6 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs">✕</span>
            Incorrect Usage Examples (Don&apos;t)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dontItems.map((item) => (
              <EditableListItem
                key={item.id}
                onDelete={() => handleDeleteItem(item)}
                deleteConfirmTitle="Delete 'Don't' example?"
                isAdmin={isAdmin}
                className="bg-white border-2 border-rose-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
              >
                <div className="h-48 bg-rose-50/40 p-4 flex items-center justify-center relative border-b border-rose-100">
                  <EditableImage
                    assetId={item.assetId}
                    onSelectAsset={(ast) => updateItemAsset(item.id, ast.id!)}
                    guidelineId={guidelineId}
                    availableAssets={availableAssets}
                    compatibleKind="dos_donts"
                    isAdmin={isAdmin}
                    onAddAssetRecord={onAddAssetRecord}
                    className="w-full h-full flex items-center justify-center"
                    imageClassName="max-w-full max-h-full object-contain"
                  />
                  <div className="absolute top-3 left-3 bg-rose-600 text-white rounded-full p-1 shadow-md">
                    <X className="w-4 h-4" />
                  </div>
                </div>

                <div className="p-4 bg-white">
                  <EditableText
                    tag="p"
                    multiline
                    value={item.caption}
                    placeholder="Caption explaining why this usage is incorrect..."
                    onSave={(val) => updateItemCaption(item.id, val)}
                    isAdmin={isAdmin}
                    className="text-xs font-medium text-gray-800 leading-relaxed"
                  />
                </div>
              </EditableListItem>
            ))}

            {isAdmin && (
              <EditableImage
                onSelectAsset={(ast) => addItem("dont", ast)}
                guidelineId={guidelineId}
                availableAssets={availableAssets}
                compatibleKind="dos_donts"
                isAdmin={isAdmin}
                onAddAssetRecord={onAddAssetRecord}
                className="min-h-[220px]"
              >
                <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center p-6 border-2 border-dashed border-rose-300 hover:border-rose-500 bg-rose-50/30 hover:bg-rose-50/60 rounded-2xl text-rose-700 font-semibold text-xs transition-colors">
                  <span>+ Add Don&apos;t Example</span>
                </div>
              </EditableImage>
            )}
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
