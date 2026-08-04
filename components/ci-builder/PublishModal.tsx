"use client";

import React, { useState } from "react";
import { X, ExternalLink, Copy, AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface PublishModalProps {
  guideline: any;
  sections: any[];
  assets: any[];
  onClose: () => void;
  onFlushSaves?: () => Promise<boolean>;
  saveStatus?: "saved" | "saving" | "error";
}

export function PublishModal({
  guideline,
  sections,
  assets,
  onClose,
  onFlushSaves,
  saveStatus = "saved"
}: PublishModalProps) {
  const [slug, setSlug] = useState(guideline?.slug || "");
  const [loading, setLoading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(
    guideline?.status === "published" ? guideline.slug : null
  );

  const handlePublish = async () => {
    if (!slug.trim()) return alert("Please enter a URL slug.");
    setPublishError(null);
    setLoading(true);

    try {
      // 1. Flush any pending draft saves before snapshotting
      if (onFlushSaves) {
        const flushOk = await onFlushSaves();
        if (!flushOk || saveStatus === "error") {
          setLoading(false);
          setPublishError("Some changes haven't saved yet — please click Save or retry before publishing.");
          return;
        }
      }

      const supabase = createClient();

      // 2. Update guideline record status & slug
      const { error: gErr } = await (supabase as any)
        .from("ci_guidelines")
        .update({
          slug: slug.trim(),
          status: "published",
          published_at: new Date().toISOString()
        })
        .eq("id", guideline.id);

      if (gErr) {
        console.error("Guideline publish update error:", gErr);
        setLoading(false);
        setPublishError(`Failed to update guideline status: ${gErr.message}`);
        return;
      }

      // 3. Deactivate previous published versions
      await (supabase as any)
        .from("ci_guideline_versions")
        .update({ is_published: false })
        .eq("guideline_id", guideline.id);

      // 4. Create new version snapshot payload
      const contentPayload = {
        theme: guideline.theme || {},
        sections: sections || [],
        assets: assets || []
      };

      const { error: vErr } = await (supabase as any)
        .from("ci_guideline_versions")
        .insert({
          guideline_id: guideline.id,
          is_published: true,
          content: contentPayload
        });

      if (vErr) {
        console.error("Version snapshot insert error:", vErr);
        setLoading(false);
        setPublishError(`Failed to write version snapshot: ${vErr.message}`);
        return;
      }

      // 5. READ-BACK VERIFICATION: Query published version from DB to verify
      const { data: verifiedVersion, error: verifyErr } = await (supabase as any)
        .from("ci_guideline_versions")
        .select("id, content")
        .eq("guideline_id", guideline.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (verifyErr || !verifiedVersion?.content) {
        console.error("Publish verification failed:", verifyErr);
        setLoading(false);
        setPublishError("Publish verification failed — could not confirm published snapshot in database.");
        return;
      }

      // 6. Confirmed read-back matches
      setPublishedSlug(slug.trim());
    } catch (err: any) {
      console.error("Publish unexpected error:", err);
      setPublishError(`Unexpected error during publish: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const publishUrl = typeof window !== "undefined"
    ? `${window.location.origin}/g/${publishedSlug}`
    : `/g/${publishedSlug}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Publish Guideline</h2>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {publishError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold">Publish Blocked</p>
                <p className="mt-0.5 leading-relaxed">{publishError}</p>
              </div>
            </div>
          )}

          {publishedSlug ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Successfully Published & Verified!</h3>
              <p className="text-sm text-gray-500">
                Your brand guideline snapshot is verified in the database and live for clients.
              </p>

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
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
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
