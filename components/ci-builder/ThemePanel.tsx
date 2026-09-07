"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CITheme, cssFontStack } from "@/lib/ci-builder/types";
import type { CIAsset, CISection } from "@/lib/ci-builder/types";
import {
  appearanceFromBackground,
  CI_RADIUS_PRESETS,
  DEFAULT_COVER_EYEBROW,
  DEFAULT_COVER_SUBTITLE,
  ensureReadableTheme,
  resolveColorChapterLayout,
  resolveLogoCardPadding,
  resolveLogoCardSize,
  resolveLogoCardZoom,
  resolvePromptButtonBg,
  resolvePromptButtonFg,
  contrastPromptFg,
  resolveThemeRadius,
  themeHasReadableContrast,
  withAppearance,
  COVER_HEADER_ITEMS,
  isCoverHeaderItemVisible,
  withCoverHeaderItem,
  type CiAppearance,
  type ColorChapterLayout,
  type LogoCardPadding,
  type LogoCardSize,
} from "@/lib/ci-builder/theme-css";
import { collectImportGaps } from "@/lib/ci-builder/import-gaps";
import {
  resolveBreakerAlign,
  resolveBreakerSize,
  type BreakerAlign,
  type BreakerSize,
} from "@/lib/ci-builder/breaker-type";
import { AlertTriangle, Moon, Sun, X } from "lucide-react";
import { ciFieldClass, ciFieldMonoClass, ciSelectClass } from "./primitives/formStyles";

interface ThemePanelProps {
  guideline: any;
  /** Extra faces discovered in typography section rows (when theme.availableFonts empty). */
  discoveredFonts?: string[];
  /** Project name used when cover title is left blank. */
  fallbackTitle?: string;
  assets?: Partial<CIAsset>[];
  sections?: Partial<CISection>[];
  fontLoaded?: boolean | null;
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
  fallbackTitle = "Brand",
  assets = [],
  sections = [],
  fontLoaded = null,
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

  const importGaps = useMemo(
    () =>
      collectImportGaps({
        theme,
        sections,
        assets,
        fontLoaded,
      }),
    [theme, sections, assets, fontLoaded]
  );

  const handleChange = (field: keyof CITheme, value: any) => {
    const newTheme: CITheme = { ...theme, [field]: value };
    if (field === "backgroundColor") {
      newTheme.appearance = appearanceFromBackground(value);
    }
    if (field === "promptButtonBg") {
      const bg = String(value || "").trim();
      if (bg) {
        // Keep Fg in sync when unset or still the previous auto-contrast value.
        const prevBg = resolvePromptButtonBg(theme);
        const prevAutoFg = contrastPromptFg(prevBg);
        if (!theme.promptButtonFg || theme.promptButtonFg === prevAutoFg) {
          newTheme.promptButtonFg = contrastPromptFg(bg);
        }
      }
    }
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
    const next =
      field === "backgroundColor" || field === "textColor"
        ? ensureReadableTheme(newTheme)
        : newTheme;
    setTheme(next);
    onUpdate(next);
  };

  const appearance: CiAppearance =
    theme.appearance || appearanceFromBackground(theme.backgroundColor);

  const applyAppearance = (next: CiAppearance) => {
    const newTheme = withAppearance(theme, next);
    setTheme(newTheme);
    onUpdate(newTheme);
  };

  const patchLogoCards = (
    patch: Partial<NonNullable<CITheme["logoCards"]>>
  ) => {
    const next: CITheme = {
      ...theme,
      logoCards: {
        ...(theme.logoCards || {}),
        ...patch,
      },
    };
    setTheme(next);
    onUpdate(next);
  };

  const logoPad = resolveLogoCardPadding(theme);
  const logoZoom = resolveLogoCardZoom(theme);
  const logoSize = resolveLogoCardSize(theme);

