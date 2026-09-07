"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import type { CiClientTemplate } from "@/lib/ci-builder/types";
import type { CiModuleId } from "@/lib/ci-builder/modules-catalog";
import type { CanvasModuleKey } from "@/lib/ci-builder/canvas/modules";
import { CANVAS_MODULES, moduleIdForCanvasKey } from "@/lib/ci-builder/canvas/modules";
import { useCiGuideline } from "./useCiGuideline";

export type CanvasTab = "edit" | "view";
export type ToolAppearance = "dark" | "light";

export type CanvasDrawer =
  | { kind: "core"; mode: "mission" | "values" | "archetype" }
  | { kind: "editorial"; side: "do" | "dont"; itemId?: string }
  | { kind: "tone"; axisId?: string }
  | { kind: "voice"; side: "on" | "off"; itemId?: string }
  | { kind: "color"; sectionId: string }
  | { kind: "scale"; sectionId: string; stepId?: string }
  | { kind: "type"; rowId?: string }
  | { kind: "token"; which: "spacing" | "radius"; tokenId?: string }
  | { kind: "photo"; sectionType: string; itemId?: string; side?: "do" | "dont" }
  | { kind: "link"; sectionType: string; linkId?: string }
  | { kind: "rename"; markId: string }
  | { kind: "settings" }
  | { kind: "template" }
  | { kind: "unassigned" }
  | null;

type Store = ReturnType<typeof useCiGuideline>;

type CanvasContextValue = Store & {
  projectId: string;
  tab: CanvasTab;
  setTab: (t: CanvasTab) => void;
  activeKey: CanvasModuleKey;
  setActiveKey: (k: CanvasModuleKey) => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  appearance: ToolAppearance;
  setAppearance: (v: ToolAppearance) => void;
  drawer: CanvasDrawer;
  openDrawer: (d: Exclude<CanvasDrawer, null>) => void;
  closeDrawer: () => void;
  viewPage: string;
  setViewPage: (p: string) => void;
  hiddenKeys: Set<CanvasModuleKey>;
  toggleHidden: (key: CanvasModuleKey) => void;
  patchType: (sectionType: string, updater: (data: Record<string, any>) => Record<string, any>) => Promise<void>;
};

const CiCanvasContext = createContext<CanvasContextValue | null>(null);

export function useCanvas() {
  const ctx = useContext(CiCanvasContext);
  if (!ctx) throw new Error("useCanvas must be used inside CiCanvasProvider");
  return ctx;
}

export function CiCanvasProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const store = useCiGuideline(projectId);
  const [tab, setTab] = useState<CanvasTab>("edit");
  const [activeKey, setActiveKey] = useState<CanvasModuleKey>("core");
  const [editMode, setEditMode] = useState(false);
  const [appearance, setAppearance] = useState<ToolAppearance>(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem("ci-canvas-appearance") === "light" ? "light" : "dark";
  });
  const [drawer, setDrawer] = useState<CanvasDrawer>(null);
  const [viewPage, setViewPage] = useState("landing");

  const hiddenModules = (store.theme.hiddenModules || []) as CiModuleId[];
  const hiddenKeys = new Set(
    CANVAS_MODULES.filter((m) => hiddenModules.includes(m.id)).map((m) => m.key)
  );

  const toggleHidden = useCallback(
    (key: CanvasModuleKey) => {
      const id = moduleIdForCanvasKey(key);
      const next = new Set(hiddenModules);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      void store.updateTheme({ hiddenModules: Array.from(next) });
    },
    [hiddenModules, store]
  );

  const setAppearancePersist = useCallback((v: ToolAppearance) => {
    setAppearance(v);
    if (typeof window !== "undefined") window.localStorage.setItem("ci-canvas-appearance", v);
  }, []);

  const patchType = useCallback(
    async (sectionType: string, updater: (data: Record<string, any>) => Record<string, any>) => {
      const sec = await store.ensureSection(sectionType);
      if (!sec?.id) return;
      const live = store.sectionByType(sectionType);
      const current = { ...((live?.data || sec.data || {}) as Record<string, any>) };
      store.patchSectionData(sec.id, updater(current));
    },
    [store]
  );

  const value: CanvasContextValue = {
    ...store,
    projectId,
    tab,
    setTab: (t) => {
      setTab(t);
      if (t === "view") setViewPage("landing");
    },
    activeKey,
    setActiveKey,
    editMode,
    setEditMode,
    appearance,
    setAppearance: setAppearancePersist,
    drawer,
    openDrawer: (d) => setDrawer(d),
    closeDrawer: () => setDrawer(null),
    viewPage,
    setViewPage,
    hiddenKeys,
    toggleHidden,
    patchType,
  };

  return <CiCanvasContext.Provider value={value}>{children}</CiCanvasContext.Provider>;
}

export function resolveTemplate(theme: Store["theme"]): CiClientTemplate {
  const t = theme.clientTemplate;
  if (t === "foundry" || t === "multipage" || t === "greenpoint") return t;
  return "greenpoint";
}
