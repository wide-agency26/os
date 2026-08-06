"use client";

import React, { useMemo, useState } from "react";
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

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function PublishModal({
  guideline,
  sections,
  assets,
  onClose,
  onFlushSaves,
  saveStatus = "saved",
}: PublishModalProps) {
  const [slug, setSlug] = useState(
    guideline?.slug || slugify(guideline?.projects?.title || guideline?.id || "brand-guide")
  );
  const [loading, setLoading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(
    guideline?.status === "published" ? guideline.slug : null
  );

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://os-bice-nine.vercel.app";

  const clientGuidelineUrl = useMemo(
    () => `${origin}/app/client-guidelines/${publishedSlug || slug.trim()}`,
    [origin, publishedSlug, slug]
  );
  const clientLibraryUrl = useMemo(() => `${origin}/app/client-guidelines`, [origin]);

  const handlePublish = async () => {
    if (!slug.trim()) return alert("Please enter a URL slug.");
    setPublishError(null);
    setLoading(true);

    try {
      if (onFlushSaves) {
        const flushOk = await onFlushSaves();
        if (!flushOk || saveStatus === "error") {
          setLoading(false);
          setPublishError(
            "Some changes haven't saved yet — please click Save or retry before publishing."
          );
          return;
        }
      }

      const supabase = createClient();
      const cleanSlug = slug.trim();

      const { error: gErr } = await supabase
        .from("ci_guidelines")
        .update({
          slug: cleanSlug,
          status: "published",
          published_at: new Date().toISOString(),
        })
        .eq("id", guideline.id);

      if (gErr) {
        setLoading(false);
        setPublishError(`Failed to update guideline status: ${gErr.message}`);
        return;
      }

      await supabase
        .from("ci_guideline_versions")
        .update({ is_published: false })
        .eq("guideline_id", guideline.id);

      const contentPayload = {
        theme: guideline.theme || {},
        sections: sections || [],
        assets: assets || [],
      };

      const { error: vErr } = await supabase.from("ci_guideline_versions").insert({
        guideline_id: guideline.id,
        is_published: true,
        content: contentPayload,
      });

      if (vErr) {
        setLoading(false);
        setPublishError(`Failed to write version snapshot: ${vErr.message}`);
        return;
      }

      const { data: verifiedVersion, error: verifyErr } = await supabase
        .from("ci_guideline_versions")
        .select("id, content")
        .eq("guideline_id", guideline.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (verifyErr || !verifiedVersion?.content) {
        setLoading(false);
        setPublishError(
          "Publish verification failed — could not confirm published snapshot in database."
        );
        return;
      }

      setPublishedSlug(cleanSlug);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setPublishError(`Unexpected error during publish: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Publish Guideline</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
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
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Published</h3>
                <p className="text-sm text-gray-500">
                  Clients with company access will see this under Brand Guidelines.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700">
                  Client guideline link
                </label>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={clientGuidelineUrl}
                    className="flex-1 bg-transparent text-xs text-gray-900 outline-none min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(clientGuidelineUrl)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                    title="Copy link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <a
                    href={clientGuidelineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    title="Open"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700">
                  Client library (all guidelines)
                </label>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={clientLibraryUrl}
                    className="flex-1 bg-transparent text-xs text-gray-900 outline-none min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(clientLibraryUrl)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                    title="Copy link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">URL slug</label>
                <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <span className="text-gray-400 text-[11px] py-3 select-none shrink-0">
                    …/client-guidelines/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) =>
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                    }
                    placeholder="munich-startup"
                    className="flex-1 text-sm py-3 outline-none min-w-0 bg-white text-gray-900 placeholder:text-gray-400"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Clients open:{" "}
                  <span className="font-mono text-gray-700">/app/client-guidelines/{slug || "…"}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={handlePublish}
                disabled={loading || !slug.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Publish for clients</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
