import React from "react";
import { CISection, CIAsset } from "@/lib/ci-builder/types";

import { SectionContainer } from "./SectionContainer";
import { ColorsSection } from "./ColorsSection";
import { LogoSection } from "./LogoSection";
import { TypographySection } from "./TypographySection";
import { GridFramesSection } from "./GridFramesSection";

// Fallback generic section
function GenericSection({ section, isAdmin }: { section: Partial<CISection>; isAdmin?: boolean }) {
  return (
    <SectionContainer section={section} isAdmin={isAdmin}>
      <div className="p-8 border border-dashed border-[var(--ci-border,#eaeaea)] rounded-xl text-center text-[var(--ci-text-muted,#666)]">
        Content for {section.section_type} goes here.
      </div>
    </SectionContainer>
  );
}

const SECTION_MAP: Record<string, React.FC<{ section: Partial<CISection>; assets: Partial<CIAsset>[]; isAdmin?: boolean }>> = {
  colors: ColorsSection,
  logo: LogoSection,
  typography: TypographySection,
  grid_frames: GridFramesSection,
};

export function SectionRenderer({ 
  section, 
  assets, 
  isAdmin 
}: { 
  section: Partial<CISection>; 
  assets: Partial<CIAsset>[]; 
  isAdmin?: boolean;
}) {
  if (!section.section_type) return <GenericSection section={section} isAdmin={isAdmin} />;
  const Component = SECTION_MAP[section.section_type as string] || GenericSection;
  return <Component section={section} assets={assets} isAdmin={isAdmin} />;
}
