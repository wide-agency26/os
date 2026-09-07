"use client";

import React, { useState } from "react";
import { Download, Plus, Type } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { CIAsset, generateUUID } from "@/lib/ci-builder/types";
import { BRAND_GUIDELINES_BUCKET, sanitizeStorageFileName } from "@/lib/brand-guideline/storage";
import { downloadApiHref, downloadFilename } from "@/lib/ci-builder/downloads";
import { EditableText } from "./EditableText";
import { EditableListItem } from "./EditableListItem";

export type FontFileRow = {
  id: string;
  assetId: string;
  label: string;
  weight?: string;
  style?: string;
};

const FONT_ACCEPT = ".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf";

function fontFormat(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".woff2")) return "woff2";
  if (path.endsWith(".woff")) return "woff";
  if (path.endsWith(".otf")) return "opentype";
  if (path.endsWith(".ttf")) return "truetype";
  return "woff2";
}

export function FontFilesField({
  files,
  assets,
  isAdmin,
  elements,
  guidelineId,
  sectionId,
  family,
  onChange,
  onAddAssetRecord,
}: {
  files: FontFileRow[];
  assets: Partial<CIAsset>[];
  isAdmin?: boolean;
  elements?: boolean;
  guidelineId?: string;
  sectionId?: string;
  family?: string;
  onChange: (next: FontFileRow[]) => void;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const rows = files.filter((f) => f.assetId || isAdmin);
  if (!isAdmin && rows.length === 0) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !guidelineId) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = sanitizeStorageFileName(file.name);
      const storagePath = `${guidelineId}/fonts/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from(BRAND_GUIDELINES_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (uploadErr) throw uploadErr;
      const { data: publicUrlData } = supabase.storage
        .from(BRAND_GUIDELINES_BUCKET)
        .getPublicUrl(storagePath);
      const payload: Partial<CIAsset> = {
        id: generateUUID(),
        guideline_id: guidelineId,
        section_id: sectionId || null,
        kind: "font",
        storage_path: storagePath,
        public_url: publicUrlData.publicUrl,
        label: file.name.replace(/\.[^/.]+$/, ""),
        caption: null,
        metadata: { uploaded_at: new Date().toISOString(), font: true },
        sort_order: assets.length,
      };
      const { data: inserted, error: dbErr } = await (supabase as any)
        .from("ci_assets")
        .insert(payload)
        .select()
        .single();
      if (dbErr) throw dbErr;
      const created = inserted || payload;
      onAddAssetRecord?.(created);
      onChange([
        ...files,
        {
          id: generateUUID(),
          assetId: created.id || "",
          label: created.label || file.name,
        },
      ]);
    } catch (err: any) {
      console.error("Font upload error:", err);
      alert(`Failed to upload font: ${err.message || err}`);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const faceCss = rows
    .map((row) => {
      const asset = assets.find((a) => a.id === row.assetId);
      if (!asset?.public_url) return "";
      const familyName = (family || row.label || "BrandFont").replace(/['"]/g, "");
      return `@font-face { font-family: '${familyName}'; src: url('${asset.public_url}') format('${fontFormat(asset.public_url)}'); font-weight: ${row.weight || "normal"}; font-style: ${row.style || "normal"}; font-display: swap; }`;
    })
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-2">
      {faceCss ? <style dangerouslySetInnerHTML={{ __html: faceCss }} /> : null}
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ci-text-muted,#666)]">
        Font files
      </p>
      {rows.map((row) => {
        const asset = assets.find((a) => a.id === row.assetId);
        return (
          <EditableListItem
            key={row.id}
            isAdmin={isAdmin}
            onDelete={() => onChange(files.filter((x) => x.id !== row.id))}
          >
            <div className="flex items-center gap-3 rounded-xl border border-[var(--ci-border,#eaeaea)] px-3 py-2.5 bg-[var(--ci-surface,#fff)]">
              <Type className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <EditableText
                  value={row.label}
                  placeholder="Weight / style name"
                  onSave={(label) =>
                    onChange(files.map((x) => (x.id === row.id ? { ...x, label } : x)))
                  }
                  isAdmin={isAdmin}
                  className="text-sm font-medium"
                />
                <p className="text-[11px] text-gray-500 truncate">
                  {asset?.label || "Font file"}
                </p>
              </div>
              {asset?.id ? (
                <a
                  href={downloadApiHref({
                    assetId: asset.id,
                    kind: "original",
                    name: downloadFilename(row.label || asset.label || "font", "original", asset),
                  })}
                  className="ci-dl-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold shrink-0"
                >
                  <Download size={12} />
                  Download
                </a>
              ) : null}
            </div>
          </EditableListItem>
        );
      })}
      {isAdmin ? (
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-[var(--ci-text,#111)]/25 hover:border-[var(--ci-text,#111)]/50 text-[var(--ci-text,#111)] font-semibold text-xs rounded-lg cursor-pointer">
          <Plus className="w-4 h-4" />
          {uploading ? "Uploading…" : "Upload font"}
          <input
            type="file"
            accept={FONT_ACCEPT}
            className="hidden"
            disabled={uploading || !guidelineId}
            onChange={handleUpload}
          />
        </label>
      ) : null}
      {elements && faceCss ? (
        <pre className="mt-2 text-[11px] font-mono text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-3 whitespace-pre-wrap overflow-x-auto">
          {faceCss}
        </pre>
      ) : null}
    </div>
  );
}
