"use client";

import React from "react";
import { CISection, CIAsset, ApplicationsSectionData, ApplicationCard } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";
import { EditableText, EditableImage, EditableListItem, AddItemButton } from "../primitives";

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

export function ApplicationsSection({
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
  const data = (section.data || {}) as ApplicationsSectionData;
  const apps = data.apps || [];
  const availableAssets = assets.length > 0 ? assets : allAssets;

  const handleDeleteApplication = (app: ApplicationCard) => {
    const assetId = app.assetId;
    let count = 0;
    allSections.forEach(sec => {
      const dStr = JSON.stringify(sec.data || {});
      if (assetId && dStr.includes(assetId)) {
        count += (dStr.match(new RegExp(assetId, 'g')) || []).length;
      }
    });

    const updated = apps.filter(a => a.id !== app.id);
    if (onUpdateData) onUpdateData({ ...data, apps: updated });

    if (count <= 1 && assetId && onDeleteAssetRecord) {
      onDeleteAssetRecord(assetId);
    }
  };

  const addApplication = (selectedAsset: Partial<CIAsset>) => {
    const newApp: ApplicationCard = {
      id: `app_${Date.now()}`,
      label: selectedAsset.label || "Brand Application",
      subtitle: "Mockup Context",
      tag: "Digital / Product",
      assetId: selectedAsset.id || ""
    };
    if (onUpdateData) onUpdateData({ ...data, apps: [...apps, newApp] });
  };

  const updateApplication = (id: string, updates: Partial<ApplicationCard>) => {
    const updated = apps.map(a => a.id === id ? { ...a, ...updates } : a);
    if (onUpdateData) onUpdateData({ ...data, apps: updated });
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin} onEditSectionFields={onEditSectionFields}>
      <div className="space-y-12">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-6">
          Real-World Applications & Mockups
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => (
            <EditableListItem
              key={app.id}
              onDelete={() => handleDeleteApplication(app)}
              deleteConfirmTitle="Delete application mockup card?"
              isAdmin={isAdmin}
              className="bg-white border border-[var(--ci-border,#eaeaea)] rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
            >
              {/* Mockup Image */}
              <div className="h-52 bg-gray-50 p-4 flex items-center justify-center relative border-b border-[var(--ci-border,#eaeaea)]">
                <EditableImage
                  assetId={app.assetId}
                  onSelectAsset={(ast) => updateApplication(app.id, { assetId: ast.id })}
                  guidelineId={guidelineId}
                  availableAssets={availableAssets}
                  compatibleKind="applications"
                  isAdmin={isAdmin}
                  onAddAssetRecord={onAddAssetRecord}
                  className="w-full h-full flex items-center justify-center"
                  imageClassName="max-w-full max-h-full object-contain rounded-xl"
                />
              </div>

              {/* Labels Footer */}
              <div className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <EditableText
                    tag="h4"
                    value={app.label}
                    placeholder="Application Title"
                    onSave={(val) => updateApplication(app.id, { label: val })}
                    isAdmin={isAdmin}
                    className="font-bold text-base text-[var(--ci-text,#111)]"
                  />
                  {app.tag && (
                    <EditableText
                      tag="span"
                      value={app.tag}
                      placeholder="TAG"
                      onSave={(val) => updateApplication(app.id, { tag: val })}
                      isAdmin={isAdmin}
                      className="text-[10px] font-bold uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md"
                    />
                  )}
                </div>

                {app.subtitle && (
                  <EditableText
                    tag="p"
                    value={app.subtitle}
                    placeholder="Subtitle or Context"
                    onSave={(val) => updateApplication(app.id, { subtitle: val })}
                    isAdmin={isAdmin}
                    className="text-xs text-[var(--ci-text-muted,#666)]"
                  />
                )}
              </div>
            </EditableListItem>
          ))}

          {isAdmin && (
            <EditableImage
              onSelectAsset={addApplication}
              guidelineId={guidelineId}
              availableAssets={availableAssets}
              compatibleKind="applications"
              isAdmin={isAdmin}
              onAddAssetRecord={onAddAssetRecord}
              className="min-h-[260px]"
            >
              <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gray-50/50 rounded-2xl text-gray-500 hover:text-blue-600 transition-colors">
                <span className="text-xs font-semibold">+ Add Application</span>
              </div>
            </EditableImage>
          )}
        </div>
      </div>
    </SectionContainer>
  );
}
