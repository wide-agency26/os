import {
  generateJsonFromGateway,
  hasGatewayCredentials,
} from "@/lib/ai/gateway-json";
import { docsGuardrail, packDocs } from "@/lib/audience/generate";
import {
  MARKET_FIELDS,
  type FieldMeta,
  type MarketField,
} from "@/lib/market/types";
import type { ContextDoc } from "@/lib/content/types";

export { docsGuardrail };

type FieldDraft = { text: string; origin: "sourced" | "inferred" };

export type MarketDraft = Record<MarketField, FieldDraft>;

export async function draftMarketAnalysis(input: {
  company: string;
  projectTitle: string;
  category: string;
  docs: ContextDoc[];
  unverified: boolean;
}): Promise<{ ok: true; fields: MarketDraft } | { ok: false; error: string }> {
  if (!hasGatewayCredentials()) {
    return { ok: false, error: "AI credentials are not configured." };
  }
  const packed = packDocs(input.docs);
  const system = `You are WIDE's market strategist. Output ONLY JSON.
Shape: {
  "size_notes": { "text": string, "origin": "sourced" | "inferred" },
  "trend_notes": { "text": string, "origin": "sourced" | "inferred" },
  "timing_notes": { "text": string, "origin": "sourced" | "inferred" },
  "risk_notes": { "text": string, "origin": "sourced" | "inferred" }
}
origin=sourced only when uploaded research supports the claim.
origin=inferred when you are extrapolating or research is missing.
Write 2–4 short sentences per field. No TAM/SAM theatre, no invented market figures.
${
  input.unverified
    ? "No research uploaded — every origin must be inferred. Open each field by stating it is unverified inference, not sourced fact."
    : "Ground claims in the research. Do not invent category size numbers the docs do not support."
}`;

  let json: unknown;
  try {
    json = await generateJsonFromGateway({
      system,
      prompt: `Company: ${input.company}\nProject: ${input.projectTitle}\nCategory: ${input.category}\nUnverified: ${input.unverified}\n\nResearch:\n${packed || "(none)"}`,
      maxOutputTokens: 1800,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" };
  }

  const fields = {} as MarketDraft;
  for (const key of MARKET_FIELDS) {
    const raw = (json as Record<string, unknown>)?.[key] as
      | { text?: string; origin?: string }
      | string
      | undefined;
    const text = String(
      typeof raw === "object" && raw ? raw.text ?? "" : raw ?? ""
    ).trim();
    const origin: "sourced" | "inferred" =
      input.unverified || (typeof raw === "object" && raw?.origin === "inferred")
        ? "inferred"
        : "sourced";
    fields[key] = {
      text: input.unverified
        ? text
          ? `[Unverified inference]\n${text}`
          : "[Unverified inference — no research docs.]"
        : text,
      origin,
    };
  }
  if (!MARKET_FIELDS.some((k) => fields[k].text.replace(/\[Unverified[^\]]*\]/g, "").trim())) {
    return { ok: false, error: "The model returned an empty market analysis." };
  }
  return { ok: true, fields };
}

export async function draftMarketField(input: {
  company: string;
  projectTitle: string;
  category: string;
  field: MarketField;
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
      system: `Rewrite one market-analysis section. Output ONLY JSON: { "text": string, "origin": "sourced" | "inferred" }. 2–4 sentences.
${input.unverified ? "No research — origin must be inferred and the text must say so." : "Ground in the research when possible."}`,
      prompt: `Company: ${input.company}\nProject: ${input.projectTitle}\nCategory: ${input.category}\nField: ${input.field}\nUnverified: ${input.unverified}\n\nResearch:\n${packed || "(none)"}`,
      maxOutputTokens: 800,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" };
  }
  const text = String((json as { text?: string })?.text || "").trim();
  if (!text) return { ok: false, error: "Empty field from the model." };
  const origin =
    (json as { origin?: string })?.origin === "inferred" || input.unverified
      ? "inferred"
      : "sourced";
  return {
    ok: true,
    text: input.unverified && !text.startsWith("[Unverified")
      ? `[Unverified inference]\n${text}`
      : text,
    origin,
  };
}

export function fieldMetaFromDrafts(
  fields: MarketDraft
): Record<MarketField, FieldMeta> {
  const meta = {} as Record<MarketField, FieldMeta>;
  for (const key of MARKET_FIELDS) {
    meta[key] = { origin: fields[key].origin };
  }
  return meta;
}
