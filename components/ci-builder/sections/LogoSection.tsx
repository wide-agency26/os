"use client";

import React from "react";
import { CISection, LogoSectionData, CIAsset } from "@/lib/ci-builder/types";
import { SectionContainer } from "./SectionContainer";

export function LogoSection({ 
  section, 
  assets, 
  isAdmin 
}: { 
  section: Partial<CISection>; 
  assets: Partial<CIAsset>[]; 
  isAdmin?: boolean 
}) {
  const data = (section.data || {}) as LogoSectionData;

  const getAssetUrl = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    return asset?.public_url || asset?.storage_path || ""; // fallback to storage path for previewing if uploaded manually
  };

  return (
    <SectionContainer section={section} isAdmin={isAdmin}>
      <div className="space-y-12">
        {data.logos?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {data.logos.map((logo) => (
              <div 
                key={logo.assetId} 
                className={`relative group rounded-2xl p-8 flex items-center justify-center border border-[var(--ci-border,#eaeaea)] min-h-[250px] ${logo.stage === 'dark' ? 'bg-gray-900' : 'bg-white'}`}
              >
                <img 
                  src={getAssetUrl(logo.assetId)} 
                  alt={logo.label}
                  className="max-w-[80%] max-h-[80%] object-contain"
                  style={{ width: logo.width, objectFit: logo.fit }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNjY2MiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg=='; // image placeholder icon
                  }}
                />
                <div className="absolute bottom-4 left-4">
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${logo.stage === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                    {logo.label}
                  </span>
                </div>

                {isAdmin && (
                  <div className="absolute top-4 right-4 bg-white p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 cursor-pointer text-gray-700 hover:text-blue-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 border border-dashed border-[var(--ci-border,#eaeaea)] rounded-2xl flex flex-col items-center justify-center text-[var(--ci-text-muted,#666)]">
            <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p>No logo assets configured.</p>
          </div>
        )}

        {(data.clearspaceText || data.minSizeDigital || data.minSizePrint) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-[var(--ci-border,#eaeaea)]">
            {data.clearspaceText && (
              <div>
                <h4 className="text-sm font-semibold uppercase text-[var(--ci-text,#111)] mb-2">Clearspace</h4>
                <p className="text-[var(--ci-text-muted,#666)] text-sm">{data.clearspaceText}</p>
              </div>
            )}
            {data.minSizeDigital && (
              <div>
                <h4 className="text-sm font-semibold uppercase text-[var(--ci-text,#111)] mb-2">Minimum Size (Digital)</h4>
                <p className="text-[var(--ci-text-muted,#666)] text-sm">{data.minSizeDigital}</p>
              </div>
            )}
            {data.minSizePrint && (
              <div>
                <h4 className="text-sm font-semibold uppercase text-[var(--ci-text,#111)] mb-2">Minimum Size (Print)</h4>
                <p className="text-[var(--ci-text-muted,#666)] text-sm">{data.minSizePrint}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionContainer>
  );
}
