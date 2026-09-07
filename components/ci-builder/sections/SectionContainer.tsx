"use client";

import React, { useState } from "react";
import { CISection, type CIAsset, type CITheme, type SectionPresentation, readSectionPresentation } from "@/lib/ci-builder/types";
import {
  HEAD_GAP_PX,
  hasBackgroundPhoto,
  mergeModuleScopedSectionPresentation,
  pickLayoutPresentation,
  pickSectionChrome,
  resolveModulePresentation,
  resolveSectionBackgroundPresentation,
  resolveSectionLayoutPresentation,
} from "@/lib/ci-builder/module-presentation";
import { getSubModule, supportsSideImageLayout } from "@/lib/ci-builder/modules-catalog";
import { useNestedSectionAnchor } from "../DeferredPaint";
import { EditableText } from "../primitives/EditableText";
import { Sparkles, Trash2, Eye, EyeOff } from "lucide-react";
import { toPromptText } from "@/lib/ci-builder/prompts";
import { triggerToast } from "../Toast";
import {
  defaultClientDescription,
  sectionCopyNeedsPropose,
} from "@/lib/ci-builder/section-copy";
import { proposeCiSectionCopy } from "@/app/actions/ci-builder";
import { CI_PROMPT_CHIP_CLASS } from "@/lib/ci-builder/theme-css";
import {
  SectionPresentationBackground,
  SectionPresentationControls,
  SectionPresentationMedia,
  presentationSectionStyle,
} from "@/components/ci-builder/SectionPresentation";

export interface SectionContainerProps {
  section: Partial<CISection>;
  children: React.ReactNode;
  onEditSectionFields?: (fields: Partial<CISection>) => void;
  isAdmin?: boolean;
  /** Optional live values for catalog prompt templates. */
  promptVars?: Record<string, string>;
  /** Sleek brand-book presentation: hide Copy Prompt chrome. */
  hidePromptActions?: boolean;
  /** Tight cell for a 3-col visual tile grid (logos, buttons, marks). */
  compact?: boolean;
  /** Consecutive color families share a wrapping row in Brand book. */
  clustered?: boolean;
  /** Brand book sub-module title scale. */
  headlineScale?: "h2" | "h3";
  /** Stacked color families (small/large breakers) — tighter padding. */
  followOn?: boolean;
  /** Edit mode: remove this whole sub-module from the guideline. */
  onDeleteSection?: () => void;
  /** Compact tile header slot (e.g. downloads popover). */
  headerExtra?: React.ReactNode;
  /** Edit: this section is hidden from clients until it has content. */
  editorReminder?: boolean;
  /** Brand book: allow presentation chrome editing (appearance / layout / bg). */
  presentationEdit?: boolean;
  /** Assets available for presentation media / background picks. */
  presentationAssets?: Partial<CIAsset>[];
  /** Brand palette for text / accent chips. */
  presentationPalette?: string[];
  /** Persist `data.presentation` patch (full section data merge handled by parent). */
  onPatchPresentation?: (presentation: SectionPresentation) => void;
  /** Module block owns module chrome; section can still override colors. */
  moduleScoped?: boolean;
  /** Guideline theme — for detecting module bg clash. */
  theme?: CITheme | null;
  /** Sibling sections in the same module (for module chrome resolve). */
  allSections?: Partial<CISection>[];
  guidelineId?: string;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
}

