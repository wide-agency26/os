"use client";

import React, { useState } from "react";
import { Image as ImageIcon, Pencil, Upload } from "lucide-react";
import { CIAsset } from "@/lib/ci-builder/types";
import { AssetPickerModal } from "./AssetPickerModal";
import { CiMediaImage } from "@/components/ci-builder/CiMediaImage";
import { getCiAssetDragId } from "@/lib/ci-builder/asset-drag";

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
  imageClassName = "max-w-full max-h-full w-auto h-auto object-contain",
  children,
  onAddAssetRecord,
}: EditableImageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dropActive, setDropActive] = useState(false);

  const matchedAsset = availableAssets.find((a) => a.id === assetId);
  const displayUrl = matchedAsset?.public_url || matchedAsset?.storage_path || currentUrl;

  const applyDroppedAsset = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDropActive(false);
    const id = getCiAssetDragId(event);
    if (!id) return;
    const hit = availableAssets.find((a) => a.id === id);
    if (hit) onSelectAsset(hit);
  };

  const media = displayUrl ? (
    <CiMediaImage
      src={displayUrl}
      alt={alt}
      sizes="(max-width: 768px) 100vw, 480px"
      className={`ci-logo-media ${imageClassName}`}
    />
  ) : null;

  if (!isAdmin) {
    if (children) return <>{children}</>;
    return (
      <div
        className={`relative flex items-center justify-center min-h-0 min-w-0 overflow-hidden w-full h-full ${className}`}
      >
        {media || (
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
        className={`group relative cursor-pointer overflow-hidden rounded-xl border transition-all flex items-center justify-center min-h-0 min-w-0 w-full h-full ${
          dropActive
            ? "border-gray-900 ring-2 ring-gray-300"
            : "border-transparent hover:border-gray-400 hover:ring-2 hover:ring-gray-200"
        } ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsModalOpen(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={applyDroppedAsset}
        title="Click to replace, or drop a Figma asset here"
      >
        {children ? (
          children
        ) : displayUrl ? (
          media
        ) : (
          <div className="w-full h-full min-h-40 bg-gray-100 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-xl">
            <Upload className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs font-medium text-gray-600">
              {dropActive ? "Drop Figma asset" : "Upload or pick from Figma"}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-all text-white font-medium text-xs">
          <span className="bg-gray-900 p-2 rounded-full shadow-lg">
            <Pencil className="w-4 h-4" />
          </span>
          <span>{displayUrl ? "Replace" : "Add image"}</span>
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
