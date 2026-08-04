"use client";

import React, { useState } from "react";
import { CISection, CIAsset, ButtonsSectionData, ButtonSample, StateColors } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";
import { EditableText, EditableListItem, AddItemButton, CopyableValue } from "../primitives";
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

export function ButtonsSection({
  section,
  isAdmin,
  onUpdateData,
  onEditSectionFields
}: SectionProps) {
  const data = (section.data || {}) as ButtonsSectionData;
  const samples = data.samples || [
    {
      id: "b_pri",
      variant: "primary",
      label: "Primary Action",
      defaultColors: { bg: "#0066FF", text: "#FFFFFF", border: "#0066FF" },
      hoverColors: { bg: "#0052CC", text: "#FFFFFF", border: "#0052CC" },
      activeColors: { bg: "#003D99", text: "#FFFFFF", border: "#003D99" }
    },
    {
      id: "b_sec",
      variant: "secondary",
      label: "Secondary Action",
      defaultColors: { bg: "#F3F4F6", text: "#111827", border: "#E5E7EB" },
      hoverColors: { bg: "#E5E7EB", text: "#111827", border: "#D1D5DB" },
      activeColors: { bg: "#D1D5DB", text: "#111827", border: "#9CA3AF" }
    }
  ];

  const [activeTabPerButton, setActiveTabPerButton] = useState<Record<string, "default" | "hover" | "active">>({});
  const [editingColorsId, setEditingColorsId] = useState<string | null>(null);

  const addButtonVariant = () => {
    const newSample: ButtonSample = {
      id: `btn_${Date.now()}`,
      variant: "custom",
      label: "New Button Action",
      defaultColors: { bg: "#10B981", text: "#FFFFFF", border: "#10B981" },
      hoverColors: { bg: "#059669", text: "#FFFFFF", border: "#059669" },
      activeColors: { bg: "#047857", text: "#FFFFFF", border: "#047857" }
    };
    if (onUpdateData) onUpdateData({ ...data, samples: [...samples, newSample] });
  };

  const updateButtonSample = (id: string, updates: Partial<ButtonSample>) => {
    const updated = samples.map(s => s.id === id ? { ...s, ...updates } : s);
    if (onUpdateData) onUpdateData({ ...data, samples: updated });
  };

  const updateStateColors = (id: string, stateKey: "defaultColors" | "hoverColors" | "activeColors", field: keyof StateColors, val: string) => {
    const updated = samples.map(s => {
      if (s.id === id) {
        const curState = s[stateKey] || {};
        return { ...s, [stateKey]: { ...curState, [field]: val } };
      }
      return s;
    });
    if (onUpdateData) onUpdateData({ ...data, samples: updated });
  };

  const deleteButtonVariant = (id: string) => {
    if (onUpdateData) onUpdateData({ ...data, samples: samples.filter(s => s.id !== id) });
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin} onEditSectionFields={onEditSectionFields}>
      <div className="space-y-12">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-6">
          Button Variants & Interaction States
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {samples.map((btn) => {
            const activeTab = activeTabPerButton[btn.id] || "default";
            const curColors: StateColors =
              activeTab === "hover"
                ? btn.hoverColors || btn.defaultColors || {}
                : activeTab === "active"
                ? btn.activeColors || btn.defaultColors || {}
                : btn.defaultColors || {};

            const btnStyle: React.CSSProperties = {
              backgroundColor: curColors.bg || "#0066FF",
              color: curColors.text || "#FFFFFF",
              borderColor: curColors.border || curColors.bg || "#0066FF"
            };

            return (
              <EditableListItem
                key={btn.id}
                onDelete={() => deleteButtonVariant(btn.id)}
                deleteConfirmTitle="Delete button variant?"
                isAdmin={isAdmin}
                className="bg-white border border-[var(--ci-border,#eaeaea)] p-6 rounded-2xl shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-6">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-500">
                      {btn.variant} Variant
                    </span>

                    {/* State Switcher Tabs */}
                    <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-[10px] font-semibold">
                      {(["default", "hover", "active"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => setActiveTabPerButton({ ...activeTabPerButton, [btn.id]: st })}
                          className={`px-2 py-1 rounded-md capitalize transition-colors ${
                            activeTab === st ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rendered Button Sample */}
                  <div className="h-28 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center p-4 mb-4">
                    <button
                      style={btnStyle}
                      className="px-6 py-3 rounded-xl font-semibold text-sm border-2 transition-all shadow-sm flex items-center gap-2"
                    >
                      <EditableText
                        tag="span"
                        value={btn.label}
                        placeholder="Button Action"
                        onSave={(val) => updateButtonSample(btn.id, { label: val })}
                        isAdmin={isAdmin}
                      />
                    </button>
                  </div>

                  {/* Copyable Spec Values for Current State */}
                  {!isAdmin && (
                    <div className="flex items-center gap-3 text-[11px] font-mono text-gray-500 mb-2 flex-wrap">
                      {curColors.bg && <CopyableValue value={curColors.bg} label={`${btn.label} (${activeTab}) bg`} displayValue={`bg: ${curColors.bg}`} />}
                      {curColors.text && <CopyableValue value={curColors.text} label={`${btn.label} (${activeTab}) text`} displayValue={`text: ${curColors.text}`} />}
                      {curColors.border && <CopyableValue value={curColors.border} label={`${btn.label} (${activeTab}) border`} displayValue={`border: ${curColors.border}`} />}
                    </div>
                  )}
                </div>

                {/* State Color Config Toggle */}
                {isAdmin && (
                  <div>
                    <button
                      onClick={() => setEditingColorsId(editingColorsId === btn.id ? null : btn.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" /> Customize State Colors ({activeTab})
                    </button>

                    {editingColorsId === btn.id && (
                      <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3 text-xs">
                        <p className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">
                          Editing State: <span className="text-blue-600 font-mono">{activeTab}</span>
                        </p>
                        
                        {(() => {
                          const stateKey =
                            activeTab === "hover"
                              ? "hoverColors"
                              : activeTab === "active"
                              ? "activeColors"
                              : "defaultColors";
                          const colors = btn[stateKey] || {};

                          return (
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Background</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="color"
                                    value={colors.bg || "#000000"}
                                    onChange={(e) => updateStateColors(btn.id, stateKey, "bg", e.target.value)}
                                    className="w-6 h-6 rounded border p-0 cursor-pointer shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={colors.bg || ""}
                                    onChange={(e) => updateStateColors(btn.id, stateKey, "bg", e.target.value)}
                                    className="w-full border rounded px-1.5 py-0.5 font-mono text-[10px]"
                                    placeholder="#0066FF"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Text Color</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="color"
                                    value={colors.text || "#FFFFFF"}
                                    onChange={(e) => updateStateColors(btn.id, stateKey, "text", e.target.value)}
                                    className="w-6 h-6 rounded border p-0 cursor-pointer shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={colors.text || ""}
                                    onChange={(e) => updateStateColors(btn.id, stateKey, "text", e.target.value)}
                                    className="w-full border rounded px-1.5 py-0.5 font-mono text-[10px]"
                                    placeholder="#FFFFFF"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Border Color</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="color"
                                    value={colors.border || "#000000"}
                                    onChange={(e) => updateStateColors(btn.id, stateKey, "border", e.target.value)}
                                    className="w-6 h-6 rounded border p-0 cursor-pointer shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={colors.border || ""}
                                    onChange={(e) => updateStateColors(btn.id, stateKey, "border", e.target.value)}
                                    className="w-full border rounded px-1.5 py-0.5 font-mono text-[10px]"
                                    placeholder="#0066FF"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </EditableListItem>
            );
          })}

          <AddItemButton
            label="+ Add Button Variant"
            onClick={addButtonVariant}
            isAdmin={isAdmin}
            variant="dashed-card"
            className="min-h-[220px]"
          />
        </div>
      </div>
    </SectionContainer>
  );
}
