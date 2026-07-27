import type { BrandGuidelineDocument } from "./types";

const T = {
  cyan: "#00ECFF",
  magenta: "#FF00CE",
  amber: "#FFC100",
  orange: "#FF4200",
  lime: "#CDFF00",
};

export const DEFAULT_NAV: BrandGuidelineDocument["nav"] = [
  { id: "hero", label: "Overview", dotColor: T.cyan, group: "Identity" },
  { id: "logos", label: "Logo System", dotColor: "#F2F7F7", group: "Identity" },
  { id: "dna", label: "Visual DNA", dotColor: T.magenta, group: "Identity" },
  { id: "colors", label: "Color", dotColor: T.amber, group: "Foundation" },
  { id: "type", label: "Typography", dotColor: T.lime, group: "Foundation" },
  { id: "bgs", label: "Backgrounds", dotColor: T.orange, group: "Foundation" },
  { id: "voice", label: "Voice & Tone", dotColor: "#389AFF", group: "Expression" },
  { id: "usage", label: "Usage Examples", dotColor: T.magenta, group: "Expression" },
];

/** Blank slate for new clients — no placeholder colors, type, or sections. */
export function createEmptyGuidelineDocument(brandName: string): BrandGuidelineDocument {
  const safe = brandName.trim() || "Brand";
  return {
    version: 1,
    accentColor: "#6b7280",
    brandName: safe,
    sidebarSubtitle: "Brand Guidelines",
    showVersionTag: false,
    versionLabel: "",
    nav: [],
    hero: {
      badge: "",
      titleLines: [],
      accentLineIndex: null,
      description: "",
      metaTags: [],
    },
    logos: {
      eyebrow: "",
      title: "",
      description: "",
      marksLabel: "",
      marks: [],
      wordmarksLabel: "",
      wordmarks: [],
    },
    visualDna: {
      eyebrow: "",
      title: "",
      description: "",
      elements: [],
    },
    colors: {
      eyebrow: "",
      title: "",
      description: "",
      band: [],
      neons: [],
      blues: [],
      neutrals: [],
    },
    typography: {
      eyebrow: "",
      title: "",
      description: "",
      fontFamily: "",
      specimens: [],
    },
    backgrounds: {
      eyebrow: "",
      title: "",
      description: "",
      slots: [],
    },
    voice: {
      eyebrow: "",
      title: "",
      description: "",
      pillars: [],
      dos: [],
      donts: [],
    },
    usage: {
      eyebrow: "",
      title: "",
      description: "",
      examples: [],
    },
  };
}

export function isGuidelineDocumentPopulated(doc: BrandGuidelineDocument): boolean {
  if (doc.nav.length > 0) return true;
  if (doc.hero.titleLines.some((l) => l.trim())) return true;
  if (doc.logos.marks.length || doc.logos.wordmarks.length) return true;
  if (doc.colors.neons.length || doc.colors.neutrals.length || doc.colors.band.length) return true;
  if (doc.typography.specimens.length) return true;
  return false;
}

