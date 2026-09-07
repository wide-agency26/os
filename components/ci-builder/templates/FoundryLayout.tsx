"use client";

import React, { useMemo, useState } from "react";
import type { GuidelineViewModel } from "@/lib/ci-builder/view-model";
import { CiFontLoader } from "@/components/ci-builder/CiFontLoader";
import { brandMarkUrl } from "@/lib/ci-builder/brand-mark";
import {
  ContactFooter,
  ModuleViewBody,
  clientViewStyle,
  firstPhotoUrl,
  visibleCanvasModules,
} from "@/components/ci-builder/canvas/view/ViewContent";
import { resolveCanvasPage } from "@/lib/ci-builder/canvas/modules";
import "@/components/ci-builder/canvas/CiCanvas.css";

export function FoundryLayout({
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
  const [page, setPage] = useState<string>(() => resolveCanvasPage(initialModuleId));
  const mark = brandMarkUrl(viewModel.sections, viewModel.assets, { forBackground: "light" });
  const hero = firstPhotoUrl(viewModel);
  const cssVars = useMemo(() => clientViewStyle(viewModel, "#f2f1ee"), [viewModel]);

  const go = (key: string) => {
    setPage(key);
    if (typeof window !== "undefined" && slug) {
      window.history.replaceState(null, "", key === "landing" ? `/g/${slug}` : `/g/${slug}?module=${key}`);
    }
  };

  const active = modules.find((m) => m.key === page);

  return (
    <div className="ci-canvas ci-view-root" style={cssVars}>
      <CiFontLoader theme={viewModel.theme} assets={viewModel.assets} sections={viewModel.sections} />
      <div
        id="fd-client-nav"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 40px",
          background: "var(--brand-bg-canvas, #f2f1ee)",
          borderBottom: "1px solid var(--brand-border-subtle, #e2e1de)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => go("landing")}>
          {mark ? <div style={{ width: 24, height: 24, background: `url(${mark}) center/contain no-repeat` }} /> : null}
          <span className="mono brand-name-text" style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".05em" }}>
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
        <div className="screen fd-active" data-tab="view" data-fd="landing" style={{ display: "block" }}>
          <div className="fd-page">
            <div id="fd-landing-hero" className="fd-landing-hero" style={hero ? { backgroundImage: `url(${hero})` } : undefined}>
              <span className="fd-wordmark brand-name-text">{viewModel.brandName}</span>
            </div>
            <div className="fd-col">
              <p className="fd-landing-intro">
                Welcome to the <span className="brand-name-text">{viewModel.brandName}</span> brand guidelines. They outline the visual and verbal identity of the brand — use your best judgement and reference this as a starting point, not a strict rulebook.
              </p>
              <div className="fd-grid">
                {modules.map((m) => (
                  <div key={m.key} className="fd-card" onClick={() => go(m.key)} style={{ cursor: "pointer" }}>
                    <span className="fd-card-num">{m.num}</span>
                    <span className="fd-card-label">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="fd-footer">
              <div className="fd-col">
                <span className="fd-footer-label">Questions about this brand kit</span>
                <span style={{ fontSize: 16 }}>
                  {[viewModel.pointOfContact, viewModel.contactEmail].filter(Boolean).join(" — ") || viewModel.teamName}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : active ? (
        <div className="screen fd-active" data-tab="view" data-fd={active.key} style={{ display: "block" }}>
          <div className="fd-page">
            <div className="fd-col">
              <span className="fd-back-link" onClick={() => go("landing")}>
                ← All modules
              </span>
            </div>
            <div className="fd-module-hero">
              <span className="fd-title">{active.label}.</span>
            </div>
            <div className="fd-col">
              <ModuleViewBody vm={viewModel} moduleKey={active.key} variant="foundry" />
            </div>
            <ContactFooter vm={viewModel} compact />
          </div>
        </div>
      ) : null}
    </div>
  );
}
