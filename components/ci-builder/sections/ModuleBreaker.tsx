"use client";

import React, { Fragment } from "react";
import type { CIAsset, CISection, CITheme } from "@/lib/ci-builder/types";
import { getSubModule } from "@/lib/ci-builder/modules-catalog";
import { moduleDownloadEntries } from "@/lib/ci-builder/downloads";
import { ModuleDownloadsBar } from "@/components/ci-builder/primitives/AssetDownloads";
import {
  breakerStyleFromTheme,
  resolveBreakerAlign,
} from "@/lib/ci-builder/breaker-type";
import { BrandBookModuleBlock } from "@/components/ci-builder/BrandBookModuleBlock";
import type { BrandBookBlockId } from "@/lib/ci-builder/module-presentation";

export function ModuleBreaker({
  index,
  label,
  quiet = false,
  extras,
}: {
  index?: number;
  label: string;
  quiet?: boolean;
  extras?: ModuleBreakerExtras;
}) {
  const num =
    typeof index === "number" && index > 0
      ? String(index).padStart(2, "0")
      : null;
  const typeStyle = breakerStyleFromTheme(extras?.theme, extras?.allSections);
  const align = resolveBreakerAlign(extras?.theme);
  const alignClass =
    align === "center"
      ? "items-center text-center"
      : align === "right"
        ? "items-end text-right"
        : "items-start text-left";

  if (quiet) {
    return (
      <div className={`bb-chapter ${alignClass}`} style={typeStyle}>
        {num ? <p className="bb-chapter-num">{num}</p> : null}
        <h2 className="bb-h2">{label}</h2>
      </div>
    );
  }

  return (
    <div
      className={`ci-module-breaker flex flex-col ${alignClass} justify-center px-6 py-16 md:py-20`}
      aria-hidden="true"
      style={typeStyle}
    >
      {num && (
        <p
          className="font-bold uppercase tracking-[0.28em] text-[var(--ci-accent,#111)] mb-3"
          style={{
            fontSize: "var(--ci-breaker-num-size, 10px)",
            fontWeight: "var(--ci-breaker-num-weight, 700)" as unknown as number,
          }}
        >
          {num}
        </p>
      )}
      <p
        className="font-semibold text-[var(--ci-text,#111)]"
        style={{
          fontFamily: "var(--ci-breaker-font, var(--ci-font, inherit))",
          fontSize: "var(--ci-breaker-size, 1.25rem)",
          fontWeight: "var(--ci-breaker-weight, 600)" as unknown as number,
          letterSpacing: "var(--ci-breaker-tracking, 0.08em)",
          fontStyle: "var(--ci-breaker-style, normal)",
          textTransform: "none",
        }}
      >
        {label}
      </p>
    </div>
  );
}

export type SectionRenderOpts = {
  compact?: boolean;
  clustered?: boolean;
  headlineScale?: "h2" | "h3";
  followOn?: boolean;
  /** Parent module block owns module chrome; section can still override colors. */
  moduleScoped?: boolean;
};

export type ModuleBreakerExtras = {
  viewMode?: "presentation" | "elements";
  assets?: Partial<CIAsset>[];
  colorChapterLayout?: "merge" | "small" | "large";
  theme?: CITheme | null;
  allSections?: Partial<CISection>[];
  presentationEdit?: boolean;
  onUpdateTheme?: (theme: CITheme) => void;
  palette?: string[];
  guidelineId?: string;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
};

function moduleDownloads(
  sections: Partial<CISection>[],
  extras: ModuleBreakerExtras | undefined,
  moduleId: string,
  show: boolean
) {
  if (!show || extras?.viewMode !== "elements") return null;
  const entries = moduleDownloadEntries(sections, extras.assets || [], moduleId);
  if (!entries.length) return null;
  return <ModuleDownloadsBar entries={entries} />;
}

function isColorGroup(section: Partial<CISection>) {
  return getSubModule(section.section_type)?.renderer === "color_group";
}

function moduleIdFor(section: Partial<CISection>): BrandBookBlockId {
  return (getSubModule(section.section_type)?.moduleId || "other") as BrandBookBlockId;
}

