"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanelLeftClose, PanelLeft, X } from "lucide-react";
import { SectionRenderer } from "@/components/ci-builder/sections";
import { withModuleBreakers } from "@/components/ci-builder/sections/ModuleBreaker";
import { CITheme, CISection, CIAsset, ColorSwatch, CoverHeaderId } from "@/lib/ci-builder/types";
import {
  appearanceFromBackground,
  ciThemeCssVars,
  isCoverHeaderItemVisible,
  isCoverTitleVisible,
  resolveColorChapterLayout,
  resolveCoverTitle,
  resolveCoverSubtitle,
  withCoverHeaderItem,
} from "@/lib/ci-builder/theme-css";
import { GuidelineCoverBlock, type CoverStat, CoverItemToggle } from "./GuidelineCoverBlock";
import {
  CI_MODULES,
  getSubModule,
  sortSectionsByCatalog,
  type CiModuleId,
} from "@/lib/ci-builder/modules-catalog";
import { scrollToSectionAnchor } from "@/lib/ci-builder/scroll";
import { isFormatColorSection } from "@/lib/ci-builder/color-cleanup";
import { sectionHasClientValue } from "@/lib/ci-builder/section-value";
import { polishClientFacingSections } from "@/lib/ci-builder/polish-client-content";
import { isCompleteHex, toHexColor } from "@/lib/ci-builder/color-utils";
import { groupSwatchesByFamily } from "@/lib/ci-builder/color-families";
import { pickBrandMark } from "@/lib/ci-builder/brand-mark";
import { breakerStyleFromTheme } from "@/lib/ci-builder/breaker-type";
import { CiFontLoader } from "@/components/ci-builder/CiFontLoader";
import { DeferredPaint } from "@/components/ci-builder/DeferredPaint";
import { CiMediaImage } from "@/components/ci-builder/CiMediaImage";
import { BrandBookModuleBlock } from "@/components/ci-builder/BrandBookModuleBlock";
import { collectPresentationPalette } from "@/components/ci-builder/SectionPresentation";
import "./brand-book.css";

export interface BrandBookPresentationProps {
  brandName: string;
  theme: CITheme | null | undefined;
  sections: Partial<CISection>[];
  assets: Partial<CIAsset>[];
  toolbar?: React.ReactNode;
  floatingActions?: React.ReactNode;
  className?: string;
  printDocument?: boolean;
  isAdmin?: boolean;
  onUpdateTheme?: (theme: CITheme) => void;
  onUpdateSectionData?: (sectionId: string, newData: any) => void;
  guidelineId?: string;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
}

function sectionAnchor(sec: Partial<CISection>) {
  return sec.id || sec.section_type || "";
}

const NAV_GROUPS: { label: string; ids: CiModuleId[] }[] = [
  {
    label: "Identity",
    ids: ["brand_core_strategy", "brand_voice_ai_texting", "logo_system"],
  },
  {
    label: "Foundation",
    ids: [
      "colors_systems",
      "typography_properties",
      "design_tokens",
      "ui_elements",
    ],
  },
  {
    label: "Application",
    ids: ["imagery", "touchpoints"],
  },
];

