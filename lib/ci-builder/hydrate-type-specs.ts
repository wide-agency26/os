import type { CISection, CITheme } from "@/lib/ci-builder/types";

const TYPE_SPEC_ROLES = [
  "headline_primary",
  "headline_secondary",
  "headline_tertiary",
  "body",
  "caption",
] as const;

type TypeSpecRole = (typeof TYPE_SPEC_ROLES)[number];

const DEFAULT_SAMPLE = /the quick brown fox/i;

const SCALE_MATCH: Record<TypeSpecRole, RegExp> = {
  headline_primary:
    /heading.*primary|primary.*headline|display|\bh1\b|(^|\/|\s)primary$/i,
  headline_secondary: /heading.*secondary|secondary.*headline|\bh2\b/i,
  headline_tertiary: /heading.*tertiary|tertiary.*headline|\bh3\b|\bh4\b/i,
  body: /\bbody\b|paragraph|copy/i,
  caption: /\bcaption\b|meta|small/i,
};

function themeFontForRole(role: TypeSpecRole, theme?: CITheme | null): string {
  const t = theme || {};
  if (role === "headline_primary") {
    return String(t.primaryFont || t.fontFamily || "").trim();
  }
  if (role === "headline_secondary") {
    return String(t.secondaryFont || t.primaryFont || t.fontFamily || "").trim();
  }
  if (role === "headline_tertiary") {
    return String(
      t.tertiaryFont || t.secondaryFont || t.primaryFont || t.fontFamily || ""
    ).trim();
  }
  if (role === "body") {
    return String(t.secondaryFont || t.primaryFont || t.fontFamily || "").trim();
  }
  return String(
    t.tertiaryFont || t.secondaryFont || t.primaryFont || t.fontFamily || ""
  ).trim();
}

function parsePx(value: unknown): number | null {
  const n = parseFloat(String(value || "").replace(/px/i, ""));
  return Number.isFinite(n) ? n : null;
}

function formatPx(n: number): string {
  return `${Math.round(n)}px`;
}

function stepWeight(weight: string): string {
  const n = parseInt(weight, 10);
  if (Number.isFinite(n)) return String(Math.min(900, n + 100));
  if (/bold/i.test(weight)) return "900";
  return "800";
}

function dataOf(
  sections: Partial<CISection>[],
  type: string
): Record<string, any> {
  return (
    (sections.find((s) => s.section_type === type)?.data as Record<
      string,
      any
    >) || {}
  );
}

function scaleHit(
  scale: { token?: string; fontFamily?: string; fontWeight?: string; px?: number; value?: string; lineHeight?: string; letterSpacing?: string; fontStyle?: string }[],
  role: TypeSpecRole
) {
  return scale.find((row) => SCALE_MATCH[role].test(String(row.token || "")));
}

/**
 * Empty Headline Primary (and sibling type specs) stay hidden because
 * sectionHasClientValue requires fontFamily. Theme already has the face
 * used on the cover — copy it into the specimen so Brand book / Elements show it.
 */
export function hydrateTypeSpecsFromTheme(
  sections: Partial<CISection>[],
  theme?: CITheme | null
): { sections: Partial<CISection>[]; changed: boolean } {
  const scale = Array.isArray(
    (sections.find((s) => s.section_type === "typography_scale")?.data as
      | { scale?: unknown[] }
      | undefined)?.scale
  )
    ? ((
        sections.find((s) => s.section_type === "typography_scale")?.data as {
          scale: Record<string, any>[];
        }
      ).scale || [])
    : [];

  const secondary = dataOf(sections, "headline_secondary");
  const tertiary = dataOf(sections, "headline_tertiary");
  let changed = false;

  const next = sections.map((sec) => {
    const role = sec.section_type as TypeSpecRole;
    if (!TYPE_SPEC_ROLES.includes(role)) return sec;
    const data = { ...((sec.data || {}) as Record<string, any>) };
    if (String(data.fontFamily || "").trim()) return sec;

    const fromScale = scaleHit(scale, role);
    const family =
      String(fromScale?.fontFamily || "").trim() || themeFontForRole(role, theme);
    if (!family) return sec;

    data.fontFamily = family;
    if (!String(data.fontWeight || "").trim()) {
      data.fontWeight =
        String(fromScale?.fontWeight || "").trim() ||
        (role === "headline_primary"
          ? stepWeight(String(secondary.fontWeight || "800"))
          : role === "headline_secondary"
            ? String(tertiary.fontWeight || "600")
            : role === "body"
              ? "400"
              : role === "caption"
                ? "400"
                : "600");
    }
    if (!String(data.fontStyle || "").trim()) {
      data.fontStyle =
        String(fromScale?.fontStyle || "").trim() ||
        (role === "headline_primary"
          ? String(secondary.fontStyle || "")
          : "");
    }
    if (!String(data.fontSize || "").trim()) {
      const scaled = fromScale?.value || (fromScale?.px != null ? formatPx(fromScale.px) : "");
      if (scaled) {
        data.fontSize = scaled;
      } else if (role === "headline_primary") {
        const secPx = parsePx(secondary.fontSize);
        data.fontSize = secPx != null ? formatPx(secPx * 1.25) : "96px";
      } else if (role === "headline_secondary") {
        data.fontSize = "48px";
      } else if (role === "headline_tertiary") {
        data.fontSize = "32px";
      } else if (role === "body") {
        data.fontSize = "16px";
      } else {
        data.fontSize = "12px";
      }
    }
    if (!String(data.lineHeight || "").trim()) {
      if (fromScale?.lineHeight) {
        data.lineHeight = fromScale.lineHeight;
      } else if (role === "headline_primary") {
        const lead = parsePx(secondary.lineHeight);
        const size = parsePx(data.fontSize);
        data.lineHeight =
          lead != null
            ? formatPx(lead * 1.25)
            : size != null
              ? formatPx(size * 1.05)
              : "";
      }
    }
    if (!String(data.letterSpacing || "").trim()) {
      if (fromScale?.letterSpacing) {
        data.letterSpacing = fromScale.letterSpacing;
      } else if (role === "headline_primary" && secondary.letterSpacing) {
        data.letterSpacing = secondary.letterSpacing;
      }
    }
    if (
      role === "headline_primary" &&
      DEFAULT_SAMPLE.test(String(data.sampleText || "")) &&
      theme?.coverTitle?.trim()
    ) {
      data.sampleText = theme.coverTitle.trim();
    }

    changed = true;
    return { ...sec, data };
  });

  return { sections: next, changed };
}
