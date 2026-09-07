export const COMPETITOR_FIELDS = [
  "positioning_summary",
  "messaging_notes",
  "channels_notes",
  "strengths",
  "weaknesses",
] as const;

export type CompetitorField = (typeof COMPETITOR_FIELDS)[number];

export const COMPETITOR_FIELD_LABELS: Record<CompetitorField, string> = {
  positioning_summary: "Positioning",
  messaging_notes: "Messaging",
  channels_notes: "Channels",
  strengths: "Strengths",
  weaknesses: "Weaknesses",
};

export type FieldOrigin = "sourced" | "inferred";

export type FieldMeta = {
  origin: FieldOrigin;
};

export type Competitor = {
  id: string;
  projectId: string;
  name: string;
  url: string;
  notes: string;
  positioningSummary: string;
  messagingNotes: string;
  channelsNotes: string;
  strengths: string;
  weaknesses: string;
  status: "draft" | "finalized";
  accepted: boolean;
  aiGenerated: boolean;
  fieldMeta: Partial<Record<CompetitorField, FieldMeta>>;
  fetchError?: string;
  sortOrder: number;
};

export type CompetitionSynthesis = {
  id: string;
  projectId: string;
  gapsAndOpportunities: string;
  status: "draft" | "finalized";
  aiGenerated: boolean;
};

export type CompetitionSnapshot = {
  totalCount: number;
  synthesisLine: string;
  synthesisBody: string;
  competitors: { name: string; summary: string }[];
};

export function isCompetitorField(value: string): value is CompetitorField {
  return (COMPETITOR_FIELDS as readonly string[]).includes(value);
}

export function competitionModuleStatus(
  synthesis: CompetitionSynthesis | null
): "not_started" | "in_progress" | "finalized" {
  if (!synthesis) return "not_started";
  if (synthesis.status === "finalized") return "finalized";
  return "in_progress";
}

export function firstSentence(text: string, max = 160): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  const line = (match ? match[1] : trimmed).trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function competitionSnapshot(
  competitors: Competitor[],
  synthesis: CompetitionSynthesis | null,
  clientSafe: boolean
): CompetitionSnapshot | undefined {
  if (clientSafe && synthesis?.status !== "finalized") return undefined;
  const visible = clientSafe
    ? competitors.filter((c) => c.accepted || c.status === "finalized")
    : competitors;
  const showSynthesis =
    Boolean(synthesis?.gapsAndOpportunities) &&
    (!clientSafe || synthesis?.status === "finalized");
  const body = showSynthesis ? synthesis?.gapsAndOpportunities ?? "" : "";
  return {
    totalCount: visible.length,
    synthesisLine: firstSentence(body),
    synthesisBody: body,
    competitors: visible.map((c) => ({
      name: c.name,
      summary: c.positioningSummary || "",
    })),
  };
}
