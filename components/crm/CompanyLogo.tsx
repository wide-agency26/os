"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Globe, Loader2, Upload, X } from "lucide-react";
import {
  fetchCompanyFavicon,
  saveCompanyLogoUrl,
  saveCompanyWebsite,
} from "@/app/actions/company-logo";
import { COMPANY_LOGO_SIZE, companyMarkSrc } from "@/lib/crm/logo";

const ACCEPT = "image/png,image/jpeg,image/webp,image/x-icon,.png,.jpg,.jpeg,.webp,.ico";
const CROP_VIEW = 280;

export function CompanyLogoMark({
  label,
  logoUrl,
  website,
  size = 32,
}: {
  label: string;
  logoUrl?: string | null;
  website?: string | null;
  size?: number;
}) {
  const src = companyMarkSrc({ logoUrl, website });
  const initial = (label || "?").trim().charAt(0).toUpperCase() || "?";
  if (!src) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-md bg-gray-100 text-gray-600 font-semibold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        aria-hidden
      >
        {initial}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="rounded-md object-contain bg-white border border-gray-200 shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

function coverScale(nw: number, nh: number, view: number) {
  return Math.max(view / nw, view / nh);
}

function clampOffset(
  x: number,
  y: number,
  nw: number,
  nh: number,
  scale: number,
  view: number
) {
  const w = nw * scale;
  const h = nh * scale;
  let nx = x;
  let ny = y;
  if (w <= view) nx = (view - w) / 2;
  else nx = Math.min(0, Math.max(view - w, x));
  if (h <= view) ny = (view - h) / 2;
  else ny = Math.min(0, Math.max(view - h, y));
  return { x: nx, y: ny };
}

function LogoCropModal({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const minScale =
    natural.w && natural.h ? coverScale(natural.w, natural.h, CROP_VIEW) : 1;
  const scale = minScale * zoom;

  function onImgLoad(el: HTMLImageElement) {
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    setNatural({ w, h });
    const s = coverScale(w, h, CROP_VIEW);
    setZoom(1);
    setOffset(
      clampOffset(
        (CROP_VIEW - w * s) / 2,
        (CROP_VIEW - h * s) / 2,
        w,
        h,
        s,
        CROP_VIEW
      )
    );
  }

  function setZoomClamped(next: number) {
    const z = Math.min(4, Math.max(1, next));
    const s = minScale * z;
    setZoom(z);
    setOffset((o) =>
      clampOffset(o.x, o.y, natural.w, natural.h, s, CROP_VIEW)
    );
  }

  function exportPng() {
    const img = imgRef.current;
    if (!img || !natural.w) return;
    const canvas = document.createElement("canvas");
    canvas.width = COMPANY_LOGO_SIZE;
    canvas.height = COMPANY_LOGO_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, COMPANY_LOGO_SIZE, COMPANY_LOGO_SIZE);
    const k = COMPANY_LOGO_SIZE / CROP_VIEW;
    ctx.drawImage(
      img,
      offset.x * k,
      offset.y * k,
      natural.w * scale * k,
      natural.h * scale * k
    );
    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
        else onCancel();
      },
      "image/png",
      0.92
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logo-crop-title"
        className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-md p-5 shadow-xl border border-gray-200 max-h-[100dvh] overflow-y-auto"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <p id="logo-crop-title" className="text-[13px] font-semibold text-gray-900">
              Crop to {COMPANY_LOGO_SIZE}×{COMPANY_LOGO_SIZE}
            </p>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Drag to pan, zoom to fill the square. Saved as PNG.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-700"
            aria-label="Cancel crop"
          >
            <X size={16} />
          </button>
        </div>
        <div
          className="relative mx-auto overflow-hidden rounded-lg border border-gray-200 bg-gray-100 cursor-grab active:cursor-grabbing touch-none"
          style={{ width: CROP_VIEW, height: CROP_VIEW }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              ox: offset.x,
              oy: offset.y,
            };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const dx = e.clientX - drag.current.x;
            const dy = e.clientY - drag.current.y;
            setOffset(
              clampOffset(
                drag.current.ox + dx,
                drag.current.oy + dy,
                natural.w,
                natural.h,
                scale,
                CROP_VIEW
              )
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onWheel={(e) => {
            setZoomClamped(zoom + (e.deltaY < 0 ? 0.12 : -0.12));
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => onImgLoad(e.currentTarget)}
              className="absolute max-w-none select-none pointer-events-none left-0 top-0"
              style={{
                width: natural.w * scale || "auto",
                height: natural.h * scale || "auto",
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          ) : null}
        </div>
        <label className="block mt-3 text-[11px] font-medium text-gray-600">
          Zoom
          <input
            type="range"
            min={1}
            max={4}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoomClamped(Number(e.target.value))}
            className="w-full mt-1"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={exportPng}
            className="px-3 py-2 text-xs font-semibold rounded-md bg-gray-900 text-white hover:bg-black"
          >
            Save {COMPANY_LOGO_SIZE}×{COMPANY_LOGO_SIZE}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CompanyLogoEditor({
  companyId,
  label,
  logoUrl,
  website,
  compact,
  placeholderWebsite,
}: {
  companyId: string;
  label: string;
  logoUrl: string | null;
  website: string | null;
  compact?: boolean;
  placeholderWebsite?: string;
}) {
  const [site, setSite] = useState(website || "");
  const [mark, setMark] = useState(logoUrl);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = compact ? 40 : COMPANY_LOGO_SIZE;

  function pickFile(file: File | undefined) {
    if (!file) return;
    const ok =
      /image\/(png|jpeg|jpg|webp|x-icon|vnd.microsoft.icon)/i.test(file.type) ||
      /\.(png|jpe?g|webp|ico)$/i.test(file.name);
    if (!ok) {
      setMsg("Use a PNG or JPG (WebP is fine too).");
      return;
    }
    setMsg(null);
    setCropFile(file);
  }

  function fetchFavicon() {
    setMsg(null);
    startTransition(async () => {
      const nextSite = site.trim() || placeholderWebsite || "";
      if (!nextSite) {
        setMsg("Add a website first (e.g. wide-communication.com).");
        return;
      }
      if (nextSite !== (website || "")) {
        await saveCompanyWebsite(companyId, nextSite);
        if (!site.trim() && placeholderWebsite) setSite(placeholderWebsite);
      }
      const res = await fetchCompanyFavicon(companyId, nextSite);
      if (!res.ok) {
        setMsg(res.error || "Could not fetch favicon");
        return;
      }
      setMark(res.logoUrl || null);
      setMsg(`Pulled ${COMPANY_LOGO_SIZE}px favicon.`);
    });
  }

  async function uploadBlob(blob: Blob) {
    setUploading(true);
    setMsg(null);
    setCropFile(null);
    try {
      const fd = new FormData();
      fd.append("companyId", companyId);
      fd.append("file", blob, "logo.png");
      const res = await fetch("/api/company-logo", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        logoUrl?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Upload failed (${res.status})`);
      }
      setMark(json.logoUrl || null);
      setMsg(`Logo saved at ${COMPANY_LOGO_SIZE}×${COMPANY_LOGO_SIZE}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function clearLogo() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveCompanyLogoUrl(companyId, null);
      if (!res.ok) {
        setMsg(res.error || "Could not clear");
        return;
      }
      setMark(null);
    });
  }

  return (
    <div
      className={
        compact
          ? "space-y-2"
          : "rounded-lg border border-gray-200 bg-white p-3 space-y-2"
      }
    >
      <div className={`flex gap-3 ${compact ? "items-center" : "items-start"}`}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="shrink-0 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          title="Upload PNG or JPG"
        >
          <CompanyLogoMark
            label={label}
            logoUrl={mark}
            website={site || placeholderWebsite}
            size={preview}
          />
        </button>
        <div className="min-w-0 flex-1">
          {!compact && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Logo · {COMPANY_LOGO_SIZE}×{COMPANY_LOGO_SIZE} square
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <input
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder={placeholderWebsite || "website.com"}
              value={site}
              onChange={(e) => setSite(e.target.value)}
              onBlur={() => {
                if (site.trim() !== (website || "")) {
                  void saveCompanyWebsite(companyId, site);
                }
              }}
              className="flex-1 min-w-[10rem] text-[12px] px-2 py-1.5 border border-gray-200 rounded-md"
            />
            <button
              type="button"
              disabled={pending || uploading}
              onClick={fetchFavicon}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
              title="Pull favicon from the website"
            >
              {pending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Globe size={12} />
              )}
              Favicon
            </button>
            <label
              className={`inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-md hover:bg-gray-50 ${
                pending || uploading ? "opacity-50 pointer-events-none" : "cursor-pointer"
              }`}
            >
              {uploading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Upload size={12} />
              )}
              Upload
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                disabled={pending || uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  pickFile(file);
                }}
              />
            </label>
            {mark ? (
              <button
                type="button"
                disabled={pending}
                onClick={clearLogo}
                className="p-1.5 text-gray-400 hover:text-gray-700"
                title="Remove logo"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          {!compact ? (
            <p className="text-[11px] text-gray-500 mt-1.5">
              PNG or JPG — crop and resize to {COMPANY_LOGO_SIZE}×
              {COMPANY_LOGO_SIZE}. Or pull the site favicon.
            </p>
          ) : null}
        </div>
      </div>
      {msg ? (
        <p
          className={`text-[11px] ${
            /fail|could not|use a png|add a website|try again|under 5/i.test(msg)
              ? "text-red-600"
              : "text-gray-500"
          }`}
        >
          {msg}
        </p>
      ) : null}
      {cropFile ? (
        <LogoCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={(blob) => void uploadBlob(blob)}
        />
      ) : null}
    </div>
  );
}
