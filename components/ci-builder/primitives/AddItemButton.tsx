"use client";

import React from "react";
import { Plus } from "lucide-react";

export interface AddItemButtonProps {
  label: string;
  onClick: () => void;
  isAdmin?: boolean;
  variant?: "tile" | "button" | "dashed-card" | "shade";
  className?: string;
}

export function AddItemButton({
  label,
  onClick,
  isAdmin = false,
  variant = "button",
  className = ""
}: AddItemButtonProps) {
  if (!isAdmin) return null;

  if (variant === "shade") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-[132px] min-h-[150px] rounded-[14px] border-[1.5px] border-dashed border-[var(--ci-text,#111)]/20 hover:border-[var(--ci-text,#111)]/45 text-[var(--ci-muted,#8e8e9f)] hover:text-[var(--ci-text,#111)] flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-transparent box-border transition-colors ${className}`}
      >
        <Plus className="w-[18px] h-[18px]" strokeWidth={1.8} />
        <span className="text-[11px] font-medium">{label}</span>
      </button>
    );
  }

  if (variant === "dashed-card" || variant === "tile") {
    return (
      <button
        onClick={onClick}
        className={`group relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gray-50/50 hover:bg-blue-50/30 rounded-xl transition-all min-h-[140px] text-gray-500 hover:text-blue-600 ${className}`}
      >
        <div className="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-200 group-hover:border-blue-400 group-hover:scale-110 flex items-center justify-center mb-2 transition-all">
          <Plus className="w-5 h-5 text-blue-600" />
        </div>
        <span className="text-xs font-semibold">{label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-blue-400 hover:border-blue-600 bg-blue-50/50 hover:bg-blue-100/50 text-blue-700 font-semibold text-xs rounded-lg transition-colors ${className}`}
    >
      <Plus className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
