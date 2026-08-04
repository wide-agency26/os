"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { CISection, CIAsset } from "@/lib/ci-builder/types";
import { SectionRenderer } from "./sections/index";
import { parseManifest } from "@/lib/ci-builder/parser";
import { CI_GLOSSARY } from "@/lib/ci-builder/glossary";
import { Settings, Share, UploadCloud, Plus, GripVertical } from "lucide-react";
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

    setUploading(true);
    try {
      const text = await file.text();
      const manifest = JSON.parse(text);
      const parsed = parseManifest(manifest);

      if (parsed.sections.length === 0) {
        alert(`Manifest parsed, but 0 sections were matched. Try adding sections manually or check your JSON format.`);
      } else {
        alert("Manifest parsed successfully! (Note: Images are placeholders until actual files are uploaded to storage)");
      }
      
      const newSections = parsed.sections.map((s, i) => ({
        ...s,
        id: `temp_${i}`,
        guideline_id: guideline.id,
        position: i
      }));
      setSections(newSections);
      
      const newAssets = parsed.assets.map(a => ({
        ...a,
        guideline_id: guideline.id
      }));
      setAssets(newAssets);
      
      // Update theme if suggestions exist
      if (parsed.themeSuggested && Object.keys(parsed.themeSuggested).length > 0) {
        setGuideline({ ...guideline, theme: { ...guideline.theme, ...parsed.themeSuggested } });
      }

    } catch (err) {
      console.error(err);
      alert("Failed to parse manifest. Please ensure it is valid JSON.");
    } finally {
      setUploading(false);
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
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Sections</h3>
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
          {sections.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
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
    </div>
  );
}
