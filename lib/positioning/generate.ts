import {
  generateJsonFromGateway,
  hasGatewayCredentials,
} from "@/lib/ai/gateway-json";
import { STRATEGY_TYPE_LABELS, type StrategyType, isStrategyType } from "@/lib/strategy/modules";

export async function draftPositioning(input: {
  company: string;
  projectTitle: string;
  strategyType: string;
  pack: string;
  previousStatement?: string;
  previousRationale?: string;
}): Promise<
  | { ok: true; statement: string; rationale: string }
  | { ok: false; error: string }
> {
  if (!hasGatewayCredentials()) {
    return { ok: false, error: "AI credentials are not configured." };
  }
  const typeLabel = isStrategyType(input.strategyType)
    ? STRATEGY_TYPE_LABELS[input.strategyType as StrategyType]
    : input.strategyType;
  const rewrite = Boolean(input.previousStatement);
  const system = `You are WIDE's brand strategist. Output ONLY JSON.
Shape: { "positioning_statement": string, "rationale": string }
positioning_statement: one crisp sentence (under 280 characters) that names where brand truth, audience need, and — if present — market timing and competitive gap overlap. It must be specific to this ${typeLabel}, not a generic slogan.
rationale: 2–4 short paragraphs. Name which analyzer inputs you used. Do not invent facts the inputs do not support.
${rewrite ? "A previous draft exists. Rewrite it so new analyzer inputs are visibly present — do not repeat the old sentence." : "This is the first draft from the inputs below."}`;

  let json: unknown;
  try {
    json = await generateJsonFromGateway({
      system,
      prompt: `Company: ${input.company}
Project: ${input.projectTitle}
Strategy type: ${typeLabel}
${rewrite ? `\nPrevious statement:\n${input.previousStatement}\n\nPrevious rationale:\n${input.previousRationale || ""}\n` : ""}
Finalized analyzer inputs:
${input.pack}`,
      maxOutputTokens: 1400,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" };
  }
  if (!json || typeof json !== "object") {
    return { ok: false, error: "The model returned no JSON." };
  }

  const statement = String((json as any)?.positioning_statement || "").trim();
  const rationale = String((json as any)?.rationale || "").trim();
  if (!statement || !rationale) {
    return { ok: false, error: "The model returned an empty positioning draft." };
  }
  return { ok: true, statement, rationale };
}
