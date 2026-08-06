"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Pencil, Check, X, Copy } from "lucide-react";
import { ColorSwatch } from "@/lib/ci-builder/types";
import { triggerToast } from "../Toast";
import { ciFieldClass, ciFieldMonoClass } from "./formStyles";

export interface EditableColorProps {
  swatch: ColorSwatch;
  onUpdate?: (updatedSwatch: ColorSwatch) => void;
  isAdmin?: boolean;
  className?: string;
  /** Open the edit panel immediately (e.g. after "+ Add Color") */
  startEditing?: boolean;
  onEditingHandled?: () => void;
}

/** Normalize any color string to #RRGGBB for <input type="color"> */
function toHexColor(value: string): string {
  const raw = (value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const rgb = raw.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i
  );
  if (rgb) {
    const hex = [rgb[1], rgb[2], rgb[3]]
      .map((n) => Math.min(255, Math.max(0, parseInt(n, 10))).toString(16).padStart(2, "0"))
      .join("");
    return `#${hex}`;
  }
  return "#000000";
}

function suggestCssVar(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `--color-${slug}` : "";
}

export function EditableColor({
  swatch,
  onUpdate,
  isAdmin = false,
  className = "",
  startEditing = false,
  onEditingHandled,
}: EditableColorProps) {
  const [copied, setCopied] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [draftHex, setDraftHex] = useState(toHexColor(swatch.hex));
  const [draftName, setDraftName] = useState(swatch.name);
  const [draftCssVar, setDraftCssVar] = useState(swatch.cssVar || "");

  const hexInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDraftHex(toHexColor(swatch.hex));
    setDraftName(swatch.name);
    setDraftCssVar(swatch.cssVar || "");
  }, [swatch]);

  useEffect(() => {
    if (startEditing && isAdmin) {
      setIsPopoverOpen(true);
      onEditingHandled?.();
      requestAnimationFrame(() => hexInputRef.current?.focus());
    }
  }, [startEditing, isAdmin, onEditingHandled]);

  useEffect(() => {
    if (!isPopoverOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsPopoverOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isPopoverOpen]);

  const copyHex = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const hex = toHexColor(swatch.hex);
    navigator.clipboard.writeText(hex);
    setCopied(true);
    triggerToast(`Copied ${hex}`);
    setTimeout(() => setCopied(false), 2000);
  };

  const openEditor = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isAdmin) {
      copyHex();
      return;
    }
    setDraftHex(toHexColor(swatch.hex));
    setDraftName(swatch.name);
    setDraftCssVar(swatch.cssVar || "");
    setIsPopoverOpen(true);
  };

  const handleSave = () => {
    const hex = toHexColor(draftHex);
    const name = draftName.trim() || "Untitled color";
    const cssVar = (draftCssVar.trim() || suggestCssVar(name)) || undefined;
    onUpdate?.({
      ...swatch,
      name,
      hex,
      cssVar,
    });
    setIsPopoverOpen(false);
  };

  const pickerHex = toHexColor(draftHex);

  return (
    <div
      className={`relative group flex flex-col rounded-xl overflow-hidden shadow-sm border border-[var(--ci-border,#eaeaea)] bg-white ${className}`}
    >
      <div
        className={`h-32 w-full transition-transform duration-200 relative ${
          isAdmin ? "cursor-pointer group-hover:scale-[1.02]" : "cursor-pointer group-hover:scale-105"
        }`}
        style={{ backgroundColor: toHexColor(swatch.hex) }}
        onClick={openEditor}
        title={isAdmin ? "Click to edit color" : "Click to copy HEX"}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") openEditor();
        }}
      >
        {copied && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center text-white text-xs font-semibold">
            Copied!
          </div>
        )}
        {isAdmin && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white text-gray-800 text-[11px] font-semibold shadow">
              <Pencil className="w-3 h-3" />
              Edit color
            </span>
          </div>
        )}
      </div>

      <div className="p-3.5 bg-white flex flex-col justify-between flex-1 gap-2">
        <p
          className="font-medium text-[var(--ci-text,#111)] text-xs truncate"
          title={swatch.name}
        >
          {swatch.name}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wide truncate">
            {toHexColor(swatch.hex)}
          </span>
          <button
            type="button"
            onClick={copyHex}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
            title="Copy HEX"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            Copy
          </button>
        </div>
        {swatch.cssVar && (
          <p className="text-[10px] text-gray-400 font-mono truncate" title={swatch.cssVar}>
            {swatch.cssVar}
          </p>
        )}
      </div>

      {mounted &&
        isPopoverOpen &&
        isAdmin &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setIsPopoverOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Edit color"
          >
            <div
              className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 p-6 space-y-4 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="font-semibold text-gray-900 text-sm">Edit Color</span>
                <button
                  type="button"
                  onClick={() => setIsPopoverOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block font-medium text-gray-600 mb-1.5">Pick or type HEX</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={pickerHex}
                    onChange={(e) => setDraftHex(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5 bg-white shrink-0"
                    title="Color picker"
                  />
                  <input
                    ref={hexInputRef}
                    type="text"
                    value={draftHex}
                    onChange={(e) => setDraftHex(e.target.value)}
                    onBlur={() => setDraftHex(toHexColor(draftHex))}
                    className={`flex-1 uppercase ${ciFieldMonoClass}`}
                    placeholder="#000000"
                    autoFocus
                  />
                </div>
                <div
                  className="mt-2 h-10 rounded-lg border border-gray-200"
                  style={{ backgroundColor: pickerHex }}
                  title="Preview"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className={`w-full ${ciFieldClass}`}
                  placeholder="Primary Brand"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-600 mb-1">CSS variable (optional)</label>
                <input
                  type="text"
                  value={draftCssVar}
                  onChange={(e) => setDraftCssVar(e.target.value)}
                  className={`w-full ${ciFieldMonoClass}`}
                  placeholder="--color-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPopoverOpen(false)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium inline-flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
