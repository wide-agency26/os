"use client";

import type { CITheme, CoverHeaderId } from "@/lib/ci-builder/types";
import {
  DEFAULT_COVER_EYEBROW,
  DEFAULT_COVER_SUBTITLE,
  isCoverTitleVisible,
  resolveCoverEyebrow,
  resolveCoverSubtitle,
  resolveCoverTitle,
} from "@/lib/ci-builder/theme-css";
import { EditableText } from "./primitives/EditableText";
import { Eye, EyeOff } from "lucide-react";

export type CoverStat = {
  id?: CoverHeaderId;
  value: string;
  label: string;
  hidden?: boolean;
};

export function CoverItemToggle({
  visible,
  label,
  onToggle,
}: {
  visible: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="bb-cover-toggle no-print"
      onClick={onToggle}
      title={
        visible
          ? `Hide ${label} on the brand book`
          : `Show ${label} on the brand book`
      }
    >
      {visible ? <Eye size={12} strokeWidth={1.8} /> : <EyeOff size={12} strokeWidth={1.8} />}
      <span>{visible ? "On" : "Off"}</span>
    </button>
  );
}

function splitDisplayTitle(title: string): {
  leadLines: string[];
  accent: string;
  newline: boolean;
} {
  const lines = title
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    return {
      leadLines: lines.slice(0, -1),
      accent: lines[lines.length - 1],
      newline: true,
    };
  }
  const words = (lines[0] || title).trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { leadLines: [title.trim()], accent: "", newline: false };
  }
  return {
    leadLines: [words.slice(0, -1).join(" ")],
    accent: words[words.length - 1],
    newline: false,
  };
}

export function GuidelineCoverBlock({
  theme,
  fallbackTitle,
  variant = "hero",
  subtitleFallback = DEFAULT_COVER_SUBTITLE,
  stats,
  isAdmin = false,
  onUpdateTheme,
  onToggleCoverHeader,
}: {
  theme?: CITheme | null;
  fallbackTitle: string;
  variant?: "hero" | "compact";
  subtitleFallback?: string;
  stats?: CoverStat[];
  isAdmin?: boolean;
  onUpdateTheme?: (theme: CITheme) => void;
  onToggleCoverHeader?: (id: CoverHeaderId) => void;
}) {
  const showTitle = isCoverTitleVisible(theme);
  const title = resolveCoverTitle(theme, fallbackTitle);
  const eyebrow = resolveCoverEyebrow(theme);
  const subtitle = resolveCoverSubtitle(theme, subtitleFallback);
  const split = splitDisplayTitle(title);

  const patch = (partial: Partial<CITheme>) => {
    onUpdateTheme?.({ ...(theme || {}), ...partial });
  };

  const rawEyebrow = theme && Object.prototype.hasOwnProperty.call(theme, "coverEyebrow")
    ? String(theme.coverEyebrow || "")
    : DEFAULT_COVER_EYEBROW;
  const rawTitle = theme?.coverTitle || "";
  const rawSubtitle =
    theme && Object.prototype.hasOwnProperty.call(theme, "coverSubtitle")
      ? String(theme.coverSubtitle || "")
      : subtitleFallback;

  if (!isAdmin && !showTitle && variant !== "hero") return null;

  const hero = variant === "hero";

  if (!hero) {
    if (!isAdmin && !showTitle) return null;
    return (
      <div className="px-6 lg:px-8 pt-10 pb-8 max-w-6xl mx-auto w-full">
        {(eyebrow || isAdmin) && (
          <EditableText
            tag="p"
            value={isAdmin ? rawEyebrow : eyebrow}
            placeholder={DEFAULT_COVER_EYEBROW}
            onSave={(val) => patch({ coverEyebrow: val })}
            isAdmin={isAdmin}
            className="font-bold uppercase tracking-[0.22em] text-[var(--ci-accent)] text-[10px] mb-3"
            style={{ fontFamily: "var(--ci-font-tertiary)" }}
          />
        )}
        {(title || isAdmin) ? (
          <EditableText
            tag="h1"
            multiline={isAdmin}
            value={isAdmin ? rawTitle || fallbackTitle : title}
            placeholder={fallbackTitle}
            onSave={(val) => patch({ coverTitle: val })}
            isAdmin={isAdmin}
            className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.05] max-w-3xl whitespace-pre-line"
            style={{ fontFamily: "var(--ci-font)" }}
          />
        ) : null}
        {(subtitle || isAdmin) && (
          <EditableText
            tag="p"
            multiline={isAdmin}
            value={isAdmin ? rawSubtitle : subtitle}
            placeholder={DEFAULT_COVER_SUBTITLE}
            onSave={(val) => patch({ coverSubtitle: val })}
            isAdmin={isAdmin}
            className="max-w-xl leading-relaxed text-[var(--ci-text-muted)] mt-3 text-sm sm:text-base"
            style={{ fontFamily: "var(--ci-font-secondary)" }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bb-hero-content">
      {eyebrow ? <p className="bb-eyebrow">{eyebrow}</p> : null}
      {showTitle && title ? (
        <h1 className="bb-display">
          {split.leadLines.map((line, i) => (
            <span key={`${line}-${i}`}>
              {line}
              {split.newline || i < split.leadLines.length - 1 ? <br /> : split.accent ? " " : null}
            </span>
          ))}
          {split.accent ? (
            <span className="bb-display-accent">{split.accent}</span>
          ) : null}
        </h1>
      ) : null}
      {subtitle ? <p className="bb-lead">{subtitle}</p> : null}
      {stats && stats.length > 0 ? (
        <div className="bb-stats">
          {stats.map((s) => (
            <div
              key={s.id || s.label}
              className={`bb-stat${s.hidden ? " bb-cover-hidden" : ""}`}
            >
              <strong>{s.value}</strong>
              <span>{s.label}</span>
              {isAdmin && s.id && onToggleCoverHeader ? (
                <CoverItemToggle
                  visible={!s.hidden}
                  label={s.label}
                  onToggle={() => onToggleCoverHeader(s.id!)}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
