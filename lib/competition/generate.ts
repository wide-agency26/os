import {
  generateJsonFromGateway,
  hasGatewayCredentials,
} from "@/lib/ai/gateway-json";
import type { ContextDoc } from "@/lib/content/types";
import {
  COMPETITOR_FIELDS,
  type Competitor,
  type CompetitorField,
  type FieldMeta,
} from "@/lib/competition/types";
import type { SiteFetch } from "@/lib/competition/fetch-site";

const DOC_CHAR_BUDGET = 8000;

export function packDocs(docs: ContextDoc[]): string {
  const active = docs.filter((d) => d.active !== false);
  if (!active.length) return "";
  const per = Math.max(600, Math.floor(DOC_CHAR_BUDGET / active.length));
  return active
    .map((d) => {
      const body = (d.extracted_text || "").slice(0, per);
      return `### ${d.filename}\n${body || "(no extracted text)"}`;
    })
    .join("\n\n");
}

type FieldDraft = { text: string; origin: "sourced" | "inferred" };

export type EnrichDraft = Record<CompetitorField, FieldDraft>;

export async function draftCompetitorEnrichment(input: {
  company: string;
  projectTitle: string;
  competitorName: string;
  competitorUrl: string;
  notes: string;
  site: SiteFetch | null;
  docs: ContextDoc[];
}): Promise<{ ok: true; fields: EnrichDraft } | { ok: false; error: string }> {
  if (!hasGatewayCredentials()) {
    return { ok: false, error: "AI credentials are not configured." };
  }
  const fetched = Boolean(input.site?.ok && input.site.text);
  const packed = packDocs(input.docs);
  const system = `You are WIDE's competitive strategist. Output ONLY JSON.
Shape: {
  "positioning_summary": { "text": string, "origin": "sourced" | "inferred" },
  "messaging_notes": { "text": string, "origin": "sourced" | "inferred" },
  "channels_notes": { "text": string, "origin": "sourced" | "inferred" },
  "strengths": { "text": string, "origin": "sourced" | "inferred" },
  "weaknesses": { "text": string, "origin": "sourced" | "inferred" }
}
origin=sourced only when the site text or research docs support the claim.
origin=inferred when you are extrapolating or the source is missing.
Write 2–4 short sentences per field. No marketing fluff.
${
  fetched
    ? "Ground claims in the fetched page. Do not invent products, prices, or channels the page does not support."
    : "The competitor site was not fetchable and must not be fabricated. Every origin must be inferred. State clearly what is unverified / unknown rather than inventing specifics."
}`;

  const siteBlock = fetched
    ? `Fetched URL: ${input.site?.finalUrl || input.competitorUrl}\nTitle: ${input.site?.title || ""}\nMeta: ${input.site?.metaDescription || ""}\nPage text:\n${input.site?.text}`
    : `URL provided: ${input.competitorUrl || "(none)"}\nFetch error: ${input.site?.error || "no URL"} — treat all fields as unverified.`;

  let json: unknown;
  try {
    json = await generateJsonFromGateway({
      system,
      prompt: `Our client: ${input.company}\nProject: ${input.projectTitle}\nCompetitor: ${input.competitorName}\nAdmin notes: ${input.notes || "(none)"}\n\n${siteBlock}\n\nProject research:\n${packed || "(none)"}`,
      maxOutputTokens: 1800,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" };
  }

  const fields = {} as EnrichDraft;
  for (const key of COMPETITOR_FIELDS) {
    const raw = (json as Record<string, unknown>)?.[key] as
      | { text?: string; origin?: string }
      | string
      | undefined;
    const text = String(
      typeof raw === "object" && raw ? raw.text ?? "" : raw ?? ""
    ).trim();
    const origin: "sourced" | "inferred" =
      !fetched || (typeof raw === "object" && raw?.origin === "inferred")
        ? "inferred"
        : "sourced";
    fields[key] = {
      text: fetched
        ? text
        : text
          ? `[Unverified — no usable URL content]\n${text}`
          : "[Unverified — no usable URL content. Do not treat as fact.]",
      origin,
    };
  }
  if (!COMPETITOR_FIELDS.some((k) => fields[k].text.replace(/\[Unverified[^\]]*\]/g, "").trim())) {
    return { ok: false, error: "The model returned an empty enrichment." };
  }
  return { ok: true, fields };
}

export function fieldMetaFromDrafts(
  fields: EnrichDraft,
  fetchError?: string
): Record<CompetitorField, FieldMeta> & { fetch?: { ok: boolean; error?: string } } {
  const meta = {} as Record<CompetitorField, FieldMeta> & {
    fetch?: { ok: boolean; error?: string };
  };
  for (const key of COMPETITOR_FIELDS) {
    meta[key] = { origin: fields[key].origin };
  }
  if (fetchError) meta.fetch = { ok: false, error: fetchError };
  else meta.fetch = { ok: true };
  return meta;
}

export async function draftCompetitionSynthesis(input: {
  company: string;
  projectTitle: string;
  competitors: Competitor[];
  docs: ContextDoc[];
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!hasGatewayCredentials()) {
    return { ok: false, error: "AI credentials are not configured." };
  }
  const packed = packDocs(input.docs);
  const set = input.competitors
    .map((c, i) => {
      const tag = c.accepted ? "accepted" : "draft";
      return `## ${i + 1}. ${c.name} (${tag}${c.url ? ` · ${c.url}` : ""})
Positioning: ${c.positioningSummary || "(empty)"}
Messaging: ${c.messagingNotes || "(empty)"}
Channels: ${c.channelsNotes || "(empty)"}
Strengths: ${c.strengths || "(empty)"}
Weaknesses: ${c.weaknesses || "(empty)"}`;
    })
    .join("\n\n");

  let json: unknown;
  try {
    json = await generateJsonFromGateway({
      system: `You are WIDE's competitive strategist. Output ONLY JSON:
{ "gaps_and_opportunities": string }
Write 3–6 short paragraphs covering: where the set clusters, whitespace in positioning/messaging, channel openings, and what our client (${input.company}) can uniquely occupy.
Name competitors when you contrast them. Do not invent facts that are not in the notes.
If a field is marked unverified, treat it as weak signal, not evidence.`,
      prompt: `Client: ${input.company}\nProject: ${input.projectTitle}\nCompetitor count: ${input.competitors.length}\n\n${set}\n\nProject research:\n${packed || "(none)"}`,
      maxOutputTokens: 1800,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" };
  }
  const text = String((json as { gaps_and_opportunities?: string })?.gaps_and_opportunities || "").trim();
  if (!text) return { ok: false, error: "The model returned an empty synthesis." };
  return { ok: true, text };
}
