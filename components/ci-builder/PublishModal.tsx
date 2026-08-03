"use client";

import React, { useState } from "react";
import { X, ExternalLink, Copy } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface PublishModalProps {
  guideline: any;
  sections: any[];
  assets: any[];
  onClose: () => void;
}

export function PublishModal({ guideline, sections, assets, onClose }: PublishModalProps) {
  const [slug, setSlug] = useState(guideline?.slug || "");
  const [loading, setLoading] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(guideline?.status === 'published' ? guideline.slug : null);

  const handlePublish = async () => {
    if (!slug.trim()) return alert("Please enter a URL slug.");
    
    setLoading(true);
    const supabase = createClient();
    
    // 1. Update guideline with slug & status
    const { error: gErr } = await (supabase as any)
      .from('ci_guidelines')
      .update({ 
        slug: slug.trim(),
        status: 'published',
        published_at: new Date().toISOString()
      })
      .eq('id', guideline.id);
      
    if (gErr) {
      console.error(gErr);
      setLoading(false);
      return alert("Failed to update guideline. Slug might be taken.");
    }

    // 2. Create version snapshot
    const contentPayload = {
      theme: guideline.theme,
      sections,
      assets
    };
    
    const { error: vErr } = await (supabase as any)
      .from('ci_guideline_versions')
      .insert({
        guideline_id: guideline.id,
        is_published: true,
        content: contentPayload
      });
      
    if (vErr) {
      console.error(vErr);
    } else {
      setPublishedSlug(slug.trim());
    }
    
    setLoading(false);
  };

  const publishUrl = typeof window !== 'undefined' ? `${window.location.origin}/g/${publishedSlug}` : `/g/${publishedSlug}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Publish Guideline</h2>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {publishedSlug ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Successfully Published!</h3>
              <p className="text-sm text-gray-500">Your brand guideline is now live and accessible to anyone with the link.</p>
              
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={publishUrl}
                  className="flex-1 bg-transparent text-sm text-gray-600 outline-none"
                />
                <button 
                  onClick={() => navigator.clipboard.writeText(publishUrl)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                  title="Copy link"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <a 
                  href={publishUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                  title="Open link"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Public URL Slug
                </label>
                <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow">
                  <span className="text-gray-400 text-sm py-3 select-none">domain.com/g/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="acme-corp"
                    className="flex-1 text-sm py-3 outline-none min-w-0"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  This will be the public link to share with clients and partners.
                </p>
              </div>
              
              <button
                onClick={handlePublish}
                disabled={loading || !slug.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Publish Guideline</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
