"use client";

import React, { useMemo, useState } from "react";
import type { GuidelineViewModel } from "@/lib/ci-builder/view-model";
import { CiFontLoader } from "@/components/ci-builder/CiFontLoader";
import { brandMarkUrl } from "@/lib/ci-builder/brand-mark";
import {
  ContactFooter,
  ModuleViewBody,
  clientViewStyle,
  visibleCanvasModules,
} from "@/components/ci-builder/canvas/view/ViewContent";
import { assetUrl } from "@/components/ci-builder/canvas/useCiGuideline";
import { resolveCanvasPage } from "@/lib/ci-builder/canvas/modules";
import "@/components/ci-builder/canvas/CiCanvas.css";

export function MultipageLayout({
  viewModel,
  slug,
  initialModuleId,
  toolbar,
}: {
  viewModel: GuidelineViewModel;
  viewMode?: string;
  mode?: "portal" | "standalone";
  slug?: string;
  initialModuleId?: string | null;
  toolbar?: React.ReactNode;
}) {
  const modules = visibleCanvasModules(viewModel);
  const settings = viewModel.theme.templateSettings?.multipage || {};
  const [page, setPage] = useState<string>(() => resolveCanvasPage(initialModuleId));
  const mark = brandMarkUrl(viewModel.sections, viewModel.assets, { forBackground: "light" });
  const headerAsset = settings.headerImageAssetId
    ? viewModel.assets.find((a) => a.id === settings.headerImageAssetId)
    : null;
  const headerUrl = headerAsset ? assetUrl(headerAsset) : "";
  const radius =
    settings.cornerRadius === "none" ? "0px" : settings.cornerRadius === "round" ? "24px" : "12px";
  const spacing =
    settings.sectionSpacing === "compact" ? "24px" : settings.sectionSpacing === "airy" ? "64px" : "40px";
  const accents = viewModel.proportionBars.map((b) => b.hex);
  const tileMode = settings.landingTileColorMode || "cycle";

  const cssVars = useMemo(
    () =>
      ({
        ...clientViewStyle(viewModel, "#eef1f0"),
        "--mp-radius": radius,
        "--mp-gap": spacing,
      }) as React.CSSProperties,
    [viewModel, radius, spacing]
  );

  const go = (key: string) => {
    setPage(key);
    if (typeof window !== "undefined" && slug) {
      window.history.replaceState(null, "", key === "landing" ? `/g/${slug}` : `/g/${slug}?module=${key}`);
    }
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeIndex = modules.findIndex((m) => m.key === page);
  const active = modules[activeIndex];
  const next = settings.showNextModuleCard !== false && activeIndex >= 0 ? modules[activeIndex + 1] : null;

  return (
    <div className="ci-canvas ci-view-root" style={cssVars}>
      <CiFontLoader theme={viewModel.theme} assets={viewModel.assets} sections={viewModel.sections} />
      <div
        id="mp-client-nav"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 40px",
          background: "var(--brand-bg-canvas, #eef1f0)",
          borderBottom: "1px solid var(--brand-border-subtle, #d9dcda)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => go("landing")}>
          {mark ? <div style={{ width: 24, height: 24, background: `url(${mark}) center/contain no-repeat` }} /> : null}
          <span className="mono brand-name-text" style={{ fontSize: 13, fontWeight: 600 }}>
            {viewModel.brandName}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--brand-text-muted)" }}>
            Brand Guidelines
          </span>
          {toolbar}
        </div>
      </div>

      {page === "landing" ? (
        <div className="screen mp-active" data-tab="view" data-mp="landing" style={{ display: "block" }}>
          <div className="mp-page">
            <div
              className={`mp-landing-hero${headerUrl ? " has-image" : ""}`}
              style={headerUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url(${headerUrl})` } : undefined}
            >
              <span className="mp-wordmark brand-name-text">{viewModel.brandName}</span>
            </div>
            <div className="mp-col">
              <p className="mp-landing-intro">
                Welcome to the <span className="brand-name-text">{viewModel.brandName}</span> brand guidelines. They outline the visual and verbal identity of the brand — use your best judgement and reference this as a starting point, not a strict rulebook.
              </p>
              <div className="mp-grid">
                {modules.map((m, i) => (
                  <div
                    key={m.key}
                    className="mp-card"
                    onClick={() => go(m.key)}
                    style={{
                      cursor: "pointer",
                      background:
                        tileMode === "cycle" && accents.length
                          ? accents[i % accents.length]
                          : "var(--brand-accent-primary)",
                      borderRadius: radius,
                    }}
                  >
                    <span className="mp-card-num">{m.num}</span>
                    <span className="mp-card-label">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <ContactFooter vm={viewModel} />
          </div>
        </div>
      ) : active ? (
        <div className="screen mp-active" data-tab="view" data-mp={active.key} style={{ display: "block" }}>
          <div className="mp-page">
            <div className="mp-col">
              <span className="mp-back-link" onClick={() => go("landing")}>
                ← All modules
              </span>
            </div>
            <div
              className={`mp-module-hero${headerUrl ? " has-image" : ""}`}
              style={headerUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url(${headerUrl})` } : undefined}
            >
              <span className="mp-title">{active.label}.</span>
            </div>
            <div className="mp-col" style={{ display: "flex", flexDirection: "column", gap: spacing }}>
              <ModuleViewBody vm={viewModel} moduleKey={active.key} variant="multipage" />
              {next ? (
                <div className="mp-next" onClick={() => go(next.key)}>
                  <div>
                    <span className="mp-next-label">Next</span>
                    <span className="mp-next-title">{next.label}</span>
                  </div>
                  <span className="mp-next-arrow">→</span>
                </div>
              ) : null}
            </div>
            <ContactFooter vm={viewModel} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
