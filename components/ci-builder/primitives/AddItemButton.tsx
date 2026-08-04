"use client";

import React from "react";
import { Plus } from "lucide-react";

export interface AddItemButtonProps {
  label: string;
  onClick: () => void;
  isAdmin?: boolean;
  variant?: "tile" | "button" | "dashed-card";
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
