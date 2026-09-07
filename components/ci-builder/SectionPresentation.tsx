"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import type {
  CIAsset,
  CISection,
  CITheme,
  ModuleCoverPhoto,
  PresentationGapSize,
  SectionBgAttachment,
  SectionBgFit,
  SectionBgPosition,
  SectionBgRepeat,
  SectionPresentation,
  SectionPresentationBackground,
} from "@/lib/ci-builder/types";
import {
  readSectionPresentation,
  sectionPresentationIsEmpty,
} from "@/lib/ci-builder/types";
import {
  layoutPresentationIsEmpty,
  modulePresentationIsEmpty,
  sectionBackgroundIsEmpty,
} from "@/lib/ci-builder/module-presentation";
import { CI_THEME_PRESETS } from "@/lib/ci-builder/theme-css";
import { toHexColor } from "@/lib/ci-builder/color-utils";
import { CiMediaImage } from "@/components/ci-builder/CiMediaImage";
import { triggerToast } from "@/components/ci-builder/Toast";
import { AssetPickerModal } from "@/components/ci-builder/primitives/AssetPickerModal";

export function presentationSectionStyle(
  presentation: SectionPresentation
): CSSProperties | undefined {
  const appearance = presentation.appearance || "inherit";
  const textOverride = presentation.textColor;
  const accentOverride = presentation.accentColor;
  const bgOverride = presentation.backgroundColor;

  if (
    appearance === "inherit" &&
    !textOverride &&
    !accentOverride &&
    !bgOverride
  ) {
    return undefined;
  }

  const style: Record<string, string> = {};

  if (appearance === "light" || appearance === "dark") {
    const preset = CI_THEME_PRESETS[appearance];
    const bg = preset.backgroundColor;
    const text = textOverride || preset.textColor;
    style["--ci-bg"] = bg;
    style["--ci-text"] = text;
    style["--ci-bg-alt"] = `color-mix(in srgb, ${text} 7%, ${bg})`;
    style["--ci-surface"] = `color-mix(in srgb, ${text} 8%, ${bg})`;
    style["--ci-text-muted"] = `color-mix(in srgb, ${text} 62%, ${bg})`;
    style["--ci-border"] = `color-mix(in srgb, ${text} 14%, transparent)`;
    style.backgroundColor = "var(--ci-bg)";
    style.color = "var(--ci-text)";
  } else if (textOverride) {
    style["--ci-text"] = textOverride;
    style["--ci-text-muted"] =
      `color-mix(in srgb, ${textOverride} 62%, var(--ci-bg))`;
    style.color = "var(--ci-text)";
  }

  if (accentOverride) {
    style["--ci-accent"] = accentOverride;
  }

  if (bgOverride) {
    style["--ci-bg"] = bgOverride;
    style.backgroundColor = bgOverride;
    if (!textOverride && appearance === "inherit") {
      style.color = "var(--ci-text)";
    }
  }

  return style as CSSProperties;
}

