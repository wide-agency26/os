import { pairIsFinalized, type AudienceSegment } from "@/lib/audience/types";

const COLORS = [
  "#111111",
  "#2f2f2f",
  "#4b4b4b",
  "#6b6b6b",
  "#8a8a8a",
  "#a3a3a3",
  "#c4c4c4",
  "#d6d6d6",
];

export type AudienceMixRow = {
  id: string;
  name: string;
  sizeLabel: string;
  status: "finalized" | "accepted" | "draft";
  pct: number;
  color: string;
};

export type AudienceMix = {
  caption: string;
  rows: AudienceMixRow[];
};

function parsePercent(value: string): number | null {
  const m = value.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseAbsolute(value: string): number | null {
  const cleaned = value.replace(/,/g, "");
  const m = cleaned.match(/(\d+(?:\.\d+)?)\s*(million|mn|m|thousand|k)?/i);
  if (!m) return null;
  let n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit === "million" || unit === "mn" || unit === "m") n *= 1_000_000;
  else if (unit === "thousand" || unit === "k") n *= 1_000;
  return n;
}

export function buildAudienceMix(segments: AudienceSegment[]): AudienceMix {
  const base = segments.map((s) => ({
    id: s.id,
    name: s.name || "Untitled",
    sizeLabel: (s.sizeOrValue || "").trim(),
    status: pairIsFinalized(s)
      ? ("finalized" as const)
      : s.accepted
        ? ("accepted" as const)
        : ("draft" as const),
    percent: parsePercent(s.sizeOrValue || ""),
    absolute: parseAbsolute(s.sizeOrValue || ""),
  }));

  let weights: number[];
  let caption: string;
  const withPct = base.filter((b) => b.percent != null);

  if (withPct.length) {
    weights = base.map((b) => b.percent ?? 0);
    const named = weights.reduce((a, b) => a + b, 0);
    const missingIdx = base
      .map((b, i) => (b.percent == null ? i : -1))
      .filter((i) => i >= 0);
    if (missingIdx.length && named < 100) {
      const rest = (100 - named) / missingIdx.length;
      for (const i of missingIdx) weights[i] = rest;
    } else if (missingIdx.length) {
      for (const i of missingIdx) weights[i] = named / withPct.length || 1;
    }
    caption =
      withPct.length === base.length
        ? "Share of the audience, read from each segment’s size."
        : "Percentages from Size or value; remaining segments split what’s left.";
  } else if (base.some((b) => b.absolute != null)) {
    weights = base.map((b) => b.absolute ?? 1);
    caption = "Relative size from the size/value field.";
  } else {
    weights = base.map(() => 1);
    caption =
      "Equal mix for now. Put a % or a count in Size or value to weight the chart.";
  }

  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return {
    caption,
    rows: base.map((b, i) => ({
      id: b.id,
      name: b.name,
      sizeLabel: b.sizeLabel,
      status: b.status,
      pct: Math.round((weights[i] / total) * 1000) / 10,
      color: COLORS[i % COLORS.length],
    })),
  };
}
