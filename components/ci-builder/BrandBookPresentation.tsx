"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SectionRenderer } from "@/components/ci-builder/sections";
import { CITheme, CISection, CIAsset, cssFontStack } from "@/lib/ci-builder/types";
import {
  CI_MODULES,
  getSubModule,
  sortSectionsByCatalog,
} from "@/lib/ci-builder/modules-catalog";
import { scrollToSectionAnchor } from "@/lib/ci-builder/scroll";

export interface BrandBookPresentationProps {
  brandName: string;
  theme: CITheme | null | undefined;
  sections: Partial<CISection>[];
  assets: Partial<CIAsset>[];
  /** Optional admin / client chrome rendered above the sticky brand nav */
  toolbar?: React.ReactNode;
  /** Soft overlay actions (theme, publish) floated over the canvas */
  floatingActions?: React.ReactNode;
  className?: string;
}

function sectionAnchor(sec: Partial<CISection>) {
  return sec.id || sec.section_type || "";
}

function sectionLabel(sec: Partial<CISection>) {
  const def = getSubModule(sec.section_type);
  return (
    sec.eyebrow_label ||
    sec.headline ||
    def?.defaultHeadline ||
    sec.section_type ||
    "Section"
  );
}

function themeStyle(theme: CITheme | null | undefined): React.CSSProperties {
  const t = theme || {};
  return {
    "--ci-bg": t.backgroundColor || "#ffffff",
    "--ci-text": t.textColor || "#111111",
    "--ci-accent": t.accentColors?.[0] || "#111111",
    "--ci-border": "color-mix(in srgb, var(--ci-text) 12%, transparent)",
    "--ci-text-muted": "color-mix(in srgb, var(--ci-text) 55%, transparent)",
    "--ci-font": cssFontStack(t.primaryFont || t.fontFamily, t.primaryFontFallback),
    "--ci-font-secondary": cssFontStack(
      t.secondaryFont || t.primaryFont || t.fontFamily,
      t.secondaryFontFallback || t.primaryFontFallback
    ),
    "--ci-font-tertiary": cssFontStack(
      t.tertiaryFont || t.secondaryFont,
      t.tertiaryFontFallback
    ),
    backgroundColor: "var(--ci-bg)",
    color: "var(--ci-text)",
    fontFamily: "var(--ci-font)",
  } as React.CSSProperties;
}

