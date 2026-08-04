"use client";

import React from "react";
import { CISection } from "@/lib/ci-builder/types";
import { EditableText } from "../primitives/EditableText";

export interface SectionContainerProps {
  section: Partial<CISection>;
  children: React.ReactNode;
  onEditSectionFields?: (fields: Partial<CISection>) => void;
  isAdmin?: boolean;
}

export function SectionContainer({
  section,
  children,
  onEditSectionFields,
  isAdmin
}: SectionContainerProps) {
  const handleSaveField = (field: keyof CISection, value: any) => {
    if (onEditSectionFields) {
      onEditSectionFields({ [field]: value });
    }
  };

  return (
    <section id={section.section_type} className="py-24 border-b border-[var(--ci-border,#eaeaea)] scroll-mt-12">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-16">
          {(section.eyebrow_label || isAdmin) && (
            <EditableText
              tag="p"
              value={section.eyebrow_label || ""}
              placeholder="EYEBROW LABEL"
              onSave={(val) => handleSaveField("eyebrow_label", val)}
              isAdmin={isAdmin}
              className="text-[var(--ci-accent,#000)] font-semibold tracking-wider text-sm mb-4 uppercase"
            />
          )}

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
