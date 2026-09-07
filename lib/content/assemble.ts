import { loadCiBrandText } from "./ci-context";
import { emptySocialAssets, parseSocialAssets } from "./social-assets";
import {
  CONTEXT_HARD_LIMIT,
  CONTEXT_SOFT_LIMIT,
  type AssembledContext,
  type ContentSettings,
  type ContextDoc,
} from "./types";

type Sb = any;

export function defaultSettings(projectId: string): ContentSettings {
  return {
    project_id: projectId,
    pillars: ["BRAND", "PRODUCT", "PEOPLE"],
    languages: ["de", "en"],
    client_languages: ["de", "en"],
    platform_personas: {
      linkedin:
        "Formal third-person brand voice. Short professional paragraphs. One clear CTA with [LINK].",
      instagram:
        "First-person branded companion. Shorter, warmer, emoji-forward. Same idea, different register.",
    },
    cadence: { linkedin: 3, instagram: 3 },
    next_post_number: 1,
    social_assets: emptySocialAssets(),
  };
}

export function mapSettings(row: any, projectId: string): ContentSettings {
  if (!row) return defaultSettings(projectId);
  return {
    project_id: projectId,
    pillars: Array.isArray(row.pillars) && row.pillars.length ? row.pillars : ["BRAND", "PRODUCT", "PEOPLE"],
    languages: Array.isArray(row.languages) && row.languages.length ? row.languages : ["de", "en"],
    client_languages:
      Array.isArray(row.client_languages) && row.client_languages.length
        ? row.client_languages
        : row.languages || ["de", "en"],
    platform_personas: row.platform_personas || defaultSettings(projectId).platform_personas,
    cadence: row.cadence || { linkedin: 3, instagram: 3 },
    next_post_number: Number(row.next_post_number || 1),
    social_assets: parseSocialAssets(row.social_assets),
  };
}

export async function assembleProjectContext(
  supabase: Sb,
  projectId: string
): Promise<AssembledContext> {
  const [{ data: settingsRow }, { data: docs }, ci] = await Promise.all([
    supabase.from("content_settings").select("*").eq("project_id", projectId).maybeSingle(),
    supabase
      .from("content_context_docs")
      .select("*")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: false }),
    loadCiBrandText(supabase, projectId),
  ]);

  const settings = mapSettings(settingsRow, projectId);
  const mappedDocs = (docs || []) as ContextDoc[];
  const parts: string[] = [];

  parts.push(
    `PROJECT SETTINGS\nPillars: ${settings.pillars.join(", ")}\nLanguages: ${settings.languages.join(", ")}\nCadence (posts/week): ${JSON.stringify(settings.cadence)}\n\nLinkedIn persona:\n${settings.platform_personas.linkedin || ""}\n\nInstagram persona:\n${settings.platform_personas.instagram || ""}`
  );

  if (ci?.text) {
    parts.push(`CI BUILDER BRAND GUIDELINES (read-only, synced)\n${ci.text}`);
  } else {
    parts.push("CI BUILDER: no guideline linked to this project yet.");
  }

  for (const d of mappedDocs.filter((x) => x.active && x.extracted_text)) {
    parts.push(`UPLOADED CONTEXT — ${d.filename}\n${d.extracted_text}`);
  }

  let text = parts.join("\n\n----\n\n");
  let truncated = false;
  if (text.length > CONTEXT_HARD_LIMIT) {
    text = text.slice(0, CONTEXT_HARD_LIMIT) + "\n\n[Context truncated to fit the model window.]";
    truncated = true;
  }

  return {
    ci: ci
      ? { label: ci.label, slug: ci.slug, status: ci.status, text: ci.text, chars: ci.text.length }
      : null,
    docs: mappedDocs.map((d) => ({
      id: d.id,
      filename: d.filename,
      chars: (d.extracted_text || "").length,
      active: d.active,
    })),
    settings,
    text,
    chars: text.length,
    truncated: truncated || text.length > CONTEXT_SOFT_LIMIT,
  };
}
