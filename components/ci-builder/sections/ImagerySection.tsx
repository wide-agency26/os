"use client";

import React from "react";
import { CISection, CIAsset, ImagerySectionData, RuleItem } from "@/lib/ci-builder/types";
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

export function ImagerySection({
  section,
  isAdmin,
  onUpdateData,
  onEditSectionFields
}: SectionProps) {
  const data = (section.data || {}) as ImagerySectionData;
  const rules = data.rules || [
    {
      id: "r1",
      title: "Authentic & Candid Expressions",
      description: "Avoid overly staged stock photography. Focus on genuine human interactions, natural lighting, and unposed subjects."
    },
    {
      id: "r2",
      title: "Consistent Color Palette",
      description: "Ensure photography tones reflect our brand color harmony with clean shadows and natural saturation."
    }
  ];

  const addRule = () => {
    const newRule: RuleItem = {
      id: `rule_${Date.now()}`,
      title: "New Imagery Rule",
      description: "Specify guidelines for composition, lighting, subjects, or visual tone."
    };
    if (onUpdateData) onUpdateData({ ...data, rules: [...rules, newRule] });
  };

  const updateRule = (id: string, field: keyof RuleItem, val: string) => {
    const updated = rules.map(r => r.id === id ? { ...r, [field]: val } : r);
    if (onUpdateData) onUpdateData({ ...data, rules: updated });
  };

  const deleteRule = (id: string) => {
    if (onUpdateData) onUpdateData({ ...data, rules: rules.filter(r => r.id !== id) });
  };

  const moveRule = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rules.length) return;

    const newRules = [...rules];
    const [moved] = newRules.splice(index, 1);
    newRules.splice(targetIndex, 0, moved);

    if (onUpdateData) onUpdateData({ ...data, rules: newRules });
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin} onEditSectionFields={onEditSectionFields}>
      <div className="space-y-12">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ci-accent,#666)] mb-6">
          Photography & Imagery Rules
        </h3>

        <div className="space-y-6">
          {rules.map((rule, idx) => (
            <EditableListItem
              key={rule.id}
              onDelete={() => deleteRule(rule.id)}
              deleteConfirmTitle="Delete imagery rule?"
              isAdmin={isAdmin}
              reorderable={isAdmin}
              onMoveUp={idx > 0 ? () => moveRule(idx, "up") : undefined}
              onMoveDown={idx < rules.length - 1 ? () => moveRule(idx, "down") : undefined}
              className="bg-white border border-[var(--ci-border,#eaeaea)] p-6 rounded-2xl shadow-sm flex items-start gap-5"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--ci-accent,#000)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                {idx + 1}
              </div>

              <div className="flex-1 space-y-1">
                <EditableText
                  tag="h4"
                  value={rule.title}
                  placeholder="Rule Title"
                  onSave={(val) => updateRule(rule.id, "title", val)}
                  isAdmin={isAdmin}
                  className="font-bold text-lg text-[var(--ci-text,#111)]"
                />
                <EditableText
                  tag="p"
                  multiline
                  value={rule.description}
                  placeholder="Detailed rule description..."
                  onSave={(val) => updateRule(rule.id, "description", val)}
                  isAdmin={isAdmin}
                  className="text-sm text-[var(--ci-text-muted,#666)] leading-relaxed"
                />
              </div>
            </EditableListItem>
          ))}
        </div>

        <div className="pt-2">
          <AddItemButton
            label="+ Add Rule"
            onClick={addRule}
            isAdmin={isAdmin}
            variant="button"
          />
        </div>
      </div>
    </SectionContainer>
  );
}
