export const MARKET_FIELDS = [
  "size_notes",
  "trend_notes",
  "timing_notes",
  "risk_notes",
] as const;

export type MarketField = (typeof MARKET_FIELDS)[number];

export const MARKET_FIELD_LABELS: Record<MarketField, string> = {
  size_notes: "Size",
  trend_notes: "Trends",
  timing_notes: "Timing",
  risk_notes: "Risks",
};

export type FieldOrigin = "sourced" | "inferred";

export type FieldMeta = {
  origin: FieldOrigin;
};

export type MarketAnalysis = {
  id: string;
  projectId: string;
  category: string;
  sizeNotes: string;
  trendNotes: string;
  timingNotes: string;
  riskNotes: string;
  status: "draft" | "finalized";
  aiGenerated: boolean;
  fieldMeta: Partial<Record<MarketField, FieldMeta>>;
};

export type MarketSnapshot = {
  category: string;
  takeaway: string;
  sections: { label: string; text: string }[];
};

export function isMarketField(value: string): value is MarketField {
  return (MARKET_FIELDS as readonly string[]).includes(value);
}

export function marketModuleStatus(
  row: MarketAnalysis | null
): "not_started" | "in_progress" | "finalized" {
  if (!row) return "not_started";
  if (row.status === "finalized") return "finalized";
  const hasBody = Boolean(
    row.sizeNotes || row.trendNotes || row.timingNotes || row.riskNotes || row.category
  );
  return hasBody ? "in_progress" : "not_started";
}

export function firstSentence(text: string, max = 160): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  const line = (match ? match[1] : trimmed).trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function marketTakeaway(row: MarketAnalysis): string {
  return firstSentence(row.timingNotes) || firstSentence(row.trendNotes) || "";
}

export function marketSnapshot(
  row: MarketAnalysis | null,
  clientSafe: boolean
): MarketSnapshot | undefined {
  if (!row) return undefined;
  if (clientSafe && row.status !== "finalized") return undefined;
  return {
    category: row.category,
    takeaway: marketTakeaway(row),
    sections: MARKET_FIELDS.map((field) => ({
      label: MARKET_FIELD_LABELS[field],
      text:
        field === "size_notes"
          ? row.sizeNotes
          : field === "trend_notes"
            ? row.trendNotes
            : field === "timing_notes"
              ? row.timingNotes
              : row.riskNotes,
    })).filter((s) => s.text.trim()),
  };
}
