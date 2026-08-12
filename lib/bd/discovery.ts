import { experimental_transcribe as transcribe } from "ai";
import {
  generateJsonFromGateway,
  GATEWAY_JSON_MODEL,
  hasGatewayCredentials,
} from "@/lib/ai/gateway-json";

export type DiscoveryCallPayload = {
  consent_disclosed: true;
  consent_line: string;
  notes_text: string | null;
  notes_file_url: string | null;
  notes_file_name: string | null;
  audio_file_url: string | null;
  audio_file_name: string | null;
  transcript: string | null;
  summary: string | null;
  action_items: string[];
  needs: string | null;
  budget: string | null;
  timeline: string | null;
  updated_at: string | null;
};

export const DISCOVERY_CONSENT_LINE =
  "This discovery call may be recorded and/or notes may be taken so WIDE can accurately capture requirements, budget, and timeline. By joining, you acknowledge this disclosure.";

export function emptyDiscoveryCall(): DiscoveryCallPayload {
  return {
    consent_disclosed: true,
    consent_line: DISCOVERY_CONSENT_LINE,
    notes_text: null,
    notes_file_url: null,
    notes_file_name: null,
    audio_file_url: null,
    audio_file_name: null,
    transcript: null,
    summary: null,
    action_items: [],
    needs: null,
    budget: null,
    timeline: null,
    updated_at: null,
  };
}

export function mergeDiscoveryCall(
  raw: Record<string, unknown> | null | undefined
): DiscoveryCallPayload {
  const base = emptyDiscoveryCall();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    consent_disclosed: true,
    consent_line: DISCOVERY_CONSENT_LINE,
    action_items: Array.isArray(raw.action_items)
      ? (raw.action_items as string[])
      : [],
  };
}

export async function transcribeAudioBuffer(
  bytes: Uint8Array,
  mediaType: string
): Promise<string | null> {
  if (!hasGatewayCredentials()) return null;
  try {
    const result = await transcribe({
      model: "openai/whisper-1",
      audio: bytes,
      providerOptions: {
        // gateway routes by model id
      },
    });
    return result.text?.trim() || null;
  } catch (e) {
    console.error("transcribe failed", e);
    // fallback: try without provider options / alternate model string patterns
    try {
      const result = await transcribe({
        model: "openai/whisper-1" as never,
        audio: { data: bytes, mediaType },
      } as never);
      return (result as { text?: string }).text?.trim() || null;
    } catch (e2) {
      console.error("transcribe fallback failed", e2);
      return null;
    }
  }
}

export async function extractDiscoveryInsights(input: {
  companyName: string;
  contactName: string;
  sourceText: string;
}): Promise<{
  summary: string;
  action_items: string[];
  needs: string | null;
  budget: string | null;
  timeline: string | null;
}> {
  const source = input.sourceText.slice(0, 20000);
  if (!source.trim()) {
    return {
      summary: "No notes or transcript provided yet.",
      action_items: [],
      needs: null,
      budget: null,
      timeline: null,
    };
  }

  if (hasGatewayCredentials()) {
    try {
      const json = await generateJsonFromGateway({
        system:
          "You extract structured discovery-call insights for a brand agency. Return ONLY JSON.",
        prompt: `Company: ${input.companyName}
Contact: ${input.contactName}

From the notes/transcript below, return JSON with keys:
summary (string, 2-4 sentences),
action_items (string array, concrete next steps),
needs (string|null — product/brand needs),
budget (string|null — any budget signal),
timeline (string|null — any timing signal).

NOTES/TRANSCRIPT:
${source}`,
        model: GATEWAY_JSON_MODEL,
        maxOutputTokens: 2000,
      });
      if (json && typeof json === "object") {
        const o = json as Record<string, unknown>;
        return {
          summary:
            typeof o.summary === "string" ? o.summary : "Summary unavailable.",
          action_items: Array.isArray(o.action_items)
            ? o.action_items.filter((x): x is string => typeof x === "string")
            : [],
          needs: typeof o.needs === "string" ? o.needs : null,
          budget: typeof o.budget === "string" ? o.budget : null,
          timeline: typeof o.timeline === "string" ? o.timeline : null,
        };
      }
    } catch (e) {
      console.error("discovery AI extract failed, using heuristics", e);
    }
  }

  return heuristicDiscoveryInsights(source);
}

function heuristicDiscoveryInsights(source: string): {
  summary: string;
  action_items: string[];
  needs: string | null;
  budget: string | null;
  timeline: string | null;
} {
  const lines = source
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const budgetLine =
    lines.find((l) => /^budget\b/i.test(l)) ||
    lines.find((l) => /budget|eur|€|\$|\d+\s*[-–]?\s*\d*\s*k\b/i.test(l)) ||
    null;
  const timelineLine =
    lines.find((l) => /^timeline\b/i.test(l)) ||
    lines.find((l) =>
      /timeline|kickoff|launch|q[1-4]|sept|oct|nov|dec|jan|deadline/i.test(l)
    ) ||
    null;
  const needsLine =
    lines.find((l) => /^needs?\b/i.test(l)) ||
    lines.find((l) =>
      /need|rebrand|website|identity|brand|sow|seo/i.test(l)
    ) ||
    null;

  const action_items = lines
    .filter((l) =>
      /^(action|todo|next|follow[- ]?up|send|schedule|draft)/i.test(l)
    )
    .map((l) => l.replace(/^(action|todo|next)\s*[:\-–]?\s*/i, ""))
    .slice(0, 8);

  const summary =
    lines.slice(0, 4).join(" ") || source.slice(0, 400).trim();

  return {
    summary,
    action_items:
      action_items.length > 0
        ? action_items
        : lines
            .filter((l) => /send |schedule |draft |follow/i.test(l))
            .slice(0, 5),
    needs: needsLine,
    budget: budgetLine,
    timeline: timelineLine,
  };
}
