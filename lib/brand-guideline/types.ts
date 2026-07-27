export interface GuidelineNavItem {
  id: string;
  label: string;
  group: string;
  dotColor: string;
}

export interface GuidelineColorToken {
  bg: string;
  name: string;
  hex: string;
  role: string;
}

export interface GuidelineLogoMark {
  bg: string;
  fill: string;
  label: string;
  desc: string;
  preferred?: boolean;
}

export interface GuidelineWordmark {
  bg: string;
  mFill: string;
  text: string;
  sub: string;
  label: string;
  desc: string;
  line1: string;
  line2: string;
}

export interface GuidelineDnaElement {
  name: string;
  desc: string;
  kind: "glow" | "gradient" | "marquee" | "grid" | "plain";
}

export interface GuidelineTypeSpecimen {
  label: string;
  sample: string;
  variant: "display-xl" | "display" | "heading" | "subheading" | "label" | "body" | "caption" | "pills";
}

export interface GuidelineVoicePillar {
  label: string;
  phrase: string;
}

export interface GuidelineUsageExample {
  title: string;
  caption: string;
  layout: "social" | "card" | "hero";
}

/** Serializable document stored in `brand_hubs.guideline_document` */
export interface BrandGuidelineDocument {
  version: number;
  accentColor: string;
  brandName: string;
  sidebarSubtitle: string;
  showVersionTag: boolean;
  versionLabel: string;
  nav: GuidelineNavItem[];
  hero: {
    badge: string;
    titleLines: string[];
    accentLineIndex: number | null;
    description: string;
    metaTags: string[];
  };
  logos: {
    eyebrow: string;
    title: string;
    description: string;
    marksLabel: string;
    marks: GuidelineLogoMark[];
    wordmarksLabel: string;
    wordmarks: GuidelineWordmark[];
  };
  visualDna: {
    eyebrow: string;
    title: string;
    description: string;
    elements: GuidelineDnaElement[];
  };
  colors: {
    eyebrow: string;
    title: string;
    description: string;
    band: Array<{ hex: string; name: string }>;
    neons: GuidelineColorToken[];
    blues: GuidelineColorToken[];
    neutrals: GuidelineColorToken[];
  };
  typography: {
    eyebrow: string;
    title: string;
    description: string;
    fontFamily: string;
    specimens: GuidelineTypeSpecimen[];
  };
  backgrounds: {
    eyebrow: string;
    title: string;
    description: string;
    /** Optional image shown in preview; set via Supabase Storage public URL */
    slots: Array<{ name: string; imageUrl?: string | null }>;
  };
  voice: {
    eyebrow: string;
    title: string;
    description: string;
    pillars: GuidelineVoicePillar[];
    dos: string[];
    donts: string[];
  };
  usage: {
    eyebrow: string;
    title: string;
    description: string;
    examples: GuidelineUsageExample[];
  };
}

export function isBrandGuidelineDocument(v: unknown): v is BrandGuidelineDocument {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.version === "number" &&
    typeof o.brandName === "string" &&
    Array.isArray(o.nav) &&
    o.hero !== null &&
    typeof o.hero === "object"
  );
}
