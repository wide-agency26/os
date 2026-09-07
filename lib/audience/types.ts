export const PROFILE_FIELDS = [
  "pains",
  "motivations",
  "channel_habits",
  "language_cues",
  "objections",
  "triggers",
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const PROFILE_FIELD_LABELS: Record<ProfileField, string> = {
  pains: "Pains",
  motivations: "Motivations",
  channel_habits: "Channel habits",
  language_cues: "Language cues",
  objections: "Objections",
  triggers: "Triggers",
};

export type FieldOrigin = "sourced" | "inferred";

export type FieldMeta = {
  origin: FieldOrigin;
};

export type AudienceSegment = {
  id: string;
  projectId: string;
  name: string;
  demographicSummary: string;
  sizeOrValue: string;
  rationale: string;
  status: "draft" | "finalized";
  accepted: boolean;
  aiGenerated: boolean;
  sortOrder: number;
  profile: AudienceProfile | null;
};

export type AudienceProfile = {
  id: string;
  segmentId: string;
  pains: string;
  motivations: string;
  channelHabits: string;
  languageCues: string;
  objections: string;
  triggers: string;
  status: "draft" | "finalized";
  aiGenerated: boolean;
  fieldMeta: Partial<Record<ProfileField, FieldMeta>>;
};

export type AudienceSource = {
  id: string;
  segmentId: string | null;
  profileId: string | null;
  contextDocId: string;
  fieldName: string | null;
  note: string | null;
  filename?: string;
};

export type AudienceSnapshot = {
  finalizedCount: number;
  totalCount: number;
  segments: { name: string; summary: string }[];
};

export function isProfileField(value: string): value is ProfileField {
  return (PROFILE_FIELDS as readonly string[]).includes(value);
}

export function pairIsFinalized(segment: AudienceSegment): boolean {
  return segment.status === "finalized" && segment.profile?.status === "finalized";
}

export function audienceModuleStatus(
  segments: AudienceSegment[]
): "not_started" | "in_progress" | "finalized" {
  if (!segments.length) return "not_started";
  const done = segments.filter(pairIsFinalized).length;
  if (done === 0) return "not_started";
  if (done === segments.length) return "finalized";
  return "in_progress";
}

export function audienceSnapshot(
  segments: AudienceSegment[],
  clientSafe: boolean
): AudienceSnapshot {
  const visible = clientSafe ? segments.filter(pairIsFinalized) : segments;
  return {
    finalizedCount: segments.filter(pairIsFinalized).length,
    totalCount: segments.length,
    segments: visible.map((s) => ({
      name: s.name,
      summary: s.demographicSummary || s.rationale || "",
    })),
  };
}
