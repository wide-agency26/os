"use client";

import React, { useState } from "react";
import { CISection, CIAsset, TypographySectionData, TypeRow, TypeScaleEntry } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";
import { EditableText, EditableListItem, AddItemButton } from "../primitives";
import { Settings, X } from "lucide-react";

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

export function TypographySection({
  section,
  isAdmin,
  onUpdateData,
  onEditSectionFields
}: SectionProps) {
  const data = (section.data || {}) as TypographySectionData;
  const rows = data.rows || [];
  const scale = data.scale || [
    { id: "s1", px: 64, token: "Display Large" },
    { id: "s2", px: 48, token: "Display Medium" },
    { id: "s3", px: 32, token: "Heading 1" },
    { id: "s4", px: 24, token: "Heading 2" },
    { id: "s5", px: 16, token: "Body Regular" }
  ];

  const [activeSpecRowId, setActiveSpecRowId] = useState<string | null>(null);

  const addTypeStyle = () => {
    const newRow: TypeRow = {
      id: `row_${Date.now()}`,
      label: "Heading 2",
      fontSize: "32px",
      fontWeight: "700",
      lineHeight: "1.2",
      fontFamily: "Inter, sans-serif",
      sampleText: "Sphinx of black quartz, judge my vow."
    };
    if (onUpdateData) onUpdateData({ ...data, rows: [...rows, newRow] });
  };

  const updateTypeRow = (id: string, updates: Partial<TypeRow>) => {
    const updated = rows.map(r => r.id === id ? { ...r, ...updates } : r);
    if (onUpdateData) onUpdateData({ ...data, rows: updated });
  };

  const deleteTypeRow = (id: string) => {
    if (onUpdateData) onUpdateData({ ...data, rows: rows.filter(r => r.id !== id) });
  };

  const addScaleEntry = () => {
    const newScale: TypeScaleEntry = {
      id: `scale_${Date.now()}`,
      px: 20,
      token: "Body Large"
    };
    if (onUpdateData) onUpdateData({ ...data, scale: [...scale, newScale] });
  };

  const updateScaleEntry = (id: string, field: keyof TypeScaleEntry, val: any) => {
    const updated = scale.map(s => s.id === id ? { ...s, [field]: val } : s);
    if (onUpdateData) onUpdateData({ ...data, scale: updated });
  };

  const deleteScaleEntry = (id: string) => {
    if (onUpdateData) onUpdateData({ ...data, scale: scale.filter(s => s.id !== id) });
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin} onEditSectionFields={onEditSectionFields}>
      <div className="space-y-16">
        {/* Type Styles List */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-6">
            Typography Hierarchy & Styles
          </h3>

          <div className="space-y-8">
            {rows.map((row) => {
              const rowStyle: React.CSSProperties = {
                fontFamily: row.fontFamily || "inherit",
                fontSize: row.fontSize || "inherit",
                fontWeight: row.fontWeight || "normal",
                lineHeight: row.lineHeight || "1.4"
              };
              const specDisplay = `${row.fontSize || "32px"} / ${row.lineHeight || "1.2"} • ${row.fontWeight || "700"}`;

              return (
                <EditableListItem
                  key={row.id}
                  onDelete={() => deleteTypeRow(row.id)}
                  deleteConfirmTitle="Delete type style row?"
                  isAdmin={isAdmin}
                  className="p-6 bg-white border border-[var(--ci-border,#eaeaea)] rounded-2xl shadow-sm relative group"
                >
                  <div className="flex flex-col md:flex-row md:items-baseline justify-between border-b border-gray-100 pb-4 mb-4 gap-2">
                    <EditableText
                      tag="h4"
                      value={row.label}
                      placeholder="Style Name"
                      onSave={(val) => updateTypeRow(row.id, { label: val })}
                      isAdmin={isAdmin}
                      className="font-bold text-sm text-[var(--ci-text,#111)] uppercase tracking-wider"
                    />

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded">
                        {specDisplay}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => setActiveSpecRowId(activeSpecRowId === row.id ? null : row.id)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          title="Configure Font Family, Weight, Size"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Spec Drawer */}
                  {isAdmin && activeSpecRowId === row.id && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold text-gray-600 mb-1">Font Family</label>
                        <input
                          type="text"
                          value={row.fontFamily || ""}
                          onChange={(e) => updateTypeRow(row.id, { fontFamily: e.target.value })}
                          placeholder="Inter, sans-serif"
                          className="w-full border rounded px-2 py-1 bg-white font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-600 mb-1">Font Size</label>
                        <input
                          type="text"
                          value={row.fontSize || ""}
                          onChange={(e) => updateTypeRow(row.id, { fontSize: e.target.value })}
                          placeholder="32px"
                          className="w-full border rounded px-2 py-1 bg-white font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-600 mb-1">Font Weight</label>
                        <input
                          type="text"
                          value={row.fontWeight || ""}
                          onChange={(e) => updateTypeRow(row.id, { fontWeight: e.target.value })}
                          placeholder="700"
                          className="w-full border rounded px-2 py-1 bg-white font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-600 mb-1">Line Height</label>
                        <input
                          type="text"
                          value={row.lineHeight || ""}
                          onChange={(e) => updateTypeRow(row.id, { lineHeight: e.target.value })}
                          placeholder="1.2"
                          className="w-full border rounded px-2 py-1 bg-white font-mono text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Sample Text Rendered Live */}
                  <EditableText
                    tag="div"
                    multiline
                    value={row.sampleText}
                    placeholder="Enter sample text..."
                    onSave={(val) => updateTypeRow(row.id, { sampleText: val })}
                    isAdmin={isAdmin}
                    style={rowStyle}
                    className="text-[var(--ci-text,#111)] overflow-hidden"
                  />
                </EditableListItem>
              );
            })}
          </div>

          <div className="mt-6">
            <AddItemButton
              label="+ Add Type Style"
              onClick={addTypeStyle}
              isAdmin={isAdmin}
              variant="button"
            />
          </div>
        </div>

        {/* Type Scale Table */}
        <div className="border-t border-[var(--ci-border,#eaeaea)] pt-12">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-6">
            Type Scale & Tokens
          </h3>

          <div className="bg-white border border-[var(--ci-border,#eaeaea)] rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 bg-gray-50 px-6 py-3 border-b border-[var(--ci-border,#eaeaea)] text-xs font-bold uppercase tracking-wider text-[var(--ci-text-muted,#666)]">
              <div className="col-span-3">Pixel Size</div>
              <div className="col-span-8">Token / Role Name</div>
              <div className="col-span-1 text-right"></div>
            </div>

            <div className="divide-y divide-[var(--ci-border,#eaeaea)]">
              {scale.map((sc) => (
                <EditableListItem
                  key={sc.id}
                  onDelete={() => deleteScaleEntry(sc.id)}
                  deleteConfirmTitle="Delete type scale entry?"
                  isAdmin={isAdmin}
                  className="grid grid-cols-12 px-6 py-3 items-center text-sm"
                >
                  <div className="col-span-3 font-mono font-bold text-[var(--ci-accent,#000)] flex items-center gap-1">
                    <EditableText
                      tag="span"
                      value={String(sc.px)}
                      placeholder="16"
                      onSave={(val) => updateScaleEntry(sc.id, "px", parseInt(val, 10) || 16)}
                      isAdmin={isAdmin}
                    />
                    <span>px</span>
                  </div>

                  <div className="col-span-8 font-medium text-[var(--ci-text,#111)]">
                    <EditableText
                      tag="span"
                      value={sc.token}
                      placeholder="Token Name"
                      onSave={(val) => updateScaleEntry(sc.id, "token", val)}
                      isAdmin={isAdmin}
                    />
                  </div>
                </EditableListItem>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <AddItemButton
              label="+ Add Scale Entry"
              onClick={addScaleEntry}
              isAdmin={isAdmin}
              variant="button"
            />
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
