import {
  generateJsonFromGateway,
  hasGatewayCredentials,
} from "@/lib/ai/gateway-json";
import { DEFAULT_TERMS_TEXT } from "@/lib/sow/constants";
import type { SowAssistAnswers, SowSuggestion } from "@/lib/sow/assist";
import type { SowDocument } from "@/lib/sow/types";

function clip(s: string, n: number) {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

export function buildAssistPromptPack(input: {
  sow: SowDocument;
  rawText: string;
  answers: SowAssistAnswers;
  discovery?: {
    summary?: string | null;
    needs?: string | null;
    budget?: string | null;
    timeline?: string | null;
    notes_text?: string | null;
    transcript?: string | null;
  } | null;
}): { system: string; prompt: string } {
  const sections = input.sow.sections.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.service_description_snapshot || s.intro || "",
    items: s.line_items.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description || "",
    })),
  }));

  const discoveryBits = [
    input.discovery?.summary,
    input.discovery?.needs,
    input.discovery?.budget,
    input.discovery?.timeline,
    input.discovery?.notes_text,
    input.discovery?.transcript,
  ]
    .filter(Boolean)
    .join("\n");

  const context = clip(
    [input.rawText, discoveryBits].filter(Boolean).join("\n\n"),
    18000
  );

  const system = `You are WIDE's SOW drafting assistant. WIDE is a brand/growth studio.
Write client-facing copy: sharp, concrete, no filler, no invented deliverables.
Return JSON only matching the schema. Suggestions are drafts for a human to accept.
Never invent a numeric price unless answers.budgetBand or discovery budget contains a number.
If no budget signal, omit price or set it null.
Terms should adapt DEFAULT terms to this discussion (what's in/out, timeline, revisions) without dropping legal basics.
Tone: ${input.answers.tone === "conservative" ? "tight and conservative" : "confident and sharp"}.`;

  const prompt = `Company: ${input.sow.company?.company || input.sow.company?.name || "Client"}
SOW title: ${input.sow.title}

Admin answers:
- Services in/out: ${input.answers.services || "—"}
- Budget band: ${input.answers.budgetBand || "—"}
- Timeline: ${input.answers.timeline || "—"}
- In / out of scope: ${input.answers.inOut || "—"}

Context (discovery / email / notes):
${context || "(none)"}

Current document JSON:
${JSON.stringify({ intro: input.sow.intro_narrative, conservative: input.sow.conservative_body, terms: input.sow.terms_text, sections })}

Default terms template:
${DEFAULT_TERMS_TEXT}

Return JSON:
{
  "intro_narrative": "string",
  "conservative_body": "string",
  "terms_text": "string",
  "sections": [
    { "id": "section-id", "title": "string", "description": "string", "price": null }
  ],
  "items": [
    { "id": "item-id", "title": "string", "description": "string" }
  ]
}
Only include sections/items that exist. Keep line-item titles close to current unless context clearly renames them.`;

  return { system, prompt };
}

export function suggestionsFromModelJson(
  raw: unknown,
  sow: SowDocument
): SowSuggestion[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const out: SowSuggestion[] = [];
  const push = (field: string, proposed: unknown, price?: unknown) => {
    if (typeof proposed !== "string" || !proposed.trim()) return;
    out.push({
      id: field,
      field,
      proposed: proposed.trim(),
      price:
        typeof price === "number" && Number.isFinite(price) ? price : null,
    });
  };
  push("intro_narrative", o.intro_narrative);
  push("conservative_body", o.conservative_body);
  push("terms_text", o.terms_text);
  const sectionIds = new Set(sow.sections.map((s) => s.id));
  const itemIds = new Set(
    sow.sections.flatMap((s) => s.line_items.map((i) => i.id))
  );
  if (Array.isArray(o.sections)) {
    for (const s of o.sections) {
      if (!s || typeof s !== "object") continue;
      const row = s as Record<string, unknown>;
      if (typeof row.id !== "string" || !sectionIds.has(row.id)) continue;
      push(`section:${row.id}:title`, row.title);
      push(`section:${row.id}:description`, row.description, row.price);
    }
  }
  if (Array.isArray(o.items)) {
    for (const i of o.items) {
      if (!i || typeof i !== "object") continue;
      const row = i as Record<string, unknown>;
      if (typeof row.id !== "string" || !itemIds.has(row.id)) continue;
      push(`item:${row.id}:title`, row.title);
      push(`item:${row.id}:description`, row.description);
    }
  }
  return out;
}