function renderModuleBody(
  sections: Partial<CISection>[],
  startIndex: number,
  renderSection: (
    section: Partial<CISection>,
    index: number,
    opts?: SectionRenderOpts
  ) => React.ReactNode,
  extras: ModuleBreakerExtras | undefined,
  moduleId: BrandBookBlockId
) {
  const nodes: React.ReactNode[] = [];
  const presentation = extras?.viewMode === "presentation";
  const sectionOpts: SectionRenderOpts = { moduleScoped: presentation };

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const globalIndex = startIndex + i;

    if (presentation && isColorGroup(sec)) {
      const cluster = [sec];
      while (i + 1 < sections.length) {
        const next = sections[i + 1];
        const nextDef = getSubModule(next.section_type);
        if (
          nextDef?.renderer !== "color_group" ||
          (nextDef.moduleId || "other") !== moduleId
        ) {
          break;
        }
        i += 1;
        cluster.push(next);
      }
      const layout = extras?.colorChapterLayout || "merge";
      const colorOpts: SectionRenderOpts = {
        ...sectionOpts,
        ...(layout === "large"
          ? { headlineScale: "h2" as const, followOn: true }
          : layout === "small"
            ? { headlineScale: "h3" as const, followOn: true }
            : { clustered: true as const, headlineScale: "h3" as const }),
      };
      if (layout === "merge") {
        nodes.push(
          <div key={cluster[0].id || cluster[0].section_type || globalIndex} className="bb-color-cluster">
            {cluster.map((c, ci) =>
              renderSection(c, globalIndex - (cluster.length - 1) + ci, colorOpts)
            )}
          </div>
        );
      } else {
        cluster.forEach((c, ci) => {
          nodes.push(
            <Fragment key={c.id || c.section_type || ci}>
              {renderSection(c, globalIndex - (cluster.length - 1) + ci, colorOpts)}
            </Fragment>
          );
        });
      }
      continue;
    }

    nodes.push(
      <Fragment key={sec.id || sec.section_type || globalIndex}>
        {moduleDownloads(sections, extras, moduleId, i === 0 && extras?.viewMode !== "presentation")}
        {renderSection(sec, globalIndex, sectionOpts)}
      </Fragment>
    );
  }

  return nodes;
}

function groupSectionsByModule(sections: Partial<CISection>[]) {
  const groups: {
    moduleId: BrandBookBlockId;
    moduleLabel: string;
    moduleIndex?: number;
    sections: Partial<CISection>[];
    startIndex: number;
  }[] = [];

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const def = getSubModule(sec.section_type);
    const moduleId = moduleIdFor(sec);
    const last = groups[groups.length - 1];
    if (last && last.moduleId === moduleId) {
      last.sections.push(sec);
    } else {
      groups.push({
        moduleId,
        moduleLabel: def?.moduleLabel || "Other",
        moduleIndex: def?.moduleIndex,
        sections: [sec],
        startIndex: i,
      });
    }
  }

  return groups;
}

export function withModuleBreakers(
  sections: Partial<CISection>[],
  renderSection: (
    section: Partial<CISection>,
    index: number,
    opts?: SectionRenderOpts
  ) => React.ReactNode,
  extras?: ModuleBreakerExtras
) {
  if (extras?.viewMode !== "presentation") {
    return renderLegacyModuleBreakers(sections, renderSection, extras);
  }

  const groups = groupSectionsByModule(sections);
  return groups.map((group) => (
    <BrandBookModuleBlock
      key={group.moduleId}
      blockId={group.moduleId}
      blockLabel={group.moduleLabel}
      theme={extras?.theme}
      moduleSections={group.sections as CISection[]}
      assets={extras?.assets || []}
      palette={extras?.palette || ["#FFFFFF", "#111111"]}
      presentationEdit={extras?.presentationEdit}
      onUpdateTheme={extras?.onUpdateTheme}
      guidelineId={extras?.guidelineId}
      onAddAssetRecord={extras?.onAddAssetRecord}
    >
      <ModuleBreaker
        index={group.moduleIndex}
        label={group.moduleLabel}
        quiet
        extras={extras}
      />
      {renderModuleBody(
        group.sections,
        group.startIndex,
        renderSection,
        extras,
        group.moduleId
      )}
    </BrandBookModuleBlock>
  ));
}

function renderLegacyModuleBreakers(
  sections: Partial<CISection>[],
  renderSection: (
    section: Partial<CISection>,
    index: number,
    opts?: SectionRenderOpts
  ) => React.ReactNode,
  extras?: ModuleBreakerExtras
) {
  const nodes: React.ReactNode[] = [];
  let lastModule = "";

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const def = getSubModule(sec.section_type);
    const moduleId = def?.moduleId || "other";
    const showBreaker = moduleId !== lastModule;
    lastModule = moduleId;

    nodes.push(
      <Fragment key={sec.id || sec.section_type || i}>
        {showBreaker && (
          <ModuleBreaker
            index={def?.moduleIndex}
            label={def?.moduleLabel || "Other"}
            quiet={extras?.viewMode === "presentation"}
            extras={extras}
          />
        )}
        {moduleDownloads(sections, extras, moduleId, showBreaker)}
        {renderSection(sec, i)}
      </Fragment>
    );
  }

  return nodes;
}
