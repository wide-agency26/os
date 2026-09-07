"use client";

import React from "react";
import type { CIAsset, CITheme, CISection } from "@/lib/ci-builder/types";
import {
  CHAPTER_GAP_PX,
  modulePresentationIsEmpty,
  pickModuleChrome,
  resolveModulePresentation,
  type BrandBookBlockId,
} from "@/lib/ci-builder/module-presentation";
import {
  SectionPresentationBackground,
  SectionPresentationControls,
  presentationSectionStyle,
} from "@/components/ci-builder/SectionPresentation";

/**
 * Wraps a brand-book module (chapter + sub-modules) with optional per-module
 * tone / text / accent / background. No cover photos — those were removed.
 */
export function BrandBookModuleBlock({
  blockId,
  blockLabel,
  theme,
  moduleSections,
  assets,
  palette,
  presentationEdit,
  onUpdateTheme,
  guidelineId,
  onAddAssetRecord,
  children,
}: {
  blockId: BrandBookBlockId;
  blockLabel: string;
  theme?: CITheme | null;
  moduleSections?: Partial<CISection>[];
  assets: Partial<CIAsset>[];
  palette: string[];
  presentationEdit?: boolean;
  onUpdateTheme?: (theme: CITheme) => void;
  guidelineId?: string;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
  children: React.ReactNode;
}) {
  const presentation = resolveModulePresentation(
    theme,
    blockId,
    moduleSections
  );
  const appearance = presentation.appearance || "inherit";
  const style = presentationSectionStyle(presentation);
  const chapterGap = presentation.chapterGap || "m";

  const handleChange = (
    next: import("@/lib/ci-builder/types").SectionPresentation
  ) => {
    if (!onUpdateTheme) return;
    const base = theme || {};
    const modulePresentation = { ...(base.modulePresentation || {}) };
    const chrome = pickModuleChrome(next);
    if (modulePresentationIsEmpty(chrome)) {
      delete modulePresentation[blockId];
    } else {
      modulePresentation[blockId] = chrome;
    }
    onUpdateTheme({
      ...base,
      modulePresentation:
        Object.keys(modulePresentation).length > 0
          ? modulePresentation
          : undefined,
    });
  };

  return (
    <div
      className="bb-module-block"
      data-bb-module={blockId}
      data-bb-appearance={appearance}
      data-bb-chapter-gap={chapterGap}
      style={{
        ...style,
        ["--bb-chapter-gap" as string]: CHAPTER_GAP_PX[chapterGap],
      }}
    >
      <SectionPresentationBackground presentation={presentation} assets={assets} />
      <div className="bb-module-block-inner">
        {presentationEdit && onUpdateTheme ? (
          <div className="bb-module-block-controls">
            <SectionPresentationControls
              data={{ presentation }}
              assets={assets}
              palette={palette}
              onChange={handleChange}
              showLayoutControls={false}
              showAppearanceControls
              showModuleCoverControls={false}
              scopeLabel={`Module · ${blockLabel}`}
              guidelineId={guidelineId}
              onAddAssetRecord={onAddAssetRecord}
            />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