export function heuristicSowSuggestions(
  sow: SowDocument,
  rawText: string,
  answers: SowAssistAnswers
): SowSuggestion[] {
  const blob = [rawText, answers.inOut, answers.timeline, answers.budgetBand]
    .filter(Boolean)
    .join(" ")
    .trim();
  const snippet = clip(blob.replace(/\s+/g, " "), 420);
  const company = sow.company?.company || sow.company?.name || "you";
  const out: SowSuggestion[] = [];
  if (snippet) {
    out.push({
      id: "intro_narrative",
      field: "intro_narrative",
      proposed: `This SOW is built from our discussion with ${company}. ${snippet}`,
    });
    const extra = [
      answers.timeline ? `Timeline: ${answers.timeline}.` : "",
      answers.inOut ? `Boundaries: ${answers.inOut}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    out.push({
      id: "terms_text",
      field: "terms_text",
      proposed: extra
        ? `${DEFAULT_TERMS_TEXT}\n\nEngagement notes\n${extra}`
        : DEFAULT_TERMS_TEXT,
    });
    for (const section of sow.sections) {
      const current =
        section.service_description_snapshot || section.intro || "";
      if (!current) continue;
      out.push({
        id: `section:${section.id}:description`,
        field: `section:${section.id}:description`,
        proposed: `${current.trim()}\n\nFor ${company}, this tracks what we aligned in discovery — not a generic catalog dump.`,
      });
    }
  }
  return out;
}

export async function generateSowSuggestions(input: {
  sow: SowDocument;
  rawText: string;
  answers: SowAssistAnswers;
  discovery?: Parameters<typeof buildAssistPromptPack>[0]["discovery"];
}): Promise<{ suggestions: SowSuggestion[]; usedAi: boolean }> {
  const pack = buildAssistPromptPack(input);
  if (hasGatewayCredentials()) {
    try {
      const json = await generateJsonFromGateway({
        system: pack.system,
        prompt: pack.prompt,
        maxOutputTokens: 6000,
      });
      const suggestions = suggestionsFromModelJson(json, input.sow);
      if (suggestions.length > 0) return { suggestions, usedAi: true };
    } catch (e) {
      console.error("proposeSowFromContext AI failed", e);
    }
  }
  return {
    suggestions: heuristicSowSuggestions(input.sow, input.rawText, input.answers),
    usedAi: false,
  };
}

export async function rewriteFieldWithContext(input: {
  field: string;
  current: string;
  mode: "rewrite" | "shorter" | "template";
  rawText: string;
  answers: SowAssistAnswers;
  template?: string | null;
}): Promise<string | null> {
  if (input.mode === "template") return input.template?.trim() || input.current;
  if (!hasGatewayCredentials()) {
    if (input.mode === "shorter") {
      return clip(input.current, Math.max(80, Math.floor(input.current.length * 0.6)));
    }
    const extra = clip(input.rawText, 280);
    return extra ? `${input.current.trim()}\n\n${extra}` : input.current;
  }
  const json = await generateJsonFromGateway({
    system:
      "Rewrite one SOW field. Return JSON {\"text\":\"...\"} only. Keep WIDE voice. Do not invent prices.",
    prompt: `Mode: ${input.mode}
Field: ${input.field}
Current:
${input.current}

Context:
${clip(input.rawText, 8000)}
Answers: ${JSON.stringify(input.answers)}`,
    maxOutputTokens: 1200,
  });
  if (json && typeof json === "object" && typeof (json as { text?: unknown }).text === "string") {
    return ((json as { text: string }).text || "").trim() || null;
  }
  return null;
}
