"use client";

import React from "react";
import { CISection, CIAsset, VoiceToneSectionData, VoiceTonePill, VoiceTonePhrase } from "@/lib/ci-builder/types";
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

export function VoiceToneSection({
  section,
  isAdmin,
  onUpdateData,
  onEditSectionFields
}: SectionProps) {
  const data = (section.data || {}) as VoiceToneSectionData;

  // Normalize string arrays to objects with IDs
  const rawPills = data.marqueeWords || ["Bold", "Human", "Direct", "Confident"];
  const pills: VoiceTonePill[] = rawPills.map((item, idx) =>
    typeof item === "string" ? { id: `p_${idx}`, word: item } : item
  );

  const rawDo = data.doPhrases || [
    "Simple, clear explanations without jargon.",
    "Empowering and welcoming tone.",
    "Action-oriented headlines."
  ];
  const doPhrases: VoiceTonePhrase[] = rawDo.map((item, idx) =>
    typeof item === "string" ? { id: `do_${idx}`, text: item } : item
  );

  const rawDont = data.dontPhrases || [
    "Overly academic or technical corporate speak.",
    "Passive aggressive or dismissive phrasing.",
    "Vague claims without clear value."
  ];
  const dontPhrases: VoiceTonePhrase[] = rawDont.map((item, idx) =>
    typeof item === "string" ? { id: `dont_${idx}`, text: item } : item
  );

  // Marquee pill handlers
  const addPill = () => {
    const newPill: VoiceTonePill = { id: `pill_${Date.now()}`, word: "Key Word" };
    if (onUpdateData) onUpdateData({ ...data, marqueeWords: [...pills, newPill] });
  };

  const updatePill = (id: string, word: string) => {
    const updated = pills.map(p => p.id === id ? { ...p, word } : p);
    if (onUpdateData) onUpdateData({ ...data, marqueeWords: updated });
  };

  const deletePill = (id: string) => {
    if (onUpdateData) onUpdateData({ ...data, marqueeWords: pills.filter(p => p.id !== id) });
  };

  // Do Phrases handlers
  const addDoPhrase = () => {
    const newPhrase: VoiceTonePhrase = { id: `do_${Date.now()}`, text: "Say this positive phrase..." };
    if (onUpdateData) onUpdateData({ ...data, doPhrases: [...doPhrases, newPhrase] });
  };

  const updateDoPhrase = (id: string, text: string) => {
    const updated = doPhrases.map(p => p.id === id ? { ...p, text } : p);
    if (onUpdateData) onUpdateData({ ...data, doPhrases: updated });
  };

  const deleteDoPhrase = (id: string) => {
    if (onUpdateData) onUpdateData({ ...data, doPhrases: doPhrases.filter(p => p.id !== id) });
  };

  // Don't Phrases handlers
  const addDontPhrase = () => {
    const newPhrase: VoiceTonePhrase = { id: `dont_${Date.now()}`, text: "Avoid this phrase or tone..." };
    if (onUpdateData) onUpdateData({ ...data, dontPhrases: [...dontPhrases, newPhrase] });
  };

  const updateDontPhrase = (id: string, text: string) => {
    const updated = dontPhrases.map(p => p.id === id ? { ...p, text } : p);
    if (onUpdateData) onUpdateData({ ...data, dontPhrases: updated });
  };

  const deleteDontPhrase = (id: string) => {
    if (onUpdateData) onUpdateData({ ...data, dontPhrases: dontPhrases.filter(p => p.id !== id) });
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin} onEditSectionFields={onEditSectionFields}>
      <div className="space-y-16">
        {/* Marquee Pill Words */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-4">
            Voice Pillars & Personality Traits
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            {pills.map((pill) => (
              <EditableListItem
                key={pill.id}
                onDelete={() => deletePill(pill.id)}
                deleteConfirmTitle="Delete pillar word?"
                isAdmin={isAdmin}
                className="bg-gray-100 border border-gray-200 rounded-full px-4 py-2 text-sm font-semibold text-gray-800"
              >
                <EditableText
                  tag="span"
                  value={pill.word}
                  placeholder="Word"
                  onSave={(val) => updatePill(pill.id, val)}
                  isAdmin={isAdmin}
                />
              </EditableListItem>
            ))}

            <AddItemButton
              label="+ Add Word"
              onClick={addPill}
              isAdmin={isAdmin}
              variant="button"
              className="rounded-full"
            />
          </div>
        </div>

        {/* Parallel Say / Avoid Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-[var(--ci-border,#eaeaea)] pt-12">
          {/* Say This Column */}
          <div className="bg-emerald-50/50 border border-emerald-200/80 p-6 rounded-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800 mb-6 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">✓</span>
              Say This
            </h3>

            <div className="space-y-3 mb-6">
              {doPhrases.map((phrase) => (
                <EditableListItem
                  key={phrase.id}
                  onDelete={() => deleteDoPhrase(phrase.id)}
                  deleteConfirmTitle="Delete phrase from Say This?"
                  isAdmin={isAdmin}
                  className="bg-white border border-emerald-100 p-4 rounded-xl shadow-sm text-sm text-gray-800 font-medium"
                >
                  <EditableText
                    tag="p"
                    multiline
                    value={phrase.text}
                    placeholder="Say this phrase..."
                    onSave={(val) => updateDoPhrase(phrase.id, val)}
                    isAdmin={isAdmin}
                  />
                </EditableListItem>
              ))}
            </div>

            <AddItemButton
              label="+ Add Phrase"
              onClick={addDoPhrase}
              isAdmin={isAdmin}
              variant="button"
              className="border-emerald-400 text-emerald-700 bg-white hover:bg-emerald-100/50"
            />
          </div>

          {/* Avoid This Column */}
          <div className="bg-rose-50/50 border border-rose-200/80 p-6 rounded-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-rose-800 mb-6 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center font-bold">✕</span>
              Avoid This
            </h3>

            <div className="space-y-3 mb-6">
              {dontPhrases.map((phrase) => (
                <EditableListItem
                  key={phrase.id}
                  onDelete={() => deleteDontPhrase(phrase.id)}
                  deleteConfirmTitle="Delete phrase from Avoid This?"
                  isAdmin={isAdmin}
                  className="bg-white border border-rose-100 p-4 rounded-xl shadow-sm text-sm text-gray-800 font-medium"
                >
                  <EditableText
                    tag="p"
                    multiline
                    value={phrase.text}
                    placeholder="Avoid this phrase..."
                    onSave={(val) => updateDontPhrase(phrase.id, val)}
                    isAdmin={isAdmin}
                  />
                </EditableListItem>
              ))}
            </div>

            <AddItemButton
              label="+ Add Phrase"
              onClick={addDontPhrase}
              isAdmin={isAdmin}
              variant="button"
              className="border-rose-400 text-rose-700 bg-white hover:bg-rose-100/50"
            />
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
