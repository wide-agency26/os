"use client";

import React from "react";
import { ToastContainer } from "@/components/ci-builder/Toast";
import { CiFontLoader } from "@/components/ci-builder/CiFontLoader";
import { GuidelineClientShell } from "@/components/ci-builder/templates/GuidelineClientShell";
import { CiCanvasProvider, resolveTemplate, useCanvas } from "./CiCanvasContext";
import { CiCanvasShell } from "./CiCanvasShell";
import { EditCore } from "./edit/EditCore";
import { EditVoice } from "./edit/EditVoice";
import { EditLogo } from "./edit/EditLogo";
import { EditColor } from "./edit/EditColor";
import { EditType } from "./edit/EditType";
import { EditTokens } from "./edit/EditTokens";
import { EditUi } from "./edit/EditUi";
import { EditImagery } from "./edit/EditImagery";
import { EditTouch } from "./edit/EditTouch";
import "@/components/ci-builder/canvas/CiCanvas.css";

export function CiCanvasApp({ projectId }: { projectId: string }) {
  return (
    <CiCanvasProvider projectId={projectId}>
      <CiCanvasInner />
    </CiCanvasProvider>
  );
}

function CiCanvasInner() {
  const c = useCanvas();

  if (c.loading || c.migrating) {
    return (
      <div className="ci-canvas" style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {c.migrating ? "Adapting imported sections…" : "Loading CI Canvas…"}
      </div>
    );
  }

  if (c.loadError) {
    return (
      <div className="ci-canvas" style={{ position: "fixed", inset: 0, zIndex: 200, padding: 48 }}>
        {c.loadError}
      </div>
    );
  }

  return (
    <>
      <CiFontLoader theme={c.theme} assets={c.assets} sections={c.sections} />
      <CiCanvasShell>
        {c.tab === "edit" ? <EditScreen /> : <ViewScreen />}
      </CiCanvasShell>
      <ToastContainer />
    </>
  );
}

function EditScreen() {
  const c = useCanvas();
  switch (c.activeKey) {
    case "core":
      return <EditCore />;
    case "voice":
      return <EditVoice />;
    case "logo":
      return <EditLogo />;
    case "color":
      return <EditColor />;
    case "type":
      return <EditType />;
    case "tokens":
      return <EditTokens />;
    case "ui":
      return <EditUi />;
    case "imagery":
      return <EditImagery />;
    default:
      return <EditTouch />;
  }
}

function ViewScreen() {
  const c = useCanvas();
  const template = resolveTemplate(c.theme);
  return (
    <GuidelineClientShell
      brandName={c.brandName}
      theme={{ ...c.theme, clientTemplate: template }}
      sections={c.sections}
      assets={c.assets}
      initialModuleId={c.viewPage === "landing" ? null : c.viewPage}
      visibility="full"
    />
  );
}
