import { SectionType } from "./types";
import {
  CI_SUBMODULES,
  type CiSubModuleDef,
} from "./modules-catalog";

export interface GlossaryEntry {
  section_type: SectionType;
  eyebrow_label: string;
  default_headline: string;
  prefixes: string[];
  synonyms: string[];
  description: string;
  moduleId?: string;
  moduleLabel?: string;
  moduleIndex?: number;
  tier?: string;
  inputType?: string;
  renderer?: string;
}

/** Legacy 11-section taxonomy — still matched for existing guidelines & imports. */
const LEGACY_GLOSSARY: GlossaryEntry[] = [
  {
    section_type: "overview",
    eyebrow_label: "01 · Overview",
    default_headline: "Brand Overview",
    prefixes: ["Overview"],
    synonyms: ["intro", "about", "introduction", "brand", "übersicht"],
    description: "Legacy overview section (prefer Brand Core sub-modules)",
  },
  {
    section_type: "logo",
    eyebrow_label: "03 · Logo",
    default_headline: "Primary Logo",
    prefixes: ["Logo"],
    synonyms: [
      "logo",
      "logos",
      "wortmarke",
      "bildmarke",
      "markenzeichen",
      "wordmark",
      "brandmark",
      "logomark",
      "symbol",
    ],
    description: "Legacy combined logo section",
  },
  {
    section_type: "colors",
    eyebrow_label: "04 · Colors",
    default_headline: "Brand Colors",
    prefixes: ["Colors", "Color", "Farben", "Farbe"],
    synonyms: [
      "farbe",
      "farben",
      "farbwelt",
      "palette",
      "colours",
      "colour",
      "swatch",
      "swatches",
    ],
    description: "Legacy combined colors section",
  },
  {
    section_type: "typography",
    eyebrow_label: "05 · Typography",
    default_headline: "Typography",
    prefixes: ["Typography", "Type", "Fonts", "Typografie"],
    synonyms: [
      "typografie",
      "schrift",
      "schriftart",
      "schriftzug",
      "font",
      "fonts",
      "typeface",
      "text",
      "typesetting",
    ],
    description: "Legacy combined typography section",
  },
  {
    section_type: "buttons",
    eyebrow_label: "07 · UI Elements",
    default_headline: "Buttons & Inputs",
    prefixes: ["Buttons", "UI"],
    synonyms: [
      "buttons",
      "knöpfe",
      "schaltflächen",
      "button",
      "input",
      "elements",
      "components",
      "controls",
    ],
    description: "Legacy combined UI section",
  },
  {
    section_type: "grid_frames",
    eyebrow_label: "06 · Layout",
    default_headline: "Grids & Frames",
    prefixes: ["Grid", "Frame", "Frames", "Layout", "Raster"],
    synonyms: ["raster", "gitter", "rahmen", "grids", "layout", "structure", "spacing"],
    description: "Legacy layout section",
  },
  {
    section_type: "backgrounds",
    eyebrow_label: "07 · Backgrounds",
    default_headline: "Background Assets",
    prefixes: ["Backgrounds", "Background", "BGs", "Hintergrund"],
    synonyms: ["hintergrund", "hintergründe", "bg", "backdrop", "texture", "textures"],
    description: "Legacy backgrounds section",
  },
  {
    section_type: "imagery",
    eyebrow_label: "08 · Imagery",
    default_headline: "Photography & Imagery",
    prefixes: ["Imagery", "Photo", "Photography", "Bildsprache"],
    synonyms: [
      "bildsprache",
      "bilder",
      "fotografie",
      "photos",
      "images",
      "pictures",
      "direction",
    ],
    description: "Legacy imagery section",
  },
  {
    section_type: "voice_tone",
    eyebrow_label: "02 · Voice",
    default_headline: "Voice & Tone",
    prefixes: ["Voice", "Tone", "Language", "Sprache"],
    synonyms: [
      "sprache",
      "tonalität",
      "wording",
      "copy",
      "writing",
      "copywriting",
      "messaging",
    ],
    description: "Legacy voice section",
  },
  {
    section_type: "applications",
    eyebrow_label: "09 · Applications",
    default_headline: "In Practice",
    prefixes: ["Applications", "Mockups", "InUse", "Anwendungen"],
    synonyms: [
      "anwendungen",
      "anwendungsbeispiele",
      "application",
      "mockup",
      "practice",
      "examples",
    ],
    description: "Legacy applications section",
  },
  {
    section_type: "dos_donts",
    eyebrow_label: "11 · Rules",
    default_headline: "Do's and Don'ts",
    prefixes: ["DoDont", "DosDonts", "Rules"],
    synonyms: [
      "richtig",
      "falsch",
      "erlaubt",
      "verboten",
      "richtig/falsch",
      "erlaubt/verboten",
      "dos and don'ts",
      "guidelines",
      "correct",
      "incorrect",
      "right",
      "wrong",
      "do",
      "dont",
      "do's",
      "don'ts",
    ],
    description: "Legacy rules section",
  },
];

