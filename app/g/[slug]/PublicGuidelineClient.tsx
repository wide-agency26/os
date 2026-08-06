"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SectionRenderer } from "@/components/ci-builder/sections";
import { CITheme, CISection, CIAsset } from "@/lib/ci-builder/types";
import {
  Sparkles,
  Menu,
  X,
  ChevronRight,
  Layers,
  ArrowLeft,
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
    visibleSections[0]?.section_type || ""
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (visibleSections.length === 0) return;

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
      if (sec.section_type) {
        const el = document.getElementById(sec.section_type);
        if (el) observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [visibleSections]);

  const styleVariables = {
    "--ci-bg": theme?.backgroundColor || "#ffffff",
    "--ci-text": theme?.textColor || "#111827",
    "--ci-accent": theme?.accentColors?.[0] || "#0066FF",
    "--ci-border": "#eaeaea",
    "--ci-font": theme?.fontFamily || "Inter, sans-serif",
  } as React.CSSProperties;

  const activeSection = visibleSections.find((s) => s.section_type === activeSectionId);
  const activeLabel =
    activeSection?.eyebrow_label || activeSection?.headline || activeSection?.section_type;

  const handleCopyBrandPrompt = () => {
    const promptText = generateFullBrandPrompt(brandName, visibleSections);
    navigator.clipboard.writeText(promptText);
    triggerToast("Brand system prompt copied");
  };

  const sectionNav = (
    <nav className="space-y-1">
      {visibleSections.map((sec) => {
        const isActive = activeSectionId === sec.section_type;
        const label =
          sec.eyebrow_label || sec.headline || sec.section_type?.replace(/_/g, " ");

        return (
          <a
            key={sec.id || sec.section_type}
            href={`#${sec.section_type}`}
            onClick={() => setMobileNavOpen(false)}
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              isActive
                ? "bg-blue-50 text-blue-800 border border-blue-200 shadow-sm"
                : "text-gray-600 border border-transparent hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="truncate normal-case">{label}</span>
            {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-blue-600" />}
          </a>
        );
      })}
    </nav>
  );

  return (
    <div
      className={`flex flex-col md:flex-row text-[var(--ci-text)] bg-[var(--ci-bg)] font-[var(--ci-font)] ${
        embedded ? "h-full min-h-0 flex-1 overflow-hidden" : "min-h-screen"
      }`}
      style={styleVariables}
    >
      <ToastContainer />

      {/* Section nav — sticky within portal shell, fixed only on public standalone */}
      <aside
        className={`border-r border-gray-200 flex-col justify-between overflow-y-auto hidden md:flex shrink-0 z-20 ${
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
                Sections
              </span>
            </div>
            <h1 className="font-bold text-base tracking-tight text-gray-900 leading-snug">
              {brandName || "Brand System"}
            </h1>
          </div>
          {sectionNav}
        </div>

        <div className="pt-4 border-t border-gray-200 mt-6">
          <button
            type="button"
            onClick={handleCopyBrandPrompt}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-sm transition-all active:scale-[0.98]"
            title="Copy full brand rules as AI system prompt"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Copy Brand Prompt</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 bg-white/90 backdrop-blur-md border-b border-[var(--ci-border,#eaeaea)] px-4 py-3 flex items-center justify-between z-50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="p-2 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          {embedded && (
            <Link
              href="/app/client-guidelines"
              className="p-2 text-gray-500 hover:text-blue-600"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <span className="font-bold text-sm truncate">{brandName}</span>
        </div>
        <button
          type="button"
          onClick={handleCopyBrandPrompt}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Copy</span>
        </button>
      </header>

      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            className="w-72 bg-white h-full p-6 space-y-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-4">
              <span className="font-bold text-sm uppercase tracking-wider">{brandName}</span>
              <button type="button" onClick={() => setMobileNavOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {sectionNav}
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        className={`flex-1 w-full min-w-0 flex flex-col ${
          embedded ? "overflow-y-auto h-full" : "min-h-screen md:ml-64"
        }`}
      >
        <div className="hidden md:flex sticky top-0 bg-[var(--ci-bg,#fff)]/80 backdrop-blur-md border-b border-[var(--ci-border,#eaeaea)] px-6 lg:px-8 py-3.5 items-center justify-between z-10">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium min-w-0">
            <span className="truncate">{brandName}</span>
            <span>/</span>
            <span className="text-[var(--ci-accent,#0066ff)] uppercase font-bold tracking-wider truncate">
              {activeLabel || "Brand Guidelines"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyBrandPrompt}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[var(--ci-accent,#0066ff)] hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-sm transition-all shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Copy Brand Prompt</span>
          </button>
        </div>

        <main className="flex-1 pb-20">
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
                />
              );
            })
          )}
        </main>

        <footer className="py-8 border-t border-[var(--ci-border,#eaeaea)] text-center text-xs text-gray-400 shrink-0">
          <p>Powered by WIDE Guidelines</p>
        </footer>
      </div>
    </div>
  );
}
