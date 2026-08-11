"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SectionRenderer } from "@/components/ci-builder/sections";
import { BrandBookPresentation } from "@/components/ci-builder/BrandBookPresentation";
import { CITheme, CISection, CIAsset, cssFontStack } from "@/lib/ci-builder/types";
import { getSubModule, CI_MODULES } from "@/lib/ci-builder/modules-catalog";
import {
  Sparkles,
  Menu,
  X,
  ChevronRight,
  Layers,
  ArrowLeft,
  Printer,
} from "lucide-react";
import { generateFullBrandPrompt } from "@/lib/ci-builder/prompts";
import { triggerToast, ToastContainer } from "@/components/ci-builder/Toast";

interface PublicGuidelineClientProps {
  brandName: string;
  theme: CITheme;
  sections: Partial<CISection>[];
  assets: Partial<CIAsset>[];
  /** portal = sits inside Client Portal shell; standalone = public /g/ page */
  mode?: "portal" | "standalone";
}

function sectionAnchor(sec: Partial<CISection>) {
  return sec.id || sec.section_type || "";
}

export function PublicGuidelineClient({
  brandName,
  theme,
  sections,
  assets,
  mode = "standalone",
}: PublicGuidelineClientProps) {
  const embedded = mode === "portal";
  const visibleSections = sections.filter((s) => s.is_visible !== false);
  const [activeSectionId, setActiveSectionId] = useState<string>(
    sectionAnchor(visibleSections[0] || {})
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"presentation" | "elements">(
    "presentation"
  );

  useEffect(() => {
    if (viewMode !== "elements" || visibleSections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0.1 }
    );

    visibleSections.forEach((sec) => {
      const id = sectionAnchor(sec);
      if (id) {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [visibleSections, viewMode]);

  const styleVariables = {
    "--ci-bg": theme?.backgroundColor || "#ffffff",
    "--ci-text": theme?.textColor || "#111827",
    "--ci-accent": theme?.accentColors?.[0] || "#111111",
    "--ci-border": "#eaeaea",
    "--ci-font": cssFontStack(
      theme?.primaryFont || theme?.fontFamily,
      theme?.primaryFontFallback
    ),
    "--ci-font-secondary": cssFontStack(
      theme?.secondaryFont || theme?.primaryFont || theme?.fontFamily,
      theme?.secondaryFontFallback || theme?.primaryFontFallback
    ),
    "--ci-font-tertiary": cssFontStack(
      theme?.tertiaryFont || theme?.secondaryFont,
      theme?.tertiaryFontFallback
    ),
  } as React.CSSProperties;

  const activeSection = visibleSections.find(
    (s) => sectionAnchor(s) === activeSectionId
  );
  const activeLabel =
    activeSection?.eyebrow_label ||
    activeSection?.headline ||
    activeSection?.section_type;

  const handleCopyBrandPrompt = () => {
    const promptText = generateFullBrandPrompt(brandName, visibleSections);
    navigator.clipboard.writeText(promptText);
    triggerToast("Brand system prompt copied");
  };

  const handleSavePdf = () => {
    window.print();
  };

  const modeToggle = (
    <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white text-xs font-semibold">
      <button
        type="button"
        onClick={() => setViewMode("presentation")}
        className={`px-3 py-1.5 rounded-md ${
          viewMode === "presentation"
            ? "bg-gray-900 text-white"
            : "text-gray-600 hover:bg-gray-50"
        }`}
      >
        Brand book
      </button>
      <button
        type="button"
        onClick={() => setViewMode("elements")}
        className={`px-3 py-1.5 rounded-md ${
          viewMode === "elements"
            ? "bg-gray-900 text-white"
            : "text-gray-600 hover:bg-gray-50"
        }`}
      >
        Elements
      </button>
    </div>
  );

  const sectionNav = (
    <nav className="space-y-3">
      {CI_MODULES.map((mod) => {
        const modSecs = visibleSections.filter(
          (sec) => getSubModule(sec.section_type)?.moduleId === mod.id
        );
        if (modSecs.length === 0) return null;
        return (
          <div key={mod.id}>
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {String(mod.index).padStart(2, "0")} · {mod.label}
            </div>
            <div className="space-y-0.5">
              {modSecs.map((sec) => {
                const id = sectionAnchor(sec);
                const isActive = activeSectionId === id;
                const def = getSubModule(sec.section_type);
                const label =
                  sec.eyebrow_label ||
                  sec.headline ||
                  def?.defaultHeadline ||
                  sec.section_type?.replace(/_/g, " ");

                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={() => setMobileNavOpen(false)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                      isActive
                        ? "bg-blue-50 text-blue-800 border border-blue-200 shadow-sm"
                        : "text-gray-600 border border-transparent hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <span className="truncate normal-case">{label}</span>
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
      {visibleSections.some((s) => !getSubModule(s.section_type)) && (
        <div className="space-y-0.5">
          {visibleSections
            .filter((s) => !getSubModule(s.section_type))
            .map((sec) => {
              const id = sectionAnchor(sec);
              const isActive = activeSectionId === id;
              const label =
                sec.eyebrow_label ||
                sec.headline ||
                sec.section_type?.replace(/_/g, " ");
              return (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={() => setMobileNavOpen(false)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-800 border border-blue-200 shadow-sm"
                      : "text-gray-600 border border-transparent hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <span className="truncate normal-case">{label}</span>
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                  )}
                </a>
              );
            })}
        </div>
      )}
    </nav>
  );

  if (viewMode === "presentation") {
    return (
      <div
        className={
          embedded ? "h-full min-h-0 flex-1 overflow-hidden" : "min-h-screen"
        }
      >
        <ToastContainer />
        <BrandBookPresentation
          brandName={brandName}
          theme={theme}
          sections={visibleSections}
          assets={assets}
          className={embedded ? "h-full" : "min-h-screen"}
          toolbar={
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-8 py-3 border-b border-black/5 bg-white/95 backdrop-blur-sm no-print">
              <div className="flex items-center gap-3 min-w-0">
                {embedded && (
                  <Link
                    href="/app/client-guidelines"
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-blue-600 shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    All guidelines
                  </Link>
                )}
                {modeToggle}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSavePdf}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white"
                >
                  <Printer size={14} /> Save as PDF
                </button>
                <button
                  type="button"
                  onClick={handleCopyBrandPrompt}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-[var(--ci-accent,#111)] hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-sm transition-all shrink-0"
                  style={{ backgroundColor: theme?.accentColors?.[0] || "#111" }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Copy Brand Prompt</span>
                </button>
              </div>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col md:flex-row text-[var(--ci-text)] bg-[var(--ci-bg)] font-[var(--ci-font)] ${
        embedded ? "h-full min-h-0 flex-1 overflow-hidden" : "min-h-screen"
      }`}
      style={styleVariables}
    >
      <ToastContainer />

      <aside
        className={`border-r border-gray-200 flex-col justify-between overflow-y-auto hidden md:flex shrink-0 z-20 no-print ${
          embedded
            ? "w-60 relative h-full bg-gray-50/90 p-4"
            : "w-64 fixed top-0 left-0 h-screen z-40 bg-[var(--ci-bg,#fff)] p-5"
        }`}
      >
        <div>
          <div className="mb-5 border-b border-gray-200 pb-4">
            {embedded && (
              <Link
                href="/app/client-guidelines"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-blue-600 mb-3"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                All guidelines
              </Link>
            )}
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Elements
              </span>
            </div>
            <h1 className="font-bold text-base tracking-tight text-gray-900 leading-snug">
              {brandName || "Brand System"}
            </h1>
          </div>
          {sectionNav}
        </div>

        <div className="pt-4 border-t border-gray-200 mt-6 space-y-2">
          <button
            type="button"
            onClick={handleSavePdf}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 rounded-xl font-semibold text-xs shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Save as PDF</span>
          </button>
          <button
            type="button"
            onClick={handleCopyBrandPrompt}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-sm transition-all active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Copy Brand Prompt</span>
          </button>
        </div>
      </aside>

      <header className="md:hidden sticky top-0 bg-white/90 backdrop-blur-md border-b border-[var(--ci-border,#eaeaea)] px-4 py-3 flex items-center justify-between z-50 shrink-0 no-print">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="p-2 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-bold text-sm truncate">{brandName}</span>
        </div>
        {modeToggle}
      </header>

      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 no-print"
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            className="w-72 bg-white h-full p-6 space-y-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-4">
              <span className="font-bold text-sm uppercase tracking-wider">
                {brandName}
              </span>
              <button type="button" onClick={() => setMobileNavOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {sectionNav}
          </div>
        </div>
      )}

      <div
        className={`flex-1 w-full min-w-0 flex flex-col ${
          embedded ? "overflow-y-auto h-full" : "min-h-screen md:ml-64"
        }`}
      >
        <div className="hidden md:flex sticky top-0 bg-[var(--ci-bg,#fff)]/80 backdrop-blur-md border-b border-[var(--ci-border,#eaeaea)] px-6 lg:px-8 py-3.5 items-center justify-between z-10 no-print">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium min-w-0">
            <span className="truncate">{brandName}</span>
            <span>/</span>
            <span className="text-[var(--ci-accent,#111)] uppercase font-bold tracking-wider truncate">
              {activeLabel || "Elements"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {modeToggle}
            <button
              type="button"
              onClick={handleSavePdf}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white"
            >
              <Printer size={14} /> Save as PDF
            </button>
          </div>
        </div>

        <main className="flex-1 pb-20 ci-guideline-print">
          {visibleSections.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              This published guideline has no visible sections yet.
            </div>
          ) : (
            visibleSections.map((sec) => {
              const secAssets = assets.filter(
                (a) => a.section_id === sec.id || a.kind === sec.section_type
              );
              return (
                <SectionRenderer
                  key={sec.id || sec.section_type}
                  section={sec}
                  assets={secAssets}
                  allAssets={assets}
                  allSections={visibleSections}
                  isAdmin={false}
                  viewMode="elements"
                />
              );
            })
          )}
        </main>

        <footer className="py-8 border-t border-[var(--ci-border,#eaeaea)] text-center text-xs text-gray-400 shrink-0 no-print">
          <p>Powered by WIDE Guidelines</p>
        </footer>
      </div>
    </div>
  );
}