export function BrandBookPresentation({
  brandName,
  theme,
  sections,
  assets,
  toolbar,
  floatingActions,
  className = "",
}: BrandBookPresentationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => sortSectionsByCatalog(sections.filter((s) => s.is_visible !== false)),
    [sections]
  );

  const navEntries = useMemo(() => {
    const entries: { id: string; label: string; moduleId: string }[] = [];
    for (const mod of CI_MODULES) {
      const modSecs = visible.filter(
        (sec) => getSubModule(sec.section_type)?.moduleId === mod.id
      );
      for (const sec of modSecs) {
        entries.push({
          id: sectionAnchor(sec),
          label: sectionLabel(sec),
          moduleId: mod.id,
        });
      }
    }
    for (const sec of visible.filter((s) => !getSubModule(s.section_type))) {
      entries.push({
        id: sectionAnchor(sec),
        label: sectionLabel(sec),
        moduleId: "other",
      });
    }
    return entries;
  }, [visible]);

  const [activeSectionId, setActiveSectionId] = useState<string>(
    navEntries[0]?.id || ""
  );

  const heroAsset = useMemo(() => {
    const imagery = assets.find(
      (a) =>
        a.kind?.includes("imagery") ||
        a.kind?.includes("mood") ||
        a.kind === "photo" ||
        a.kind === "image"
    );
    const logo = assets.find(
      (a) => a.kind?.includes("logo") || a.kind === "primary_logo"
    );
    return imagery || logo || null;
  }, [assets]);

  useEffect(() => {
    if (navEntries.length === 0) return;
    if (!navEntries.some((e) => e.id === activeSectionId)) {
      setActiveSectionId(navEntries[0].id);
    }
  }, [navEntries, activeSectionId]);

  useEffect(() => {
    if (visible.length === 0) return;

    const root = scrollRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit?.target?.id) setActiveSectionId(hit.target.id);
      },
      {
        root: root || null,
        rootMargin: "-25% 0px -55% 0px",
        threshold: [0.1, 0.25, 0.5],
      }
    );

    visible.forEach((sec) => {
      const id = sectionAnchor(sec);
      const el = id ? document.getElementById(id) : null;
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [visible]);

  const scrollToSection = (anchorId: string) => {
    scrollToSectionAnchor(anchorId, scrollRef.current);
    setActiveSectionId(anchorId);
  };

  return (
    <div
      className={`relative flex flex-col overflow-hidden text-[var(--ci-text)] bg-[var(--ci-bg)] h-full min-h-0 ${className}`}
      style={themeStyle(theme)}
    >
      {floatingActions}

      {toolbar && <div className="shrink-0 no-print">{toolbar}</div>}

      {/* Brandpad-style sticky chapter nav */}
      <header className="sticky top-0 z-30 shrink-0 no-print border-b border-[var(--ci-border)] bg-[var(--ci-bg)]/90 backdrop-blur-md">
        <div className="flex items-center gap-4 px-6 lg:px-12 py-3.5 max-w-[1800px] mx-auto">
          <button
            type="button"
            onClick={() => {
              scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="text-sm font-bold tracking-tight shrink-0 hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--ci-font)" }}
          >
            {brandName || "Brand"}
          </button>

          <nav className="flex-1 flex items-center justify-end gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
            {navEntries.map((entry, idx) => {
              const prev = navEntries[idx - 1];
              const showModuleDivider = prev && prev.moduleId !== entry.moduleId;
              const active = activeSectionId === entry.id;
              return (
                <React.Fragment key={entry.id}>
                  {showModuleDivider && (
                    <span
                      className="hidden sm:block w-px h-4 bg-[var(--ci-border)] shrink-0 mx-0.5"
                      aria-hidden
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => scrollToSection(entry.id)}
                    title={entry.label}
                    className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold tracking-wide whitespace-nowrap transition-colors ${
                      active
                        ? "text-[var(--ci-accent)]"
                        : "text-[var(--ci-text-muted)] hover:text-[var(--ci-text)]"
                    }`}
                  >
                    {entry.label}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        </div>
        <div
          className="h-0.5 w-full origin-left transition-transform"
          style={{
            background: `linear-gradient(90deg, var(--ci-accent), transparent)`,
          }}
        />
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto ci-guideline-print scroll-smooth"
      >
        {/* Full-bleed hero */}
        <section
          id="brand-book-hero"
          className="relative min-h-[min(72vh,720px)] flex flex-col justify-end overflow-hidden border-b border-[var(--ci-border)]"
        >
          {heroAsset?.public_url || heroAsset?.storage_path ? (
            <div className="absolute inset-0">
              <img
                src={heroAsset.public_url || heroAsset.storage_path || ""}
                alt=""
                className="h-full w-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, color-mix(in srgb, var(--ci-bg) 92%, transparent) 0%, color-mix(in srgb, var(--ci-bg) 35%, transparent) 45%, transparent 100%)",
                }}
              />
            </div>
          ) : (
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 20% 20%, var(--ci-accent), transparent 45%),
                  radial-gradient(circle at 80% 60%, var(--ci-text), transparent 40%)
                `,
              }}
            />
          )}

          <div className="relative z-10 px-6 lg:px-12 pb-16 pt-28 max-w-[1800px] mx-auto w-full">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.22em] mb-5 text-[var(--ci-accent)]"
              style={{ fontFamily: "var(--ci-font-tertiary)" }}
            >
              Brand guidelines
            </p>
            <h1
              className="text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight leading-[0.95] max-w-4xl"
              style={{ fontFamily: "var(--ci-font)" }}
            >
              {brandName || "Brand"}
            </h1>
            <p
              className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-[var(--ci-text-muted)]"
              style={{ fontFamily: "var(--ci-font-secondary)" }}
            >
              Identity, voice, and visual system — presentation view.
            </p>
          </div>
        </section>

        <main>
          {visible.length === 0 ? (
            <div className="px-8 py-24 text-center text-sm text-[var(--ci-text-muted)]">
              No visible sections yet. Switch to Edit to add sub-modules or import from Figma.
            </div>
          ) : (
            visible.map((sec) => (
              <SectionRenderer
                key={sec.id || sec.section_type}
                section={sec}
                assets={assets.filter(
                  (a) => a.section_id === sec.id || a.kind === sec.section_type
                )}
                allAssets={assets}
                allSections={visible}
                isAdmin={false}
                viewMode="presentation"
                hidePromptActions
              />
            ))
          )}
        </main>

        <footer className="px-6 lg:px-12 py-14 border-t border-[var(--ci-border)] no-print">
          <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4">
            <p
              className="text-xs text-[var(--ci-text-muted)]"
              style={{ fontFamily: "var(--ci-font-secondary)" }}
            >
              {brandName || "Brand"} · Brand book
            </p>
            <button
              type="button"
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              className="text-xs font-semibold text-[var(--ci-accent)] hover:opacity-70 transition-opacity"
            >
              Back to top
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
