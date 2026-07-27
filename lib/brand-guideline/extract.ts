import { PDFParse } from "pdf-parse";
import { mergeWithDefaults } from "./defaults";
import type { BrandGuidelineDocument } from "./types";
import { generateJsonFromGateway, hasGatewayCredentials } from "@/lib/ai/gateway-json";

const MAX_CHARS = 14_000;

const SYSTEM = `You are a brand strategist. From the user's source material (brand guidelines excerpt, deck, or notes), produce ONE JSON object that matches this TypeScript shape. Use concise, professional copy. Invent reasonable placeholders only where the source is silent.

Shape (all keys required at top level unless empty arrays):
{
  "version": 1,
  "accentColor": "#hex",
  "brandName": "string",
  "sidebarSubtitle": "Brand Guidelines",
  "showVersionTag": true,
  "versionLabel": "Version 1.0",
  "nav": [{ "id": "hero"|"logos"|"dna"|"colors"|"type"|"bgs"|"voice"|"usage", "label": "string", "group": "Identity"|"Foundation"|"Expression", "dotColor": "#hex" }],
  "hero": { "badge": "string", "titleLines": ["line1","line2",...], "accentLineIndex": number|null, "description": "string", "metaTags": ["..."] },
  "logos": { "eyebrow": "01 — Logo System", "title": "string", "description": "string", "marksLabel": "string", "marks": [{ "bg": "#hex", "fill": "#hex"|"gradient", "label": "string", "desc": "string", "preferred": boolean optional }], "wordmarksLabel": "string", "wordmarks": [{ "bg": "#hex", "mFill": "#hex"|"gradient", "text": "#hex", "sub": "#hex", "label": "string", "desc": "string", "line1": "UPPERCASE", "line2": "UPPERCASE" }] },
  "visualDna": { "eyebrow": "02 — Visual DNA", "title": "string", "description": "string", "elements": [{ "name": "string", "desc": "string", "kind": "glow"|"gradient"|"marquee"|"grid"|"plain" }] },
  "colors": { "eyebrow": "03 — Color", "title": "string", "description": "string", "band": [{ "hex": "#hex", "name": "string" }], "neons": [{ "bg": "#hex", "name": "string", "hex": "#hex", "role": "string" }], "blues": [...], "neutrals": [...] },
  "typography": { "eyebrow": "04 — Typography", "title": "string", "description": "string", "fontFamily": "string", "specimens": [{ "label": "string", "sample": "string", "variant": "display-xl"|"display"|"heading"|"subheading"|"label"|"body"|"caption"|"pills" }] },
  "backgrounds": { "eyebrow": "05 — Backgrounds", "title": "string", "description": "string", "slots": [{ "name": "string" }] },
  "voice": { "eyebrow": "06 — Voice & Tone", "title": "string", "description": "string", "pillars": [{ "label": "string", "phrase": "string" }], "dos": ["string"], "donts": ["string"] },
  "usage": { "eyebrow": "07 — Usage Examples", "title": "string", "description": "string", "examples": [{ "title": "string", "caption": "string", "layout": "social"|"card"|"hero" }] }
}

Rules:
- Keep hex colors valid (#RRGGBB) except logo fills may be "gradient".
- titleLines: 2–4 short lines for the hero; accentLineIndex is 0-based or null.
- nav must include all eight ids in a sensible order.
- Return ONLY valid JSON, no markdown fences.`;

async function pdfBufferToText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } finally {
    await parser.destroy();
  }
}

export async function fileToExtractedText(file: File): Promise<{ text: string; kind: string }> {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    const buf = Buffer.from(await file.arrayBuffer());
    const text = await pdfBufferToText(buf);
    return { text, kind: "pdf" };
  }

  if (
    type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv")
  ) {
    return { text: (await file.text()).trim(), kind: "text" };
  }

  if (name.endsWith(".fig") || type.includes("figma")) {
    return {
      text: "",
      kind: "figma",
    };
  }

  return { text: "", kind: "unknown" };
}

async function callGatewayJson(userContent: string): Promise<unknown> {
  return generateJsonFromGateway({
    system: SYSTEM,
    prompt: userContent,
    maxOutputTokens: 6000,
  });
}

export async function buildGuidelineFromUpload(options: {
  file: File | null;
  pastedText: string;
  brandName: string;
  companyName?: string | null;
}): Promise<{
  document: BrandGuidelineDocument;
  usedAi: boolean;
  message: string;
}> {
  const brand = options.brandName.trim() || options.companyName?.trim() || "Client brand";
  let extracted = "";
  let meta = "";

  if (options.file) {
    const { text, kind } = await fileToExtractedText(options.file);
    extracted = text;
    meta = `File: ${options.file.name} (${kind}).\n`;
    if (kind === "figma") {
      meta +=
        "Binary Figma file — describe structure from filename and any pasted notes only.\n";
    }
    if (kind === "unknown" && !text) {
      meta +=
        "Unsupported binary — use filename and pasted notes only.\n";
    }
  }

  const notes = options.pastedText.trim();
  const bundle = `${meta}
Brand name: ${brand}

--- Source text ---
${(extracted || "(no text extracted)").slice(0, MAX_CHARS)}
--- End ---

${notes ? `--- Additional notes ---\n${notes.slice(0, 4000)}` : ""}`;

  if (!hasGatewayCredentials()) {
    return {
      document: mergeWithDefaults(null, brand),
      usedAi: false,
      message:
        "AI extraction is off — set AI_GATEWAY_API_KEY (automatic on Vercel). Loaded the editable template — refine blocks below.",
    };
  }

  try {
    const parsed = await callGatewayJson(bundle);
    if (parsed && typeof parsed === "object") {
      return {
        document: mergeWithDefaults(parsed, brand),
        usedAi: true,
        message: "Generated with AI from your upload and notes.",
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI extraction failed";
    return {
      document: mergeWithDefaults(null, brand),
      usedAi: false,
      message: `${msg} Loaded the editable template instead.`,
    };
  }

  return {
    document: mergeWithDefaults(null, brand),
    usedAi: false,
    message: "AI returned no usable data. Loaded the editable template — refine blocks below.",
  };
}
