"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Check, X, Copy, Trash2, AlertTriangle } from "lucide-react";
import { ColorSwatch } from "@/lib/ci-builder/types";
import {
  type ColorFormat,
  contrastLabel,
  contrastRatio,
  hexToCmykToken,
  hexToRgbCss,
  isCompleteHex,
  normalizeTypedHex,
  parseCmykToHex,
  parseRgbToHex,
  pickTextColor,
  shadeHint,
  suggestCssVar,
  toHexColor,
} from "@/lib/ci-builder/color-utils";
import { triggerToast } from "../Toast";

export interface EditableColorProps {
  swatch: ColorSwatch;
  onUpdate?: (updatedSwatch: ColorSwatch) => void;
  onDelete?: () => void;
  isAdmin?: boolean;
  className?: string;
  /** Open the edit popover immediately (e.g. after "+ Add Color") */
  startEditing?: boolean;
  onEditingHandled?: () => void;
  /** Extra copyable value shown on RGB / CMYK cards — also seeds the format tab. */
  extraValue?: { label: string; value: string };
  /** Force the starting format tab (hex / rgb / hsl / cmyk). */
  initialFormat?: ColorFormat;
  /** Mark this shade as the family hero (others become the scale). */
  onSetMain?: () => void;
  /** Reassign this swatch to another palette (Primary / Secondary / …). */
  paletteMove?: {
    currentId: string;
    options: { id: string; label: string }[];
    onMove: (targetId: string) => void;
    scopeLabel?: string;
  };
}

