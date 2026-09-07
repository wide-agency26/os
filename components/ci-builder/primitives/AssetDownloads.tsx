"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, ExternalLink } from "lucide-react";
import type { CIAsset } from "@/lib/ci-builder/types";
import { getSubModule } from "@/lib/ci-builder/modules-catalog";
import {
  downloadApiHref,
  downloadFilename,
  isSafeHttpUrl,
  parseDownloads,
  type CiDownloadsConfig,
} from "@/lib/ci-builder/downloads";

const btnClass =
  "ci-dl-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold";

export function AssetDownloadButtons({
  asset,
  config,
  filename,
  compact,
  mode = "full",
}: {
  asset?: Partial<CIAsset>;
  config: CiDownloadsConfig;
  filename?: string;
  compact?: boolean;
  mode?: "full" | "files" | "drive";
}) {
  const label = filename || asset?.label || "asset";
  const assetId = asset?.id;
  const showPng = (mode === "full" || mode === "files") && config.offerPng && Boolean(assetId);
  const showOriginal =
    (mode === "full" || mode === "files") &&
    config.offerOriginal &&
    Boolean(assetId && asset?.public_url);
  const showDrive =
    (mode === "full" || mode === "drive") &&
    Boolean(config.driveUrl && isSafeHttpUrl(config.driveUrl));
  if (!showPng && !showOriginal && !showDrive) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "mt-2"}`}>
      {showPng && assetId ? (
        <a
          href={downloadApiHref({
            assetId,
            kind: "png",
            name: downloadFilename(label, "png", asset),
          })}
          className={btnClass}
        >
          <Download size={12} /> PNG
        </a>
      ) : null}
      {showOriginal && assetId ? (
        <a
          href={downloadApiHref({
            assetId,
            kind: "original",
            name: downloadFilename(label, "original", asset),
          })}
          className={btnClass}
        >
          <Download size={12} /> Original
        </a>
      ) : null}
      {showDrive ? (
        <a
          href={config.driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={btnClass}
        >
          <ExternalLink size={12} /> {config.driveLabel || "Working files"}
        </a>
      ) : null}
    </div>
  );
}

function DownloadsFields({
  sectionType,
  config,
  onChange,
}: {
  sectionType?: string | null;
  config: CiDownloadsConfig;
  onChange: (next: CiDownloadsConfig) => void;
}) {
  const def = getSubModule(sectionType);
  const moduleLabel = def?.moduleLabel || "module";
  const patch = (partial: Partial<CiDownloadsConfig>) => onChange({ ...config, ...partial });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={config.showOnSubmodule}
            onChange={(e) => patch({ showOnSubmodule: e.target.checked })}
          />
          This sub-module
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={config.showOnModule}
            onChange={(e) => patch({ showOnModule: e.target.checked })}
          />
          {moduleLabel} header
        </label>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={config.offerPng}
            onChange={(e) => patch({ offerPng: e.target.checked })}
          />
          PNG
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={config.offerOriginal}
            onChange={(e) => patch({ offerOriginal: e.target.checked })}
          />
          Original file
        </label>
      </div>
      <input
        type="url"
        value={config.driveUrl}
        onChange={(e) => patch({ driveUrl: e.target.value })}
        placeholder="https://drive.google.com/…"
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800"
      />
      <input
        type="text"
        value={config.driveLabel}
        onChange={(e) => patch({ driveLabel: e.target.value })}
        placeholder="Working files"
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800"
      />
    </div>
  );
}

export function AdminDownloadsStrip({
  sectionType,
  config,
  asset,
  filename,
  onChange,
  popover,
}: {
  sectionType?: string | null;
  config: CiDownloadsConfig;
  asset?: Partial<CIAsset>;
  filename?: string;
  onChange: (next: CiDownloadsConfig) => void;
  popover?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = config.showOnSubmodule || config.showOnModule;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (popover) {
    return (
      <div ref={rootRef} className="relative shrink-0 no-print">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Downloads for Elements"
          className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors ${
            active
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 text-gray-400 hover:text-gray-800 hover:bg-gray-50"
          }`}
        >
          <Download size={13} />
        </button>
        {open ? (
          <div className="ci-chrome absolute right-0 top-full z-[80] mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,.12)] text-gray-900">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Downloads
            </p>
            <DownloadsFields
              sectionType={sectionType}
              config={config}
              onChange={onChange}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <details className="rounded-xl border border-gray-200 bg-white no-print">
      <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between gap-2 text-xs font-semibold text-gray-700 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <Download size={12} />
          Downloads
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {active ? "On in Elements" : "Off"}
        </span>
      </summary>
      <div className="px-3 pb-3 pt-1 border-t border-gray-100">
        <DownloadsFields
          sectionType={sectionType}
          config={config}
          onChange={onChange}
        />
        {active ? (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">
              Preview
            </p>
            <AssetDownloadButtons asset={asset} config={config} filename={filename} />
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function ModuleDownloadsBar({
  entries,
}: {
  entries: {
    sectionId: string;
    label: string;
    asset?: Partial<CIAsset>;
    downloads: CiDownloadsConfig;
  }[];
}) {
  if (!entries.length) return null;
  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-12 pb-2 no-print">
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Downloads
        </p>
        {entries.map((entry) => (
          <div
            key={entry.sectionId}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-xs font-semibold text-gray-700 min-w-[7rem]">
              {entry.label}
            </span>
            <AssetDownloadButtons
              asset={entry.asset}
              config={entry.downloads}
              filename={entry.label}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssetClickDownload({
  asset,
  filename,
  children,
}: {
  asset?: Partial<CIAsset>;
  filename?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const assetId = asset?.id;
  if (!assetId) return <>{children}</>;
  const label = filename || asset?.label || "logo";
  const pngHref = downloadApiHref({
    assetId,
    kind: "png",
    name: downloadFilename(label, "png", asset),
  });
  const originalHref = downloadApiHref({
    assetId,
    kind: "original",
    name: downloadFilename(label, "original", asset),
  });

  return (
    <div
      className="group relative w-full h-full min-h-0 flex items-center justify-center"
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="contents cursor-pointer"
        onClick={() => setOpen((v) => !v)}
        title="Download logo"
      >
        {children}
      </button>
      <div
        className={`absolute inset-x-2 bottom-2 flex justify-center gap-1.5 transition-opacity ${
          open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <a
          href={pngHref}
          className="ci-dl-btn inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold shadow-sm border"
          onClick={(e) => e.stopPropagation()}
        >
          <Download size={11} /> PNG
        </a>
        <a
          href={originalHref}
          className="ci-dl-btn inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold shadow-sm border"
          onClick={(e) => e.stopPropagation()}
        >
          <Download size={11} /> Original
        </a>
      </div>
    </div>
  );
}

export { parseDownloads };