export function collectPresentationPalette(opts: {
  theme?: CITheme | null;
  sections?: Partial<CISection>[];
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: unknown) => {
    if (typeof raw !== "string") return;
    const t = raw.trim();
    if (!/^#[0-9a-fA-F]{3,8}$/.test(t)) return;
    const hex = toHexColor(t);
    if (seen.has(hex)) return;
    seen.add(hex);
    out.push(hex);
  };

  const theme = opts.theme;
  if (theme) {
    push(theme.backgroundColor);
    push(theme.textColor);
    for (const a of theme.accentColors || []) push(a);
  }

  for (const sec of opts.sections || []) {
    const data = (sec.data || {}) as { swatches?: { hex?: string }[] };
    if (!Array.isArray(data.swatches)) continue;
    for (const s of data.swatches) push(s?.hex);
  }

  if (typeof document !== "undefined") {
    const el =
      (document.querySelector(".ci-canvas") as HTMLElement | null) ||
      document.documentElement;
    const s = getComputedStyle(el);
    push(s.getPropertyValue("--ci-bg").trim());
    push(s.getPropertyValue("--ci-text").trim());
    push(s.getPropertyValue("--ci-accent").trim());
    push(s.getPropertyValue("--ci-accent-2").trim());
  }

  push("#FFFFFF");
  push("#111111");
  return out.length ? out : ["#FFFFFF", "#111111"];
}

function bgSizeCss(fit: SectionBgFit | undefined): string {
  if (fit === "contain") return "contain";
  if (fit === "none") return "auto";
  return "cover";
}

export function SectionPresentationBackground({
  presentation,
  assets,
}: {
  presentation: SectionPresentation;
  assets: Partial<CIAsset>[];
}) {
  const bg = presentation.background;
  const assetId = bg?.assetId;
  if (!assetId) return null;
  const asset = assets.find((a) => a.id === assetId);
  const url = asset?.public_url || asset?.storage_path;
  if (!url) return null;
  const opacity = typeof bg?.opacity === "number" ? bg.opacity : 0.25;
  return (
    <div
      className="bb-section-bg"
      aria-hidden
      style={{
        opacity,
        backgroundImage: `url(${JSON.stringify(url)})`,
        backgroundSize: bgSizeCss(bg?.fit),
        backgroundPosition: bg?.position || "center",
        backgroundRepeat: bg?.repeat || "no-repeat",
        backgroundAttachment: bg?.attachment || "scroll",
      }}
    />
  );
}

export function SectionPresentationMedia({
  presentation,
  assets,
}: {
  presentation: SectionPresentation;
  assets: Partial<CIAsset>[];
}) {
  const layout = presentation.layout || "stack";
  if (layout === "stack") return null;
  const assetId = presentation.mediaAssetId;
  if (!assetId) return null;
  const asset = assets.find((a) => a.id === assetId);
  const url = asset?.public_url || asset?.storage_path;
  if (!url) return null;
  const fit = presentation.mediaFit || "cover";
  const position = presentation.mediaPosition || "center";
  return (
    <div
      className="bb-section-media"
      data-bb-media-fit={fit}
      data-bb-media-position={position}
    >
      <CiMediaImage
        src={url}
        alt={asset?.label || "Section media"}
        fill
        className="bb-section-media-img"
        sizes="(max-width: 900px) 100vw, 50vw"
        style={{
          objectFit: fit === "none" ? "none" : fit,
          objectPosition: position,
          maxWidth: "none",
          maxHeight: "none",
        }}
      />
    </div>
  );
}

type PresentationPatch = Omit<
  Partial<SectionPresentation>,
  | "background"
  | "textColor"
  | "accentColor"
  | "backgroundColor"
  | "cover"
  | "headGap"
  | "chapterGap"
> & {
  background?: SectionPresentationBackground | null;
  textColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  cover?: ModuleCoverPhoto | null;
  headGap?: PresentationGapSize | null;
  chapterGap?: PresentationGapSize | null;
};

export const PRESENTATION_POSITIONS: {
  id: SectionBgPosition;
  label: string;
}[] = [
  { id: "top left", label: "↖" },
  { id: "top", label: "↑" },
  { id: "top right", label: "↗" },
  { id: "left", label: "←" },
  { id: "center", label: "·" },
  { id: "right", label: "→" },
  { id: "bottom left", label: "↙" },
  { id: "bottom", label: "↓" },
  { id: "bottom right", label: "↘" },
];

const UPLOAD_HINT =
  "Max 50 MB · PNG/JPG/WebP · 1920px+ wide recommended for covers";

function GapSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: PresentationGapSize;
  onChange: (gap: PresentationGapSize | undefined) => void;
}) {
  return (
    <label className="bb-presentation-field">
      <span>{label}</span>
      <select
        value={value || "m"}
        onChange={(e) => {
          const v = e.target.value as PresentationGapSize;
          onChange(v === "m" ? undefined : v);
        }}
      >
        <option value="s">S — tight</option>
        <option value="m">M — default</option>
        <option value="l">L — airy</option>
      </select>
    </label>
  );
}

