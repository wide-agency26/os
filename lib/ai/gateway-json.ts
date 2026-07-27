import { generateText } from "ai";

/**
 * Shared helper to get a JSON object back from an LLM via the Vercel AI Gateway.
 * Uses the AI_GATEWAY_API_KEY (local) / VERCEL_OIDC_TOKEN (Vercel) credentials
 * that the rest of the app already relies on.
 *
 * Returns null when no gateway credentials are configured so callers can fall
 * back to a template. Throws on a genuine model/parse error.
 */

export const GATEWAY_JSON_MODEL = "anthropic/claude-sonnet-4.6";

export function hasGatewayCredentials(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
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
    model: options.model ?? GATEWAY_JSON_MODEL,
    system: options.system,
    prompt: options.prompt,
    temperature: 0.3,
    maxOutputTokens: options.maxOutputTokens ?? 4000,
  });

  const candidate = extractJsonObject(text);
  return JSON.parse(candidate) as unknown;
}
