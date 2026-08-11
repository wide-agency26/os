"use client";

import React from "react";
import { CISection } from "@/lib/ci-builder/types";
import { EditableText } from "../primitives/EditableText";
import { Sparkles } from "lucide-react";
import { toPromptText } from "@/lib/ci-builder/prompts";
import { triggerToast } from "../Toast";

export interface SectionContainerProps {
  section: Partial<CISection>;
  children: React.ReactNode;
  onEditSectionFields?: (fields: Partial<CISection>) => void;
  isAdmin?: boolean;
  /** Optional live values for catalog prompt templates. */
  promptVars?: Record<string, string>;
  /** Sleek brand-book presentation: hide Copy Prompt chrome. */
  hidePromptActions?: boolean;
}

export function SectionContainer({
  section,
  children,
  onEditSectionFields,
  isAdmin,
  promptVars,
  hidePromptActions = false,
}: SectionContainerProps) {
  const handleSaveField = (field: keyof CISection, value: any) => {
    if (onEditSectionFields) {
      onEditSectionFields({ [field]: value });
    }
  };

  const handleCopySectionPrompt = () => {
    const text = toPromptText(section, promptVars);
    navigator.clipboard.writeText(text);
    const label = section.eyebrow_label || section.headline || section.section_type || "Section";
    triggerToast(`"${label}" prompt copied`);
  };

  return (
    <section
      id={section.id || section.section_type}
      className="py-20 md:py-24 border-b border-[var(--ci-border,#eaeaea)] scroll-mt-20"
    >
      <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-12">
        <div className="mb-14">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            {(section.eyebrow_label || isAdmin) && (
              <EditableText
                tag="p"
                value={section.eyebrow_label || ""}
                placeholder="EYEBROW LABEL"
                onSave={(val) => handleSaveField("eyebrow_label", val)}
                isAdmin={isAdmin}
                className="text-[var(--ci-accent,#000)] font-bold tracking-wider text-xs uppercase"
              />
            )}

            {/* Public Section Action: Copy as Prompt */}
            {!isAdmin && !hidePromptActions && (
              <button
                onClick={handleCopySectionPrompt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 text-xs font-semibold rounded-lg transition-colors select-none border border-gray-200/60 shadow-sm shrink-0"
                title="Copy section rules formatted for AI prompts"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Copy as Prompt</span>
              </button>
            )}
          </div>

          {(section.headline || isAdmin) && (
            <div className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--ci-text,#111)]">
              <EditableText
                tag="h2"
                value={section.headline || ""}
                placeholder="Section Headline"
                onSave={(val) => handleSaveField("headline", val)}
                isAdmin={isAdmin}
              />
              {(section.headline_emphasis || isAdmin) && (
                <EditableText
                  tag="em"
                  value={section.headline_emphasis || ""}
                  placeholder="Subheadline / emphasis"
                  onSave={(val) => handleSaveField("headline_emphasis", val)}
                  isAdmin={isAdmin}
                  className="block text-[var(--ci-accent,#666)] not-italic mt-2 text-2xl md:text-3xl font-normal"
                />
              )}
            </div>
          )}

          {(section.description || isAdmin) && (
            <EditableText
              tag="p"
              multiline
              value={section.description || ""}
              placeholder="Add section description text..."
              onSave={(val) => handleSaveField("description", val)}
              isAdmin={isAdmin}
              className="mt-6 text-xl text-[var(--ci-text-muted,#666)] max-w-2xl leading-relaxed font-normal"
            />
          )}
        </div>
        
        <div className="section-content">
          {children}
        </div>
      </div>
    </section>
  );
}
