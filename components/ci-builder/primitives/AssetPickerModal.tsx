"use client";

import React, { useState } from "react";
import { X, UploadCloud, Image as ImageIcon, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { CIAsset, generateUUID } from "@/lib/ci-builder/types";
import { BRAND_GUIDELINES_BUCKET, sanitizeStorageFileName } from "@/lib/brand-guideline/storage";

export interface AssetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAsset: (asset: Partial<CIAsset>) => void;
  guidelineId: string;
  availableAssets: Partial<CIAsset>[];
  compatibleKind?: string;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
}

export function AssetPickerModal({
  isOpen,
  onClose,
  onSelectAsset,
  guidelineId,
  availableAssets = [],
  compatibleKind,
  onAddAssetRecord
}: AssetPickerModalProps) {
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"existing" | "upload">("existing");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredAssets = compatibleKind 
    ? availableAssets.filter(a => !a.kind || a.kind === compatibleKind || compatibleKind === 'all')
    : availableAssets;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !guidelineId) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = sanitizeStorageFileName(file.name);
      const storagePath = `${guidelineId}/${Date.now()}_${safeName}`;
      
      // 1. Upload to Supabase storage
      const { error: uploadErr } = await supabase.storage
        .from(BRAND_GUIDELINES_BUCKET)
        .upload(storagePath, file, { contentType: file.type || "image/png" });

      if (uploadErr) {
        throw uploadErr;
      }

      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(BRAND_GUIDELINES_BUCKET)
        .getPublicUrl(storagePath);

      const publicUrl = publicUrlData.publicUrl;

      // 3. Create asset record in database
      const newAssetPayload: Partial<CIAsset> = {
        id: generateUUID(),
        guideline_id: guidelineId,
        kind: compatibleKind || "general",
        storage_path: storagePath,
        public_url: publicUrl,
        label: file.name.replace(/\.[^/.]+$/, ""),
        caption: null,
        metadata: { uploaded_at: new Date().toISOString() },
        sort_order: availableAssets.length
      };

      const { data: inserted, error: dbErr } = await (supabase as any)
        .from("ci_assets")
        .insert(newAssetPayload)
        .select()
        .single();

      const createdAsset = inserted || newAssetPayload;
      if (onAddAssetRecord) {
        onAddAssetRecord(createdAsset);
      }

      onSelectAsset(createdAsset);
      onClose();
    } catch (err: any) {
      console.error("Asset upload error:", err);
      alert(`Failed to upload asset: ${err.message || err}`);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-600" />
              Select Asset
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {compatibleKind ? `Showing assets for: ${compatibleKind}` : "Choose an asset or upload a new one"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5 bg-gray-50/30">
          <button
            onClick={() => setActiveTab("existing")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "existing"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Existing Assets ({filteredAssets.length})
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "upload"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" /> Upload New
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto min-h-[300px]">
          {activeTab === "existing" ? (
            filteredAssets.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No compatible assets found.</p>
                <button
                  onClick={() => setActiveTab("upload")}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                >
                  Upload New Asset
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {filteredAssets.map((ast) => {
                  const isSel = selectedId === ast.id;
                  const imgUrl = ast.public_url || ast.storage_path;
                  return (
                    <div
                      key={ast.id}
                      onClick={() => {
                        setSelectedId(ast.id!);
                        onSelectAsset(ast);
                        onClose();
                      }}
                      className={`group relative bg-white border-2 rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                        isSel ? "border-blue-600 ring-2 ring-blue-200" : "border-gray-200 hover:border-blue-400"
                      }`}
                    >
                      <div className="h-28 bg-gray-50 flex items-center justify-center p-2 border-b border-gray-100">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={ast.label || "Asset"}
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">No Image</span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-medium text-gray-800 truncate" title={ast.label || ""}>
                          {ast.label || "Untitled Asset"}
                        </p>
                      </div>
                      {isSel && (
                        <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1 shadow">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-2xl p-8 text-center transition-colors bg-gray-50/50">
              <UploadCloud className="w-12 h-12 text-blue-500 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-gray-800 mb-1">Upload a new image asset</h4>
              <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
                Supports PNG, SVG, JPG, WebP. File will be uploaded to Supabase Storage and auto-selected.
              </p>
              
              <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-5 py-2.5 rounded-lg cursor-pointer transition-colors shadow-sm">
                {uploading ? "Uploading file..." : "Browse Local File"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
