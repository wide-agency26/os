"use client";

import React from "react";
import { CISection, GridFramesSectionData, CIAsset } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";

export function GridFramesSection({ 
  section, 
  assets, 
  isAdmin 
}: { 
  section: Partial<CISection>; 
  assets: Partial<CIAsset>[]; 
  isAdmin?: boolean 
}) {
  const data = (section.data || {}) as GridFramesSectionData;

  const getAssetUrl = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    return asset?.public_url || asset?.storage_path || "";
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {data.frames?.length > 0 ? (
          data.frames.map((frame) => (
            <div key={frame.id} className="group relative">
              <div className="bg-[var(--ci-border,#eaeaea)] rounded-xl overflow-hidden aspect-square mb-4 relative flex items-center justify-center">
                <img 
                  src={getAssetUrl(frame.assetId)} 
                  alt={frame.label}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNjY2MiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';
                  }}
                />
                {isAdmin && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="bg-white text-gray-900 px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50">
                      Replace Image
                    </button>
                  </div>
                )}
              </div>
              <h4 className="text-lg font-semibold text-[var(--ci-text,#111)]">
                {frame.label} {frame.aspectRatio && <span className="text-[var(--ci-text-muted,#666)] font-normal ml-2">{frame.aspectRatio}</span>}
              </h4>
              {frame.sublabel && (
                <p className="text-sm text-[var(--ci-text-muted,#666)] mt-1">{frame.sublabel}</p>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full p-8 border border-dashed border-[var(--ci-border,#eaeaea)] rounded-xl text-center text-[var(--ci-text-muted,#666)]">
            No grid frames defined.
          </div>
        )}
      </div>
    </SectionContainer>
  );
}
