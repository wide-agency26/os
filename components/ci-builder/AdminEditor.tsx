"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { CISection, CIAsset } from "@/lib/ci-builder/types";
import { SectionRenderer } from "./sections/index";
import { parseManifest } from "@/lib/ci-builder/parser";
import { CI_GLOSSARY } from "@/lib/ci-builder/glossary";
import { Settings, Share, UploadCloud, Plus, GripVertical, CheckSquare, Square, X, AlertTriangle, Layers, Image as ImageIcon } from "lucide-react";
import { ThemePanel } from "./ThemePanel";
import { PublishModal } from "./PublishModal";

export function AdminEditor({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [guideline, setGuideline] = useState<any>(null);
  const [sections, setSections] = useState<Partial<CISection>[]>([]);
  const [assets, setAssets] = useState<Partial<CIAsset>[]>([]);
  
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showAddSectionDropdown, setShowAddSectionDropdown] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importReport, setImportReport] = useState<any>(null);
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());

  const handleAddSection = (entry: any) => {
    const newSection: Partial<CISection> = {
      id: `temp_${Date.now()}`,
      guideline_id: guideline?.id,
      section_type: entry.section_type,
      eyebrow_label: entry.eyebrow_label,
      headline: entry.default_headline,
      position: sections.length,
      is_visible: true,
      data: {}
    };
    setSections([...sections, newSection]);
  };

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    setLoading(true);
    
    // 1. Fetch or create guideline for project
    let { data: gl } = await (supabase as any)
      .from('ci_guidelines')
      .select('*')
      .eq('project_id', projectId)
      .single();
      
    if (!gl) {
      const { data: newGl, error } = await (supabase as any)
        .from('ci_guidelines')
        .insert({ project_id: projectId, theme: {} })
        .select()
        .single();
      if (error) console.error("Error creating guideline:", error);
      gl = newGl;
    }
    setGuideline(gl);

    if (gl) {
      // 2. Fetch sections
      const { data: secs } = await (supabase as any)
        .from('ci_sections')
        .select('*')
        .eq('guideline_id', gl.id)
        .order('position', { ascending: true });
      if (secs) setSections(secs);

      // 3. Fetch assets
      const { data: asts } = await (supabase as any)
        .from('ci_assets')
        .select('*')
        .eq('guideline_id', gl.id);
      if (asts) setAssets(asts);
    }
    
    setLoading(false);
  }

  // Handle manifest upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !guideline) return;

    if (sections.length > 0 || assets.length > 0) {
      if (!window.confirm("You already have sections or assets in this guideline. Re-importing will add new sections and update assets additively. Existing copy edits will not be overwritten. Continue?")) {
        if (e.target) e.target.value = '';
        return;
      }
    }

    setUploading(true);
    try {
      const text = await file.text();
      const manifest = JSON.parse(text);
      
      const parsed = parseManifest(manifest, sections);

      setImportReport(parsed.report);
      
      const newSections = parsed.sections.map((s, i) => ({
        ...s,
        guideline_id: guideline.id,
        position: s.position !== undefined ? s.position : i
      }));
      setSections(newSections);
      
      // Keep existing assets + newly parsed assets (in a real app we'd merge by ID)
      const newAssets = parsed.assets.map(a => ({
        ...a,
        guideline_id: guideline.id
      }));
      setAssets(prev => [...prev.filter(pa => !newAssets.find(na => na.id === pa.id)), ...newAssets]);
      
      // Update theme if suggestions exist
      if (parsed.themeSuggested && Object.keys(parsed.themeSuggested).length > 0) {
        setGuideline({ ...guideline, theme: { ...guideline.theme, ...parsed.themeSuggested } });
      }

    } catch (err) {
      console.error(err);
      alert("Failed to parse manifest. Please ensure it is valid JSON.");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = ''; // Reset input
    }
  };

  const applyThemeToCSS = () => {
    if (!guideline?.theme) return {};
    const t = guideline.theme;
    return {
      '--ci-bg': t.backgroundColor || '#ffffff',
      '--ci-text': t.textColor || '#111111',
      '--ci-accent': t.accentColors?.[0] || '#000000',
      '--ci-border': '#eaeaea',
      backgroundColor: 'var(--ci-bg)',
      color: 'var(--ci-text)',
      fontFamily: t.fontFamily || 'Inter, sans-serif'
    } as React.CSSProperties;
  };

  if (loading) return <div className="p-8 animate-pulse text-gray-500">Loading editor...</div>;

  return (
    <div className="flex h-full bg-white text-sm">
      
      {/* LEFT PANE: Admin Controls */}
      <div className="w-64 border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800 mb-1">CI Builder</h2>
          <p className="text-xs text-gray-500 mb-4">Edit brand guideline structure and assets.</p>
          
          <label className="flex-1 bg-white border border-gray-300 rounded px-3 py-1.5 text-xs font-medium text-center cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
            <UploadCloud className="w-4 h-4" />
            {uploading ? "Parsing..." : "Upload Manifest"}
            <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex justify-between">
            <span>Sections</span>
            {sections.length > 0 && <span className="text-gray-400">{sections.length}</span>}
          </h3>
          {sections.length === 0 ? (
            <p className="text-gray-400 text-xs italic">No sections. Upload a manifest to begin.</p>
          ) : (
            sections.map((sec, idx) => (
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
              <div className="mt-1 w-full bg-white border border-gray-200 shadow-sm rounded-md overflow-hidden py-1">
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

          {/* Unassigned Assets Panel in Sidebar (Summarized) */}
          {assets.filter(a => a.section_id === null).length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h3 className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Unassigned</span>
                <span className="bg-amber-100 text-amber-800 py-0.5 px-2 rounded-full text-[10px] font-bold">
                  {assets.filter(a => a.section_id === null).length}
                </span>
              </h3>
              <p className="text-[10px] text-gray-500 mb-2 leading-tight">View the main editor pane to assign these assets.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <button 
            onClick={() => setShowThemePanel(true)}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 rounded px-3 py-1.5 font-medium hover:bg-gray-50"
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

      {/* RIGHT PANE: Live Preview */}
      <div className="flex-1 overflow-y-auto relative bg-[#f9f9f9]">
        <div 
          className="min-h-full transition-colors duration-300"
          style={applyThemeToCSS()}
        >
          {/* Unassigned Assets Grid */}
          {assets.filter(a => a.section_id === null).length > 0 && (
            <div className="max-w-6xl mx-auto p-8 mb-8 bg-amber-50/50 border-b border-amber-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                    <Layers className="w-5 h-5" /> 
                    Unassigned Assets Queue ({assets.filter(a => a.section_id === null).length})
                  </h2>
                  <p className="text-sm text-amber-700 mt-1">These assets couldn't be auto-matched. Select items to bulk-assign them to a section.</p>
                </div>
                
                {selectedUnassigned.size > 0 && (
                  <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-amber-200 shadow-sm">
                    <span className="text-sm font-medium text-gray-700 px-2">{selectedUnassigned.size} selected</span>
                    <select 
                      className="text-sm border border-gray-300 rounded-md p-1.5 min-w-[150px]"
                      value=""
                      onChange={(e) => {
                        const secId = e.target.value;
                        if (secId) {
                          setAssets(assets.map(a => selectedUnassigned.has(a.id!) ? { ...a, section_id: secId } : a));
                          setSelectedUnassigned(new Set());
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
                            alt={asset.label}
                            className="max-w-full max-h-full object-contain p-2"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNjY2MiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';
                            }}
                          />
                        )}
                      </div>
                      
                      <div className="p-3">
                        <div className="text-xs font-semibold text-gray-800 truncate mb-1" title={asset.label}>{asset.label}</div>
                        <div className="text-[10px] text-gray-500 truncate mb-2" title={asset.storage_path}>{asset.storage_path}</div>
                        
                        <select 
                          className="text-xs border border-gray-200 rounded p-1.5 w-full bg-gray-50 cursor-pointer hover:bg-white"
                          value=""
                          onChange={(e) => {
                            const secId = e.target.value;
                            if (secId) {
                              setAssets(assets.map(a => a.id === asset.id ? { ...a, section_id: secId } : a));
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
              <p>Upload a manifest.json to generate the guideline</p>
            </div>
          ) : (
            <div className="pb-32">
              {sections.map(section => (
                <SectionRenderer 
                  key={section.id} 
                  section={section} 
                  assets={assets.filter(a => a.section_id === section.id || a.kind === section.section_type)} 
                  isAdmin={true} 
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
          onUpdate={(newTheme) => setGuideline({ ...guideline, theme: newTheme })}
        />
      )}

      {showPublishModal && (
        <PublishModal 
          guideline={guideline} 
          sections={sections}
          assets={assets}
          onClose={() => setShowPublishModal(false)} 
        />
      )}

      {importReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">Manifest Import Report</h3>
              <button onClick={() => setImportReport(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">{importReport.totalItems}</div>
                  <div className="text-xs font-medium text-blue-800 uppercase tracking-wide">Assets Found</div>
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