export function createDefaultGuidelineDocument(brandName: string): BrandGuidelineDocument {
  const safe = brandName.trim() || "Your Brand";
  return {
    version: 1,
    accentColor: T.cyan,
    brandName: safe,
    sidebarSubtitle: "Brand Guidelines",
    showVersionTag: true,
    versionLabel: "Version 1.0",
    nav: DEFAULT_NAV,
    hero: {
      badge: "Brand Guidelines",
      titleLines: [safe, "Identity", "System"],
      accentLineIndex: 2,
      description: `This document defines the visual and verbal identity of ${safe} — use it to keep every touchpoint consistent and professional.`,
      metaTags: ["Dark palette", "Strong type", "Focused accents", "Clear voice"],
    },
    logos: {
      eyebrow: "01 — Logo System",
      title: "The Mark",
      description:
        "Primary and alternate logo treatments. Prefer the clearest lockup on the default background; reserve alternates for specific contexts.",
      marksLabel: "Primary marks",
      marks: [
        {
          bg: "#232323",
          fill: "#F2F7F7",
          label: "Mark — Light on dark",
          desc: "Default dark surface",
          preferred: true,
        },
        {
          bg: "#EFF5F5",
          fill: "#232323",
          label: "Mark — Dark on light",
          desc: "Light surface",
        },
      ],
      wordmarksLabel: "Wordmark combinations",
      wordmarks: [
        {
          bg: "#232323",
          mFill: "#F2F7F7",
          text: "#F2F7F7",
          sub: T.cyan,
          label: "Full lockup — dark",
          desc: "Primary wordmark",
          line1: safe.toUpperCase(),
          line2: "BRAND",
        },
      ],
    },
    visualDna: {
      eyebrow: "02 — Visual DNA",
      title: "Graphic Elements",
      description:
        "Reusable graphic devices define the aesthetic. Use them consistently rather than inventing one-off decorations.",
      elements: [
        {
          name: "Accent glow",
          desc: "Soft radial accent for depth on dark backgrounds.",
          kind: "glow",
        },
        {
          name: "Motion strip",
          desc: "Short headline or CTA strip for energy and rhythm.",
          kind: "marquee",
        },
        {
          name: "Grid texture",
          desc: "Structural overlay at low opacity for texture.",
          kind: "grid",
        },
      ],
    },
    colors: {
      eyebrow: "03 — Color",
      title: "The Palette",
      description:
        "A restrained base with intentional accent colors. Keep backgrounds calm so accents carry meaning.",
      band: [
        { hex: T.cyan, name: "Accent A" },
        { hex: T.magenta, name: "Accent B" },
        { hex: T.amber, name: "Warm" },
        { hex: T.orange, name: "CTA" },
        { hex: T.lime, name: "Highlight" },
      ],
      neons: [
        { bg: T.cyan, name: "Cyan", hex: T.cyan, role: "Primary accent" },
        { bg: T.magenta, name: "Magenta", hex: T.magenta, role: "Highlights" },
        { bg: T.amber, name: "Amber", hex: T.amber, role: "Warm emphasis" },
        { bg: T.orange, name: "Orange", hex: T.orange, role: "CTAs" },
        { bg: T.lime, name: "Lime", hex: T.lime, role: "Success / open" },
      ],
      blues: [
        { bg: "#A3CEFF", name: "Blue 100", hex: "#A3CEFF", role: "Tint" },
        { bg: "#66AEFF", name: "Blue 200", hex: "#66AEFF", role: "Mid" },
        { bg: "#389AFF", name: "Blue 300", hex: "#389AFF", role: "Interactive" },
        { bg: "#3968A7", name: "Blue 400", hex: "#3968A7", role: "Deep" },
        {
          bg: "linear-gradient(180deg,#276AAD,#84B7E4)",
          name: "Gradient",
          hex: "#276AAD → #84B7E4",
          role: "Brand fill",
        },
      ],
      neutrals: [
        { bg: "#1a1a1a", name: "Darkest", hex: "#1a1a1a", role: "Page bg" },
        { bg: "#232323", name: "Dark", hex: "#232323", role: "Surfaces" },
        { bg: "#132333", name: "Navy", hex: "#132333", role: "Alt dark" },
        { bg: "#F2F7F7", name: "Light", hex: "#F2F7F7", role: "Text on dark" },
        { bg: "#FFFFFF", name: "White", hex: "#FFFFFF", role: "Pure white" },
      ],
    },
    typography: {
      eyebrow: "04 — Typography",
      title: "Type hierarchy",
      description:
        "One family, multiple roles. Reserve the heaviest weights for hero moments; keep UI readable and calm.",
      fontFamily: "Inter, system-ui, sans-serif",
      specimens: [
        {
          label: "Display — Black Italic · Uppercase",
          sample: safe,
          variant: "display-xl",
        },
        {
          label: "Heading — Black · Uppercase",
          sample: "Section title",
          variant: "heading",
        },
        {
          label: "Body — Regular",
          sample:
            "Short, confident sentences. Lead with the outcome. Avoid filler and corporate vagueness.",
          variant: "body",
        },
        {
          label: "Label — Bold · Tracked",
          sample: "Label · 2026 · Program",
          variant: "label",
        },
      ],
    },
    backgrounds: {
      eyebrow: "05 — Backgrounds",
      title: "Setting the scene",
      description:
        "Backgrounds stay atmospheric and dark-first. Photography and motifs should support the story, not compete with type.",
      slots: [
        { name: "Hero photography" },
        { name: "Event stage" },
        { name: "Abstract dark" },
      ],
    },
    voice: {
      eyebrow: "06 — Voice & Tone",
      title: "Direct and human",
      description:
        "Sound like people who ship work: clear verbs, short lines, and honest enthusiasm.",
      pillars: [
        { label: "Energetic", phrase: "JOIN THE PROGRAM" },
        { label: "Direct", phrase: "HERE IS WHAT CHANGES" },
        { label: "Grounded", phrase: "REAL PROJECTS. REAL RESULTS." },
        { label: "Welcoming", phrase: "YOU BELONG HERE" },
      ],
      dos: [
        "Short imperative phrases in key moments",
        "Concrete nouns and verbs",
        "One idea per sentence in headlines",
      ],
      donts: [
        "Long paragraphs in hero sections",
        "Jargon without explanation",
        "More than two loud accents in one composition",
      ],
    },
    usage: {
      eyebrow: "07 — Usage Examples",
      title: "In the wild",
      description: "How the system composes across social, events, and web.",
      examples: [
        { title: "Social post · 1×1", caption: "Centered lockup + single CTA", layout: "social" },
        { title: "Speaker card · 1×1", caption: "Portrait frame + role chip", layout: "card" },
        { title: "Web hero", caption: "Headline, supporting copy, dual CTAs", layout: "hero" },
      ],
    },
  };
}

