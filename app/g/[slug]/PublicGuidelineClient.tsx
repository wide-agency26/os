"use client";

import React, { useState, useEffect } from "react";
import { SectionRenderer } from "@/components/ci-builder/sections";
import { CITheme, CISection, CIAsset } from "@/lib/ci-builder/types";
import { Sparkles, Menu, X, ChevronRight, Layers, ArrowLeft } from "lucide-react";
import { generateFullBrandPrompt } from "@/lib/ci-builder/prompts";
import { triggerToast, ToastContainer } from "@/components/ci-builder/Toast";
import Link from "next/link";

interface PublicGuidelineClientProps {
  brandName: string;
  theme: CITheme;
  sections: Partial<CISection>[];
  assets: Partial<CIAsset>[];
}

export function PublicGuidelineClient({
  brandName,
  theme,
  sections,
  assets
}: PublicGuidelineClientProps) {
  const visibleSections = sections.filter((s) => s.is_visible !== false);
  const [activeSectionId, setActiveSectionId] = useState<string>(visibleSections[0]?.section_type || "");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // IntersectionObserver for scroll-spy active section highlighting
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
    "--ci-font": theme?.fontFamily || "Inter, sans-serif"
  } as React.CSSProperties;

  const activeSection = visibleSections.find((s) => s.section_type === activeSectionId);
  const activeLabel = activeSection?.eyebrow_label || activeSection?.headline || activeSection?.section_type;

  const handleCopyBrandPrompt = () => {
    const promptText = generateFullBrandPrompt(brandName, visibleSections);
    navigator.clipboard.writeText(promptText);
    triggerToast("Brand system prompt copied");
  };

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row text-[var(--ci-text)] bg-[var(--ci-bg)] font-[var(--ci-font)]"
      style={styleVariables}
    >
      <ToastContainer />

      {/* Desktop Sticky Sidebar Nav */}
      <aside className="w-64 fixed top-0 left-0 h-screen border-r border-[var(--ci-border,#eaeaea)] bg-[var(--ci-bg,#fff)] p-6 flex flex-col justify-between overflow-y-auto hidden md:flex z-40">
        <div>
          {/* Header & Brand Title */}
          <div className="mb-8 border-b border-[var(--ci-border,#eaeaea)] pb-6">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-5 h-5 text-[var(--ci-accent,#0066ff)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Brand Guideline</span>
            </div>
            <h1 className="font-extrabold text-xl tracking-tight text-[var(--ci-text,#111)]">
              {brandName || "Brand System"}
            </h1>
          </div>

          {/* Section Navigation List */}
          <nav className="space-y-1">
            {visibleSections.map((sec) => {
              const isActive = activeSectionId === sec.section_type;
              const label = sec.eyebrow_label || sec.headline || sec.section_type?.replace(/_/g, " ");

              return (
                <a
                  key={sec.id || sec.section_type}
                  href={`#${sec.section_type}`}
                  className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                    isActive
                      ? "bg-[var(--ci-accent,#0066ff)] text-white shadow-sm"
                      : "text-gray-600 hover:text-black hover:bg-gray-100/60"
                  }`}
                >
                  <span className="truncate">{label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-80" />}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Global Copy Brand Prompt Button (Sidebar Bottom) */}
        <div className="pt-6 border-t border-[var(--ci-border,#eaeaea)]">
          <button
            onClick={handleCopyBrandPrompt}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.98]"
            title="Copy full brand rules as AI system prompt"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Copy Brand Prompt</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Navigation Bar */}
      <header className="md:hidden sticky top-0 bg-white/90 backdrop-blur-md border-b border-[var(--ci-border,#eaeaea)] px-4 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="p-2 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-bold text-sm truncate max-w-[160px]">{brandName}</span>
        </div>

        <button
          onClick={handleCopyBrandPrompt}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Copy Prompt</span>
        </button>
      </header>

      {/* Mobile Nav Drawer Overlay */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileNavOpen(false)}>
          <div
            className="w-72 bg-white h-full p-6 space-y-4 overflow-y-auto animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-4">
              <span className="font-bold text-sm uppercase tracking-wider">{brandName}</span>
              <button onClick={() => setMobileNavOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <nav className="space-y-1">
              {visibleSections.map((sec) => {
                const label = sec.eyebrow_label || sec.headline || sec.section_type?.replace(/_/g, " ");
                return (
                  <a
                    key={sec.id || sec.section_type}
                    href={`#${sec.section_type}`}
                    onClick={() => setMobileNavOpen(false)}
                    className="block px-3 py-2.5 rounded-lg text-xs font-semibold uppercase text-gray-700 hover:bg-gray-100"
                  >
                    {label}
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 md:ml-64 w-full min-h-screen flex flex-col">
        {/* Desktop Sticky Top Header Breadcrumb */}
        <div className="hidden md:flex sticky top-0 bg-[var(--ci-bg,#fff)]/80 backdrop-blur-md border-b border-[var(--ci-border,#eaeaea)] px-8 py-4 items-center justify-between z-30">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <span>{brandName}</span>
            <span>/</span>
            <span className="text-[var(--ci-accent,#0066ff)] uppercase font-bold tracking-wider">
              {activeLabel || "Brand Guidelines"}
            </span>
          </div>

          <button
            onClick={handleCopyBrandPrompt}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--ci-accent,#0066ff)] hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Copy Brand Prompt</span>
          </button>
        </div>

        {/* Rendered Sections List */}
        <main className="flex-1 pb-24">
          {visibleSections.map((sec) => {
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
          })}
        </main>

        {/* Public Footer */}
        <footer className="py-12 border-t border-[var(--ci-border,#eaeaea)] text-center text-xs text-gray-400">
          <p>Powered by WIDE Guidelines</p>
        </footer>
      </div>
    </div>
  );
}
