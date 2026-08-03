"use client";

import React from "react";
import { CISection } from "@/lib/ci-builder/types";

export interface SectionContainerProps {
  section: Partial<CISection>;
  children: React.ReactNode;
  onEditField?: (sectionId: string, field: keyof CISection, value: any) => void;
  isAdmin?: boolean;
}

export function SectionContainer({ section, children, onEditField, isAdmin }: SectionContainerProps) {
  // If we are admin, we'll wrap text in an editable span
  // For now, just render static text with an edit icon if hovered
  
  const EditableText = ({ field, value, className, tag: Tag = "div" }: any) => {
    return (
      <Tag className={`relative group ${className}`}>
        {value}
        {isAdmin && (
          <div className="absolute -right-6 top-0 hidden group-hover:block opacity-50 hover:opacity-100 cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </div>
        )}
      </Tag>
    );
  };

  return (
    <section id={section.section_type} className="py-24 border-b border-[var(--ci-border,#eaeaea)] scroll-mt-12">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-16">
          {section.eyebrow_label && (
            <EditableText 
              tag="p"
              field="eyebrow_label" 
              value={section.eyebrow_label} 
              className="text-[var(--ci-accent,#000)] font-semibold tracking-wider text-sm mb-4 uppercase"
            />
          )}
          {section.headline && (
            <EditableText 
              tag="h2"
              field="headline" 
              value={
                <>
                  {section.headline}
                  {section.headline_emphasis && (
                    <em className="block text-[var(--ci-accent,#666)] not-italic mt-2">
                      {section.headline_emphasis}
                    </em>
                  )}
                </>
              }
              className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--ci-text,#111)]"
            />
          )}
          {section.description && (
            <EditableText 
              tag="p"
              field="description" 
              value={section.description} 
              className="mt-6 text-xl text-[var(--ci-text-muted,#666)] max-w-2xl leading-relaxed"
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