export function storedGuidelineHasContent(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const p = raw as Record<string, unknown>;
  if (Array.isArray(p.nav) && p.nav.length > 0) return true;
  const hero = p.hero as Record<string, unknown> | undefined;
  if (Array.isArray(hero?.titleLines) && hero.titleLines.some((l) => typeof l === "string" && l.trim())) {
    return true;
  }
  const logos = p.logos as Record<string, unknown> | undefined;
  if (Array.isArray(logos?.marks) && logos.marks.length > 0) return true;
  return false;
}

export function mergeWithDefaults(
  partial: unknown,
  brandName: string
): BrandGuidelineDocument {
  if (!storedGuidelineHasContent(partial)) {
    return createEmptyGuidelineDocument(brandName);
  }
  const base = createDefaultGuidelineDocument(brandName);
  const p = partial as Record<string, unknown>;
  return {
    ...base,
    ...p,
    hero: p.hero && typeof p.hero === "object" ? { ...base.hero, ...(p.hero as object) } : base.hero,
    logos: p.logos && typeof p.logos === "object" ? { ...base.logos, ...(p.logos as object) } : base.logos,
    visualDna:
      p.visualDna && typeof p.visualDna === "object"
        ? { ...base.visualDna, ...(p.visualDna as object) }
        : base.visualDna,
    colors:
      p.colors && typeof p.colors === "object" ? { ...base.colors, ...(p.colors as object) } : base.colors,
    typography:
      p.typography && typeof p.typography === "object"
        ? { ...base.typography, ...(p.typography as object) }
        : base.typography,
    backgrounds:
      p.backgrounds && typeof p.backgrounds === "object"
        ? { ...base.backgrounds, ...(p.backgrounds as object) }
        : base.backgrounds,
    voice: p.voice && typeof p.voice === "object" ? { ...base.voice, ...(p.voice as object) } : base.voice,
    usage: p.usage && typeof p.usage === "object" ? { ...base.usage, ...(p.usage as object) } : base.usage,
    nav: Array.isArray(p.nav) && p.nav.length ? (p.nav as BrandGuidelineDocument["nav"]) : base.nav,
  } as BrandGuidelineDocument;
}
