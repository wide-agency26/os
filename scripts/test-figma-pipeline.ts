/**
 * Offline unit checks for Figma normalize pipeline (P2–P4).
 * Run: npx tsx scripts/test-figma-pipeline.ts
 */

import { normalizeColors } from "../lib/ci-builder/figma/normalize/colors";
import { normalizeTypography } from "../lib/ci-builder/figma/normalize/typography";
import {
  normalizeButtons,
  collectVisualPendings,
} from "../lib/ci-builder/figma/normalize/visuals";
import { parseFigmaFileKey, parseFigmaTeamId, figmaColorToHex, tokenNameToCssVar } from "../lib/ci-builder/figma/client";
import type { FigmaFileResponse } from "../lib/ci-builder/figma/client";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

const mockFile: FigmaFileResponse = {
  name: "Brand System",
  version: "123",
  lastModified: "2026-08-06T00:00:00Z",
  styles: {
    "S:fill1": { name: "Brand/Primary", styleType: "FILL" },
    "S:text1": { name: "Type/H1", styleType: "TEXT" },
  },
  components: {},
  componentSets: {
    "CS:1": { name: "Button/Primary" },
  },
  document: {
    id: "0:0",
    name: "Document",
    type: "DOCUMENT",
    children: [
      {
        id: "1:0",
        name: "Page 1",
        type: "PAGE",
        children: [
          {
            id: "2:1",
            name: "Logo/Primary/dark",
            type: "FRAME",
            absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 80 },
            fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
            styles: { fill: "S:fill1" },
          },
          {
            id: "2:2",
            name: "Colors/Swatch",
            type: "FRAME",
            fills: [{ type: "SOLID", color: { r: 0.1, g: 0.4, b: 0.9 } }],
            styles: { fill: "S:fill1" },
          },
          {
            id: "2:3",
            name: "Headline",
            type: "TEXT",
            characters: "Hello Brand",
            style: {
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: 48,
              lineHeightPx: 56,
            },
            styles: { text: "S:text1" },
            fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
          },
          {
            id: "2:4",
            name: "Button/Primary=default",
            type: "COMPONENT",
            fills: [{ type: "SOLID", color: { r: 0.1, g: 0.4, b: 0.9 } }],
            children: [
              {
                id: "2:41",
                name: "Label",
                type: "TEXT",
                characters: "Click me",
                fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
                style: { fontFamily: "Inter", fontSize: 14, fontWeight: 600 },
              },
            ],
          },
          {
            id: "2:5",
            name: "Button/Primary=hover",
            type: "COMPONENT",
            fills: [{ type: "SOLID", color: { r: 0.05, g: 0.3, b: 0.8 } }],
            children: [
              {
                id: "2:51",
                name: "Label",
                type: "TEXT",
                characters: "Click me",
                fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
              },
            ],
          },
          {
            id: "2:6",
            name: "Backgrounds/Texture/Wave",
            type: "FRAME",
            absoluteBoundingBox: { x: 0, y: 0, width: 1200, height: 800 },
          },
          {
            id: "2:7",
            name: "Grid/Square",
            type: "FRAME",
            absoluteBoundingBox: { x: 0, y: 0, width: 1080, height: 1080 },
          },
          {
            id: "2:8",
            name: "Applications/Mobile Mockup",
            type: "FRAME",
            absoluteBoundingBox: { x: 0, y: 0, width: 390, height: 844 },
          },
          {
            id: "2:9",
            name: "Do/Clearspace",
            type: "FRAME",
            absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
          },
          {
            id: "2:10",
            name: "Don't/Stretch logo",
            type: "FRAME",
            absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
          },
        ],
      },
    ],
  },
};

const variables = {
  meta: {
    variableCollections: {
      C1: {
        id: "C1",
        name: "Brand",
        defaultModeId: "M1",
        modes: [{ modeId: "M1", name: "Default" }],
        variableIds: ["V1", "V2"],
      },
    },
    variables: {
      V1: {
        id: "V1",
        name: "color/brand/primary",
        variableCollectionId: "C1",
        resolvedType: "COLOR" as const,
        valuesByMode: { M1: { r: 0.1, g: 0.4, b: 0.9, a: 1 } },
      },
      V2: {
        id: "V2",
        name: "color/brand/background",
        variableCollectionId: "C1",
        resolvedType: "COLOR" as const,
        valuesByMode: { M1: { r: 1, g: 1, b: 1, a: 1 } },
      },
    },
  },
};

console.log("\nFigma pipeline unit tests\n");

assert(parseFigmaFileKey("https://www.figma.com/design/AbCdEfGhIj/Brand") === "AbCdEfGhIj", "parse file key from design URL");
assert(parseFigmaTeamId("https://www.figma.com/files/team/123456789/Name") === "123456789", "parse team id");
assert(figmaColorToHex({ r: 1, g: 0, b: 0 }) === "#ff0000", "color to hex");
assert(tokenNameToCssVar("color/Brand Primary") === "--color-brand-primary", "css var slug");

{
  const sections: any[] = [];
  const themeSuggested: any = { accentColors: [] };
  const stats = normalizeColors({
    file: mockFile,
    variables,
    sections,
    themeSuggested,
  });
  assert(stats.fromVariables === 2, "imports 2 color variables");
  assert(stats.swatchCount >= 2, "has swatches");
  assert(themeSuggested.backgroundColor === "#ffffff", "suggests background from variable name");
  const colorsSec = sections.find((s) => s.section_type === "colors");
  assert(colorsSec?.data.groups?.[0]?.swatches?.length >= 2, "colors section populated");
}

{
  const sections: any[] = [];
  const themeSuggested: any = {};
  const stats = normalizeTypography({ file: mockFile, sections, themeSuggested });
  assert(stats.rowCount >= 1, "typography rows from text styles");
  assert(themeSuggested.fontFamily === "Inter", "theme font from text");
}

{
  const sections: any[] = [];
  const stats = normalizeButtons({ file: mockFile, sections });
  assert(stats.sampleCount >= 1, "button samples extracted");
  const btn = sections.find((s) => s.section_type === "buttons");
  assert(btn?.data.samples?.[0]?.defaultColors?.bg, "button has default bg");
}

{
  const sections: any[] = [];
  const visual = collectVisualPendings({ file: mockFile, sections });
  assert(visual.pendings.some((p) => p.sectionType === "logo"), "logo pending");
  assert(visual.pendings.some((p) => p.sectionType === "backgrounds"), "backgrounds pending");
  assert(visual.pendings.some((p) => p.sectionType === "grid_frames"), "grid pending");
  assert(visual.pendings.some((p) => p.sectionType === "applications"), "applications pending");
  assert(
    sections.find((s) => s.section_type === "dos_donts")?.data.items?.length >= 2,
    "do/dont items"
  );
}

console.log("\nAll Figma normalize tests passed.\n");
