"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, Layers, Loader2 } from "lucide-react";
import { FigmaImportWizard } from "@/components/ci-builder/FigmaImportWizard";

type ImportPanelProps = {
  guidelineId: string;
  projectId: string;
  uploading: boolean;
  linkedFigma?: {
    fileKey: string | null;
    fileName: string | null;
    version: string | null;
    lastImportedAt: string | null;
  } | null;
  onJsonFile: (file: File) => Promise<void>;
  onFigmaImported: (result: {
    sections: any[];
    assets: any[];
    theme: any;
    report: any;
    figma?: { fileKey?: string; fileName?: string; version?: string };
  }) => void;
};

export function ImportPanel({
  guidelineId,
  projectId,
  uploading,
  linkedFigma,
  onJsonFile,
  onFigmaImported,
}: ImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showFigma, setShowFigma] = useState(false);

  return (
    <>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Import
        </p>
        <label className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-medium text-center cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <UploadCloud className="w-4 h-4" />
          )}
          {uploading ? "Parsing & Saving…" : "Import from JSON"}
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await onJsonFile(file);
              if (e.target) e.target.value = "";
            }}
          />
        </label>

        <button
          type="button"
          onClick={() => setShowFigma(true)}
          disabled={uploading}
          className="w-full bg-[#0d0d0d] text-white border border-gray-900 rounded-lg px-3 py-2 text-xs font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Layers className="w-4 h-4" />
          Connect to Figma
        </button>
      </div>

      {showFigma && (
        <FigmaImportWizard
          guidelineId={guidelineId}
          projectId={projectId}
          linkedFigma={linkedFigma}
          onClose={() => setShowFigma(false)}
          onImported={(result) => {
            onFigmaImported(result);
            setShowFigma(false);
          }}
        />
      )}
    </>
  );
}
