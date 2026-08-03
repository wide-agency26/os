"use client";

import React from "react";
import { CISection, TypographySectionData } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";

export function TypographySection({ section, isAdmin }: { section: Partial<CISection>; isAdmin?: boolean }) {
  const data = (section.data || {}) as TypographySectionData;

  return (
    <SectionContainer section={section} isAdmin={isAdmin}>
      <div className="space-y-12">
        {data.rows?.length > 0 ? (
          data.rows.map((row) => (
            <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-8 border-b border-[var(--ci-border,#eaeaea)] pb-12 last:border-0 last:pb-0">
              <div className="md:col-span-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--ci-text,#111)] mb-3">
                  {row.label}
                </h4>
                <div className="text-[var(--ci-text-muted,#666)] text-sm space-y-1 font-mono">
                  <p>{row.specLine1}</p>
                  {row.specLine2 && <p>{row.specLine2}</p>}
                </div>
              </div>
              <div className="md:col-span-9 overflow-hidden">
                <p 
                  className={`text-[var(--ci-text,#111)] truncate md:whitespace-normal ${row.sampleClass || ''}`}
                  style={{
                    fontSize: row.sampleClass?.includes('text-') ? undefined : '3rem',
                    lineHeight: 1.2,
                    fontFamily: row.sampleClass ? undefined : 'var(--ci-font, inherit)'
                  }}
                >
                  {row.sampleText}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 border border-dashed border-[var(--ci-border,#eaeaea)] rounded-xl text-center text-[var(--ci-text-muted,#666)]">
            No typography defined.
          </div>
        )}
      </div>
    </SectionContainer>
  );
}
