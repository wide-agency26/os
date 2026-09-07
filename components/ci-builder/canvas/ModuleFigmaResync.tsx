"use client";

import React, { useState } from "react";
import type { CanvasModuleKey } from "@/lib/ci-builder/canvas/modules";
import { getModuleImportSpec } from "@/lib/ci-builder/figma/module-import-spec";
import { triggerToast } from "@/components/ci-builder/Toast";
import { useCanvas } from "./CiCanvasContext";

export function ModuleFigmaResync({ moduleKey }: { moduleKey: CanvasModuleKey }) {
  const c = useCanvas();
  const [busy, setBusy] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const spec = getModuleImportSpec(moduleKey);
  const linked = Boolean(c.guideline?.figma_file_key);

  async function resync() {
    if (!c.guideline?.id) return;
    if (!linked) {
      triggerToast("Link a Figma file in Settings → Import first");
      return;
    }
    setBusy(true);
    void c.updateTheme({
      figmaSync: { ...(c.theme.figmaSync || {}), status: "syncing", message: `Syncing ${spec.label}…` },
    });
    try {
      const res = await fetch("/api/ci-builder/figma/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guidelineId: c.guideline.id,
          force: true,
          moduleKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      triggerToast(
        data.skipped
          ? "Figma already up to date"
          : `Re-synced ${spec.label} from Figma (other modules untouched)`
      );
      await c.reload();
    } catch (err: any) {
      void c.updateTheme({
        figmaSync: {
          ...(c.theme.figmaSync || {}),
          status: "error",
          message: err.message,
        },
      });
      triggerToast(err.message || "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 16,
        borderRadius: "var(--radius-m)",
        border: "1px solid var(--tool-border-input)",
        background: "var(--tool-overlay-soft)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tool-text-primary)" }}>
            Re-sync from Figma
          </span>
          <span style={{ fontSize: 11, color: "var(--tool-text-muted)" }}>
            Replaces only this module’s Figma-mapped sections. Other modules stay as-is.
          </span>
        </div>
        <span
          className="page-edit-btn"
          style={{ opacity: busy || !linked ? 0.55 : 1, pointerEvents: busy ? "none" : "auto" }}
          onClick={() => void resync()}
        >
          {busy ? "Syncing…" : "Re-sync from Figma"}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setInfoOpen((v) => !v)}
        style={{
          alignSelf: "flex-start",
          background: "transparent",
          border: "none",
          padding: 0,
          fontSize: 12,
          color: "var(--tool-text-link)",
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 2,
        }}
      >
        {infoOpen ? "Hide what Figma imports ▴" : "What will Figma import? ▾"}
      </button>
      {infoOpen ? (
        <div
          style={{
            fontSize: 12,
            color: "var(--tool-text-muted)",
            lineHeight: 1.55,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--tool-text-primary)" }}>Parent section:</strong>{" "}
            {spec.figmaSectionHint}
          </p>
          <p style={{ margin: 0 }}>{spec.containerNote}</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {spec.frames.map((f) => (
              <li key={`${f.frameName}-${f.sectionType}`}>
                <span style={{ color: "var(--tool-text-primary)" }}>{f.frameName}</span>
                <span className="mono" style={{ fontSize: 10, marginLeft: 6, opacity: 0.8 }}>
                  → {f.sectionType} ({f.kind})
                </span>
                {f.note ? (
                  <span style={{ display: "block", fontSize: 11, opacity: 0.85 }}>{f.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
