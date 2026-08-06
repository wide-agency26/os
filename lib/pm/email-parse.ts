import {
  generateJsonFromGateway,
  hasGatewayCredentials,
} from "@/lib/ai/gateway-json";

export type ProposedTask = {
  title: string;
  description: string;
  suggestedMatchTaskId: string | null;
};

export type ParseEmailResult = {
  proposals: ProposedTask[];
  highVolume: boolean;
  parseMode: "llm" | "heuristic";
};

type OpenTask = { id: string; title: string };

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findBestMatch(title: string, openTasks: OpenTask[]): string | null {
  const n = normalizeTitle(title);
  if (!n) return null;
  let best: { id: string; score: number } | null = null;
  for (const t of openTasks) {
    const ot = normalizeTitle(t.title);
    if (!ot) continue;
    if (ot === n) return t.id;
    const overlap =
      n.includes(ot) || ot.includes(n)
        ? Math.min(n.length, ot.length) / Math.max(n.length, ot.length)
        : 0;
    if (overlap >= 0.7 && (!best || overlap > best.score)) {
      best = { id: t.id, score: overlap };
    }
  }
  return best?.id ?? null;
}

/** Fallback when AI gateway is unavailable — split on bullets / numbered lines. */
function heuristicExtract(body: string): { title: string; description: string }[] {
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s>*\-\d.)]+/, "").trim())
    .filter((l) => l.length >= 8 && l.length <= 160);

  const unique: string[] = [];
  for (const l of lines) {
    if (!unique.some((u) => normalizeTitle(u) === normalizeTitle(l))) {
      unique.push(l);
    }
    if (unique.length >= 12) break;
  }

  return unique.map((title) => ({
    title: title.slice(0, 120),
    description: "Extracted from inbound note (heuristic — review carefully).",
  }));
}

export async function parseInboundToProposals(options: {
  subject: string;
  body: string;
  openTasks: OpenTask[];
}): Promise<ParseEmailResult> {
  const { subject, body, openTasks } = options;
  const openList = openTasks
    .map((t) => `- id=${t.id} | ${t.title}`)
    .join("\n");

  let raw: { title: string; description: string }[] = [];
  let parseMode: "llm" | "heuristic" = "heuristic";

  if (hasGatewayCredentials()) {
    try {
      const json = await generateJsonFromGateway({
        system: `You extract actionable work items from agency email / meeting notes.
Return ONLY JSON: { "tasks": [ { "title": string, "description": string } ] }
Rules:
- Prefer concrete next actions over status chatter.
- Max 8 tasks. If the source is a status dump with no clear tasks, return fewer or empty.
- Titles ≤ 80 chars. Descriptions 1–2 sentences.
- Do not invent work not implied by the text.`,
        prompt: `Subject: ${subject || "(none)"}

Open tasks already on the project (for context — do not duplicate unless clearly new):
${openList || "(none)"}

Source text:
---
${body.slice(0, 12000)}
---`,
        maxOutputTokens: 2000,
      });

      const tasks = (json as any)?.tasks;
      if (Array.isArray(tasks)) {
        raw = tasks
          .filter((t: any) => t && typeof t.title === "string" && t.title.trim())
          .map((t: any) => ({
            title: String(t.title).trim().slice(0, 120),
            description: String(t.description || "").trim().slice(0, 2000),
          }));
        parseMode = "llm";
      }
    } catch {
      raw = heuristicExtract(`${subject}\n${body}`);
    }
  } else {
    raw = heuristicExtract(`${subject}\n${body}`);
  }

  const proposals: ProposedTask[] = raw.map((t) => ({
    title: t.title,
    description: t.description,
    suggestedMatchTaskId: findBestMatch(t.title, openTasks),
  }));

  return {
    proposals,
    highVolume: proposals.length > 5,
    parseMode,
  };
}
