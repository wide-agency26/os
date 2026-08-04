"use client";

import React, { useState } from "react";
import { Image as ImageIcon, Pencil, Upload } from "lucide-react";
import { CIAsset } from "@/lib/ci-builder/types";
import { AssetPickerModal } from "./AssetPickerModal";

export interface EditableImageProps {
  assetId?: string;
  currentUrl?: string;
  onSelectAsset: (asset: Partial<CIAsset>) => void;
  guidelineId?: string;
  availableAssets?: Partial<CIAsset>[];
  compatibleKind?: string;
  isAdmin?: boolean;
  alt?: string;
  className?: string;
  imageClassName?: string;
  children?: React.ReactNode;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
}

export function EditableImage({
  assetId,
  currentUrl,
  onSelectAsset,
  guidelineId = "",
  availableAssets = [],
  compatibleKind,
  isAdmin = false,
  alt = "Image asset",
  className = "",
  imageClassName = "max-w-full max-h-full object-contain",
  children,
  onAddAssetRecord
}: EditableImageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Find asset if assetId provided
  const matchedAsset = availableAssets.find((a) => a.id === assetId);
  const displayUrl = matchedAsset?.public_url || matchedAsset?.storage_path || currentUrl;

  if (!isAdmin) {
    if (children) return <>{children}</>;
    return (
      <div className={className}>
        {displayUrl ? (
          <img src={displayUrl} alt={alt} className={imageClassName} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
            <ImageIcon className="w-6 h-6 opacity-40" />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className={`group relative cursor-pointer overflow-hidden rounded-xl border border-transparent hover:border-blue-400 hover:ring-2 hover:ring-blue-300 transition-all ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsModalOpen(true);
        }}
        title="Click to replace image asset"
      >
        {children ? (
          children
        ) : displayUrl ? (
          <img src={displayUrl} alt={alt} className={imageClassName} />
        ) : (
          <div className="w-full h-40 bg-gray-100 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-xl">
            <Upload className="w-8 h-8 mb-2 opacity-50 text-blue-500" />
            <span className="text-xs font-medium text-gray-600">Select Image Asset</span>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-blue-950/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-all text-white font-medium text-xs">
          <span className="bg-blue-600 p-2 rounded-full shadow-lg">
            <Pencil className="w-4 h-4" />
          </span>
          <span>Replace Image</span>
        </div>
      </div>

      <AssetPickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectAsset={onSelectAsset}
        guidelineId={guidelineId}
        availableAssets={availableAssets}
        compatibleKind={compatibleKind}
        onAddAssetRecord={onAddAssetRecord}
      />
    </>
  );
}
