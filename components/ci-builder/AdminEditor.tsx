"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { CISection, CIAsset, CITheme, generateUUID, cssFontStack } from "@/lib/ci-builder/types";

function isValidUUID(str?: string): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}
import { SectionRenderer } from "./sections/index";
import { parseManifest } from "@/lib/ci-builder/parser";
import { applyImportResult } from "@/lib/ci-builder/import/apply-import-result";
import { CI_GLOSSARY } from "@/lib/ci-builder/glossary";
import { Settings, Share, Plus, GripVertical, CheckSquare, Square, X, AlertTriangle, Layers, Save, Check, Loader2, Trash2 } from "lucide-react";
import { ThemePanel } from "./ThemePanel";
import { PublishModal } from "./PublishModal";
import { ImportPanel } from "./ImportPanel";
import { resetCiGuideline } from "@/app/actions/ci-builder";
import { triggerToast, ToastContainer } from "./Toast";

function themeHasFonts(theme: any): boolean {
  if (!theme) return false;
  if (Array.isArray(theme.availableFonts) && theme.availableFonts.length > 0) {
    return true;
  }
  return Boolean(theme.primaryFont || theme.fontFamily);
}

export function AdminEditor({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [guideline, setGuideline] = useState<any>(null);
  const [sections, setSections] = useState<Partial<CISection>[]>([]);
  const [assets, setAssets] = useState<Partial<CIAsset>[]>([]);
  
  // Save State Machine
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showAddSectionDropdown, setShowAddSectionDropdown] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importReport, setImportReport] = useState<any>(null);
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);

  const supabase = createClient();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Map<string, { type: "data" | "fields"; payload: any }>>(new Map());

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Unsaved changes beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === "saving" || saveStatus === "error" || pendingUpdatesRef.current.size > 0) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    
    try {
      // 1. Fetch or create guideline for project
      let { data: gl, error: glErr } = await (supabase as any)
        .from("ci_guidelines")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (glErr) {
        console.error("Error fetching guideline:", glErr);
      }
        
      if (!gl) {
        const { data: newGl, error: createErr } = await (supabase as any)
          .from("ci_guidelines")
          .insert({ project_id: projectId, theme: {} })
          .select()
          .single();
        if (createErr) throw createErr;
        gl = newGl;
      }
      setGuideline(gl);

      if (gl) {
        // 2. Fetch sections
        const { data: secs, error: secErr } = await (supabase as any)
          .from("ci_sections")
          .select("*")
          .eq("guideline_id", gl.id)
          .order("position", { ascending: true });
        if (secErr) throw secErr;
        if (secs) setSections(secs);

        // 3. Fetch assets
        const { data: asts, error: astErr } = await (supabase as any)
          .from("ci_assets")
          .select("*")
          .eq("guideline_id", gl.id);
        if (astErr) throw astErr;
        if (asts) setAssets(asts);
      }
      
      setSaveStatus("saved");
    } catch (err: any) {
      console.error("Failed to load CI Builder data:", err);
      setLoadError(`Failed to load guideline data: ${err.message || err}`);
      setSaveStatus("error");
    } finally {
      setLoading(false);
    }
  }

  // --- Flush Pending Debounced Writes ---
  const flushPendingSaves = useCallback(async (): Promise<boolean> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (pendingUpdatesRef.current.size === 0) {
      setSaveStatus("saved");
      setSaveErrorMsg(null);
      return true;
    }

    setSaveStatus("saving");
    const updatesToProcess = new Map(pendingUpdatesRef.current);
    pendingUpdatesRef.current.clear();

    try {
      for (const [sectionId, update] of updatesToProcess.entries()) {
        if (!sectionId) continue;
        if (update.type === "data") {
          const { error } = await (supabase as any)
            .from("ci_sections")
            .update({ data: update.payload })
            .eq("id", sectionId);
          if (error) throw error;
        } else if (update.type === "fields") {
          const { error } = await (supabase as any)
            .from("ci_sections")
            .update(update.payload)
            .eq("id", sectionId);
          if (error) throw error;
        }
      }

      setSaveStatus("saved");
      setSaveErrorMsg(null);
      return true;
    } catch (err: any) {
      console.error("Failed to flush pending saves to Supabase:", err);
      // Re-queue failed items
      updatesToProcess.forEach((val, key) => pendingUpdatesRef.current.set(key, val));
      setSaveStatus("error");
      setSaveErrorMsg(err.message || "Failed to save edits to database");
      return false;
    }
  }, [supabase]);

  const scheduleDebouncedSave = (sectionId: string, type: "data" | "fields", payload: any) => {
    setSaveStatus("saving");
    pendingUpdatesRef.current.set(sectionId, { type, payload });

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      flushPendingSaves();
    }, 600);
  };

  // --- CRUD Handlers ---

  const handleUpdateSectionData = (sectionId: string, newData: any) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, data: newData } : s));
    scheduleDebouncedSave(sectionId, "data", newData);
  };

  const handleEditSectionFields = (sectionId: string, fields: Partial<CISection>) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, ...fields } : s));
    scheduleDebouncedSave(sectionId, "fields", fields);
  };

  const handleAddAssetRecord = async (asset: Partial<CIAsset>) => {
    setAssets(prev => [...prev.filter(a => a.id !== asset.id), asset]);
    if (guideline?.id && asset.id) {
      setSaveStatus("saving");
      try {
        const { error } = await (supabase as any)
          .from("ci_assets")
          .upsert({ ...asset, guideline_id: guideline.id });
        if (error) throw error;
        setSaveStatus("saved");
      } catch (err: any) {
        console.error("Error saving asset record:", err);
        setSaveStatus("error");
        setSaveErrorMsg(err.message);
      }
    }
  };

  const handleDeleteAssetRecord = async (assetId: string) => {
    setAssets(prev => prev.filter(a => a.id !== assetId));
    if (guideline?.id && assetId) {
      setSaveStatus("saving");
      try {
        const { error } = await (supabase as any)
          .from("ci_assets")
          .delete()
          .eq("id", assetId);
        if (error) throw error;
        setSaveStatus("saved");
      } catch (err: any) {
        console.error("Error deleting asset record:", err);
        setSaveStatus("error");
        setSaveErrorMsg(err.message);
      }
    }
  };

  const handleAddSection = async (entry: any) => {
    if (!guideline?.id) return;
    const realId = generateUUID();
    const newSection: Partial<CISection> = {
      id: realId,
      guideline_id: guideline.id,
      section_type: entry.section_type,
      eyebrow_label: entry.eyebrow_label,
      headline: entry.default_headline,
      position: sections.length,
      is_visible: true,
      data: {}
    };

    setSections(prev => [...prev, newSection]);
    setSaveStatus("saving");

    try {
      const { error } = await (supabase as any)
        .from("ci_sections")
        .insert(newSection);
      if (error) throw error;
      setSaveStatus("saved");
    } catch (err: any) {
      console.error("Error adding section:", err);
      setSaveStatus("error");
      setSaveErrorMsg(err.message);
    }
  };

  const handleUpdateTheme = async (newTheme: CITheme) => {
    setGuideline((prev: any) => ({ ...prev, theme: newTheme }));
    if (guideline?.id) {
      setSaveStatus("saving");
      try {
        const { error } = await (supabase as any)
          .from("ci_guidelines")
          .update({ theme: newTheme })
          .eq("id", guideline.id);
        if (error) throw error;
        setSaveStatus("saved");
      } catch (err: any) {
        console.error("Error saving theme:", err);
        setSaveStatus("error");
        setSaveErrorMsg(err.message);
      }
    }
  };

  const persistSectionOrder = async (ordered: Partial<CISection>[]) => {
    setSaveStatus("saving");
    try {
      await Promise.all(
        ordered.map((sec, index) => {
          if (!sec.id || !isValidUUID(sec.id)) return Promise.resolve();
          return (supabase as any)
            .from("ci_sections")
            .update({ position: index })
            .eq("id", sec.id);
        })
      );
      setSaveStatus("saved");
    } catch (err: any) {
      console.error("Error saving section order:", err);
      setSaveStatus("error");
      setSaveErrorMsg(err.message || "Failed to save section order");
    }
  };

  const reorderSections = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    setSections((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((s) => s.id === fromId);
      const toIdx = next.findIndex((s) => s.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const withPos = next.map((s, i) => ({ ...s, position: i }));
      void persistSectionOrder(withPos);
      return withPos;
    });
  };

  const discoveredFonts = (() => {
    const set = new Set<string>();
    for (const sec of sections) {
      if (sec.section_type !== "typography") continue;
      const rows = sec.data?.rows || [];
      for (const row of rows) {
        if (row?.fontFamily && row.fontFamily !== "—") {
          set.add(String(row.fontFamily).trim());
        }
      }
    }
    return Array.from(set);
  })();

  // Handle manifest upload with IMMEDIATE DB WRITE-THROUGH
  const handleJsonFile = async (file: File) => {
    if (!guideline) return;

    if (sections.length > 0 || assets.length > 0) {
      if (
        !window.confirm(
          "Re-importing will add new sections and update assets additively. Existing copy edits will not be overwritten. Continue?"
        )
      ) {
        return;
      }
    }

    setUploading(true);
    setSaveStatus("saving");
    try {
      const text = await file.text();
      const manifest = JSON.parse(text);
      const parsed = parseManifest(manifest, sections);
      setImportReport(parsed.report);

      const applied = await applyImportResult(supabase, parsed, {
        guidelineId: guideline.id,
        existingTheme: guideline.theme,
        mode: "additive",
        source: "json",
        rawPayload: { fileName: file.name, format: parsed.report.format },
      });

      setSections(applied.sections);
      setAssets((prev) => [
        ...prev.filter((pa) => !applied.assets.find((na) => na.id === pa.id)),
        ...applied.assets,
      ]);
      setGuideline({ ...guideline, theme: applied.theme });
      setSaveStatus("saved");
      if (!themeHasFonts(applied.theme)) {
        triggerToast(
          "Import done — no fonts detected. Open Theme Settings to set primary / secondary / tertiary manually."
        );
      } else {
        triggerToast(
          `Fonts ready: ${(applied.theme as CITheme).primaryFont || "primary"} set in Theme Settings`
        );
      }
    } catch (err: any) {
      console.error("Error during manifest import & persistence:", err);
      alert(`Failed to parse/save manifest: ${err.message || err}`);
      setSaveStatus("error");
      setSaveErrorMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFigmaImported = (result: {
    sections: any[];
    assets: any[];
    theme: any;
    report: any;
    figma?: { fileKey?: string; fileName?: string; version?: string };
  }) => {
    setImportReport(result.report);
    if (result.sections?.length) setSections(result.sections);
    if (result.assets) setAssets(result.assets);
    setGuideline((g: any) =>
      g
        ? {
            ...g,
            theme: result.theme || g.theme,
            ...(result.figma?.fileKey
              ? {
                  figma_file_key: result.figma.fileKey,
                  figma_file_name: result.figma.fileName,
                  figma_file_version: result.figma.version,
                  figma_last_imported_at: new Date().toISOString(),
                }
              : {}),
          }
        : g
    );
    setSaveStatus("saved");
    if (!themeHasFonts(result.theme)) {
      triggerToast(
        "Figma import done — no fonts detected. Open Theme Settings to set typefaces + fallbacks."
      );
    } else {
      const names = (result.theme as CITheme)?.availableFonts?.slice(0, 3) || [];
      triggerToast(
        `Figma fonts imported: ${names.join(", ") || (result.theme as CITheme).primaryFont}. Review Theme Settings.`
      );
    }
  };

  const applyThemeToCSS = () => {
    if (!guideline?.theme) return {};
    const t = guideline.theme as CITheme;
    return {
      "--ci-bg": t.backgroundColor || "#ffffff",
      "--ci-text": t.textColor || "#111111",
      "--ci-accent": t.accentColors?.[0] || "#000000",
      "--ci-border": "#eaeaea",
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
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-white text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="font-medium text-sm">Loading CI Builder project...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-white text-red-600">
        <AlertTriangle className="w-10 h-10 mb-3" />
        <h3 className="font-bold text-lg text-gray-900 mb-1">Failed to load guideline</h3>
        <p className="text-sm text-gray-600 mb-4">{loadError}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg text-xs hover:bg-blue-700"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white text-sm">
      
      {/* LEFT PANE: Admin Controls */}
      <div className="w-64 border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-800">CI Builder</h2>

            {/* Top Bar Save Status Indicator */}
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving…
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
            {saveStatus === "error" && (
              <button
                onClick={flushPendingSaves}
                className="flex items-center gap-1 text-[11px] text-red-600 font-medium bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-full border border-red-200"
                title={saveErrorMsg || "Save error - click to retry"}
              >
                <AlertTriangle className="w-3 h-3" /> Retry Save
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 mb-4">Edit brand guideline structure and assets.</p>

          {guideline?.id && (
            <ImportPanel
              guidelineId={guideline.id}
              projectId={projectId}
              uploading={uploading}
              linkedFigma={{
                fileKey: guideline.figma_file_key || null,
                fileName: guideline.figma_file_name || null,
                version: guideline.figma_file_version || null,
                lastImportedAt: guideline.figma_last_imported_at || null,
              }}
              onJsonFile={handleJsonFile}
              onFigmaImported={handleFigmaImported}
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex justify-between">
            <span>Sections</span>
            {sections.length > 0 && <span className="text-gray-400">{sections.length}</span>}
          </h3>
          {sections.length === 0 ? (
            <p className="text-gray-400 text-xs italic">No sections. Import from JSON or Figma, or click + Add Section.</p>
          ) : (
            sections.map((sec) => (
              <div
                key={sec.id}
                draggable
                onDragStart={(e) => {
                  setDragSectionId(sec.id || null);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", sec.id || "");
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId =
                    e.dataTransfer.getData("text/plain") || dragSectionId;
                  if (fromId && sec.id) reorderSections(fromId, sec.id);
                  setDragSectionId(null);
                }}
                onDragEnd={() => setDragSectionId(null)}
                className={`flex items-center gap-2 p-2 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing group ${
                  dragSectionId === sec.id ? "opacity-50 bg-gray-200" : ""
                }`}
              >
                <GripVertical className="w-3 h-3 text-gray-400 opacity-50 group-hover:opacity-100 shrink-0" />
                <a
                  href={`#${sec.section_type}`}
                  className="flex-1 truncate text-gray-700"
                  onClick={(e) => e.stopPropagation()}
                  draggable={false}
                >
                  {sec.eyebrow_label || sec.section_type}
                </a>
              </div>
            ))
          )}
          
          <div className="mt-2">
            <button 
              onClick={() => setShowAddSectionDropdown(!showAddSectionDropdown)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-xs p-2 w-full"
            >
              <Plus className="w-3 h-3" /> Add Section
            </button>
            {showAddSectionDropdown && (
              <div className="mt-1 w-full bg-white border border-gray-200 shadow-sm rounded-md overflow-hidden py-1 z-30 relative">
                {CI_GLOSSARY.map((entry) => (
                  <button
                    key={entry.section_type}
                    onClick={() => {
                      handleAddSection(entry);
                      setShowAddSectionDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    {entry.eyebrow_label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Unassigned Assets Queue Summary */}
          {assets.filter(a => a.section_id === null).length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h3 className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Unassigned</span>
                <span className="bg-amber-100 text-amber-800 py-0.5 px-2 rounded-full text-[10px] font-bold">
                  {assets.filter(a => a.section_id === null).length}
                </span>
              </h3>
              <p className="text-[10px] text-gray-500 mb-2 leading-tight">View main editor pane to assign these assets.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 space-y-2">
          {/* Explicit Save Control */}
          <button 
            onClick={flushPendingSaves}
            disabled={saveStatus === "saving"}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white rounded px-3 py-1.5 font-medium hover:bg-black disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saveStatus === "saving" ? "Saving Draft..." : "Save Draft"}
          </button>

          <button 
            onClick={() => setShowThemePanel(true)}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 rounded px-3 py-1.5 font-medium hover:bg-gray-50 text-gray-700"
          >
            <Settings className="w-4 h-4" /> Theme Settings
          </button>

          <button 
            onClick={() => setShowPublishModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded px-3 py-1.5 font-medium hover:bg-blue-700"
          >
            <Share className="w-4 h-4" /> Publish
          </button>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="w-full flex items-center justify-center gap-2 bg-white border border-red-200 text-red-700 rounded px-3 py-1.5 font-medium hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" /> Reset guideline
          </button>
        </div>
      </div>

      {/* RIGHT PANE: Live Preview / Full Visual Editor */}
      <div className="flex-1 overflow-y-auto relative bg-[#f9f9f9]">
        <div 
          className="min-h-full transition-colors duration-300"
          style={applyThemeToCSS()}
        >
          {/* Unassigned Assets Queue */}
          {assets.filter(a => a.section_id === null).length > 0 && (
            <div className="max-w-6xl mx-auto p-8 mb-8 bg-amber-50/50 border-b border-amber-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                    <Layers className="w-5 h-5" /> 
                    Unassigned Assets Queue ({assets.filter(a => a.section_id === null).length})
                  </h2>
                  <p className="text-sm text-amber-700 mt-1">Select items to assign them to a section.</p>
                </div>
                
                {selectedUnassigned.size > 0 && (
                  <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-amber-200 shadow-sm">
                    <span className="text-sm font-medium text-gray-700 px-2">{selectedUnassigned.size} selected</span>
                    <select 
                      className="text-sm border border-gray-300 rounded-md p-1.5 min-w-[150px] bg-white text-gray-900"
                      value=""
                      onChange={async (e) => {
                        const secId = e.target.value;
                        if (secId) {
                          const updated = assets.map(a => selectedUnassigned.has(a.id!) ? { ...a, section_id: secId } : a);
                          setAssets(updated);
                          setSelectedUnassigned(new Set());
                          setSaveStatus("saving");
                          try {
                            const ids = Array.from(selectedUnassigned);
                            await (supabase as any)
                              .from("ci_assets")
                              .update({ section_id: secId })
                              .in("id", ids);
                            setSaveStatus("saved");
                          } catch (err: any) {
                            setSaveStatus("error");
                            setSaveErrorMsg(err.message);
                          }
                        }
                      }}
                    >
                      <option value="" disabled>Bulk Assign to...</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.eyebrow_label || s.section_type}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => setSelectedUnassigned(new Set())}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      title="Clear selection"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {assets.filter(a => a.section_id === null).map((asset) => {
                  const isSelected = selectedUnassigned.has(asset.id!);
                  const isMissing = asset.metadata?.is_missing_file;
                  return (
                    <div 
                      key={asset.id} 
                      className={`relative bg-white border rounded-xl overflow-hidden group transition-all
                        ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-amber-300'}`}
                    >
                      <div className="absolute top-2 left-2 z-10">
                        <button 
                          onClick={() => {
                            const newSet = new Set(selectedUnassigned);
                            if (isSelected) newSet.delete(asset.id!);
                            else newSet.add(asset.id!);
                            setSelectedUnassigned(newSet);
                          }}
                          className="bg-white/80 backdrop-blur-sm rounded-sm text-gray-600 hover:text-blue-600"
                        >
                          {isSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
                        </button>
                      </div>
                      
                      <div className="h-32 bg-gray-100 flex items-center justify-center relative border-b border-gray-100">
                        {isMissing ? (
                          <div className="text-gray-400 flex flex-col items-center">
                            <AlertTriangle className="w-8 h-8 mb-1 opacity-50" />
                            <span className="text-[10px] uppercase font-bold">Missing File</span>
                          </div>
                        ) : (
                          <img 
                            src={asset.public_url || asset.storage_path} 
                            alt={asset.label || 'Asset'}
                            className="max-w-full max-h-full object-contain p-2"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNjY2MiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';
                            }}
                          />
                        )}
                      </div>
                      
                      <div className="p-3">
                        <div className="text-xs font-semibold text-gray-800 truncate mb-1" title={asset.label || ''}>{asset.label}</div>
                        <div className="text-[10px] text-gray-500 truncate mb-2" title={asset.storage_path || ''}>{asset.storage_path}</div>
                        
                        <select 
                          className="text-xs border border-gray-200 rounded p-1.5 w-full bg-gray-50 text-gray-900 cursor-pointer hover:bg-white"
                          value=""
                          onChange={async (e) => {
                            const secId = e.target.value;
                            if (secId) {
                              setAssets(assets.map(a => a.id === asset.id ? { ...a, section_id: secId } : a));
                              setSaveStatus("saving");
                              try {
                                await (supabase as any)
                                  .from("ci_assets")
                                  .update({ section_id: secId })
                                  .eq("id", asset.id);
                                setSaveStatus("saved");
                              } catch (err: any) {
                                setSaveStatus("error");
                                setSaveErrorMsg(err.message);
                              }
                            }
                          }}
                        >
                          <option value="" disabled>Assign to...</option>
                          {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.eyebrow_label || s.section_type}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {sections.length === 0 && assets.filter(a => a.section_id === null).length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 min-h-[500px]">
              <p>Upload a manifest.json or click &quot;+ Add Section&quot; to build the guideline</p>
            </div>
          ) : (
            <div className="pb-32">
              {sections.map(section => (
                <SectionRenderer 
                  key={section.id} 
                  section={section} 
                  assets={assets.filter(a => a.section_id === section.id || a.kind === section.section_type)} 
                  allAssets={assets}
                  allSections={sections}
                  isAdmin={true} 
                  onUpdateData={handleUpdateSectionData}
                  onEditSectionFields={handleEditSectionFields}
                  onAddAssetRecord={handleAddAssetRecord}
                  onDeleteAssetRecord={handleDeleteAssetRecord}
                  guidelineId={guideline?.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showThemePanel && (
        <ThemePanel 
          guideline={guideline}
          discoveredFonts={discoveredFonts}
          onClose={() => setShowThemePanel(false)}
          onUpdate={handleUpdateTheme}
        />
      )}

      {showPublishModal && (
        <PublishModal 
          guideline={guideline} 
          sections={sections}
          assets={assets}
          onClose={() => setShowPublishModal(false)}
          onFlushSaves={flushPendingSaves}
          saveStatus={saveStatus}
        />
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white text-gray-900 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4 border border-gray-100">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-gray-900 text-sm">Reset brand guideline?</h4>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              This permanently deletes all sections, assets, and published versions for this project
              and returns the guideline to an empty draft. Clients will no longer see a published
              version until you publish again. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={resetting}
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={async () => {
                  setResetting(true);
                  const result = await resetCiGuideline(projectId);
                  setResetting(false);
                  if (!result.ok) {
                    setSaveStatus("error");
                    setSaveErrorMsg(result.error || "Reset failed");
                    setShowResetConfirm(false);
                    return;
                  }
                  setShowResetConfirm(false);
                  pendingUpdatesRef.current.clear();
                  setSections([]);
                  setAssets([]);
                  setSaveStatus("saved");
                  await loadData();
                }}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {resetting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Resetting…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Delete all &amp; start fresh
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {importReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">
                {importReport.format === 'unknown' ? 'Unrecognized Format' : 'Manifest Import Report'}
              </h3>
              <button onClick={() => setImportReport(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {importReport.format === 'unknown' ? (
                <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-red-800 text-sm">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p className="font-semibold">Format auto-detection failed.</p>
                  </div>
                  <p className="mb-2">{importReport.message}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-blue-600 mb-1">{importReport.totalItems}</div>
                      <div className="text-xs font-medium text-blue-800 uppercase tracking-wide">
                        {importReport.format === 'design_tokens'
                          ? 'Tokens Found'
                          : importReport.format === 'node_tree'
                            ? 'Layers Found'
                            : 'Assets Found'}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-green-600 mb-1">{importReport.assignedCount}</div>
                      <div className="text-xs font-medium text-green-800 uppercase tracking-wide">Auto-Assigned</div>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-amber-600 mb-1">{importReport.unassignedCount}</div>
                      <div className="text-xs font-medium text-amber-800 uppercase tracking-wide">Waiting</div>
                    </div>
                  </div>

                  {importReport.format === 'design_tokens' ? (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 mb-2 border-b pb-1">Design Tokens Detected</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium">Sections populated:</span>{' '}
                          {importReport.detectedNameKeys?.length > 0 
                            ? <span className="text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">{importReport.detectedNameKeys.join(', ')}</span>
                            : <span>None</span>}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 mb-2 border-b pb-1">Key Mapping Detected</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium">Name fields used:</span>{' '}
                          {importReport.detectedNameKeys?.length > 0 
                            ? <span className="text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">{importReport.detectedNameKeys.join(', ')}</span>
                            : <span className="text-red-500">None found (Expected: frame_name, name, title)</span>}
                        </p>
                        <p>
                          <span className="font-medium">File fields used:</span>{' '}
                          {importReport.detectedFileKeys?.length > 0 
                            ? <span className="text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">{importReport.detectedFileKeys.join(', ')}</span>
                            : <span className="text-red-500">None found (Expected: file, filename, image)</span>}
                        </p>
                      </div>
                    </div>
                  )}

                  {importReport.missingFiles > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-semibold text-red-800">Missing File References ({importReport.missingFiles})</h4>
                          <p className="text-xs text-red-600 mt-1">Some rows in the manifest did not point to a valid image file. They were imported but flagged as broken.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setImportReport(null)}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Continue to Editor
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  );
}
