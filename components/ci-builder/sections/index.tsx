"use client";

import React from "react";
import dynamic from "next/dynamic";
import { CISection, CIAsset, type CITheme } from "@/lib/ci-builder/types";
import { getSubModule } from "@/lib/ci-builder/modules-catalog";

import { SectionContainer } from "./SectionContainer";
import type { ClientViewMode } from "./SubModuleSection";

const sectionFallback = () => (
  <div className="min-h-[240px] animate-pulse rounded-xl bg-black/[0.04]" aria-hidden />
);

const SubModuleSection = dynamic(
  () => import("./SubModuleSection").then((m) => m.SubModuleSection),
  { loading: sectionFallback }
);
const OverviewSection = dynamic(
  () => import("./OverviewSection").then((m) => m.OverviewSection),
  { loading: sectionFallback }
);
const LogoSection = dynamic(
  () => import("./LogoSection").then((m) => m.LogoSection),
  { loading: sectionFallback }
);
const ColorsSection = dynamic(
  () => import("./ColorsSection").then((m) => m.ColorsSection),
  { loading: sectionFallback }
);
const TypographySection = dynamic(
  () => import("./TypographySection").then((m) => m.TypographySection),
  { loading: sectionFallback }
);
const ButtonsSection = dynamic(
  () => import("./ButtonsSection").then((m) => m.ButtonsSection),
  { loading: sectionFallback }
);
const GridFramesSection = dynamic(
  () => import("./GridFramesSection").then((m) => m.GridFramesSection),
  { loading: sectionFallback }
);
const BackgroundsSection = dynamic(
  () => import("./BackgroundsSection").then((m) => m.BackgroundsSection),
  { loading: sectionFallback }
);
const ImagerySection = dynamic(
  () => import("./ImagerySection").then((m) => m.ImagerySection),
  { loading: sectionFallback }
);
const VoiceToneSection = dynamic(
  () => import("./VoiceToneSection").then((m) => m.VoiceToneSection),
  { loading: sectionFallback }
);
const ApplicationsSection = dynamic(
  () => import("./ApplicationsSection").then((m) => m.ApplicationsSection),
  { loading: sectionFallback }
);
const DosDontsSection = dynamic(
  () => import("./DosDontsSection").then((m) => m.DosDontsSection),
  { loading: sectionFallback }
);

function GenericSection({
  section,
  isAdmin,
  onDeleteSection,
}: {
  section: Partial<CISection>;
  isAdmin?: boolean;
  onDeleteSection?: () => void;
}) {
  return (
    <SectionContainer section={section} isAdmin={isAdmin} onDeleteSection={onDeleteSection}>
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
  compact?: boolean;
  clustered?: boolean;
  headlineScale?: "h2" | "h3";
  followOn?: boolean;
  moduleScoped?: boolean;
  onUpdateData?: (sectionId: string, newData: any) => void;
  onEditSectionFields?: (sectionId: string, fields: Partial<CISection>) => void;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
  onDeleteAssetRecord?: (assetId: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  onMoveColorSwatches?: (
    fromSectionId: string,
    swatchIds: string[],
    toSectionType: string
  ) => void;
  guidelineId?: string;
  presentationEdit?: boolean;
  theme?: CITheme | null;
  /** Template-specific presentation variant from view-model. */
  layoutVariant?: string;
}

const LEGACY_MAP: Record<string, React.ComponentType<any>> = {
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
  compact = false,
  clustered = false,
  headlineScale = "h3",
  followOn = false,
  moduleScoped = false,
  onUpdateData,
  onEditSectionFields,
  onAddAssetRecord,
  onDeleteAssetRecord,
  onDeleteSection,
  onMoveColorSwatches,
  guidelineId = "",
  presentationEdit = false,
  theme = null,
  layoutVariant,
}: SectionRendererProps) {
  const handleDelete =
    isAdmin && onDeleteSection && section.id
      ? () => onDeleteSection(section.id!)
      : undefined;

  if (!section.section_type) {
    return (
      <GenericSection
        section={section}
        isAdmin={isAdmin}
        onDeleteSection={handleDelete}
      />
    );
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
        compact={compact}
        clustered={clustered}
        headlineScale={headlineScale}
        followOn={followOn}
        moduleScoped={moduleScoped}
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
        onDeleteSection={handleDelete}
        onMoveColorSwatches={
          onMoveColorSwatches && section.id
            ? (swatchIds, toSectionType) =>
                onMoveColorSwatches(section.id!, swatchIds, toSectionType)
            : undefined
        }
        guidelineId={guidelineId}
        presentationEdit={presentationEdit}
        theme={theme}
        layoutVariant={layoutVariant}
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
      onDeleteSection={handleDelete}
      guidelineId={guidelineId}
    />
  );
}
