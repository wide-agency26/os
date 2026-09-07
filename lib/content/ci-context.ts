/** Read-only pull of CI Builder brand text for a project. Never writes. */

type Sb = any;

function flattenUnknown(value: unknown, depth = 0): string {
  if (value == null || depth > 6) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => flattenUnknown(v, depth + 1)).filter(Boolean).join("\n");
  }
  if (typeof value === "object") {
    const skip = new Set(["id", "created_at", "updated_at", "guideline_id"]);
    return Object.entries(value as Record<string, unknown>)
      .filter(([k, v]) => !skip.has(k) && v != null && v !== "")
      .map(([k, v]) => {
        const inner = flattenUnknown(v, depth + 1);
        if (!inner) return "";
        if (typeof v === "string") return `${k}: ${inner}`;
        return inner;
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export async function loadCiBrandText(
  supabase: Sb,
  projectId: string
): Promise<{
  label: string;
  slug: string | null;
  status: string | null;
  text: string;
} | null> {
  const { data: guideline } = await supabase
    .from("ci_guidelines")
    .select("id, slug, status, theme")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!guideline) return null;

  const { data: sections } = await supabase
    .from("ci_sections")
    .select("section_type, eyebrow_label, headline, description, data, is_visible")
    .eq("guideline_id", guideline.id)
    .order("position");

  const chunks: string[] = [];
  chunks.push(`Guideline status: ${guideline.status || "draft"}`);
  const theme = flattenUnknown(guideline.theme);
  if (theme) chunks.push(`Theme:\n${theme}`);

  for (const s of sections || []) {
    if (s.is_visible === false) continue;
    const head = [s.eyebrow_label, s.headline].filter(Boolean).join(" — ");
    const body = [s.description, flattenUnknown(s.data)].filter(Boolean).join("\n");
    const block = [head || s.section_type, body].filter(Boolean).join("\n");
    if (block.trim()) chunks.push(`## ${s.section_type}\n${block}`);
  }

  if (!chunks.length) {
    const { data: version } = await supabase
      .from("ci_guideline_versions")
      .select("content")
      .eq("guideline_id", guideline.id)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const snap = flattenUnknown(version?.content);
    if (snap) chunks.push(snap);
  }

  const text = chunks.join("\n\n").trim();
  return {
    label: "CI Builder brand guidelines",
    slug: guideline.slug || null,
    status: guideline.status || null,
    text,
  };
}

export function seedPersonaFromCi(ciText: string | null): {
  linkedin: string;
  instagram: string;
} {
  const voice = (ciText || "").slice(0, 1800);
  if (!voice) {
    return {
      linkedin:
        "Formal third-person brand voice. Short professional paragraphs. One clear CTA with [LINK].",
      instagram:
        "First-person branded companion. Shorter, warmer, emoji-forward. Same idea as LinkedIn, different register.",
    };
  }
  return {
    linkedin: `Formal third-person brand voice grounded in these guidelines:\n${voice.slice(0, 900)}`,
    instagram: `First-person branded companion grounded in these guidelines:\n${voice.slice(0, 900)}`,
  };
}