  return (
    <div className="ci-chrome absolute top-0 right-0 h-full w-full max-w-sm sm:w-80 bg-white text-gray-900 border-l border-gray-200 shadow-xl z-50 flex flex-col">
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
            Client template
          </label>
          <p className="text-[10px] text-gray-400 mb-2">
            Presentation layout for /g/[slug]. Elements mode stays available on all
            templates.
          </p>
          <select
            className={ciSelectClass}
            value={theme.clientTemplate || "greenpoint"}
            onChange={(e) =>
              handleChange(
                "clientTemplate",
                e.target.value as CITheme["clientTemplate"]
              )
            }
          >
            <option value="greenpoint">Greenpoint (scroll)</option>
            <option value="foundry">Foundry (landing + modules)</option>
            <option value="multipage">Multipage</option>
          </select>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-700">Team / contact</label>
          <input
            className={ciFieldClass}
            placeholder="Team name"
            value={theme.teamName || ""}
            onChange={(e) => handleChange("teamName", e.target.value)}
          />
          <input
            className={ciFieldClass}
            placeholder="Point of contact"
            value={theme.pointOfContact || ""}
            onChange={(e) => handleChange("pointOfContact", e.target.value)}
          />
          <input
            className={ciFieldClass}
            placeholder="Contact email"
            value={theme.contactEmail || ""}
            onChange={(e) => handleChange("contactEmail", e.target.value)}
          />
        </div>

        {(theme.clientTemplate || "greenpoint") === "multipage" ? (
          <div className="space-y-3 rounded-lg border border-gray-200 p-3">
            <div className="text-xs font-medium text-gray-700">Multipage settings</div>
            <label className="block text-[10px] text-gray-500">Corner radius</label>
            <select
              className={ciSelectClass}
              value={theme.templateSettings?.multipage?.cornerRadius || "soft"}
              onChange={(e) =>
                handleChange("templateSettings", {
                  ...(theme.templateSettings || {}),
                  multipage: {
                    ...(theme.templateSettings?.multipage || {}),
                    cornerRadius: e.target.value as "none" | "soft" | "round",
                  },
                })
              }
            >
              <option value="none">None</option>
              <option value="soft">Soft</option>
              <option value="round">Round</option>
            </select>
            <label className="block text-[10px] text-gray-500">Section spacing</label>
            <select
              className={ciSelectClass}
              value={theme.templateSettings?.multipage?.sectionSpacing || "comfortable"}
              onChange={(e) =>
                handleChange("templateSettings", {
                  ...(theme.templateSettings || {}),
                  multipage: {
                    ...(theme.templateSettings?.multipage || {}),
                    sectionSpacing: e.target.value as
                      | "compact"
                      | "comfortable"
                      | "airy",
                  },
                })
              }
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="airy">Airy</option>
            </select>
            <label className="block text-[10px] text-gray-500">Landing tile colors</label>
            <select
              className={ciSelectClass}
              value={theme.templateSettings?.multipage?.landingTileColorMode || "cycle"}
              onChange={(e) =>
                handleChange("templateSettings", {
                  ...(theme.templateSettings || {}),
                  multipage: {
                    ...(theme.templateSettings?.multipage || {}),
                    landingTileColorMode: e.target.value as
                      | "cycle"
                      | "neutral"
                      | "accent",
                  },
                })
              }
            >
              <option value="cycle">Cycle accents</option>
              <option value="neutral">Neutral</option>
              <option value="accent">Single accent</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={theme.templateSettings?.multipage?.showNextModuleCard !== false}
                onChange={(e) =>
                  handleChange("templateSettings", {
                    ...(theme.templateSettings || {}),
                    multipage: {
                      ...(theme.templateSettings?.multipage || {}),
                      showNextModuleCard: e.target.checked,
                    },
                  })
                }
              />
              Show next-module card
            </label>
          </div>
        ) : null}

        {(theme.clientTemplate || "greenpoint") === "foundry" ? (
          <div className="space-y-3 rounded-lg border border-gray-200 p-3">
            <div className="text-xs font-medium text-gray-700">Foundry settings</div>
            <label className="block text-[10px] text-gray-500">Grid density</label>
            <select
              className={ciSelectClass}
              value={theme.templateSettings?.foundry?.gridDensity || "comfortable"}
              onChange={(e) =>
                handleChange("templateSettings", {
                  ...(theme.templateSettings || {}),
                  foundry: {
                    ...(theme.templateSettings?.foundry || {}),
                    gridDensity: e.target.value as "comfortable" | "dense",
                  },
                })
              }
            >
              <option value="comfortable">Comfortable</option>
              <option value="dense">Dense</option>
            </select>
          </div>
        ) : null}

        {importGaps.map((gap) => (
          <div
            key={gap.id}
            className="flex gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-950 text-xs leading-relaxed"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p>{gap.message}</p>
              {gap.id === "font-missing" ? (
                <button
                  type="button"
                  className="mt-1.5 font-semibold underline underline-offset-2"
                  onClick={() =>
                    document.getElementById("ci-theme-primary-font")?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    })
                  }
                >
                  Fix primary font
                </button>
              ) : null}
            </div>
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Cover title
          </label>
          <p className="text-[10px] text-gray-400 mb-2">
            Brand book hero and Elements heading. Hide removes the whole cover
            block. Leave the title blank to use the project name.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => handleChange("showCoverTitle", true)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                theme.showCoverTitle !== false
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Show title
            </button>
            <button
              type="button"
              onClick={() => handleChange("showCoverTitle", false)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                theme.showCoverTitle === false
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Hide title
            </button>
          </div>
          <label className="block text-[10px] font-medium text-gray-500 mb-1">
            Title
          </label>
          <textarea
            value={theme.coverTitle || ""}
            placeholder={fallbackTitle}
            rows={3}
            disabled={theme.showCoverTitle === false}
            onChange={(e) => handleChange("coverTitle", e.target.value)}
            className={`${ciFieldClass} w-full mb-1 resize-none disabled:bg-gray-50 disabled:text-gray-400`}
          />
          <p className="text-[10px] text-gray-400 mb-3">
            Line breaks carry into Brand book. Last line is the accent.
          </p>
          <label className="block text-[10px] font-medium text-gray-500 mb-1">
            Eyebrow
          </label>
          <input
            type="text"
            value={
              Object.prototype.hasOwnProperty.call(theme, "coverEyebrow")
                ? theme.coverEyebrow || ""
                : DEFAULT_COVER_EYEBROW
            }
            placeholder={DEFAULT_COVER_EYEBROW}
            disabled={theme.showCoverTitle === false}
            onChange={(e) => handleChange("coverEyebrow", e.target.value)}
            className={`${ciFieldClass} w-full mb-3 disabled:bg-gray-50 disabled:text-gray-400`}
          />
          <label className="block text-[10px] font-medium text-gray-500 mb-1">
            Subtitle
          </label>
          <textarea
            value={
              Object.prototype.hasOwnProperty.call(theme, "coverSubtitle")
                ? theme.coverSubtitle || ""
                : DEFAULT_COVER_SUBTITLE
            }
            placeholder={DEFAULT_COVER_SUBTITLE}
            rows={2}
            disabled={theme.showCoverTitle === false}
            onChange={(e) => handleChange("coverSubtitle", e.target.value)}
            className={`${ciFieldClass} w-full resize-none disabled:bg-gray-50 disabled:text-gray-400`}
          />
          <p className="text-[10px] text-gray-400 mt-1.5">
            Clear eyebrow or subtitle to hide that line.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Cover header
          </label>
          <p className="text-[10px] text-gray-400 mb-2">
            Accent, Logo slots, Chapters, Voice, Color, and Type under the title.
            Off hides that block from the brand book and PDF — the content stays.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {COVER_HEADER_ITEMS.map((item) => {
              const on = isCoverHeaderItemVisible(theme, item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.hint}
                  onClick={() =>
                    handleChange(
                      "coverHeader",
                      withCoverHeaderItem(theme, item.id, !on).coverHeader
                    )
                  }
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left ${
                    on
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-[11px] font-medium">{item.label}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {on ? "On" : "Off"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Page appearance
          </label>
          <p className="text-[10px] text-gray-400 mb-2">
            Light / Dark restyles the whole guideline — background, type, and cards.
            Page text is kept readable against the background.
          </p>
          {!themeHasReadableContrast(theme) ? (
            <p className="mb-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              Those two colors would make type disappear. Light / Dark below (or a
              darker/lighter text) keeps the page readable.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => applyAppearance("light")}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium ${
                appearance === "light"
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Sun className="w-3.5 h-3.5" /> Light
            </button>
            <button
              type="button"
              onClick={() => applyAppearance("dark")}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium ${
                appearance === "dark"
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Moon className="w-3.5 h-3.5" /> Dark
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Color chapter
          </label>
          <p className="text-[10px] text-gray-400 mb-2">
            How Primary, Secondary, and the rest sit under Colors Systems in the
            brand book.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: "merge", label: "Merge" },
                { id: "small", label: "Small" },
                { id: "large", label: "Large" },
              ] as { id: ColorChapterLayout; label: string }[]
            ).map((opt) => {
              const active = resolveColorChapterLayout(theme) === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleChange("colorChapterLayout", opt.id)}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-medium ${
                    active
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            {resolveColorChapterLayout(theme) === "merge"
              ? "Families share one row."
              : resolveColorChapterLayout(theme) === "small"
                ? "Chapter H1, each family H3."
                : "Chapter H1, each family H2."}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Chapter breakers
          </label>
          <p className="text-[10px] text-gray-400 mb-2">
            Alignment and size for every module breaker. Size maps to caption / tertiary / secondary / primary type specs.
          </p>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {(["left", "center", "right"] as BreakerAlign[]).map((id) => {
              const active = resolveBreakerAlign(theme) === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleChange("breakerAlign", id)}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-medium capitalize ${
                    active
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {id}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {(["s", "m", "l", "xl"] as BreakerSize[]).map((id) => {
              const active = resolveBreakerSize(theme) === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleChange("breakerSize", id)}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-medium uppercase ${
                    active
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {id}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Card radius
          </label>
          <p className="text-[10px] text-gray-400 mb-2">
            Corners on brand-book cards, swatches, and logo wells.
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {CI_RADIUS_PRESETS.map((opt) => {
              const active = resolveThemeRadius(theme) === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleChange("borderRadius", opt.value)}
                  className={`rounded-lg border px-1.5 py-2 text-[11px] font-medium ${
                    active
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Logo cards
          </label>
          <p className="text-[10px] text-gray-400 mb-2">
            Padding, zoom, and well size for logo stages in Elements and Brand
            book.
          </p>
          <p className="text-[10px] font-medium text-gray-500 mb-1.5">Padding</p>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {(
              [
                { id: "none", label: "None" },
                { id: "sm", label: "S" },
                { id: "md", label: "M" },
                { id: "lg", label: "L" },
              ] as { id: LogoCardPadding; label: string }[]
            ).map((opt) => {
              const active = logoPad === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchLogoCards({ padding: opt.id })}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-medium ${
                    active
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-medium text-gray-500">Zoom</p>
              <span className="text-[10px] tabular-nums text-gray-400">
                {Math.round(logoZoom * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={200}
              step={5}
              value={Math.round(logoZoom * 100)}
              onChange={(e) =>
                patchLogoCards({ zoom: Number(e.target.value) / 100 })
              }
              className="w-full accent-gray-900"
            />
          </div>
          <p className="text-[10px] font-medium text-gray-500 mb-1.5">Size</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(["S", "M", "L"] as LogoCardSize[]).map((id) => {
              const active = logoSize === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => patchLogoCards({ size: id })}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-medium ${
                    active
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {id}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            {logoSize === "S"
              ? "Shorter wells (5∶4)."
              : logoSize === "L"
                ? "Square wells (1∶1)."
                : "Standard wells (4∶3)."}
          </p>
        </div>

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

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Copy-as-prompt chips
          </label>
          <p className="text-[10px] text-gray-400 mb-1.5">
            Solid chips in the editor. Empty background uses black on light /
            white on dark; text auto-contrasts against the chip background.
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="color"
              value={resolvePromptButtonBg(theme)}
              onChange={(e) => handleChange("promptButtonBg", e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300 bg-white"
            />
            <input
              type="text"
              value={theme.promptButtonBg || ""}
              placeholder="Background"
              onChange={(e) => handleChange("promptButtonBg", e.target.value)}
              className={`flex-1 ${ciFieldMonoClass}`}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="color"
              value={resolvePromptButtonFg(theme)}
              onChange={(e) => handleChange("promptButtonFg", e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300 bg-white"
            />
            <input
              type="text"
              value={theme.promptButtonFg || ""}
              placeholder="Text (auto if empty)"
              onChange={(e) => handleChange("promptButtonFg", e.target.value)}
              className={`flex-1 ${ciFieldMonoClass}`}
            />
          </div>
        </div>

        {SLOT_META.map((slot) => {
          const fontVal = String(theme[slot.fontField] || "");
          const fallbackVal = String(
            theme[slot.fallbackField] || FALLBACK_PRESETS[0]
          );
          return (
            <div
              key={slot.key}
              id={slot.key === "primary" ? "ci-theme-primary-font" : undefined}
              className="space-y-2 border-t border-gray-100 pt-4"
            >
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
