"use client";

import React from "react";
import { CISection, CIAsset } from "@/lib/ci-builder/types";
import { getSubModule } from "@/lib/ci-builder/modules-catalog";

import { SectionContainer } from "./SectionContainer";
import { OverviewSection } from "./OverviewSection";
import { LogoSection } from "./LogoSection";
import { ColorsSection } from "./ColorsSection";
import { TypographySection } from "./TypographySection";
import { ButtonsSection } from "./ButtonsSection";
import { GridFramesSection } from "./GridFramesSection";
import { BackgroundsSection } from "./BackgroundsSection";
import { ImagerySection } from "./ImagerySection";
import { VoiceToneSection } from "./VoiceToneSection";
import { ApplicationsSection } from "./ApplicationsSection";
import { DosDontsSection } from "./DosDontsSection";
import {
  SubModuleSection,
  type ClientViewMode,
} from "./SubModuleSection";

function GenericSection({
  section,
  isAdmin,
}: {
  section: Partial<CISection>;
  isAdmin?: boolean;
}) {
  return (
    <SectionContainer section={section} isAdmin={isAdmin}>
      <div className="p-8 border border-dashed border-[var(--ci-border,#eaeaea)] rounded-xl text-center text-[var(--ci-text-muted,#666)]">
        Content for {section.section_type} goes here.
      </div>
    </SectionContainer>
  );
}

export interface SectionRendererProps {
  section: Partial<CISection>;
  assets: Partial<CIAsset>[];
  allAssets?: Partial<CIAsset>[];
  allSections?: Partial<CISection>[];
  isAdmin?: boolean;
  /** Public client hub: presentation (brand book) vs elements (assets/tokens). */
  viewMode?: ClientViewMode;
  /** Hide per-section Copy Prompt in sleek brand-book presentation. */
  hidePromptActions?: boolean;
  onUpdateData?: (sectionId: string, newData: any) => void;
  onEditSectionFields?: (sectionId: string, fields: Partial<CISection>) => void;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
  onDeleteAssetRecord?: (assetId: string) => void;
  guidelineId?: string;
}

const LEGACY_MAP: Record<string, React.FC<any>> = {
  overview: OverviewSection,
  logo: LogoSection,
  colors: ColorsSection,
  typography: TypographySection,
  buttons: ButtonsSection,
  grid_frames: GridFramesSection,
  backgrounds: BackgroundsSection,
  imagery: ImagerySection,
  voice_tone: VoiceToneSection,
  applications: ApplicationsSection,
  dos_donts: DosDontsSection,
};

export function SectionRenderer({
  section,
  assets,
  allAssets = [],
  allSections = [],
  isAdmin,
  viewMode = "presentation",
  hidePromptActions = false,
  onUpdateData,
  onEditSectionFields,
  onAddAssetRecord,
  onDeleteAssetRecord,
  guidelineId = "",
}: SectionRendererProps) {
  if (!section.section_type) {
    return <GenericSection section={section} isAdmin={isAdmin} />;
  }

  const catalogHit = getSubModule(section.section_type);
  if (catalogHit) {
    return (
      <SubModuleSection
        section={section}
        assets={assets}
        allAssets={allAssets.length > 0 ? allAssets : assets}
        allSections={allSections}
        isAdmin={isAdmin}
        viewMode={viewMode}
        hidePromptActions={hidePromptActions}
        onUpdateData={(newData: any) =>
          onUpdateData && section.id && onUpdateData(section.id, newData)
        }
        onEditSectionFields={(fields: Partial<CISection>) =>
          onEditSectionFields &&
          section.id &&
          onEditSectionFields(section.id, fields)
        }
        onAddAssetRecord={onAddAssetRecord}
        onDeleteAssetRecord={onDeleteAssetRecord}
        guidelineId={guidelineId}
      />
    );
  }

  const Component = LEGACY_MAP[section.section_type as string] || GenericSection;

  return (
    <Component
      section={section}
      assets={assets}
      allAssets={allAssets.length > 0 ? allAssets : assets}
      allSections={allSections}
      isAdmin={isAdmin}
      onUpdateData={(newData: any) =>
        onUpdateData && section.id && onUpdateData(section.id, newData)
      }
      onEditSectionFields={(fields: Partial<CISection>) =>
        onEditSectionFields &&
        section.id &&
        onEditSectionFields(section.id, fields)
      }
      onAddAssetRecord={onAddAssetRecord}
      onDeleteAssetRecord={onDeleteAssetRecord}
      guidelineId={guidelineId}
    />
  );
}
