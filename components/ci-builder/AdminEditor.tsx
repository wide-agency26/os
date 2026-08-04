"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { CISection, CIAsset, CITheme } from "@/lib/ci-builder/types";
import { SectionRenderer } from "./sections/index";
import { parseManifest } from "@/lib/ci-builder/parser";
import { CI_GLOSSARY } from "@/lib/ci-builder/glossary";
import { Settings, Share, UploadCloud, Plus, GripVertical, CheckSquare, Square, X, AlertTriangle, Layers, Save, Check, Loader2 } from "lucide-react";
import { ThemePanel } from "./ThemePanel";
import { PublishModal } from "./PublishModal";

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
  const [uploading, setUploading] = useState(false);
  const [importReport, setImportReport] = useState<any>(null);
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());

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
    const realId = `sec_${crypto.randomUUID()}`;
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

  // Handle manifest upload with IMMEDIATE DB WRITE-THROUGH
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !guideline) return;

    if (sections.length > 0 || assets.length > 0) {
      if (!window.confirm("Re-importing will add new sections and update assets additively. Existing copy edits will not be overwritten. Continue?")) {
        if (e.target) e.target.value = "";
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
      
      // Assign real UUIDs to sections if temp_
      const newSections = parsed.sections.map((s, i) => {
        const isTemp = !s.id || s.id.startsWith("temp_");
        return {
          ...s,
          id: isTemp ? `sec_${crypto.randomUUID()}` : s.id,
          guideline_id: guideline.id,
          position: s.position !== undefined ? s.position : i
        };
      });

      // Map temp asset IDs to new real asset UUIDs
      const assetIdMap = new Map<string, string>();
      const newAssets = parsed.assets.map(a => {
        const isTemp = !a.id || a.id.startsWith("temp_");
        const realId = isTemp ? `ast_${crypto.randomUUID()}` : a.id!;
        if (a.id) assetIdMap.set(a.id, realId);
        return {
          ...a,
          id: realId,
          guideline_id: guideline.id
        };
      });

      // Update assetId references inside section data if mapped
      newSections.forEach(sec => {
        let dStr = JSON.stringify(sec.data || {});
        assetIdMap.forEach((realId, tempId) => {
          if (tempId && realId && dStr.includes(tempId)) {
            dStr = dStr.replaceAll(tempId, realId);
          }
        });
        sec.data = JSON.parse(dStr);
      });

      // BULK PERSIST TO SUPABASE IMMEDIATELY
      if (newSections.length > 0) {
        const { error: secErr } = await (supabase as any)
          .from("ci_sections")
          .upsert(newSections);
        if (secErr) throw secErr;
      }

      if (newAssets.length > 0) {
        const { error: astErr } = await (supabase as any)
          .from("ci_assets")
          .upsert(newAssets);
        if (astErr) throw astErr;
      }

      const mergedTheme = { ...guideline.theme, ...parsed.themeSuggested };
      if (parsed.themeSuggested && Object.keys(parsed.themeSuggested).length > 0) {
        await (supabase as any)
          .from("ci_guidelines")
          .update({ theme: mergedTheme })
          .eq("id", guideline.id);
      }

      setSections(newSections);
      setAssets(prev => [...prev.filter(pa => !newAssets.find(na => na.id === pa.id)), ...newAssets]);
      setGuideline({ ...guideline, theme: mergedTheme });
      setSaveStatus("saved");

    } catch (err: any) {
      console.error("Error during manifest import & persistence:", err);
      alert(`Failed to parse/save manifest: ${err.message || err}`);
      setSaveStatus("error");
      setSaveErrorMsg(err.message);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const applyThemeToCSS = () => {
    if (!guideline?.theme) return {};
    const t = guideline.theme;
    return {
      "--ci-bg": t.backgroundColor || "#ffffff",
      "--ci-text": t.textColor || "#111111",
      "--ci-accent": t.accentColors?.[0] || "#000000",
      "--ci-border": "#eaeaea",
      backgroundColor: "var(--ci-bg)",
      color: "var(--ci-text)",
      fontFamily: t.fontFamily || "Inter, sans-serif"
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
          
          <label className="flex-1 bg-white border border-gray-300 rounded px-3 py-1.5 text-xs font-medium text-center cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
            <UploadCloud className="w-4 h-4" />
            {uploading ? "Parsing & Saving..." : "Upload Manifest"}
            <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex justify-between">
            <span>Sections</span>
            {sections.length > 0 && <span className="text-gray-400">{sections.length}</span>}
          </h3>
          {sections.length === 0 ? (
            <p className="text-gray-400 text-xs italic">No sections. Upload a manifest or click + Add Section.</p>
          ) : (
            sections.map((sec) => (
              <div key={sec.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-200 cursor-pointer group">
                <GripVertical className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 cursor-grab" />
                <a href={`#${sec.section_type}`} className="flex-1 truncate text-gray-700">{sec.eyebrow_label || sec.section_type}</a>
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
                      className="text-sm border border-gray-300 rounded-md p-1.5 min-w-[150px]"
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
                          className="text-xs border border-gray-200 rounded p-1.5 w-full bg-gray-50 cursor-pointer hover:bg-white"
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
                        {importReport.format === 'design_tokens' ? 'Tokens Found' : 'Assets Found'}
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
    </div>
  );
}
