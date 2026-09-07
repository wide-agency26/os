"use client";

import React from "react";
import { CANVAS_MODULES } from "@/lib/ci-builder/canvas/modules";
import { brandMarkUrl } from "@/lib/ci-builder/brand-mark";
import { EyeIcon, GearIcon, MoonIcon, SunIcon } from "./icons";
import { resolveTemplate, useCanvas } from "./CiCanvasContext";
import { SettingsAndTemplateDrawers } from "./CiCanvasDrawers";
import { BackToProjectLink } from "./ui";

export function CiCanvasShell({ children }: { children: React.ReactNode }) {
  const c = useCanvas();
  const template = resolveTemplate(c.theme);
  // Dark chrome → logo for dark backgrounds; light chrome → logo for light backgrounds.
  const mark = brandMarkUrl(c.sections, c.assets, {
    forBackground: c.appearance === "light" ? "light" : "dark",
  });
  const viewFull = c.tab === "view";

  return (
    <div
      className={`ci-canvas${c.appearance === "light" ? " light-mode" : ""}${c.editMode ? " edit-mode" : ""}${viewFull ? " view-fullpage" : ""}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        minHeight: "100dvh",
        background: "var(--tool-bg-canvas)",
      }}
    >
      <div
        id="app-sidebar"
        style={{
          width: 280,
          flex: "none",
          background: "var(--tool-surface-input)",
          borderRight: ".5px solid var(--tool-border-input)",
          display: viewFull ? "none" : "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ padding: "12px 16px 0" }}>
          <BackToProjectLink projectId={c.projectId} />
        </div>
        <div style={{ padding: "12px 16px 20px", display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "var(--radius-xs)",
              background: mark ? `url(${mark}) center/contain no-repeat` : "#e44bbb",
              flex: "none",
            }}
          />
        </div>
        <div style={{ padding: "12px 16px 8px", display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontFamily: "var(--font-primary)",
              fontWeight: 600,
              fontSize: 40,
              lineHeight: "40px",
              letterSpacing: "-1px",
              color: "var(--tool-text-muted)",
            }}
          >
            <span className="brand-name-text">{c.brandName || "Brand"}</span>
            <br />
            Brand Kit
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "24px 8px", justifyContent: "center" }}>
          <div className={`tabbtn${c.tab === "edit" ? " active" : ""}`} onClick={() => c.setTab("edit")}>
            Edit
          </div>
          <div className={`tabbtn${c.tab === "view" ? " active" : ""}`} onClick={() => c.setTab("view")}>
            View
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "8px 16px" }}>
          <div
            style={{
              fontFamily: "var(--font-primary)",
              fontWeight: 500,
              fontSize: 20,
              lineHeight: "28px",
              color: "var(--tool-text-primary)",
              padding: 8,
            }}
          >
            MODULES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CANVAS_MODULES.map((m) => {
              const hidden = c.hiddenKeys.has(m.key);
              const active = c.tab === "edit" && c.activeKey === m.key;
              return (
                <div
                  key={m.key}
                  className={`navitem${active ? " active" : ""}${hidden ? " module-hidden" : ""}`}
                  onClick={() => {
                    c.setTab("edit");
                    c.setActiveKey(m.key);
                  }}
                  style={{
                    padding: 8,
                    borderRadius: "var(--radius-m)",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    font: "14px var(--font-primary)",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    color: "var(--tool-text-muted)",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center", overflow: "hidden" }}>
                    <span className="navitem-num">{m.num}</span>
                    <span>{m.label}</span>
                  </div>
                  <span
                    className="module-vis-btn"
                    title={hidden ? "Show in View" : "Hide from View"}
                    onClick={(e) => {
                      e.stopPropagation();
                      c.toggleHidden(m.key);
                    }}
                    style={{
                      width: 20,
                      height: 20,
                      flex: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.6,
                      cursor: "pointer",
                    }}
                  >
                    <EyeIcon />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div
          id="footer-edit"
          style={{
            padding: "4px 14px 8px",
            borderTop: ".5px solid var(--tool-border-input)",
            fontSize: 11,
            color: "var(--tool-text-muted)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 0",
              cursor: "pointer",
            }}
            onClick={() => c.openDrawer({ kind: "settings" })}
          >
            <span>Settings</span>
            <span className="icon-btn" style={{ display: "flex" }} title="Brand kit settings">
              <GearIcon />
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
            <span>Appearance</span>
            <span
              className="icon-btn"
              style={{ display: "flex" }}
              title={c.appearance === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => c.setAppearance(c.appearance === "dark" ? "light" : "dark")}
            >
              {c.appearance === "dark" ? <SunIcon /> : <MoonIcon />}
            </span>
          </div>
          <div style={{ padding: "6px 0", fontSize: 10, opacity: 0.7 }}>
            {c.saveStatus === "saving"
              ? "Saving…"
              : c.saveStatus === "error"
                ? c.saveErrorMsg || "Save error"
                : "Saved"}
          </div>
        </div>
      </div>

      <div id="canvas-col" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          id="view-header-stack"
          style={{ flexDirection: "column", position: "sticky", top: 0, zIndex: 20, display: viewFull ? "flex" : "none" }}
        >
          <div
            id="view-toolbar"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "10px 24px",
              background: "var(--tool-surface-input)",
              borderBottom: ".5px solid var(--tool-border-input)",
            }}
          >
            <BackToProjectLink projectId={c.projectId} />
            <span
              style={{
                fontFamily: "var(--font-primary)",
                fontWeight: 600,
                fontSize: 12,
                color: "var(--tool-text-muted)",
                textTransform: "uppercase",
                letterSpacing: ".75px",
                flex: 1,
              }}
            >
              CI Canvas · Builder
            </span>
            <select
              className="field-select"
              style={{ width: "auto", padding: "6px 28px 6px 10px", fontSize: 11 }}
              value={template}
              onChange={(e) =>
                void c.updateTheme({
                  clientTemplate: e.target.value as "greenpoint" | "foundry" | "multipage",
                })
              }
            >
              <option value="greenpoint">Template: Greenpoint</option>
              <option value="foundry">Template: Foundry</option>
              <option value="multipage">Template: Multipage</option>
            </select>
            <span
              className="icon-btn"
              style={{ display: "flex" }}
              title="Template settings"
              onClick={() => c.openDrawer({ kind: "template" })}
            >
              <GearIcon />
            </span>
            <button
              type="button"
              className="tabbtn"
              style={{ cursor: "pointer", border: "none", background: "transparent" }}
              title={
                c.guideline?.slug
                  ? "Open public guideline in a new tab (full width, no OS sidebar)"
                  : "Publish the guideline first to get a public /g/ link"
              }
              onClick={() => {
                const slug = String(c.guideline?.slug || "").trim();
                if (!slug) {
                  c.openDrawer({ kind: "settings" });
                  return;
                }
                const url = `${window.location.origin}/g/${encodeURIComponent(slug)}`;
                window.open(url, "_blank", "noopener,noreferrer");
              }}
            >
              Public link
            </button>
            <div style={{ display: "flex", gap: 6 }}>
              <div className="tabbtn" onClick={() => c.setTab("edit")}>
                Edit
              </div>
              <div className="tabbtn active">View</div>
            </div>
          </div>
        </div>
        <div
          id="canvas-scroll"
          style={{
            flex: 1,
            overflow: "auto",
            padding: viewFull ? 0 : "56px 64px 100px",
            display: "flex",
            flexDirection: "column",
            gap: viewFull ? 0 : 40,
          }}
        >
          {children}
        </div>
      </div>
      <SettingsAndTemplateDrawers />
    </div>
  );
}
