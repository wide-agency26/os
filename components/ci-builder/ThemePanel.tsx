"use client";

import React, { useState } from "react";
import { CITheme } from "@/lib/ci-builder/types";
import { X } from "lucide-react";
import { ciFieldMonoClass, ciSelectClass } from "./primitives/formStyles";

interface ThemePanelProps {
  guideline: any;
  onClose: () => void;
  onUpdate: (theme: CITheme) => void;
}

export function ThemePanel({ guideline, onClose, onUpdate }: ThemePanelProps) {
  const [theme, setTheme] = useState<CITheme>(guideline?.theme || {});

  const handleChange = (field: keyof CITheme, value: any) => {
    const newTheme = { ...theme, [field]: value };
    setTheme(newTheme);
    onUpdate(newTheme);
  };

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-white text-gray-900 border-l border-gray-200 shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Theme Settings</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Background Color</label>
          <div className="flex gap-2">
            <input 
              type="color" 
              value={theme.backgroundColor || "#ffffff"} 
              onChange={(e) => handleChange('backgroundColor', e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300 bg-white"
            />
            <input 
              type="text" 
              value={theme.backgroundColor || "#ffffff"}
              onChange={(e) => handleChange('backgroundColor', e.target.value)}
              className={`flex-1 uppercase ${ciFieldMonoClass}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Text Color</label>
          <div className="flex gap-2">
            <input 
              type="color" 
              value={theme.textColor || "#111111"} 
              onChange={(e) => handleChange('textColor', e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300 bg-white"
            />
            <input 
              type="text" 
              value={theme.textColor || "#111111"}
              onChange={(e) => handleChange('textColor', e.target.value)}
              className={`flex-1 uppercase ${ciFieldMonoClass}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Font Family</label>
          <select 
            value={theme.fontFamily || "Inter, sans-serif"}
            onChange={(e) => handleChange('fontFamily', e.target.value)}
            className={`w-full ${ciSelectClass}`}
          >
            <option value="Inter, sans-serif">Inter</option>
            <option value="Roboto, sans-serif">Roboto</option>
            <option value="Outfit, sans-serif">Outfit</option>
            <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
          </select>
        </div>

        <div className="p-4 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs text-gray-500 mb-2">Preview</p>
          <div 
            className="p-4 rounded shadow-sm"
            style={{ 
              backgroundColor: theme.backgroundColor || '#fff', 
              color: theme.textColor || '#111',
              fontFamily: theme.fontFamily || 'Inter'
            }}
          >
            <h4 className="font-bold text-lg mb-1">Heading</h4>
            <p className="opacity-80">This is how body text will look on the selected background.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