function clipText(value: string, max = 160) {
  const t = value.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function uniqHexes(values: (string | undefined | null)[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const t = (raw || "").trim();
    if (!t) continue;
    if (!isCompleteHex(t) && !/^#[0-9a-fA-F]{3}$/.test(t)) continue;
    const hex = toHexColor(t);
    if (!seen.has(hex)) {
      seen.add(hex);
      out.push(hex);
    }
  }
  return out;
}

export function BrandBookPresentation({
  brandName,
  theme,
  sections,
  assets,
  toolbar,
  floatingActions,
  className = "",
  printDocument = false,
  isAdmin = false,
  onUpdateTheme,
  onUpdateSectionData,
  guidelineId,
  onAddAssetRecord,
}: BrandBookPresentationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayTitle = resolveCoverTitle(theme, brandName);
  const lockupSub = resolveCoverSubtitle(theme, "");
  const showTitle = isCoverTitleVisible(theme);
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("ci-bb-sidebar-collapsed") === "1") {
        setSidebarCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleChapterNav = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 960px)").matches) {
      setNavOpen((v) => !v);
      return;
    }
    setSidebarCollapsed((v) => {
      const next = !v;
      try {
        sessionStorage.setItem("ci-bb-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const visible = useMemo(() => {
    const polished = polishClientFacingSections(sections, { theme }).sections;
    return sortSectionsByCatalog(
      polished.filter(
        (s) =>
          s.is_visible !== false &&
          !isFormatColorSection(s.section_type) &&
          sectionHasClientValue(s, assets)
      )
    );
  }, [sections, assets, theme]);

  const navEntries = useMemo(() => {
    const entries: { id: string; label: string; moduleId: string }[] =
      CI_MODULES.map((mod) => {
        const first = visible.find(
          (sec) => getSubModule(sec.section_type)?.moduleId === mod.id
        );
        return {
          id: first ? sectionAnchor(first) : "",
          label: mod.label,
          moduleId: mod.id,
        };
      }).filter((e) => e.id);
    const uncatalogued = visible.filter((s) => !getSubModule(s.section_type));
    if (uncatalogued[0]) {
      entries.push({
        id: sectionAnchor(uncatalogued[0]),
        label: "Other",
        moduleId: "other",
      });
    }
    return entries;
  }, [visible]);

  const [activeSectionId, setActiveSectionId] = useState<string>(
    navEntries[0]?.id || ""
  );

  const brandMark = useMemo(
    () => pickBrandMark(visible, assets),
    [visible, assets]
  );

  const adminCover = Boolean(isAdmin && onUpdateTheme && !printDocument);

  const toggleCoverHeader = (id: CoverHeaderId) => {
    if (!onUpdateTheme) return;
    const next = !isCoverHeaderItemVisible(theme, id);
    onUpdateTheme(withCoverHeaderItem(theme, id, next));
  };

  const stats = useMemo((): CoverStat[] => {
    const accents = (theme?.accentColors || []).filter(Boolean).length;
    const logos = visible.filter(
      (s) => getSubModule(s.section_type)?.renderer === "image_slot"
    ).length;
    const chapters = navEntries.length;
    const all: CoverStat[] = [];
    if (accents) {
      all.push({
        id: "statAccent",
        value: String(accents),
        label: accents === 1 ? "Accent" : "Accents",
        hidden: !isCoverHeaderItemVisible(theme, "statAccent"),
      });
    }
    if (logos) {
      all.push({
        id: "statLogos",
        value: String(logos),
        label: logos === 1 ? "Logo slot" : "Logo slots",
        hidden: !isCoverHeaderItemVisible(theme, "statLogos"),
      });
    }
    if (chapters) {
      all.push({
        id: "statChapters",
        value: String(chapters),
        label: chapters === 1 ? "Chapter" : "Chapters",
        hidden: !isCoverHeaderItemVisible(theme, "statChapters"),
      });
    }
    return adminCover ? all : all.filter((s) => !s.hidden);
  }, [theme, visible, navEntries.length, adminCover]);

  const activeModuleLabel =
    navEntries.find((e) => e.id === activeSectionId)?.label || "Overview";

  useEffect(() => {
    if (navEntries.length === 0) return;
    if (!navEntries.some((e) => e.id && e.id === activeSectionId)) {
      const first = navEntries.find((e) => e.id);
      if (first) setActiveSectionId(first.id);
    }
  }, [navEntries, activeSectionId]);

  useEffect(() => {
    if (printDocument || visible.length === 0) return;

    const root = scrollRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const hitId = hit?.target?.id;
        if (!hitId || hitId === "brand-book-hero") return;
        const sec = visible.find((s) => sectionAnchor(s) === hitId);
        const modId = getSubModule(sec?.section_type)?.moduleId;
        const nav =
          navEntries.find((e) => e.moduleId === modId) ||
          navEntries.find((e) => e.id === hitId);
        if (nav?.id) setActiveSectionId(nav.id);
      },
      {
        root: root || null,
        rootMargin: "-12% 0px -70% 0px",
        threshold: [0.1, 0.25, 0.5],
      }
    );

    visible.forEach((sec) => {
      const id = sectionAnchor(sec);
      const el = id ? document.getElementById(id) : null;
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [printDocument, visible, navEntries]);

  const scrollToSection = (anchorId: string) => {
    scrollToSectionAnchor(anchorId, scrollRef.current);
    setActiveSectionId(anchorId);
    setNavOpen(false);
  };

  const lockupLines = (showTitle ? displayTitle : brandName)
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2);

  const rail = useMemo(() => {
    const cards: {
      id: CoverHeaderId;
      eyebrow: string;
      text: string;
      chips?: { hex: string; large?: boolean }[];
      hidden?: boolean;
    }[] = [];
    const core = visible.find((s) => {
      const id = getSubModule(s.section_type)?.moduleId;
      return id === "brand_core_strategy" || id === "brand_voice_ai_texting";
    });
    const body = String(
      (core?.data as { body?: string; claim?: string } | undefined)?.body ||
        (core?.data as { claim?: string } | undefined)?.claim ||
        core?.description ||
        ""
    ).trim();
    if (body) {
      cards.push({
        id: "railVoice",
        eyebrow: core?.headline || core?.eyebrow_label || "Voice",
        text: clipText(body),
        hidden: !isCoverHeaderItemVisible(theme, "railVoice"),
      });
    }
    const familyChips = visible
      .filter((s) => getSubModule(s.section_type)?.renderer === "color_group")
      .flatMap((s) => {
        const swatches = Array.isArray(
          (s.data as { swatches?: ColorSwatch[] } | undefined)?.swatches
        )
          ? ((s.data as { swatches: ColorSwatch[] }).swatches || [])
          : [];
        const role = String(s.section_type || "");
        let secondaryHero = true;
        return groupSwatchesByFamily(swatches)
          .map((fam) => {
            const hex = fam.hero?.hex;
            if (!hex || (!isCompleteHex(hex) && !/^#[0-9a-fA-F]{3}$/.test(hex))) {
              return null;
            }
            const large =
              role === "color_primary" ||
              (role === "color_secondary" && secondaryHero);
            if (role === "color_secondary") secondaryHero = false;
            return { hex: toHexColor(hex), large, key: `${role}:${fam.key}` };
          })
          .filter(Boolean) as { hex: string; large: boolean; key: string }[];
      });
    const seen = new Set<string>();
    const chips = familyChips.filter((c) => {
      const k = c.hex.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (chips.length > 0) {
      const large = chips.filter((c) => c.large);
      const rest = chips.filter((c) => !c.large);
      cards.push({
        id: "railColor",
        eyebrow: "Color",
        text: "Full system — primary and secondary at full size.",
        chips: [...large, ...rest],
        hidden: !isCoverHeaderItemVisible(theme, "railColor"),
      });
    }
    const font = theme?.primaryFont || theme?.fontFamily;
    if (font) {
      cards.push({
        id: "railType",
        eyebrow: "Type",
        text: font,
        hidden: !isCoverHeaderItemVisible(theme, "railType"),
      });
    }
    return adminCover ? cards : cards.filter((c) => !c.hidden);
  }, [visible, theme, adminCover]);

  const year = new Date().getFullYear();
  const accents = theme?.accentColors?.filter(Boolean) || [];

  return (
    <div
      className={`ci-brand-book ci-canvas relative flex flex-col text-[var(--ci-text)] bg-[var(--ci-bg)] ${
        printDocument ? "print-doc h-auto overflow-visible" : "overflow-hidden h-full min-h-0"
      } ${navOpen ? "bb-nav-open" : ""} ${
        sidebarCollapsed ? "bb-sidebar-collapsed" : ""
      } ${className}`}
      style={{
        ...ciThemeCssVars(theme),
        ...breakerStyleFromTheme(theme, visible),
      }}
      data-appearance={
        theme?.appearance || appearanceFromBackground(theme?.backgroundColor)
      }
    >
      <CiFontLoader theme={theme} assets={assets} sections={sections} />
      {floatingActions}

      {toolbar && !printDocument ? (
        <div className="bb-overlay no-print ci-chrome">{toolbar}</div>
      ) : null}

      {!printDocument && navOpen ? (
        <button
          type="button"
          className="bb-nav-backdrop no-print"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      {printDocument ? null : (
        <aside className="bb-sidebar no-print">
          <button
            type="button"
            className="bb-brand"
            onClick={() => {
              scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              setNavOpen(false);
            }}
          >
            {brandMark?.public_url || brandMark?.storage_path ? (
              <CiMediaImage
                src={brandMark.public_url || brandMark.storage_path || ""}
                alt=""
                className="bb-brand-mark"
                width={80}
                height={80}
                sizes="80px"
                priority
              />
            ) : (
              <span className="bb-brand-fallback" />
            )}
            <span>
              <strong>
                {lockupLines.length
                  ? lockupLines.map((line, i) => (
                      <span key={line}>
                        {line}
                        {i < lockupLines.length - 1 ? <br /> : null}
                      </span>
                    ))
                  : "Brand"}
              </strong>
              {lockupSub ? <em>{lockupSub}</em> : null}
            </span>
          </button>

          <nav className="bb-nav">
            {NAV_GROUPS.map((group) => {
              const items = group.ids
                .map((id) => navEntries.find((e) => e.moduleId === id))
                .filter((e): e is (typeof navEntries)[number] => Boolean(e));
              if (items.length === 0) return null;
              return (
                <div key={group.label} className="bb-nav-group">
                  <span className="bb-nav-group-label">{group.label}</span>
                  {items.map((entry) => {
                    const active = activeSectionId === entry.id;
                    const colorIndex = navEntries.findIndex(
                      (e) => e.moduleId === entry.moduleId
                    );
                    const color =
                      accents[colorIndex % Math.max(accents.length, 1)] ||
                      "var(--ci-accent)";
                    return (
                      <button
                        key={entry.moduleId}
                        type="button"
                        className={active ? "active" : ""}
                        onClick={() => scrollToSection(entry.id)}
                      >
                        <i className="bb-nav-dot" style={{ background: color }} />
                        {entry.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {navEntries
              .filter((e) => e.moduleId === "other")
              .map((entry) => (
                <button
                  key={entry.moduleId}
                  type="button"
                  className={activeSectionId === entry.id ? "active" : ""}
                  onClick={() => scrollToSection(entry.id)}
                >
                  <i className="bb-nav-dot" style={{ background: "var(--ci-accent)" }} />
                  {entry.label}
                </button>
              ))}
          </nav>

          <div className="bb-sidebar-footer">
            <span className="dot" />
            Brand book · {year}
          </div>
        </aside>
      )}

      <div
        ref={scrollRef}
        className={
          printDocument
            ? "bb-main ci-guideline-print overflow-visible h-auto"
            : "bb-main flex-1 overflow-y-auto ci-guideline-print scroll-smooth min-h-0 h-full"
        }
      >
        {printDocument ? null : (
          <header className="bb-topbar no-print">
            <div className="bb-crumbs">
              <button
                type="button"
                className="bb-nav-toggle p-1 -ml-1"
                onClick={toggleChapterNav}
                aria-label={
                  sidebarCollapsed ? "Show chapter navigation" : "Hide chapter navigation"
                }
                title={
                  sidebarCollapsed ? "Show chapters" : "Hide chapters for full width"
                }
              >
                {navOpen ? (
                  <X size={16} />
                ) : sidebarCollapsed ? (
                  <PanelLeft size={16} />
                ) : (
                  <PanelLeftClose size={16} />
                )}
              </button>
              <span>{showTitle ? displayTitle : brandName}</span>
              {lockupSub ? (
                <>
                  <span>·</span>
                  <span>{lockupSub}</span>
                </>
              ) : null}
              <span>·</span>
              <span className="bb-crumb-current">{activeModuleLabel}</span>
            </div>
            <div className="bb-topbar-meta">
              <span className="bb-year-pill">{year}</span>
            </div>
          </header>
        )}

        <section id="brand-book-hero" className="bb-hero">
          <div className="bb-hero-bg" aria-hidden />
          <GuidelineCoverBlock
            theme={theme}
            fallbackTitle={brandName}
            variant="hero"
            stats={stats}
            isAdmin={adminCover}
            onToggleCoverHeader={adminCover ? toggleCoverHeader : undefined}
          />
          {rail.length > 0 ? (
            <div className="bb-hero-rail">
              {rail.map((card) => (
                <div
                  key={card.id}
                  className={`bb-rail-card${card.hidden ? " bb-cover-hidden" : ""}`}
                >
                  <span className="bb-eyebrow">{card.eyebrow}</span>
                  <p>{card.text}</p>
                  {card.chips?.length ? (
                    <div className="bb-rail-chips">
                      {card.chips.map((chip) => (
                        <i
                          key={chip.hex}
                          className={chip.large ? "bb-rail-chip-lg" : undefined}
                          style={{ background: chip.hex }}
                          title={chip.hex}
                        />
                      ))}
                    </div>
                  ) : null}
                  {adminCover ? (
                    <CoverItemToggle
                      visible={!card.hidden}
                      label={card.eyebrow}
                      onToggle={() => toggleCoverHeader(card.id)}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <main>
          {visible.length === 0 ? (
            <div className="bb-section">
              <p className="bb-desc">
                No visible sections yet. Switch to Edit to add sub-modules or import from Figma.
              </p>
            </div>
          ) : (
            withModuleBreakers(
              visible,
              (sec, _i, opts) => (
                <DeferredPaint
                  id={sec.id || sec.section_type}
                  eager={printDocument}
                >
                <SectionRenderer
                  section={sec}
                  compact={opts?.compact}
                  clustered={opts?.clustered}
                  headlineScale={opts?.headlineScale}
                  followOn={opts?.followOn}
                  moduleScoped={opts?.moduleScoped}
                  assets={assets.filter(
                    (a) => a.section_id === sec.id || a.kind === sec.section_type
                  )}
                  allAssets={assets}
                  allSections={visible}
                  isAdmin={false}
                  viewMode="presentation"
                  hidePromptActions
                  presentationEdit={
                    Boolean(isAdmin && onUpdateSectionData) && !opts?.clustered
                  }
                  theme={theme}
                  onUpdateData={onUpdateSectionData}
                  guidelineId={guidelineId}
                  onAddAssetRecord={onAddAssetRecord}
                />
                </DeferredPaint>
              ),
              {
                viewMode: "presentation",
                colorChapterLayout: resolveColorChapterLayout(theme),
                theme,
                allSections: visible,
                assets,
                palette: collectPresentationPalette({ theme, sections: visible }),
                presentationEdit: Boolean(isAdmin && onUpdateTheme),
                onUpdateTheme,
                guidelineId,
                onAddAssetRecord,
              }
            )
          )}
        </main>

        <BrandBookModuleBlock
          blockId="footer"
          blockLabel="Footer"
          theme={theme}
          assets={assets}
          palette={collectPresentationPalette({ theme, sections: visible })}
          presentationEdit={Boolean(isAdmin && onUpdateTheme)}
          onUpdateTheme={onUpdateTheme}
          guidelineId={guidelineId}
          onAddAssetRecord={onAddAssetRecord}
        >
          <footer className="bb-section bb-footer no-print">
            <p className="bb-desc">
              {showTitle ? `${displayTitle} · Brand book` : "Brand book"}
            </p>
            <button
              type="button"
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              className="mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--ci-accent)]"
            >
              Back to top
            </button>
          </footer>
        </BrandBookModuleBlock>
      </div>
    </div>
  );
}