export function SectionContainer({
  section,
  children,
  onEditSectionFields,
  isAdmin,
  promptVars,
  hidePromptActions = false,
  compact = false,
  clustered = false,
  headlineScale = "h3",
  followOn = false,
  onDeleteSection,
  headerExtra,
  editorReminder = false,
  presentationEdit = false,
  presentationAssets = [],
  presentationPalette = ["#FFFFFF", "#111111"],
  onPatchPresentation,
  moduleScoped = false,
  theme = null,
  allSections = [],
  guidelineId,
  onAddAssetRecord,
}: SectionContainerProps) {
  const nestedAnchor = useNestedSectionAnchor();
  const anchorId = nestedAnchor ? undefined : section.id || section.section_type;
  const [proposing, setProposing] = useState(false);

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

  const handleProposeCopy = async () => {
    if (!onEditSectionFields || proposing) return;
    const fallback = defaultClientDescription(section.section_type);
    onEditSectionFields({ description: fallback });
    setProposing(true);
    try {
      const labels: string[] = [];
      const data = (section.data || {}) as Record<string, any>;
      if (Array.isArray(data.swatches)) {
        labels.push(
          ...data.swatches
            .map((s: { name?: string }) => s?.name)
            .filter((n: unknown): n is string => Boolean(n))
            .slice(0, 8)
        );
      }
      const result = await proposeCiSectionCopy({
        sectionType: section.section_type || "",
        headline: section.headline || "",
        labels,
        currentDescription: section.description || "",
      });
      if (result.ok && result.text && result.text !== fallback) {
        onEditSectionFields({ description: result.text });
      }
    } catch {
      /* catalog default already applied */
    } finally {
      setProposing(false);
    }
  };

  const showPropose =
    isAdmin && !compact && sectionCopyNeedsPropose(section.description);

  const reminder = editorReminder ? (
    <p className="text-[11px] text-amber-800/80 mb-3">
      Clients won’t see this until you add content.
    </p>
  ) : null;

  const hiddenFromClients = isAdmin && section.is_visible === false;

  const visibilityBtn = isAdmin && onEditSectionFields ? (
    <button
      type="button"
      onClick={() =>
        handleSaveField("is_visible", section.is_visible === false)
      }
      className="no-print inline-flex items-center gap-1 shrink-0 px-2 py-1 text-[11px] font-medium text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-md border border-transparent hover:border-gray-200 transition-colors"
      title={
        section.is_visible === false
          ? "Hidden from clients — click to show"
          : "Visible to clients — click to hide"
      }
    >
      {section.is_visible === false ? (
        <EyeOff className="w-3.5 h-3.5" />
      ) : (
        <Eye className="w-3.5 h-3.5" />
      )}
    </button>
  ) : null;

  const deleteBtn = isAdmin && onDeleteSection ? (
    <button
      type="button"
      onClick={onDeleteSection}
      className="no-print inline-flex items-center gap-1 shrink-0 px-2 py-1 text-[11px] font-medium text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-md border border-transparent hover:border-red-200 transition-colors"
      title="Remove this section from the guideline"
    >
      <Trash2 className="w-3 h-3" />
      {compact ? null : <span>Delete section</span>}
    </button>
  ) : null;

  const book = hidePromptActions && !isAdmin && !compact;
  const layoutPresentation = moduleScoped
    ? resolveSectionLayoutPresentation(section.data)
    : readSectionPresentation(section.data);
  const sectionChrome = moduleScoped
    ? resolveSectionBackgroundPresentation(section.data)
    : readSectionPresentation(section.data);
  const presentation = moduleScoped
    ? { ...layoutPresentation, ...sectionChrome }
    : readSectionPresentation(section.data);
  const appearance = presentation.appearance || "inherit";
  const layout = presentation.layout || "stack";
  const isSplit = layout === "image-left" || layout === "image-right";
  const sectionStyle = presentationSectionStyle(sectionChrome);
  const headGap = sectionChrome.headGap || "m";
  const sideImageAllowed = supportsSideImageLayout(section.section_type);
  const showLayout =
    presentationEdit && onPatchPresentation && sideImageAllowed;
  const showSectionColors =
    presentationEdit && onPatchPresentation && moduleScoped;

  const moduleId = getSubModule(section.section_type)?.moduleId;
  const moduleBackgroundActive =
    moduleScoped && moduleId
      ? hasBackgroundPhoto(
          resolveModulePresentation(theme, moduleId, allSections)
        )
      : false;

  if (book) {
    const head = (
      <div
        className="bb-section-head"
        style={{ marginBottom: HEAD_GAP_PX[headGap] }}
      >
        {section.eyebrow_label ? (
          <p className="bb-eyebrow">{section.eyebrow_label}</p>
        ) : null}
        {section.headline ? (
          headlineScale === "h2" ? (
            <h2 className="bb-h2">{section.headline}</h2>
          ) : (
            <h3 className="bb-h3">{section.headline}</h3>
          )
        ) : null}
        {section.description && !clustered ? (
          <p className="bb-desc whitespace-pre-wrap">{section.description}</p>
        ) : null}
      </div>
    );

    return (
      <section
        id={anchorId}
        className={`bb-section scroll-mt-28 ${clustered ? "bb-section-cluster" : ""} ${followOn ? "bb-section-follow" : ""}`}
        data-bb-appearance={appearance !== "inherit" ? appearance : undefined}
        data-bb-layout={layout}
        data-bb-head-gap={headGap}
        style={sectionStyle}
      >
        <SectionPresentationBackground
          presentation={sectionChrome}
          assets={presentationAssets}
        />
        <div className="bb-section-inner">
          {showSectionColors ? (
            <SectionPresentationControls
              data={section.data}
              assets={presentationAssets}
              palette={presentationPalette}
              onChange={(next) => {
                onPatchPresentation?.(
                  mergeModuleScopedSectionPresentation({
                    ...pickLayoutPresentation(
                      readSectionPresentation(section.data)
                    ),
                    ...pickSectionChrome(next),
                  })
                );
              }}
              showLayoutControls={false}
              showAppearanceControls={false}
              showSectionBackgroundControls
              moduleBackgroundActive={moduleBackgroundActive}
              scopeLabel="Section colors"
              guidelineId={guidelineId}
              onAddAssetRecord={onAddAssetRecord}
            />
          ) : null}
          {showLayout ? (
            <SectionPresentationControls
              data={section.data}
              assets={presentationAssets}
              palette={presentationPalette}
              onChange={(next) => {
                onPatchPresentation?.(
                  mergeModuleScopedSectionPresentation({
                    ...pickSectionChrome(
                      readSectionPresentation(section.data)
                    ),
                    ...pickLayoutPresentation(next),
                  })
                );
              }}
              showLayoutControls
              showAppearanceControls={false}
              scopeLabel="Section layout"
              guidelineId={guidelineId}
              onAddAssetRecord={onAddAssetRecord}
            />
          ) : null}
          {isSplit ? (
            <div className="bb-section-split">
              <div className="bb-section-content">
                {head}
                <div className="bb-section-copy">
                  <div className="section-content">{children}</div>
                </div>
              </div>
              <SectionPresentationMedia
                presentation={presentation}
                assets={presentationAssets}
              />
            </div>
          ) : (
            <>
              {head}
              <div className="bb-section-body">
                <div className="bb-section-copy">
                  <div className="section-content">{children}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  if (compact) {
    return (
      <section
        id={anchorId}
        className={`scroll-mt-24 min-w-0 h-full flex flex-col overflow-visible ${
          hiddenFromClients ? "opacity-60" : ""
        }`}
      >
        <div className="mb-3 min-w-0 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {(section.eyebrow_label || isAdmin) && (
              <EditableText
                tag="p"
                value={section.eyebrow_label || ""}
                placeholder="EYEBROW LABEL"
                onSave={(val) => handleSaveField("eyebrow_label", val)}
                isAdmin={isAdmin}
                className="text-[var(--ci-accent,#000)] font-bold tracking-wider text-[10px] uppercase mb-1"
              />
            )}
            {(section.headline || isAdmin) && (
              <EditableText
                tag="h2"
                value={section.headline || ""}
                placeholder="Section Headline"
                onSave={(val) => handleSaveField("headline", val)}
                isAdmin={isAdmin}
                className="font-bold tracking-tight text-[var(--ci-text,#111)] leading-snug"
                style={{
                  fontFamily: "var(--ci-subhead-font, inherit)",
                  fontSize: "var(--ci-subhead-size, 1.25rem)",
                  fontWeight: "var(--ci-subhead-weight, 700)" as React.CSSProperties["fontWeight"],
                  letterSpacing: "var(--ci-subhead-tracking, -0.02em)",
                }}
              />
            )}
            {reminder}
          </div>
          <div className="flex items-start gap-1 shrink-0">
            {headerExtra}
            {visibilityBtn}
            {deleteBtn}
          </div>
        </div>
        <div className="section-content flex-1 min-w-0 overflow-visible">{children}</div>
      </section>
    );
  }

  return (
    <section
      id={anchorId}
      className={`py-20 md:py-24 border-b border-[var(--ci-border,#eaeaea)] scroll-mt-24 ${
        hiddenFromClients ? "opacity-60" : ""
      }`}
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

            {(deleteBtn || visibilityBtn || (!isAdmin && !hidePromptActions)) && (
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                {visibilityBtn}
                {deleteBtn}
                {!isAdmin && !hidePromptActions && (
                  <button
                    onClick={handleCopySectionPrompt}
                    className={CI_PROMPT_CHIP_CLASS}
                    title="Copy section rules formatted for AI prompts"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Copy as Prompt</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {(section.headline || isAdmin) && (
            <div
              className="font-bold tracking-tight text-[var(--ci-text,#111)]"
              style={{
                fontFamily: "var(--ci-subhead-font, inherit)",
                fontSize: "var(--ci-subhead-size, 1.75rem)",
                fontWeight: "var(--ci-subhead-weight, 700)" as React.CSSProperties["fontWeight"],
                letterSpacing: "var(--ci-subhead-tracking, -0.02em)",
              }}
            >
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

          {reminder}

          {(section.description || isAdmin) && (
            <div>
              <EditableText
                tag="p"
                multiline
                value={section.description || ""}
                placeholder="Add section description text..."
                onSave={(val) => handleSaveField("description", val)}
                isAdmin={isAdmin}
                className="mt-6 text-xl text-[var(--ci-text-muted,#666)] max-w-2xl leading-relaxed font-normal whitespace-pre-wrap"
              />
              {showPropose ? (
                <button
                  type="button"
                  onClick={handleProposeCopy}
                  disabled={proposing}
                  className="no-print mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" />
                  {proposing ? "Proposing…" : "Propose copy"}
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div className="section-content">
          {children}
        </div>
      </div>
    </section>
  );
}
