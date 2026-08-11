"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CITheme, cssFontStack } from "@/lib/ci-builder/types";
import { AlertTriangle, X } from "lucide-react";
import { ciFieldMonoClass, ciSelectClass } from "./primitives/formStyles";

interface ThemePanelProps {
  guideline: any;
  /** Extra faces discovered in typography section rows (when theme.availableFonts empty). */
  discoveredFonts?: string[];
  onClose: () => void;
  onUpdate: (theme: CITheme) => void;
}

const FALLBACK_PRESETS = [
  "system-ui, -apple-system, sans-serif",
  "Georgia, 'Times New Roman', serif",
  "Arial, Helvetica, sans-serif",
  "ui-monospace, SFMono-Regular, Menlo, monospace",
  "Inter, system-ui, sans-serif",
];

type FontSlot = "primary" | "secondary" | "tertiary";

const SLOT_META: {
  key: FontSlot;
  fontField: keyof CITheme;
  fallbackField: keyof CITheme;
  label: string;
  hint: string;
}[] = [
  {
    key: "primary",
    fontField: "primaryFont",
    fallbackField: "primaryFontFallback",
    label: "Primary font",
    hint: "Headings / brand voice",
  },
  {
    key: "secondary",
    fontField: "secondaryFont",
    fallbackField: "secondaryFontFallback",
    label: "Secondary font",
    hint: "Body / UI",
  },
  {
    key: "tertiary",
    fontField: "tertiaryFont",
    fallbackField: "tertiaryFontFallback",
    label: "Tertiary font",
    hint: "Captions / mono / accent",
  },
];

