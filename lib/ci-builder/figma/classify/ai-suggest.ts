/**
 * AI classification for unmapped Figma frames (P5).
 * Only suggests — never auto-applies without caller merging as "suggested".
 */

import {
  generateJsonFromGateway,
  hasGatewayCredentials,
} from "@/lib/ai/gateway-json";
import type { SectionType } from "@/lib/ci-builder/types";

const ALLOWED: SectionType[] = [
  "logo",
  "colors",
  "typography",
  "buttons",
  "grid_frames",
  "backgrounds",
  "applications",
  "dos_donts",
];

export type AiSuggestion = {
  sourceId: string;
  sourceName: string;
  suggestedSection: SectionType | null;
  confidence: "suggested" | "unmapped";
  reason: string;
};

export async function suggestSectionsForUnmapped(
  items: { sourceId: string; sourceName: string }[]
): Promise<AiSuggestion[]> {
  if (!items.length) return [];
  if (!hasGatewayCredentials()) {
    return items.map((i) => ({
      ...i,
      suggestedSection: null,
      confidence: "unmapped" as const,
      reason: "AI unavailable — left unmapped for manual review",
    }));
  }

  const batch = items.slice(0, 40);
  try {
    const result = await generateJsonFromGateway({
      system: `You classify Figma frame/component names into Brand Guideline sections.
Return JSON: { "items": [{ "sourceId": string, "section": string|null, "reason": string }] }
Allowed section values: ${ALLOWED.join(", ")}.
Use null when unsure. Never invent other section names. Prefer null over guessing.`,
      prompt: `Classify these Figma nodes:\n${JSON.stringify(batch, null, 2)}`,
      maxOutputTokens: 2000,
    });

    const rows =
      result && typeof result === "object" && Array.isArray((result as any).items)
        ? (result as any).items
        : [];

    const byId = new Map<string, { section: string | null; reason: string }>();
    for (const row of rows) {
      if (!row?.sourceId) continue;
      const section =
        typeof row.section === "string" && ALLOWED.includes(row.section)
          ? (row.section as SectionType)
          : null;
      byId.set(String(row.sourceId), {
        section,
        reason: String(row.reason || "AI suggestion"),
      });
    }

    return items.map((i) => {
      const hit = byId.get(i.sourceId);
      if (hit?.section) {
        return {
          ...i,
          suggestedSection: hit.section as SectionType,
          confidence: "suggested" as const,
          reason: hit.reason,
        };
      }
      return {
        ...i,
        suggestedSection: null,
        confidence: "unmapped" as const,
        reason: hit?.reason || "No confident AI match",
      };
    });
  } catch (err) {
    console.error("AI classify failed:", err);
    return items.map((i) => ({
      ...i,
      suggestedSection: null,
      confidence: "unmapped" as const,
      reason: "AI classification error",
    }));
  }
}
