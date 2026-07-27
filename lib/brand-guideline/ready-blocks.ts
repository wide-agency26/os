import type { BrandGuidelineDocument } from "./types";
import { createDefaultGuidelineDocument, DEFAULT_NAV } from "./defaults";

/**
 * One-click starter blocks for the brand guideline builder. Each block drops a
 * professionally written, fully-styled section into the document so a manager
 * can assemble a complete guideline without writing anything from scratch.
 */

export type BrandStarterBlock = {
  key: string;
  label: string;
  hint: string;
  apply: (doc: BrandGuidelineDocument) => BrandGuidelineDocument;
};

function template(doc: BrandGuidelineDocument): BrandGuidelineDocument {
  return createDefaultGuidelineDocument(doc.brandName || "Your Brand");
}

export const BRAND_STARTER_BLOCKS: BrandStarterBlock[] = [
  {
    key: "full",
    label: "Full starter kit",
    hint: "Fills every section with a complete, editable guideline",
    apply: (doc) => ({
      ...template(doc),
      brandName: doc.brandName || "Your Brand",
      accentColor: doc.accentColor,
    }),
  },
  {
    key: "nav",
    label: "Navigation",
    hint: "Standard 8-section sidebar",
    apply: (doc) => ({ ...doc, nav: DEFAULT_NAV }),
  },
  {
    key: "hero",
    label: "Overview / hero",
    hint: "Title, intro, and meta tags",
    apply: (doc) => ({ ...doc, hero: template(doc).hero }),
  },
  {
    key: "logos",
    label: "Logo system",
    hint: "Primary marks + wordmark lockups",
    apply: (doc) => ({ ...doc, logos: template(doc).logos }),
  },
  {
    key: "visualDna",
    label: "Visual DNA",
    hint: "Reusable graphic devices",
    apply: (doc) => ({ ...doc, visualDna: template(doc).visualDna }),
  },
  {
    key: "colors",
    label: "Colour system",
    hint: "Palette band, accents, neutrals",
    apply: (doc) => ({ ...doc, colors: template(doc).colors }),
  },
  {
    key: "typography",
    label: "Typography scale",
    hint: "Display → caption specimens",
    apply: (doc) => ({ ...doc, typography: template(doc).typography }),
  },
  {
    key: "backgrounds",
    label: "Backgrounds",
    hint: "Background slots for imagery",
    apply: (doc) => ({ ...doc, backgrounds: template(doc).backgrounds }),
  },
  {
    key: "voice",
    label: "Voice & tone",
    hint: "Pillars, do's and don'ts",
    apply: (doc) => ({ ...doc, voice: template(doc).voice }),
  },
  {
    key: "usage",
    label: "Usage examples",
    hint: "Social, card, hero layouts",
    apply: (doc) => ({ ...doc, usage: template(doc).usage }),
  },
];