export function EditableColor({
  swatch,
  onUpdate,
  onDelete,
  isAdmin = false,
  className = "",
  startEditing = false,
  onEditingHandled,
  onSetMain,
  paletteMove,
}: EditableColorProps) {
  const hex = toHexColor(swatch.hex);
  const textColor = pickTextColor(hex);
  const onDark = textColor === "#FFFFFF";
  const ratio = contrastRatio(hex, textColor);

  const [copied, setCopied] = useState(false);
  const [popoverCopied, setPopoverCopied] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftHex, setDraftHex] = useState(hex);
  const [draftRgb, setDraftRgb] = useState(hexToRgbCss(hex));
  const [draftCmyk, setDraftCmyk] = useState(hexToCmykToken(hex));
  const [draftName, setDraftName] = useState(swatch.name);
  const [draftCssVar, setDraftCssVar] = useState(swatch.cssVar || "");
  const [mounted, setMounted] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const cardRef = useRef<HTMLDivElement>(null);
  const hexInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isPopoverOpen) return;
    setDraftHex(hex);
    setDraftRgb(hexToRgbCss(hex));
    setDraftCmyk(hexToCmykToken(hex));
    setDraftName(swatch.name);
    setDraftCssVar(swatch.cssVar || "");
  }, [hex, swatch.name, swatch.cssVar, isPopoverOpen]);

  useEffect(() => {
    if (startEditing && isAdmin) {
      setIsPopoverOpen(true);
      onEditingHandled?.();
      requestAnimationFrame(() => hexInputRef.current?.focus());
    }
  }, [startEditing, isAdmin, onEditingHandled]);

  const placePopover = () => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const popoverW = 280;
    const popoverH = 460;
    let top = r.bottom + 10;
    let left = r.left;
    if (top + popoverH > window.innerHeight - 12) {
      top = Math.max(12, r.top - popoverH - 10);
    }
    if (left + popoverW > window.innerWidth - 12) {
      left = window.innerWidth - popoverW - 12;
    }
    if (left < 12) left = 12;
    setPopoverPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!isPopoverOpen) return;
    placePopover();
    const onReposition = () => placePopover();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isPopoverOpen]);

  useEffect(() => {
    if (!isPopoverOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsPopoverOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isPopoverOpen]);

  const persist = (patch: Partial<ColorSwatch>) => {
    const nextHex = toHexColor(patch.hex ?? hex);
    const nextName = patch.name ?? draftName;
    const nextCss =
      patch.cssVar !== undefined
        ? patch.cssVar.trim() || undefined
        : draftCssVar.trim() || suggestCssVar(nextName) || undefined;
    onUpdate?.({
      ...swatch,
      name: nextName,
      hex: nextHex,
      cssVar: nextCss,
      rgb: hexToRgbCss(nextHex),
      cmyk: hexToCmykToken(nextHex),
    });
  };

  const copyValue = (text: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    triggerToast(`Copied ${text}`);
    setTimeout(() => setCopied(false), 1200);
  };

  const openEditor = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isAdmin) {
      copyValue(toHexColor(hex), e);
      return;
    }
    setDraftHex(hex);
    setDraftRgb(hexToRgbCss(hex));
    setDraftCmyk(hexToCmykToken(hex));
    setDraftName(swatch.name);
    setDraftCssVar(swatch.cssVar || "");
    setIsPopoverOpen(true);
  };

  const onHexType = (raw: string) => {
    setDraftHex(raw);
    const normalized = normalizeTypedHex(raw);
    if (isCompleteHex(normalized)) {
      persist({ hex: toHexColor(normalized) });
    }
  };

  useEffect(() => {
    if (!isPopoverOpen) return;
    setDraftRgb(hexToRgbCss(hex));
    setDraftCmyk(hexToCmykToken(hex));
  }, [hex, isPopoverOpen]);

  const commitRgb = () => {
    const next = parseRgbToHex(draftRgb);
    if (next) {
      setDraftHex(next);
      persist({ hex: next });
    } else {
      setDraftRgb(hexToRgbCss(hex));
    }
  };

  const commitCmyk = () => {
    const next = parseCmykToHex(draftCmyk);
    if (next) {
      setDraftHex(next);
      persist({ hex: next });
    } else {
      setDraftCmyk(hexToCmykToken(hex));
    }
  };

  const cssVarDisplay = swatch.cssVar || suggestCssVar(swatch.name);
  const canonical =
    Boolean(swatch.isCanonical) || shadeHint(swatch.name, swatch.cssVar) === "500";
  const cardFormats: { fmt: ColorFormat; label: string; text: string }[] = [
    { fmt: "hex", label: "HEX", text: toHexColor(hex) },
    { fmt: "rgb", label: "RGB", text: hexToRgbCss(hex) },
    { fmt: "cmyk", label: "CMYK", text: hexToCmykToken(hex) },
  ];
  const wash = onDark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)";
  const badgeWash = onDark ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.12)";
  const darkField = {
    background: "#18181a",
    color: "#f1f1f6",
    border: "1px solid rgba(255,255,255,.12)",
    colorScheme: "dark" as const,
  };

  return (
    <div
      ref={cardRef}
      className={`relative max-w-full rounded-[14px] p-3 flex flex-col box-border transition-transform duration-150 ease-out hover:-translate-y-[3px] hover:shadow-[0_12px_24px_rgba(0,0,0,.35)] shadow-[0_1px_2px_rgba(0,0,0,.25)] group/swatch ${
        canonical ? "w-[200px] min-h-[188px]" : "w-[168px] min-h-[168px]"
      } ${isAdmin ? "" : "cursor-pointer"} ${className}`}
      style={{
        backgroundColor: hex,
        color: textColor,
        boxShadow: canonical
          ? `0 0 0 2px ${onDark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.28)"}, 0 10px 22px rgba(0,0,0,.28)`
          : undefined,
        transform: canonical ? "scale(1.04)" : undefined,
        zIndex: canonical ? 1 : undefined,
      }}
      onClick={
        isAdmin
          ? undefined
          : (e) => copyValue(toHexColor(hex), e)
      }
    >
      <div className="flex items-center justify-between gap-1 min-h-[19px]">
        <span className="font-mono text-[10px] font-semibold tracking-[0.3px]">
          {shadeHint(swatch.name, swatch.cssVar)}
        </span>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <div
              className={`items-center gap-1 ${
                isPopoverOpen
                  ? "flex"
                  : "hidden group-hover/swatch:flex"
              }`}
            >
              <button
                type="button"
                onClick={openEditor}
                title="Edit color"
                className="w-[19px] h-[19px] rounded-[6px] flex items-center justify-center p-0 border-0 cursor-pointer"
                style={{ background: wash, color: textColor }}
              >
                <Pencil className="w-[11px] h-[11px]" strokeWidth={1.8} />
              </button>
              {onSetMain && !canonical ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetMain();
                  }}
                  title="Use as main shade"
                  className="h-[19px] px-1.5 rounded-[6px] flex items-center justify-center p-0 border-0 cursor-pointer font-sans text-[8px] font-bold tracking-wide uppercase"
                  style={{ background: wash, color: textColor }}
                >
                  Main
                </button>
              ) : null}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(true);
                  }}
                  title="Delete shade"
                  className="w-[19px] h-[19px] rounded-[6px] flex items-center justify-center p-0 border-0 cursor-pointer"
                  style={{ background: wash, color: "#ff5c5c" }}
                >
                  <Trash2 className="w-[11px] h-[11px]" strokeWidth={1.8} />
                </button>
              )}
            </div>
          )}
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-mono text-[8.5px] font-semibold ${
              isAdmin
                ? isPopoverOpen
                  ? "hidden"
                  : "group-hover/swatch:hidden"
                : ""
            }`}
            style={{ background: badgeWash, color: textColor }}
          >
            {contrastLabel(ratio)} {ratio.toFixed(1)}
          </span>
        </div>
      </div>

      <span
        className={`font-bold leading-[1.25] mt-2 whitespace-nowrap overflow-hidden text-ellipsis ${
          canonical ? "text-[14px]" : "text-[12.5px]"
        }`}
        title={swatch.name}
      >
        {swatch.name || "Untitled"}
        {canonical ? (
          <span className="ml-1 font-semibold opacity-70 text-[9px] tracking-[0.2px]">
            MAIN
          </span>
        ) : null}
      </span>

      <div className="mt-[9px] flex flex-col gap-[3px]">
        {cardFormats.map((row) => (
          <button
            key={row.fmt}
            type="button"
            onClick={(e) => copyValue(row.text, e)}
            title={`Copy ${row.label}`}
            className="flex items-baseline gap-1.5 bg-transparent border-0 p-0 cursor-pointer text-left min-w-0"
            style={{ color: textColor }}
          >
            <span className="font-mono text-[8px] font-semibold tracking-[0.3px] opacity-60 shrink-0 w-[28px]">
              {row.label}
            </span>
            <span className="font-mono text-[10px] font-medium leading-[1.25] whitespace-nowrap overflow-hidden text-ellipsis">
              {row.text}
            </span>
          </button>
        ))}
      </div>

      {cssVarDisplay && (
        <span
          className="font-mono text-[9px] leading-[1.3] opacity-55 mt-[5px] whitespace-nowrap overflow-hidden text-ellipsis"
          title={cssVarDisplay}
        >
          {cssVarDisplay}
        </span>
      )}

      {mounted &&
        isPopoverOpen &&
        isAdmin &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[40]"
              onClick={() => setIsPopoverOpen(false)}
            />
            <div
              className="fixed z-[50] w-[280px] rounded-[14px] p-4 flex flex-col gap-3 shadow-[0_20px_40px_rgba(0,0,0,.5)]"
              style={{
                top: popoverPos.top,
                left: popoverPos.left,
                background: "#232326",
                border: "1px solid rgba(255,255,255,.1)",
                color: "#f1f1f6",
              }}
              role="dialog"
              aria-label="Edit color"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#f1f1f6]">
                  Edit color
                </span>
                <button
                  type="button"
                  onClick={() => setIsPopoverOpen(false)}
                  className="bg-transparent border-0 text-[#8e8e9f] cursor-pointer p-0.5 flex hover:text-[#f1f1f6]"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.8} />
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="color"
                  value={toHexColor(draftHex).toLowerCase()}
                  onChange={(e) => {
                    const next = e.target.value.toUpperCase();
                    setDraftHex(next);
                    persist({ hex: next });
                  }}
                  className="w-9 h-9 rounded-lg border-0 p-0 bg-transparent cursor-pointer shrink-0"
                  title="Color picker"
                />
                <input
                  ref={hexInputRef}
                  type="text"
                  value={draftHex}
                  onChange={(e) => onHexType(e.target.value)}
                  onBlur={() => setDraftHex(toHexColor(draftHex))}
                  className="flex-1 min-w-0 rounded-lg px-2.5 py-2 font-mono text-xs font-medium outline-none"
                  style={darkField}
                  placeholder="#000000"
                  autoFocus
                />
              </div>

              <input
                type="text"
                value={draftName}
                onChange={(e) => {
                  setDraftName(e.target.value);
                  persist({ name: e.target.value });
                }}
                placeholder="Color name"
                className="rounded-lg px-2.5 py-2 text-xs font-medium outline-none"
                style={darkField}
              />

              <input
                type="text"
                value={draftCssVar}
                onChange={(e) => {
                  setDraftCssVar(e.target.value);
                  persist({ cssVar: e.target.value });
                }}
                placeholder="--color-primary"
                className="rounded-lg px-2.5 py-2 font-mono text-xs font-medium outline-none"
                style={darkField}
              />

              {paletteMove && paletteMove.options.length > 1 ? (
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8e8e9f]">
                    Palette
                    {paletteMove.scopeLabel ? ` · ${paletteMove.scopeLabel}` : ""}
                  </span>
                  <select
                    value={paletteMove.currentId}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!next || next === paletteMove.currentId) return;
                      paletteMove.onMove(next);
                      setIsPopoverOpen(false);
                    }}
                    className="rounded-lg px-2.5 py-2 text-xs font-medium outline-none"
                    style={darkField}
                  >
                    {paletteMove.options.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="flex flex-col gap-1.5">
                {cardFormats.map((row) => (
                  <div
                    key={row.fmt}
                    className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                    style={{ background: "#18181a" }}
                  >
                    <span className="font-mono text-[9px] font-semibold tracking-[0.3px] text-[#8e8e9f] w-[32px] shrink-0">
                      {row.label}
                    </span>
                    {row.fmt === "rgb" || row.fmt === "cmyk" ? (
                      <input
                        type="text"
                        value={row.fmt === "rgb" ? draftRgb : draftCmyk}
                        onChange={(e) =>
                          row.fmt === "rgb"
                            ? setDraftRgb(e.target.value)
                            : setDraftCmyk(e.target.value)
                        }
                        onBlur={row.fmt === "rgb" ? commitRgb : commitCmyk}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="flex-1 min-w-0 bg-transparent border-0 font-mono text-xs font-medium text-[#f1f1f6] outline-none"
                      />
                    ) : (
                      <span className="font-mono text-xs font-medium text-[#f1f1f6] truncate flex-1">
                        {row.text}
                      </span>
                    )}
                    <button
                      type="button"
                      title={`Copy ${row.label}`}
                      onClick={() => {
                        navigator.clipboard.writeText(row.text);
                        setPopoverCopied(true);
                        triggerToast(`Copied ${row.text}`);
                        setTimeout(() => setPopoverCopied(false), 1200);
                      }}
                      className="border-0 bg-transparent text-[#8e8e9f] p-1 flex cursor-pointer hover:text-[#f1f1f6]"
                    >
                      {popoverCopied ? (
                        <Check className="w-3 h-3" strokeWidth={2.5} />
                      ) : (
                        <Copy className="w-3 h-3" strokeWidth={1.8} />
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {onSetMain ? (
                <button
                  type="button"
                  onClick={() => {
                    onSetMain();
                    setIsPopoverOpen(false);
                  }}
                  className="w-full rounded-lg px-2.5 py-2 text-[11px] font-semibold border-0 cursor-pointer"
                  style={{
                    background: canonical ? "rgba(255,255,255,.12)" : "#f1f1f6",
                    color: canonical ? "#f1f1f6" : "#18181a",
                  }}
                >
                  {canonical ? "Main shade" : "Use as main shade"}
                </button>
              ) : null}

              <div className="flex justify-between font-mono text-[10px] text-[#8e8e9f]">
                <span>vs ○ {contrastRatio(hex, "#FFFFFF").toFixed(2)}</span>
                <span>vs ● {contrastRatio(hex, "#000000").toFixed(2)}</span>
              </div>
            </div>
          </>,
          document.body
        )}

      {mounted &&
        confirmDelete &&
        onDelete &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(false);
            }}
          >
            <div
              className="ci-chrome bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4 border border-gray-100 text-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="font-semibold text-gray-900 text-sm">
                  Delete shade
                </h4>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Delete <strong>&quot;{swatch.name}&quot;</strong>? This can&apos;t
                be undone.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    onDelete();
                  }}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/** Full-bleed click-to-copy swatch used in Brand book presentation. */
export function PresentationSwatch({ swatch }: { swatch: ColorSwatch }) {
  const hex = toHexColor(swatch.hex);
  const ink = pickTextColor(hex);
  const [copied, setCopied] = React.useState(false);

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    triggerToast(`Copied ${value}`);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      className="bb-swatch"
      style={{ background: hex, color: ink }}
      onClick={() => copy(hex)}
      title="Copy HEX"
    >
      <span className="bb-swatch-copy">{copied ? "Copied" : "Copy"}</span>
      <span className="bb-swatch-name">{swatch.name || "Untitled"}</span>
      <span className="bb-swatch-hex">{hex}</span>
      {swatch.cssVar ? (
        <span className="bb-swatch-var">{swatch.cssVar}</span>
      ) : null}
    </button>
  );
}
