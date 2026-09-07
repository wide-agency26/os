import type { ReactNode } from "react";
import { AlertTriangle, Info, Lock, TrendingDown, TrendingUp } from "lucide-react";

/**
 * Shared building blocks for the SEO report.
 *
 * Two rules are enforced here rather than left to each panel:
 *   1. No number appears without a qualitative label and an explanation.
 *   2. Missing data is shown as an explicit "Not connected" card, never as zero.
 */

export type Tone = "good" | "warn" | "bad" | "muted" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  bad: "bg-red-50 text-red-700 border-red-200",
  muted: "bg-gray-50 text-gray-600 border-gray-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

export const TONE_HEX: Record<Tone, string> = {
  good: "#059669",
  warn: "#d97706",
  bad: "#dc2626",
  muted: "#9ca3af",
  info: "#2563eb",
};

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 ${className}`}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
      {children}
    </div>
  );
}

export function Chip({
  tone = "muted",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export const SEVERITY_TONE: Record<string, Tone> = {
  critical: "bad",
  high: "bad",
  medium: "warn",
  low: "muted",
  info: "info",
};

export const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Opportunity",
};

export function SeverityChip({ severity }: { severity: string }) {
  return (
    <Chip tone={SEVERITY_TONE[severity] ?? "muted"}>
      {SEVERITY_LABEL[severity] ?? severity}
    </Chip>
  );
}

/**
 * A metric with its value, a qualitative band, and a one-line explanation of
 * what it means. Every number in the report goes through something like this.
 */
export function Metric({
  label,
  value,
  band,
  tone = "muted",
  explanation,
  threshold,
  delta,
}: {
  label: string;
  value: ReactNode;
  band?: string;
  tone?: Tone;
  explanation?: string;
  threshold?: string;
  delta?: number | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{label}</SectionLabel>
        {band ? <Chip tone={tone}>{band}</Chip> : null}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-semibold tabular-nums text-gray-900">{value}</div>
        {delta !== undefined && delta !== null && delta !== 0 ? (
          <span
            className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${
              delta > 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        ) : null}
      </div>
      {threshold ? (
        <div className="text-[11px] text-gray-500">{threshold}</div>
      ) : null}
      {explanation ? (
        <p className="text-[12px] leading-relaxed text-gray-600">{explanation}</p>
      ) : null}
    </div>
  );
}

/** Provenance line, following the DatasetSourceBadge convention. */
export function SourceBadge({
  source,
  measuredAt,
  note,
}: {
  source: string;
  measuredAt?: string | null;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
      <Info size={12} className="shrink-0 text-gray-400" />
      <span>
        <span className="text-gray-500">Source:</span>{" "}
        <strong className="font-semibold text-gray-700">{source}</strong>
        {measuredAt ? (
          <>
            <span className="mx-1.5 text-gray-300">|</span>
            <span className="text-gray-500">Measured:</span>{" "}
            <strong className="font-semibold text-gray-700">
              {new Date(measuredAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </strong>
          </>
        ) : null}
      </span>
      {note ? <span className="text-gray-400">· {note}</span> : null}
    </div>
  );
}

/**
 * Shown wherever a data source is unavailable. States plainly what is missing,
 * why, and what connecting it would add — instead of rendering an empty chart
 * that reads as "we measured this and it is zero".
 */
export function NotConnectedCard({
  title,
  reason,
  wouldGive,
  action,
}: {
  title: string;
  reason: string;
  wouldGive?: string;
  action?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded-lg bg-white p-1.5 text-gray-400 ring-1 ring-gray-200">
          <Lock size={15} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <h4 className="text-[13px] font-semibold text-gray-900">{title}</h4>
            <Chip tone="muted">Not connected</Chip>
          </div>
          <p className="text-[12px] leading-relaxed text-gray-600">{reason}</p>
          {wouldGive ? (
            <p className="text-[12px] leading-relaxed text-gray-500">
              <span className="font-semibold text-gray-700">What you would get: </span>
              {wouldGive}
            </p>
          ) : null}
          {action ? (
            <p className="text-[12px] leading-relaxed text-blue-700">{action}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center">
      <p className="text-[13px] text-gray-500">{message}</p>
    </div>
  );
}

export function DegradedNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
      <p className="text-[12px] leading-relaxed text-amber-800">{children}</p>
    </div>
  );
}

export function scoreTone(score: number | null | undefined): Tone {
  if (score === null || score === undefined) return "muted";
  if (score >= 75) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString();
}