function fromCatalog(s: CiSubModuleDef): GlossaryEntry {
  return {
    section_type: s.sectionType,
    eyebrow_label: s.eyebrow,
    default_headline: s.defaultHeadline,
    prefixes: s.prefixes,
    synonyms: s.synonyms,
    description: `${s.moduleLabel} · ${s.subModuleLabel} (${s.inputType})`,
    moduleId: s.moduleId,
    moduleLabel: s.moduleLabel,
    moduleIndex: s.moduleIndex,
    tier: s.tier,
    inputType: s.inputType,
    renderer: s.renderer,
  };
}

/** Primary glossary: 52 sub-modules first, then legacy aliases for old data/imports. */
export const CI_GLOSSARY: GlossaryEntry[] = [
  ...CI_SUBMODULES.map(fromCatalog),
  ...LEGACY_GLOSSARY,
];

/** Add-section picker uses only the 52-module catalog (not legacy buckets). */
export const CI_ADDABLE_GLOSSARY: GlossaryEntry[] = CI_SUBMODULES.map(fromCatalog);

export interface MatchResult {
  type: SectionType | null;
  match_method: "exact" | "synonym" | "substring" | null;
  parts: string[];
}

export function matchSectionType(rawName: string): MatchResult {
  const normalizedStr = rawName
    .replace(/[\/\-\_\>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = normalizedStr.split(" ");

  if (parts.length === 0 || !parts[0]) {
    return { type: null, match_method: null, parts: [] };
  }

  const prefix = parts[0].toLowerCase();

  // Prefer multi-part path matches against submodule labels (Section/Subtype/Name)
  const joined = parts.map((p) => p.toLowerCase()).join(" ");
  for (const entry of CI_GLOSSARY) {
    const label = entry.default_headline.toLowerCase();
    if (joined.includes(label) || parts.some((p) => p.toLowerCase() === entry.section_type)) {
      if (joined.includes(label)) {
        return { type: entry.section_type, match_method: "exact", parts };
      }
    }
  }

  for (const entry of CI_GLOSSARY) {
    if (entry.prefixes.some((p) => p.toLowerCase() === prefix)) {
      return { type: entry.section_type, match_method: "exact", parts };
    }
  }

  for (const entry of CI_GLOSSARY) {
    if (entry.synonyms.some((s) => s.toLowerCase() === prefix)) {
      return { type: entry.section_type, match_method: "synonym", parts };
    }
  }

  for (const word of parts.map((p) => p.toLowerCase())) {
    for (const entry of CI_GLOSSARY) {
      if (
        entry.prefixes.some((p) => p.toLowerCase() === word) ||
        entry.synonyms.some((s) => s.toLowerCase() === word && s.length >= 3)
      ) {
        return { type: entry.section_type, match_method: "substring", parts };
      }
    }
  }

  const fullLowercaseName = normalizedStr.toLowerCase();
  for (const entry of CI_GLOSSARY) {
    if (
      entry.prefixes.some((p) => fullLowercaseName.includes(p.toLowerCase())) ||
      entry.synonyms.some((s) => s.length >= 4 && fullLowercaseName.includes(s.toLowerCase()))
    ) {
      return { type: entry.section_type, match_method: "substring", parts };
    }
  }

  return { type: null, match_method: null, parts };
}
