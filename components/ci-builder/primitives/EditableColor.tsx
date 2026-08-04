"use client";

import React, { useState, useEffect, useRef } from "react";
import { Pencil, Check, X, Copy } from "lucide-react";
import { ColorSwatch } from "@/lib/ci-builder/types";

export interface EditableColorProps {
  swatch: ColorSwatch;
  onUpdate?: (updatedSwatch: ColorSwatch) => void;
  isAdmin?: boolean;
  className?: string;
}

export function EditableColor({
  swatch,
  onUpdate,
  isAdmin = false,
  className = ""
}: EditableColorProps) {
  const [copied, setCopied] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [draftHex, setDraftHex] = useState(swatch.hex);
  const [draftName, setDraftName] = useState(swatch.name);
  const [draftCssVar, setDraftCssVar] = useState(swatch.cssVar || "");

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftHex(swatch.hex);
    setDraftName(swatch.name);
    setDraftCssVar(swatch.cssVar || "");
  }, [swatch]);

  // Click outside listener for popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    }
    if (isPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPopoverOpen]);

  const copyHex = () => {
    navigator.clipboard.writeText(swatch.hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate({
        ...swatch,
        name: draftName,
        hex: draftHex,
        cssVar: draftCssVar || undefined
      });
    }
    setIsPopoverOpen(false);
  };

  return (
    <div className={`relative group flex flex-col rounded-xl overflow-hidden shadow-sm border border-[var(--ci-border,#eaeaea)] bg-white ${className}`}>
      {/* Color Swatch Block */}
      <div
        className="h-32 w-full transition-transform duration-200 group-hover:scale-105 cursor-pointer relative"
        style={{ backgroundColor: swatch.hex }}
        onClick={copyHex}
        title="Click to copy HEX code"
      >
        {copied && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center text-white text-xs font-semibold animate-in fade-in duration-150">
            Copied!
          </div>
        )}
      </div>

      {/* Details Footer */}
      <div className="p-3.5 bg-white flex flex-col justify-between flex-1">
        <p className="font-medium text-[var(--ci-text,#111)] text-xs truncate" title={swatch.name}>
          {swatch.name}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[var(--ci-text-muted,#666)] text-[11px] uppercase font-mono tracking-wide">
            {swatch.hex}
          </p>
          {swatch.cssVar && (
            <p className="text-[10px] text-gray-400 font-mono truncate max-w-[80px]" title={swatch.cssVar}>
              {swatch.cssVar}
            </p>
          )}
        </div>
      </div>

      {/* Admin Edit Pencil Badge (Top Right Corner) */}
      {isAdmin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsPopoverOpen(!isPopoverOpen);
          }}
          className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-md text-gray-700 hover:text-blue-600 hover:scale-110 opacity-0 group-hover:opacity-100 transition-all z-10"
          title="Edit color details"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Edit Popover */}
      {isPopoverOpen && (
        <div
          ref={popoverRef}
          className="absolute top-12 right-2 z-30 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="font-semibold text-gray-800">Edit Color</span>
            <button
              onClick={() => setIsPopoverOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Color Picker + Hex */}
          <div>
            <label className="block font-medium text-gray-600 mb-1">Color Value</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draftHex.startsWith("#") ? draftHex : "#000000"}
                onChange={(e) => setDraftHex(e.target.value)}
                className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0 overflow-hidden shrink-0"
              />
              <input
                type="text"
                value={draftHex}
                onChange={(e) => setDraftHex(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-2 py-1 font-mono uppercase text-xs"
                placeholder="#000000"
              />
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label className="block font-medium text-gray-600 mb-1">Color Name</label>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
              placeholder="Primary Brand"
            />
          </div>

          {/* CSS Var Field */}
          <div>
            <label className="block font-medium text-gray-600 mb-1">CSS Variable (Optional)</label>
            <input
              type="text"
              value={draftCssVar}
              onChange={(e) => setDraftCssVar(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 font-mono text-xs"
              placeholder="--color-primary"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => setIsPopoverOpen(false)}
              className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
