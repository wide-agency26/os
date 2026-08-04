"use client";

import React from "react";
import { CISection, CIAsset, OverviewSectionData } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";
import { EditableText, EditableListItem, AddItemButton } from "../primitives";

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

export function OverviewSection({
  section,
  isAdmin,
  onUpdateData,
  onEditSectionFields
}: SectionProps) {
  const data = (section.data || {}) as OverviewSectionData;
  const stats = data.stats || [];
  const tonalityCards = data.tonalityCards || [];

  const updateLead = (leadParagraph: string) => {
    if (onUpdateData) onUpdateData({ ...data, leadParagraph });
  };

  const addStat = () => {
    const newStat = {
      id: `stat_${Date.now()}`,
      label: "Metric Label",
      value: "100%"
    };
    if (onUpdateData) onUpdateData({ ...data, stats: [...stats, newStat] });
  };

  const updateStat = (id: string, field: "label" | "value", val: string) => {
    const updated = stats.map(s => s.id === id ? { ...s, [field]: val } : s);
    if (onUpdateData) onUpdateData({ ...data, stats: updated });
  };

  const deleteStat = (id: string) => {
    if (onUpdateData) onUpdateData({ ...data, stats: stats.filter(s => s.id !== id) });
  };

  const addTonalityCard = () => {
    const newCard = {
      id: `card_${Date.now()}`,
      label: "Brand Principle",
      text: "Enter a brief note or description of this brand principle."
    };
    if (onUpdateData) onUpdateData({ ...data, tonalityCards: [...tonalityCards, newCard] });
  };

  const updateTonalityCard = (id: string, field: "label" | "text", val: string) => {
    const updated = tonalityCards.map(c => c.id === id ? { ...c, [field]: val } : c);
    if (onUpdateData) onUpdateData({ ...data, tonalityCards: updated });
  };

  const deleteTonalityCard = (id: string) => {
    if (onUpdateData) onUpdateData({ ...data, tonalityCards: tonalityCards.filter(c => c.id !== id) });
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin} onEditSectionFields={onEditSectionFields}>
      <div className="space-y-12">
        {/* Lead Paragraph */}
        {(data.leadParagraph || isAdmin) && (
          <div className="p-6 bg-gray-50/50 rounded-2xl border border-gray-100">
            <EditableText
              tag="p"
              multiline
              value={data.leadParagraph || ""}
              placeholder="Enter overview lead paragraph describing the brand essence..."
              onSave={updateLead}
              isAdmin={isAdmin}
              className="text-lg md:text-xl text-[var(--ci-text,#111)] leading-relaxed font-normal"
            />
          </div>
        )}

        {/* Stats Grid */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-4">
            Key Metrics & Stats
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((st) => (
              <EditableListItem
                key={st.id}
                onDelete={() => deleteStat(st.id)}
                deleteConfirmTitle="Delete stat chip? This can't be undone."
                isAdmin={isAdmin}
                className="bg-white border border-[var(--ci-border,#eaeaea)] p-5 rounded-2xl shadow-sm text-center"
              >
                <EditableText
                  tag="div"
                  value={st.value}
                  placeholder="100%"
                  onSave={(val) => updateStat(st.id, "value", val)}
                  isAdmin={isAdmin}
                  className="text-3xl md:text-4xl font-extrabold text-[var(--ci-accent,#000)]"
                />
                <EditableText
                  tag="div"
                  value={st.label}
                  placeholder="Metric Name"
                  onSave={(val) => updateStat(st.id, "label", val)}
                  isAdmin={isAdmin}
                  className="text-xs font-semibold text-[var(--ci-text-muted,#666)] uppercase tracking-wider mt-2"
                />
              </EditableListItem>
            ))}

            <AddItemButton
              label="+ Add Stat"
              onClick={addStat}
              isAdmin={isAdmin}
              variant="dashed-card"
              className="min-h-[110px]"
            />
          </div>
        </div>

        {/* Tonality Cards Grid */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-4">
            Brand Principles & Tonality Notes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tonalityCards.map((card) => (
              <EditableListItem
                key={card.id}
                onDelete={() => deleteTonalityCard(card.id)}
                deleteConfirmTitle="Delete note card? This can't be undone."
                isAdmin={isAdmin}
                className="bg-white border border-[var(--ci-border,#eaeaea)] p-6 rounded-2xl shadow-sm flex flex-col justify-between"
              >
                <div>
                  <EditableText
                    tag="h4"
                    value={card.label || ""}
                    placeholder="Principle Title"
                    onSave={(val) => updateTonalityCard(card.id, "label", val)}
                    isAdmin={isAdmin}
                    className="font-bold text-lg text-[var(--ci-text,#111)] mb-2"
                  />
                  <EditableText
                    tag="p"
                    multiline
                    value={card.text}
                    placeholder="Describe this brand principle or tonality rule..."
                    onSave={(val) => updateTonalityCard(card.id, "text", val)}
                    isAdmin={isAdmin}
                    className="text-sm text-[var(--ci-text-muted,#666)] leading-relaxed"
                  />
                </div>
              </EditableListItem>
            ))}

            <AddItemButton
              label="+ Add Note Card"
              onClick={addTonalityCard}
              isAdmin={isAdmin}
              variant="dashed-card"
              className="min-h-[140px]"
            />
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
