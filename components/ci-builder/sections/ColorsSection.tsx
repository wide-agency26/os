"use client";

import React, { useState } from "react";
import { CISection, ColorsSectionData } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";

export function ColorsSection({ section, isAdmin }: { section: Partial<CISection>; isAdmin?: boolean }) {
  const data = (section.data || {}) as ColorsSectionData;
  const [copied, setCopied] = useState<string | null>(null);

  const copyHex = (hex: string) => {
    if (isAdmin) return; // In admin mode, clicking might open the editor instead
    navigator.clipboard.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin}>
      <div className="space-y-16">
        {data.groups?.map((group, i) => (
          <div key={i}>
            <h3 className="text-xl font-semibold mb-6 text-[var(--ci-text,#111)] border-b border-[var(--ci-border,#eaeaea)] pb-3">
              {group.groupLabel}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {group.swatches.map((swatch) => (
                <div 
                  key={swatch.id} 
                  className={`group relative flex flex-col rounded-xl overflow-hidden shadow-sm border border-[var(--ci-border,#eaeaea)] ${isAdmin ? 'cursor-pointer hover:ring-2 hover:ring-blue-500' : 'cursor-pointer'}`}
                  onClick={() => copyHex(swatch.hex)}
                >
                  <div 
                    className="h-32 w-full transition-transform duration-200 group-hover:scale-105"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <div className="p-4 bg-white">
                    <p className="font-medium text-[var(--ci-text,#111)] text-sm">{swatch.name}</p>
                    <p className="text-[var(--ci-text-muted,#666)] text-xs mt-1 uppercase font-mono">{swatch.hex}</p>
                  </div>

                  {/* Toast-like overlay on copy */}
                  {copied === swatch.hex && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm font-medium">
                      Copied!
                    </div>
                  )}
                  
                  {/* Admin edit indicator */}
                  {isAdmin && (
                    <div className="absolute top-2 right-2 bg-white/80 p-1 rounded shadow-sm opacity-0 group-hover:opacity-100">
                      <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {(!data.groups || data.groups.length === 0) && (
          <div className="p-8 border border-dashed border-gray-300 rounded-xl text-center text-gray-500">
            No colors defined. Upload a manifest or add colors manually.
          </div>
        )}
      </div>
    </SectionContainer>
  );
}
