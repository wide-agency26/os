"use client";

import React, { useState, useEffect, useRef } from "react";
import { Pencil, Check, X } from "lucide-react";

export interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => void;
  isAdmin?: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  tag?: React.ElementType;
  style?: React.CSSProperties;
  /** chip: no dashed-border overlay — used inside pill tags */
  variant?: "text" | "chip";
}

export function EditableText({
  value = "",
  onSave,
  isAdmin = false,
  multiline = false,
  placeholder = "Click to edit text...",
  className = "",
  tag: Tag = "div",
  style,
  variant = "text",
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const wrapClass = multiline ? "whitespace-pre-wrap" : "";

  if (!isAdmin) {
    return (
      <Tag className={`${wrapClass} ${className}`.trim()} style={style}>
        {value || placeholder}
      </Tag>
    );
  }

  const handleSave = () => {
    if (draft.trim() !== value) {
      setStatus("saving");
      onSave(draft);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    const { color: _ignoredColor, backgroundColor: _ignoredBg, ...restStyle } =
      style || {};
    const editStyle: React.CSSProperties = {
      ...restStyle,
      color: "#111827",
      backgroundColor: "#ffffff",
    };

    return (
      <div className={`relative z-20 ${variant === "chip" ? "inline-block" : "inline-block w-full"}`} onClick={(e) => e.stopPropagation()}>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder={placeholder}
            className="w-full p-2 border-2 border-blue-500 rounded bg-white text-gray-900 shadow-lg outline-none font-normal text-base resize-y min-h-[100px] placeholder:text-gray-400"
            style={editStyle}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder={placeholder}
            className={`${variant === "chip" ? "min-w-[8rem]" : "w-full"} p-1.5 border-2 border-blue-500 rounded bg-white text-gray-900 shadow-md outline-none font-normal text-base placeholder:text-gray-400`}
            style={editStyle}
          />
        )}
        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
          <button
            onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            <Check className="w-3.5 h-3.5" /> Save
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); handleCancel(); }}
            className="flex items-center gap-1 px-2 py-1 rounded font-medium bg-[var(--ci-surface)] text-[var(--ci-text)] hover:opacity-80"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
          <span className="ml-2 text-[10px] text-gray-400">
            {multiline ? "Press Ctrl+Enter to save, Esc to cancel" : "Press Enter to save, Esc to cancel"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Tag
      className={
        variant === "chip"
          ? `group relative cursor-pointer inline-flex items-center ${className}`
          : `group relative cursor-pointer border border-transparent hover:border-dashed hover:border-blue-400 rounded px-1 -mx-1 transition-all ${wrapClass} ${className}`
      }
      style={style}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      title="Click to edit"
    >
      <span className={wrapClass}>
        {value || <span className="opacity-40 italic">{placeholder}</span>}
      </span>
      
      <span
        className={`inline-flex items-center ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity align-middle text-[10px] ${
          variant === "chip"
            ? "text-current"
            : "bg-blue-600 text-white p-0.5 rounded shadow-sm"
        }`}
      >
        <Pencil className="w-3 h-3" />
      </span>

      {status === "saved" && (
        <span className="absolute -top-6 right-0 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow animate-pulse">
          Saved!
        </span>
      )}
    </Tag>
  );
}
