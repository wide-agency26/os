import { generateText } from "ai";

/**
 * Shared AI helper for every generate call in the OS.
 * Routes through Vercel AI Gateway via a plain `provider/model` string.
 * Auth: VERCEL_OIDC_TOKEN (automatic on Vercel; `vercel env pull` locally)
 *   or AI_GATEWAY_API_KEY as a static fallback. OpenRouter is not used.
 */

export const GATEWAY_CREDENTIALS_HINT =
  "AI Gateway is not connected. On Vercel this uses OIDC automatically; locally run `vercel env pull .env.local`.";

export function hasGatewayCredentials(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL === "1"
  );
}

/** Default chat model. Override with AI_MODEL (provider/model). Flagship models like gpt-5.5 need paid AI Gateway credits. */
export const GATEWAY_JSON_MODEL =
  process.env.AI_MODEL?.trim() || "openai/gpt-5.4-mini";

/** Plain gateway model id — AI SDK routes provider/model strings through AI Gateway. */
export function resolveLanguageModel(modelId: string = GATEWAY_JSON_MODEL) {
  return modelId;
}

function stripCodeFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  return t.trim();
}

function extractJsonObject(text: string): string {
  const cleaned = stripCodeFences(text);
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return cleaned;
  return cleaned.slice(first, last + 1);
}

export async function generateJsonFromGateway(options: {
  system: string;
  prompt: string;
  model?: string;
  maxOutputTokens?: number;
}): Promise<unknown | null> {
  if (!hasGatewayCredentials()) return null;

  const { text } = await generateText({
    model: resolveLanguageModel(options.model ?? GATEWAY_JSON_MODEL),
    system: options.system,
    prompt: options.prompt,
    temperature: 0.3,
    maxOutputTokens: options.maxOutputTokens ?? 4000,
  });

  const candidate = extractJsonObject(text);
  return JSON.parse(candidate) as unknown;
}

export async function generateTextFromGateway(options: {
  system: string;
  prompt: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<string | null> {
  if (!hasGatewayCredentials()) return null;

  const { text } = await generateText({
    model: resolveLanguageModel(options.model ?? GATEWAY_JSON_MODEL),
    system: options.system,
    prompt: options.prompt,
    temperature: options.temperature ?? 0.35,
    maxOutputTokens: options.maxOutputTokens ?? 1200,
  });

  return (text || "").trim() || null;
}