export function ThemePanel({
  guideline,
  discoveredFonts = [],
  onClose,
  onUpdate,
}: ThemePanelProps) {
  const [theme, setTheme] = useState<CITheme>(guideline?.theme || {});

  useEffect(() => {
    setTheme(guideline?.theme || {});
  }, [guideline?.theme]);

  const availableFonts = useMemo(() => {
    const set = new Set<string>();
    for (const f of theme.availableFonts || []) {
      if (f?.trim()) set.add(f.trim());
    }
    for (const f of discoveredFonts) {
      if (f?.trim()) set.add(f.trim());
    }
    if (theme.primaryFont) set.add(theme.primaryFont);
    if (theme.secondaryFont) set.add(theme.secondaryFont);
    if (theme.tertiaryFont) set.add(theme.tertiaryFont);
    if (theme.fontFamily) {
      const first = theme.fontFamily.split(",")[0]?.replace(/['"]/g, "").trim();
      if (first) set.add(first);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [theme, discoveredFonts]);

  const fontsMissing = availableFonts.length === 0;

  const handleChange = (field: keyof CITheme, value: any) => {
    const newTheme: CITheme = { ...theme, [field]: value };
    // Keep legacy fontFamily in sync with primary stack for older surfaces
    if (
      field === "primaryFont" ||
      field === "primaryFontFallback" ||
      field === "fontFamily"
    ) {
      newTheme.fontFamily = cssFontStack(
        (field === "primaryFont" ? value : newTheme.primaryFont) ||
          newTheme.fontFamily,
        field === "primaryFontFallback"
          ? value
          : newTheme.primaryFontFallback
      );
    }
    setTheme(newTheme);
    onUpdate(newTheme);
  };

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-white text-gray-900 border-l border-gray-200 shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Theme Settings</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded text-gray-500"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        {fontsMissing ? (
          <div className="flex gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-950 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-0.5">No Figma fonts detected</p>
              <p>
                Import from Figma (or JSON with typography) so primary / secondary /
                tertiary faces appear here. You can still type a custom font name
                below.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-gray-500">
            Fonts from import: {availableFonts.join(" · ")}
          </p>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Background Color
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={theme.backgroundColor || "#ffffff"}
              onChange={(e) => handleChange("backgroundColor", e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300 bg-white"
            />
            <input
              type="text"
              value={theme.backgroundColor || "#ffffff"}
              onChange={(e) => handleChange("backgroundColor", e.target.value)}
              className={`flex-1 uppercase ${ciFieldMonoClass}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Text Color
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={theme.textColor || "#111111"}
              onChange={(e) => handleChange("textColor", e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300 bg-white"
            />
            <input
              type="text"
              value={theme.textColor || "#111111"}
              onChange={(e) => handleChange("textColor", e.target.value)}
              className={`flex-1 uppercase ${ciFieldMonoClass}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Accent Color
          </label>
          <p className="text-[10px] text-gray-400 mb-1.5">
            Brand book links, eyebrows, and highlights
          </p>
          <div className="flex gap-2">
            <input
              type="color"
              value={theme.accentColors?.[0] || "#111111"}
              onChange={(e) =>
                handleChange("accentColors", [
                  e.target.value,
                  ...(theme.accentColors || []).slice(1),
                ])
              }
              className="w-8 h-8 rounded cursor-pointer border border-gray-300 bg-white"
            />
            <input
              type="text"
              value={theme.accentColors?.[0] || "#111111"}
              onChange={(e) =>
                handleChange("accentColors", [
                  e.target.value,
                  ...(theme.accentColors || []).slice(1),
                ])
              }
              className={`flex-1 uppercase ${ciFieldMonoClass}`}
            />
          </div>
        </div>

        {SLOT_META.map((slot) => {
          const fontVal = String(theme[slot.fontField] || "");
          const fallbackVal = String(
            theme[slot.fallbackField] || FALLBACK_PRESETS[0]
          );
          return (
            <div key={slot.key} className="space-y-2 border-t border-gray-100 pt-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  {slot.label}
                </label>
                <p className="text-[10px] text-gray-400 mb-1.5">{slot.hint}</p>
                {availableFonts.length > 0 ? (
                  <select
                    value={
                      availableFonts.includes(fontVal) ? fontVal : "__custom__"
                    }
                    onChange={(e) => {
                      if (e.target.value === "__custom__") return;
                      handleChange(slot.fontField, e.target.value);
                    }}
                    className={`w-full mb-1.5 ${ciSelectClass}`}
                  >
                    <option value="">Select from Figma…</option>
                    {availableFonts.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                    <option value="__custom__">Custom…</option>
                  </select>
                ) : null}
                <input
                  type="text"
                  placeholder="Font family name"
                  value={fontVal}
                  onChange={(e) => handleChange(slot.fontField, e.target.value)}
                  className={`w-full ${ciFieldMonoClass}`}
                  style={{
                    fontFamily: cssFontStack(fontVal, fallbackVal),
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">
                  Fallback if {slot.label.toLowerCase()} is slow / missing
                </label>
                <select
                  value={
                    FALLBACK_PRESETS.includes(fallbackVal)
                      ? fallbackVal
                      : "__custom_fb__"
                  }
                  onChange={(e) => {
                    if (e.target.value === "__custom_fb__") return;
                    handleChange(slot.fallbackField, e.target.value);
                  }}
                  className={`w-full mb-1 ${ciSelectClass}`}
                >
                  {FALLBACK_PRESETS.map((f) => (
                    <option key={f} value={f}>
                      {f.split(",")[0]}
                    </option>
                  ))}
                  <option value="__custom_fb__">Custom stack…</option>
                </select>
                <input
                  type="text"
                  value={fallbackVal}
                  onChange={(e) =>
                    handleChange(slot.fallbackField, e.target.value)
                  }
                  className={`w-full text-[11px] ${ciFieldMonoClass}`}
                />
              </div>
            </div>
          );
        })}

        <div className="p-4 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs text-gray-500 mb-2">Preview</p>
          <div
            className="p-4 rounded shadow-sm space-y-2"
            style={{
              backgroundColor: theme.backgroundColor || "#fff",
              color: theme.textColor || "#111",
            }}
          >
            <h4
              className="font-bold text-lg"
              style={{
                fontFamily: cssFontStack(
                  theme.primaryFont || theme.fontFamily,
                  theme.primaryFontFallback
                ),
                color: theme.accentColors?.[0] || theme.textColor || "#111",
              }}
            >
              Primary — Heading
            </h4>
            <p
              className="opacity-80 text-sm"
              style={{
                fontFamily: cssFontStack(
                  theme.secondaryFont || theme.primaryFont,
                  theme.secondaryFontFallback || theme.primaryFontFallback
                ),
              }}
            >
              Secondary — body text from the brand type system.
            </p>
            <p
              className="text-xs opacity-70"
              style={{
                fontFamily: cssFontStack(
                  theme.tertiaryFont || theme.secondaryFont,
                  theme.tertiaryFontFallback
                ),
              }}
            >
              Tertiary — captions / utility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
