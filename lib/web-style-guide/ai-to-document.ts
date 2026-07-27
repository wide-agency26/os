import "server-only";

import type {
  WebStyleGuideDocument,
  WebStyleGuideNavGroup,
  WebStyleGuideSection,
} from "./document";
import { sanitizeStyleGuideHtmlFragment } from "./process-html";

export const WSG_AI_SYSTEM = `You are a senior design-systems engineer. From the user's source material (a brand or style document, deck, notes, or rough description), produce ONE JSON object describing a web style guide as a set of self-contained, inline-styled HTML blocks.

Output JSON shape:
{
  "title": "string (brand or product name)",
  "versionLabel": "1.0",
  "sections": [
    {
      "navLabel": "short label",
      "navGroup": "Foundations" | "Components" | "Other",
      "title": "string",
      "subtitle": "one short line",
      "bodyHtml": "self-contained HTML using ONLY inline style attributes"
    }
  ]
}

Rules for bodyHtml:
- Use ONLY inline style="" attributes. No <style>, <link>, <script>, classes, or external CSS.
- Assume a WHITE background. Use dark text (#111827) and the brand colours from the source where given; otherwise sensible neutrals (#4F46E5 primary, #6B7280 muted, #E5E7EB borders).
- Render REAL visual examples — actual coloured swatches with hex labels, real <button> elements, real type specimens — not descriptions of them.
- Keep each block focused. Typical blocks: Colours, Typography, Spacing, Buttons, Form elements, Cards, Alerts & badges, Logo usage, Voice & tone.
- navGroup: put colours/typography/spacing/grid in "Foundations"; buttons/forms/cards/alerts in "Components"; everything else in "Other".
- Produce 5–9 sections. Keep HTML clean, compact, and visually polished.
- Return ONLY valid JSON, no markdown fences.`;

const NAV_GROUPS: WebStyleGuideNavGroup[] = ["Foundations", "Components", "Other"];

function coerceGroup(v: unknown): WebStyleGuideNavGroup {
  return typeof v === "string" && (NAV_GROUPS as string[]).includes(v)
    ? (v as WebStyleGuideNavGroup)
    : "Other";
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

const MAX_SECTION_HTML = 280_000;

export function buildStyleGuideDocumentFromAi(
  parsed: unknown,
  titleFallback: string
): WebStyleGuideDocument {
  const o = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const rawSections = Array.isArray(o.sections) ? o.sections : [];

  const sections: WebStyleGuideSection[] = [];
  rawSections.forEach((raw, i) => {
    const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const id = `ai-${crypto.randomUUID().slice(0, 8)}`;
    const safeBody = sanitizeStyleGuideHtmlFragment(str(s.bodyHtml)).slice(0, MAX_SECTION_HTML);
    if (!safeBody.replace(/\s/g, "").length) return;

    const title = str(s.title, `Section ${i + 1}`);
    sections.push({
      id,
      navLabel: str(s.navLabel, title),
      navGroup: coerceGroup(s.navGroup),
      title,
      subtitle: str(s.subtitle),
      bodyHtml: safeBody,
      sortOrder: sections.length,
      visible: true,
    });
  });

  return {
    version: 1,
    meta: {
      title: str(o.title, titleFallback) || titleFallback,
      versionLabel: str(o.versionLabel, "1.0") || "1.0",
      bodyClass: "",
    },
    stylesheetHrefs: [],
    inlineHeadStyles: "",
    sections,
  };
}
