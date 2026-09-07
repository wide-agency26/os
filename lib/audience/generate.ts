import {
  generateJsonFromGateway,
  hasGatewayCredentials,
} from "@/lib/ai/gateway-json";
import {
  PROFILE_FIELDS,
  type FieldMeta,
  type ProfileField,
} from "@/lib/audience/types";
import type { ContextDoc } from "@/lib/content/types";

const DOC_CHAR_BUDGET = 14000;

export function docsGuardrail(
  docCount: number,
  allowUnverified?: boolean
): { ok: true; unverified: boolean } | { ok: false; code: "NO_DOCS"; error: string } {
  if (docCount === 0 && !allowUnverified) {
    return {
      ok: false,
      code: "NO_DOCS",
      error:
        "Upload research documents first. Generation without sources would be unverified inference.",
    };
  }
  return { ok: true, unverified: docCount === 0 };
}

export function packDocs(docs: ContextDoc[]): string {
  const active = docs.filter((d) => d.active !== false);
  if (!active.length) return "";
  const per = Math.max(800, Math.floor(DOC_CHAR_BUDGET / active.length));
  return active
    .map((d) => {
      const body = (d.extracted_text || "").slice(0, per);
      return `### ${d.filename}\n${body || "(no extracted text)"}`;
    })
    .join("\n\n");
}

export type DraftSegment = {
  name: string;
  demographic_summary: string;
  size_or_value: string;
  rationale: string;
};

export async function draftAudienceSegments(input: {
  company: string;
  projectTitle: string;
  docs: ContextDoc[];
  unverified: boolean;
}): Promise<{ ok: true; segments: DraftSegment[] } | { ok: false; error: string }> {
  if (!hasGatewayCredentials()) {
    return { ok: false, error: "AI credentials are not configured." };
  }
  const packed = packDocs(input.docs);
  const system = `You are WIDE's audience strategist. Output ONLY JSON.
Shape: { "segments": [ { "name": string, "demographic_summary": string, "size_or_value": string, "rationale": string } ] }
Propose 3–6 distinct, commercially useful audience segments for a branding/growth engagement.
Keep names short. demographic_summary is one or two sentences. rationale must cite what in the research supports the cut.
${input.unverified ? "Research is missing — mark this clearly in rationale as unverified inference." : "Ground every segment in the uploaded research. Do not invent markets the docs do not support."}`;

  let json: unknown;
  try {
    json = await generateJsonFromGateway({
      system,
      prompt: `Company: ${input.company}\nProject: ${input.projectTitle}\n\nResearch:\n${packed || "(none)"}`,
      maxOutputTokens: 1800,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" };
  }
  const segments = Array.isArray((json as any)?.segments) ? (json as any).segments : [];
  const cleaned: DraftSegment[] = segments
    .map((s: any) => ({
      name: String(s?.name || "").trim(),
      demographic_summary: String(s?.demographic_summary || "").trim(),
      size_or_value: String(s?.size_or_value || "").trim(),
      rationale: String(s?.rationale || "").trim(),
    }))
    .filter((s: DraftSegment) => s.name);
  if (!cleaned.length) return { ok: false, error: "The model returned no segments." };
  return { ok: true, segments: cleaned };
}

type FieldDraft = { text: string; origin: "sourced" | "inferred" };

export async function draftInsightProfile(input: {
  company: string;
  segmentName: string;
  demographicSummary: string;
  rationale: string;
  docs: ContextDoc[];
  unverified: boolean;
}): Promise<
  | {
      ok: true;
      fields: Record<ProfileField, FieldDraft>;
    }
  | { ok: false; error: string }
> {
  if (!hasGatewayCredentials()) {
    return { ok: false, error: "AI credentials are not configured." };
  }
  const packed = packDocs(input.docs);
  const system = `You are WIDE's audience researcher. Output ONLY JSON.
Shape: {
  "pains": { "text": string, "origin": "sourced" | "inferred" },
  "motivations": { "text": string, "origin": "sourced" | "inferred" },
  "channel_habits": { "text": string, "origin": "sourced" | "inferred" },
  "language_cues": { "text": string, "origin": "sourced" | "inferred" },
  "objections": { "text": string, "origin": "sourced" | "inferred" },
  "triggers": { "text": string, "origin": "sourced" | "inferred" }
}
origin=sourced when the research supports the claim; inferred when you are extrapolating.
Write 2–4 short sentences per field. No marketing fluff.
${input.unverified ? "No research uploaded — every origin must be inferred." : ""}`;

  let json: unknown;
  try {
    json = await generateJsonFromGateway({
      system,
      prompt: `Company: ${input.company}\nSegment: ${input.segmentName}\nWho: ${input.demographicSummary}\nWhy this cut: ${input.rationale}\n\nResearch:\n${packed || "(none)"}`,
      maxOutputTokens: 1800,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" };
  }
  const fields = {} as Record<ProfileField, FieldDraft>;
  for (const key of PROFILE_FIELDS) {
    const raw = (json as any)?.[key];
    const text = String(raw?.text ?? raw ?? "").trim();
    const origin = raw?.origin === "inferred" || input.unverified ? "inferred" : "sourced";
    fields[key] = { text, origin };
  }
  if (!PROFILE_FIELDS.some((k) => fields[k].text)) {
    return { ok: false, error: "The model returned an empty profile." };
  }
  return { ok: true, fields };
}

export async function draftInsightField(input: {
  company: string;
  segmentName: string;
  field: ProfileField;
  docs: ContextDoc[];
  unverified: boolean;
}): Promise<{ ok: true; text: string; origin: "sourced" | "inferred" } | { ok: false; error: string }> {
  if (!hasGatewayCredentials()) {
    return { ok: false, error: "AI credentials are not configured." };
  }
  const packed = packDocs(input.docs);
  let json: unknown;
  try {
    json = await generateJsonFromGateway({
      system: `Rewrite one audience insight field. Output ONLY JSON: { "text": string, "origin": "sourced" | "inferred" }. 2–4 sentences.`,
      prompt: `Company: ${input.company}\nSegment: ${input.segmentName}\nField: ${input.field}\nUnverified: ${input.unverified}\n\nResearch:\n${packed || "(none)"}`,
      maxOutputTokens: 800,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" };
  }
  const text = String((json as any)?.text || "").trim();
  if (!text) return { ok: false, error: "Empty field from the model." };
  const origin =
    (json as any)?.origin === "inferred" || input.unverified ? "inferred" : "sourced";
  return { ok: true, text, origin };
}

export function fieldMetaFromDrafts(
  fields: Record<ProfileField, FieldDraft>
): Record<ProfileField, FieldMeta> {
  const meta = {} as Record<ProfileField, FieldMeta>;
  for (const key of PROFILE_FIELDS) {
    meta[key] = { origin: fields[key].origin };
  }
  return meta;
}
