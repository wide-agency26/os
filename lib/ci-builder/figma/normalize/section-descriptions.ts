import type { CISection } from "@/lib/ci-builder/types";
import {
  generateJsonFromGateway,
  hasGatewayCredentials,
} from "@/lib/ai/gateway-json";
import {
  defaultClientDescription,
  isImportBoilerplate,
} from "@/lib/ci-builder/section-copy";
import { getSubModule } from "@/lib/ci-builder/modules-catalog";

function labelsFor(sec: Partial<CISection>): string[] {
  const data = (sec.data || {}) as Record<string, any>;
  const out: string[] = [];
  if (typeof data.label === "string" && data.label.trim()) out.push(data.label);
  if (Array.isArray(data.variants)) {
    for (const v of data.variants) {
      if (v?.label) out.push(String(v.label));
    }
  }
  if (Array.isArray(data.swatches)) {
    const names = data.swatches
      .map((s: { name?: string }) => s?.name)
      .filter(Boolean)
      .slice(0, 8);
    out.push(...names.map(String));
  }
  return out.slice(0, 12);
}

function applyDefaults(
  sections: Partial<CISection>[],
  guidelineId?: string | null
): Partial<CISection>[] {
  return sections.map((sec) => {
    if (!isImportBoilerplate(sec.description)) return sec;
    return {
      ...sec,
      description: defaultClientDescription(sec.section_type, guidelineId),
    };
  });
}

/**
 * Catalog default on every new/empty section. When AI Gateway is up,
 * rewrite those defaults from the section type plus detected labels.
 */
export async function fillImportedDescriptions(
  sections: Partial<CISection>[],
  opts?: { guidelineId?: string | null; brandName?: string }
): Promise<Partial<CISection>[]> {
  const withDefaults = applyDefaults(sections, opts?.guidelineId);
  if (!hasGatewayCredentials()) return withDefaults;

  const toEnrich = withDefaults
    .filter((s) => s.section_type)
    .filter((s) => {
      const catalog = defaultClientDescription(s.section_type, opts?.guidelineId);
      return (s.description || "").trim() === catalog;
    })
    .slice(0, 36);

  if (!toEnrich.length) return withDefaults;

  try {
    const payload = toEnrich.map((s) => ({
      id: s.id || s.section_type,
      sectionType: s.section_type,
      headline: s.headline || getSubModule(s.section_type)?.defaultHeadline || "",
      labels: labelsFor(s),
    }));
    const result = await generateJsonFromGateway({
      system: `You write short brand-guideline captions for clients (not designers' implementation notes).
Return JSON: { "items": [{ "id": string, "description": string }] }
Each description: 1–2 sentences, concrete, no "Imported from Figma", no Tailwind/CSS jargon, no marketing fluff.
Voice: editorial, restrained, like a studio brand book. Brand: ${opts?.brandName || "this brand"}.`,
      prompt: JSON.stringify(payload),
      maxOutputTokens: 2500,
    });
    const rows =
      result &&
      typeof result === "object" &&
      Array.isArray((result as { items?: unknown }).items)
        ? ((result as { items: { id?: string; description?: string }[] }).items ||
          [])
        : [];
    const byId = new Map<string, string>();
    for (const row of rows) {
      const text = String(row?.description || "").trim();
      if (!row?.id || !text || isImportBoilerplate(text)) continue;
      byId.set(String(row.id), text);
    }
    if (!byId.size) return withDefaults;
    return withDefaults.map((sec) => {
      const hit = byId.get(sec.id || "") || byId.get(sec.section_type || "");
      return hit ? { ...sec, description: hit } : sec;
    });
  } catch {
    return withDefaults;
  }
}