function PositionPad({
  label,
  value,
  onPick,
  keyPrefix,
}: {
  label: string;
  value: SectionBgPosition;
  onPick: (pos: SectionBgPosition) => void;
  keyPrefix: string;
}) {
  return (
    <div className="bb-presentation-position" role="group" aria-label={label}>
      <span className="bb-presentation-field-label">{label}</span>
      <div className="bb-presentation-position-pad">
        {PRESENTATION_POSITIONS.map((p) => (
          <button
            key={`${keyPrefix}-${p.id}`}
            type="button"
            className={value === p.id ? "bb-pos-btn is-active" : "bb-pos-btn"}
            title={p.id}
            onClick={() => onPick(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PaletteChips({
  label,
  value,
  palette,
  onPick,
}: {
  label: string;
  value?: string;
  palette: string[];
  onPick: (hex: string | null) => void;
}) {
  return (
    <div className="bb-presentation-palette" role="group" aria-label={label}>
      <span className="bb-presentation-field-label">{label}</span>
      <button
        type="button"
        className={
          !value
            ? "bb-presentation-chip-theme is-active"
            : "bb-presentation-chip-theme"
        }
        title="Use theme / tone default"
        onClick={() => onPick(null)}
      >
        Theme
      </button>
      {palette.map((hex) => {
        const active = (value || "").toUpperCase() === hex.toUpperCase();
        return (
          <button
            key={`${label}-${hex}`}
            type="button"
            title={hex}
            aria-label={`${label} ${hex}`}
            className={
              active
                ? "bb-presentation-swatch is-active"
                : "bb-presentation-swatch"
            }
            style={{ backgroundColor: hex }}
            onClick={() => onPick(hex)}
          />
        );
      })}
    </div>
  );
}

function BackgroundPhotoPicker({
  label,
  assetId,
  assets,
  guidelineId,
  onAddAssetRecord,
  onSelect,
  onClear,
  defaultOpacity = 0.25,
}: {
  label: string;
  assetId?: string;
  assets: Partial<CIAsset>[];
  guidelineId?: string;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
  onSelect: (asset: Partial<CIAsset>) => void;
  onClear: () => void;
  defaultOpacity?: number;
}) {
  const [open, setOpen] = useState(false);
  const asset = assetId ? assets.find((a) => a.id === assetId) : undefined;
  const url = asset?.public_url || asset?.storage_path;

  return (
    <div className="bb-presentation-photo-picker">
      <span className="bb-presentation-field-label">{label}</span>
      <div className="bb-presentation-photo-picker-row">
        <button
          type="button"
          className="bb-presentation-photo-thumb"
          onClick={() => setOpen(true)}
          title={url ? "Change photo" : "Choose photo"}
        >
          {url ? (
            <CiMediaImage
              src={url}
              alt=""
              fill
              className="object-cover"
              sizes="80px"
            />
          ) : (
            <ImageIcon className="w-5 h-5 text-gray-400" />
          )}
        </button>
        <div className="bb-presentation-photo-meta">
          <button
            type="button"
            className="text-[11px] font-semibold text-gray-800 hover:underline"
            onClick={() => setOpen(true)}
          >
            {url ? asset?.label || "Change photo" : "Choose photo"}
          </button>
          {assetId ? (
            <button
              type="button"
              className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-red-600"
              onClick={onClear}
            >
              <X className="w-3 h-3" /> Clear
            </button>
          ) : null}
          <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{UPLOAD_HINT}</p>
        </div>
      </div>
      {guidelineId ? (
        <AssetPickerModal
          isOpen={open}
          onClose={() => setOpen(false)}
          guidelineId={guidelineId}
          availableAssets={assets}
          onAddAssetRecord={onAddAssetRecord}
          onSelectAsset={(picked) => {
            onSelect(picked);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

export function SectionPresentationControls({
  data,
  assets,
  palette = ["#FFFFFF", "#111111"],
  onChange,
  showLayoutControls = true,
  showAppearanceControls = true,
  showSectionBackgroundControls = false,
  showModuleCoverControls = false,
  moduleBackgroundActive = false,
  scopeLabel = "Presentation",
  guidelineId,
  onAddAssetRecord,
}: {
  data: unknown;
  assets: Partial<CIAsset>[];
  palette?: string[];
  onChange: (presentation: SectionPresentation) => void;
  showLayoutControls?: boolean;
  showAppearanceControls?: boolean;
  showSectionBackgroundControls?: boolean;
  showModuleCoverControls?: boolean;
  moduleBackgroundActive?: boolean;
  scopeLabel?: string;
  guidelineId?: string;
  onAddAssetRecord?: (asset: Partial<CIAsset>) => void;
}) {
  const presentation = readSectionPresentation(data);
  const appearance = presentation.appearance || "inherit";
  const layout = presentation.layout || "stack";
  const bg = presentation.background;
  const cover = presentation.cover;
  const bgOpacity = typeof bg?.opacity === "number" ? bg.opacity : 0.25;
  const bgFit = bg?.fit || "cover";
  const bgAttachment = bg?.attachment || "scroll";
  const bgPosition = bg?.position || "center";
  const bgRepeat = bg?.repeat || "no-repeat";
  const coverOpacity = typeof cover?.opacity === "number" ? cover.opacity : 1;
  const coverFit = cover?.fit || "cover";
  const coverPosition = cover?.position || "center";
  const mediaFit = presentation.mediaFit || "cover";
  const mediaPosition = presentation.mediaPosition || "center";

  const dirty = showAppearanceControls
    ? !modulePresentationIsEmpty(presentation)
    : showSectionBackgroundControls
      ? !sectionBackgroundIsEmpty(presentation)
      : showLayoutControls
        ? !layoutPresentationIsEmpty(presentation)
        : !sectionPresentationIsEmpty(presentation);

  const imageAssets = assets.filter(
    (a) => a.id && (a.public_url || a.storage_path)
  );

  const patch = (next: PresentationPatch) => {
    const {
      background: nextBg,
      textColor: nextText,
      accentColor: nextAccent,
      backgroundColor: nextBgColor,
      cover: nextCover,
      headGap: nextHeadGap,
      chapterGap: nextChapterGap,
      ...rest
    } = next;
    const merged: SectionPresentation = { ...presentation, ...rest };

    if (nextBg === null) delete merged.background;
    else if (nextBg) {
      merged.background = {
        ...(presentation.background || { assetId: nextBg.assetId }),
        ...nextBg,
      };
    }
    if (nextText === null) delete merged.textColor;
    else if (typeof nextText === "string") merged.textColor = nextText;
    if (nextAccent === null) delete merged.accentColor;
    else if (typeof nextAccent === "string") merged.accentColor = nextAccent;
    if (nextBgColor === null) delete merged.backgroundColor;
    else if (typeof nextBgColor === "string") merged.backgroundColor = nextBgColor;
    if (nextCover === null) delete merged.cover;
    else if (nextCover) merged.cover = nextCover;
    if (nextHeadGap === null) delete merged.headGap;
    else if (nextHeadGap) merged.headGap = nextHeadGap;
    if (nextChapterGap === null) delete merged.chapterGap;
    else if (nextChapterGap) merged.chapterGap = nextChapterGap;

    if (merged.layout === "stack") {
      delete merged.mediaAssetId;
      delete merged.mediaFit;
      delete merged.mediaPosition;
    }
    if (!merged.mediaAssetId) {
      delete merged.mediaAssetId;
      delete merged.mediaFit;
      delete merged.mediaPosition;
    } else {
      if (!merged.mediaFit) merged.mediaFit = "cover";
      if (!merged.mediaPosition) merged.mediaPosition = "center";
    }
    if (!merged.textColor) delete merged.textColor;
    if (!merged.accentColor) delete merged.accentColor;
    if (!merged.backgroundColor) delete merged.backgroundColor;
    if (!merged.headGap) delete merged.headGap;
    if (!merged.chapterGap) delete merged.chapterGap;
    if (!merged.cover?.assetId) delete merged.cover;
    onChange(merged);
  };

  const patchBg = (partial: Partial<SectionPresentationBackground>) => {
    if (!bg?.assetId) return;
    patch({ background: { ...bg, ...partial, assetId: bg.assetId } });
  };

  const patchCover = (partial: Partial<ModuleCoverPhoto>) => {
    if (!cover?.assetId) return;
    patch({ cover: { ...cover, ...partial, assetId: cover.assetId } });
  };

  const handleReset = () => {
    let msg = "Reset presentation overrides?";
    if (showAppearanceControls) {
      msg =
        "Reset to follow the guideline theme?\n\nTone, text, accent, background, and spacing overrides will be cleared.";
    } else if (showSectionBackgroundControls) {
      msg =
        "Reset this section’s colors?\n\nTone, text, accent, background, and headline gap will be cleared.";
    } else if (showLayoutControls) {
      msg = "Reset this section layout?\n\nSide image and layout will be cleared.";
    }
    if (!window.confirm(msg)) return;
    onChange({});
    triggerToast("Presentation reset");
  };

  const sectionBgActive = Boolean(presentation.background?.assetId);

  return (
    <div className="bb-presentation-controls no-print ci-chrome">
      {showLayoutControls ? (
        <div className="bb-presentation-row">
          <span className="bb-presentation-label">{scopeLabel}</span>
          <label className="bb-presentation-field">
            <span>Layout</span>
            <select
              value={layout}
              onChange={(e) =>
                patch({
                  layout: e.target.value as SectionPresentation["layout"],
                })
              }
            >
              <option value="stack">Stack</option>
              <option value="image-left">Image left</option>
              <option value="image-right">Image right</option>
            </select>
          </label>
          {layout !== "stack" ? (
            <>
              <label className="bb-presentation-field">
                <span>Side image</span>
                <select
                  value={presentation.mediaAssetId || ""}
                  onChange={(e) =>
                    patch({
                      mediaAssetId: e.target.value ? e.target.value : undefined,
                      mediaFit: e.target.value ? mediaFit : undefined,
                      mediaPosition: e.target.value ? mediaPosition : undefined,
                    })
                  }
                >
                  <option value="">None</option>
                  {imageAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label || a.kind || a.id?.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              {presentation.mediaAssetId ? (
                <>
                  <label className="bb-presentation-field">
                    <span>Image fit</span>
                    <select
                      value={mediaFit}
                      onChange={(e) =>
                        patch({ mediaFit: e.target.value as SectionBgFit })
                      }
                    >
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                  <PositionPad
                    label="Align"
                    value={mediaPosition}
                    onPick={(pos) => patch({ mediaPosition: pos })}
                    keyPrefix="media"
                  />
                </>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            className="bb-presentation-reset"
            disabled={!dirty}
            onClick={handleReset}
          >
            Reset
          </button>
        </div>
      ) : null}

      {showSectionBackgroundControls ? (
        <>
          {moduleBackgroundActive && sectionBgActive ? (
            <p className="bb-presentation-clash">
              Module background photo is active. This section&apos;s background
              replaces it within this sub-module only.
            </p>
          ) : null}
          <div className="bb-presentation-row">
            <span className="bb-presentation-label">{scopeLabel}</span>
            <label className="bb-presentation-field">
              <span>Tone</span>
              <select
                value={appearance}
                onChange={(e) =>
                  patch({
                    appearance: e.target
                      .value as SectionPresentation["appearance"],
                  })
                }
              >
                <option value="inherit">Inherit (module / theme)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <GapSelect
              label="Headline gap"
              value={presentation.headGap}
              onChange={(gap) =>
                patch({ headGap: gap === undefined ? null : gap })
              }
            />
            <button
              type="button"
              className="bb-presentation-reset"
              disabled={!dirty}
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
          <div className="bb-presentation-row bb-presentation-colors-row">
            <span className="bb-presentation-label">Colors</span>
            <PaletteChips
              label="Text"
              value={presentation.textColor}
              palette={palette}
              onPick={(hex) => patch({ textColor: hex })}
            />
            <PaletteChips
              label="Accent"
              value={presentation.accentColor}
              palette={palette}
              onPick={(hex) => patch({ accentColor: hex })}
            />
            <PaletteChips
              label="Background"
              value={presentation.backgroundColor}
              palette={palette}
              onPick={(hex) => patch({ backgroundColor: hex })}
            />
          </div>
          <div className="bb-presentation-row bb-presentation-bg-row">
            <BackgroundPhotoPicker
              label="Section photo"
              assetId={bg?.assetId}
              assets={assets}
              guidelineId={guidelineId}
              onAddAssetRecord={onAddAssetRecord}
              onSelect={(asset) => {
                if (!asset.id) return;
                patch({
                  background: {
                    assetId: asset.id,
                    opacity: bgOpacity,
                    fit: bgFit,
                    attachment: bgAttachment,
                    position: bgPosition,
                    repeat: bgRepeat,
                  },
                });
              }}
              onClear={() => patch({ background: null })}
            />
            {bg?.assetId ? (
              <>
                <label className="bb-presentation-field">
                  <span>Fit</span>
                  <select
                    value={bgFit}
                    onChange={(e) =>
                      patchBg({ fit: e.target.value as SectionBgFit })
                    }
                  >
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                    <option value="none">None</option>
                  </select>
                </label>
                <label className="bb-presentation-field bb-presentation-opacity">
                  <span>Opacity {Math.round(bgOpacity * 100)}%</span>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={Math.round(bgOpacity * 100)}
                    onChange={(e) =>
                      patchBg({ opacity: Number(e.target.value) / 100 })
                    }
                  />
                </label>
                <PositionPad
                  label="Align"
                  value={bgPosition}
                  onPick={(pos) => patchBg({ position: pos })}
                  keyPrefix="sec-bg"
                />
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {showAppearanceControls ? (
        <>
          <div className="bb-presentation-row">
            <span className="bb-presentation-label">{scopeLabel}</span>
            <label className="bb-presentation-field">
              <span>Tone</span>
              <select
                value={appearance}
                onChange={(e) =>
                  patch({
                    appearance: e.target.value as SectionPresentation["appearance"],
                  })
                }
              >
                <option value="inherit">Inherit (theme)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <GapSelect
              label="Chapter gap"
              value={presentation.chapterGap}
              onChange={(gap) =>
                patch({ chapterGap: gap === undefined ? null : gap })
              }
            />
            <button
              type="button"
              className="bb-presentation-reset"
              disabled={!dirty}
              onClick={handleReset}
            >
              Reset
            </button>
          </div>

          <div className="bb-presentation-row bb-presentation-colors-row">
            <span className="bb-presentation-label">Colors</span>
            <PaletteChips
              label="Text"
              value={presentation.textColor}
              palette={palette}
              onPick={(hex) => patch({ textColor: hex })}
            />
            <PaletteChips
              label="Accent"
              value={presentation.accentColor}
              palette={palette}
              onPick={(hex) => patch({ accentColor: hex })}
            />
            <PaletteChips
              label="Background"
              value={presentation.backgroundColor}
              palette={palette}
              onPick={(hex) => patch({ backgroundColor: hex })}
            />
          </div>

          <div className="bb-presentation-row bb-presentation-bg-row">
            <BackgroundPhotoPicker
              label="Module photo"
              assetId={bg?.assetId}
              assets={assets}
              guidelineId={guidelineId}
              onAddAssetRecord={onAddAssetRecord}
              onSelect={(asset) => {
                if (!asset.id) return;
                patch({
                  background: {
                    assetId: asset.id,
                    opacity: bgOpacity,
                    fit: bgFit,
                    attachment: bgAttachment,
                    position: bgPosition,
                    repeat: bgRepeat,
                  },
                });
              }}
              onClear={() => patch({ background: null })}
            />
            {bg?.assetId ? (
              <>
                <label className="bb-presentation-field">
                  <span>Fit</span>
                  <select
                    value={bgFit}
                    onChange={(e) =>
                      patchBg({ fit: e.target.value as SectionBgFit })
                    }
                  >
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                    <option value="none">None</option>
                  </select>
                </label>
                <label className="bb-presentation-field">
                  <span>Scroll</span>
                  <select
                    value={bgAttachment}
                    onChange={(e) =>
                      patchBg({
                        attachment: e.target.value as SectionBgAttachment,
                      })
                    }
                  >
                    <option value="scroll">Not fixed</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </label>
                <label className="bb-presentation-field">
                  <span>Repeat</span>
                  <select
                    value={bgRepeat}
                    onChange={(e) =>
                      patchBg({ repeat: e.target.value as SectionBgRepeat })
                    }
                  >
                    <option value="no-repeat">None</option>
                    <option value="repeat">Both</option>
                    <option value="repeat-x">Horizontal</option>
                    <option value="repeat-y">Vertical</option>
                  </select>
                </label>
                <label className="bb-presentation-field bb-presentation-opacity">
                  <span>Opacity {Math.round(bgOpacity * 100)}%</span>
                  <input
                    type="range"
                    min={5}
                    max={80}
                    step={5}
                    value={Math.round(bgOpacity * 100)}
                    onChange={(e) =>
                      patchBg({ opacity: Number(e.target.value) / 100 })
                    }
                  />
                </label>
                <PositionPad
                  label="Align"
                  value={bgPosition}
                  onPick={(pos) => patchBg({ position: pos })}
                  keyPrefix="mod-bg"
                />
              </>
            ) : null}
          </div>

          {showModuleCoverControls ? (
            <div className="bb-presentation-row bb-presentation-bg-row">
              <BackgroundPhotoPicker
                label="Cover photo"
                assetId={cover?.assetId}
                assets={assets}
                guidelineId={guidelineId}
                onAddAssetRecord={onAddAssetRecord}
                defaultOpacity={1}
                onSelect={(asset) => {
                  if (!asset.id) return;
                  patch({
                    cover: {
                      assetId: asset.id,
                      placement: cover?.placement || "after_title",
                      opacity: coverOpacity,
                      fit: coverFit,
                      position: coverPosition,
                      height: cover?.height || "m",
                    },
                  });
                }}
                onClear={() => patch({ cover: null })}
              />
              {cover?.assetId ? (
                <>
                  <label className="bb-presentation-field">
                    <span>Placement</span>
                    <select
                      value={cover.placement || "after_title"}
                      onChange={(e) =>
                        patchCover({
                          placement: e.target.value as ModuleCoverPhoto["placement"],
                        })
                      }
                    >
                      <option value="before_title">Before module title</option>
                      <option value="after_title">After module title</option>
                    </select>
                  </label>
                  <label className="bb-presentation-field">
                    <span>Height</span>
                    <select
                      value={cover.height || "m"}
                      onChange={(e) =>
                        patchCover({
                          height: e.target.value as PresentationGapSize,
                        })
                      }
                    >
                      <option value="s">S</option>
                      <option value="m">M</option>
                      <option value="l">L</option>
                    </select>
                  </label>
                  <label className="bb-presentation-field">
                    <span>Fit</span>
                    <select
                      value={coverFit}
                      onChange={(e) =>
                        patchCover({ fit: e.target.value as SectionBgFit })
                      }
                    >
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                  <label className="bb-presentation-field bb-presentation-opacity">
                    <span>Opacity {Math.round(coverOpacity * 100)}%</span>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      value={Math.round(coverOpacity * 100)}
                      onChange={(e) =>
                        patchCover({ opacity: Number(e.target.value) / 100 })
                      }
                    />
                  </label>
                  <PositionPad
                    label="Align"
                    value={coverPosition}
                    onPick={(pos) => patchCover({ position: pos })}
                    keyPrefix="cover"
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
