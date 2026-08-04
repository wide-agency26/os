"use client";

import React, { useState } from "react";
import { CISection, CIAsset, LogoSectionData, LogoAsset, MinSizeCard } from "@/lib/ci-builder/types";
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

export function LogoSection({
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
  const data = (section.data || {}) as LogoSectionData;
  const logos = data.logos || [];
  const minSizes = data.minSizes || [
    ...(data.minSizeDigital ? [{ id: "min_dig", useCase: "Digital / Web", size: data.minSizeDigital, unit: "px" }] : []),
    ...(data.minSizePrint ? [{ id: "min_prt", useCase: "Print / Physical", size: data.minSizePrint, unit: "mm" }] : [])
  ];

  const availableAssets = assets.length > 0 ? assets : allAssets;
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);

  // Shared Asset Safety Delete Check
  const handleDeleteVariant = (variant: LogoAsset) => {
    const assetId = variant.assetId;
    let count = 0;
    allSections.forEach(sec => {
      const dStr = JSON.stringify(sec.data || {});
      if (assetId && dStr.includes(assetId)) {
        count += (dStr.match(new RegExp(assetId, 'g')) || []).length;
      }
    });

    const newLogos = logos.filter(l => (l.id || l.assetId) !== (variant.id || variant.assetId));
    if (onUpdateData) onUpdateData({ ...data, logos: newLogos });

    if (count <= 1 && assetId && onDeleteAssetRecord) {
      onDeleteAssetRecord(assetId);
    }
  };

  const addLogoVariant = (selectedAsset: Partial<CIAsset>) => {
    const newVariant: LogoAsset = {
      id: `logo_${Date.now()}`,
      assetId: selectedAsset.id || "",
      label: selectedAsset.label || "Logo Variant",
      subtitle: "Primary Mark",
      stage: "light",
      fit: "contain"
    };
    if (onUpdateData) onUpdateData({ ...data, logos: [...logos, newVariant] });
  };

  const updateLogoVariant = (id: string, updates: Partial<LogoAsset>) => {
    const updated = logos.map(l => (l.id || l.assetId) === id ? { ...l, ...updates } : l);
    if (onUpdateData) onUpdateData({ ...data, logos: updated });
  };

  const addMinSize = () => {
    const newMin: MinSizeCard = {
      id: `min_${Date.now()}`,
      useCase: "Favicon / Icon",
      size: "24",
      unit: "px"
    };
    if (onUpdateData) onUpdateData({ ...data, minSizes: [...minSizes, newMin] });
  };

  const updateMinSize = (id: string, field: keyof MinSizeCard, val: string) => {
    const updated = minSizes.map(m => m.id === id ? { ...m, [field]: val } : m);
    if (onUpdateData) onUpdateData({ ...data, minSizes: updated });
  };

  const deleteMinSize = (id: string) => {
    if (onUpdateData) onUpdateData({ ...data, minSizes: minSizes.filter(m => m.id !== id) });
  };

  const updateClearspaceText = (clearspaceText: string) => {
    if (onUpdateData) onUpdateData({ ...data, clearspaceText });
  };

  const updateClearspaceAsset = (asset: Partial<CIAsset>) => {
    if (onUpdateData) onUpdateData({ ...data, clearspaceAssetId: asset.id });
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin} onEditSectionFields={onEditSectionFields}>
      <div className="space-y-16">
        {/* Logo Variants Grid */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-6">
            Logo Variants & Marks
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {logos.map((logo) => {
              const itemKey = logo.id || logo.assetId;
              const isDarkStage = logo.stage === "dark";
              return (
                <EditableListItem
                  key={itemKey}
                  onDelete={() => handleDeleteVariant(logo)}
                  deleteConfirmTitle="Delete logo variant? If this asset is unused elsewhere, the uploaded file will be deleted."
                  isAdmin={isAdmin}
                  className={`rounded-2xl border border-[var(--ci-border,#eaeaea)] overflow-hidden shadow-sm flex flex-col ${
                    isDarkStage ? "bg-gray-900 text-white" : "bg-white text-[var(--ci-text,#111)]"
                  }`}
                >
                  {/* Image slot */}
                  <div className="h-44 p-6 flex items-center justify-center relative border-b border-[var(--ci-border,#eaeaea)]">
                    <EditableImage
                      assetId={logo.assetId}
                      onSelectAsset={(ast) => updateLogoVariant(itemKey, { assetId: ast.id })}
                      guidelineId={guidelineId}
                      availableAssets={availableAssets}
                      compatibleKind="logo"
                      isAdmin={isAdmin}
                      onAddAssetRecord={onAddAssetRecord}
                      className="w-full h-full flex items-center justify-center"
                      imageClassName={`max-w-full max-h-full ${logo.fit === "cover" ? "object-cover" : "object-contain"}`}
                    />

                    {isAdmin && (
                      <button
                        onClick={() => setEditingVariantId(editingVariantId === itemKey ? null : itemKey)}
                        className="absolute bottom-2 right-2 p-1.5 bg-white/80 text-gray-700 rounded-full shadow hover:bg-white z-10"
                        title="Configure Stage & Fit"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Settings Drawer if open */}
                  {isAdmin && editingVariantId === itemKey && (
                    <div className="p-3 bg-gray-100 text-gray-800 text-xs border-b border-gray-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <label className="font-semibold">Stage:</label>
                        <select
                          value={logo.stage || "light"}
                          onChange={(e) => updateLogoVariant(itemKey, { stage: e.target.value as any })}
                          className="bg-white border rounded px-1.5 py-0.5"
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="any">Any</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="font-semibold">Fit:</label>
                        <select
                          value={logo.fit || "contain"}
                          onChange={(e) => updateLogoVariant(itemKey, { fit: e.target.value as any })}
                          className="bg-white border rounded px-1.5 py-0.5"
                        >
                          <option value="contain">Contain</option>
                          <option value="cover">Cover</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Labels Footer */}
                  <div className="p-4 flex flex-col justify-between flex-1">
                    <EditableText
                      tag="h4"
                      value={logo.label}
                      placeholder="Logo Label"
                      onSave={(val) => updateLogoVariant(itemKey, { label: val })}
                      isAdmin={isAdmin}
                      className="font-bold text-base"
                    />
                    {logo.subtitle && (
                      <EditableText
                        tag="p"
                        value={logo.subtitle}
                        placeholder="Variant Subtitle"
                        onSave={(val) => updateLogoVariant(itemKey, { subtitle: val })}
                        isAdmin={isAdmin}
                        className="text-xs opacity-60 mt-1"
                      />
                    )}
                  </div>
                </EditableListItem>
              );
            })}

            {isAdmin && (
              <EditableImage
                onSelectAsset={addLogoVariant}
                guidelineId={guidelineId}
                availableAssets={availableAssets}
                compatibleKind="logo"
                isAdmin={isAdmin}
                onAddAssetRecord={onAddAssetRecord}
                className="min-h-[220px]"
              >
                <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gray-50/50 rounded-2xl text-gray-500 hover:text-blue-600 transition-colors">
                  <span className="text-xs font-semibold">+ Add Logo Variant</span>
                </div>
              </EditableImage>
            )}
          </div>
        </div>

        {/* Clearspace & Safe Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-[var(--ci-border,#eaeaea)] pt-12">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-3">
              Clearspace & Exclusion Zone
            </h3>
            <EditableText
              tag="p"
              multiline
              value={data.clearspaceText || ""}
              placeholder="Specify clearspace rules (e.g., minimum clearspace is 50% of the logotype height 'X' around all edges)..."
              onSave={updateClearspaceText}
              isAdmin={isAdmin}
              className="text-sm text-[var(--ci-text-muted,#666)] leading-relaxed"
            />
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-3">
              Clearspace Diagram
            </h3>
            <EditableImage
              assetId={data.clearspaceAssetId}
              onSelectAsset={updateClearspaceAsset}
              guidelineId={guidelineId}
              availableAssets={availableAssets}
              compatibleKind="logo"
              isAdmin={isAdmin}
              onAddAssetRecord={onAddAssetRecord}
              className="w-full h-44 bg-gray-50 border border-[var(--ci-border,#eaeaea)] rounded-xl flex items-center justify-center p-4"
            />
          </div>
        </div>

        {/* Minimum Sizes */}
        <div className="border-t border-[var(--ci-border,#eaeaea)] pt-12">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-6">
            Minimum Size Guidelines
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {minSizes.map((ms) => (
              <EditableListItem
                key={ms.id}
                onDelete={() => deleteMinSize(ms.id)}
                deleteConfirmTitle="Delete minimum size specification?"
                isAdmin={isAdmin}
                className="bg-white border border-[var(--ci-border,#eaeaea)] p-4 rounded-xl shadow-sm"
              >
                <EditableText
                  tag="p"
                  value={ms.useCase}
                  placeholder="Use Case"
                  onSave={(val) => updateMinSize(ms.id, "useCase", val)}
                  isAdmin={isAdmin}
                  className="text-xs font-semibold text-[var(--ci-text-muted,#666)] uppercase mb-2"
                />
                <div className="flex items-baseline gap-1">
                  {isAdmin ? (
                    <>
                      <EditableText
                        tag="span"
                        value={ms.size}
                        placeholder="32"
                        onSave={(val) => updateMinSize(ms.id, "size", val)}
                        isAdmin={isAdmin}
                        className="text-2xl font-extrabold text-[var(--ci-accent,#000)]"
                      />
                      <EditableText
                        tag="span"
                        value={ms.unit}
                        placeholder="px"
                        onSave={(val) => updateMinSize(ms.id, "unit", val)}
                        isAdmin={isAdmin}
                        className="text-xs font-mono uppercase text-gray-500"
                      />
                    </>
                  ) : (
                    <CopyableValue
                      value={`${ms.size}${ms.unit}`}
                      label={`${ms.useCase} min size`}
                      className="text-2xl font-extrabold text-[var(--ci-accent,#000)]"
                    />
                  )}
                </div>
              </EditableListItem>
            ))}

            <AddItemButton
              label="+ Add Min Size"
              onClick={addMinSize}
              isAdmin={isAdmin}
              variant="dashed-card"
              className="min-h-[90px]"
            />
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
