/**
 * Offline unit checks for Figma normalize pipeline (P2–P4).
 * Run: npx tsx scripts/test-figma-pipeline.ts
 */

import { normalizeColors, normalizeColorsFromDump, parseColorVariablesDump } from "../lib/ci-builder/figma/normalize/colors";
import { normalizeTypography } from "../lib/ci-builder/figma/normalize/typography";
import {
  normalizeButtons,
  collectVisualPendings,
} from "../lib/ci-builder/figma/normalize/visuals";
import { parseFigmaFileKey, parseFigmaTeamId, figmaColorToHex, tokenNameToCssVar } from "../lib/ci-builder/figma/client";
import type { FigmaFileResponse } from "../lib/ci-builder/figma/client";
import {
  MIN_THEME_CONTRAST,
  ensureReadableTheme,
  hexContrastRatio,
} from "../lib/ci-builder/theme-css";
import { ensureKeyedList } from "../lib/ci-builder/keyed-list";

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
  const primary = sections.find((s) => s.section_type === "color_primary");
  assert((primary?.data.swatches || []).length >= 2, "primary color cards populated");
  assert(
    !sections.some((s) => s.section_type === "colors"),
    "does not write a legacy combined colors section"
  );
}

{
  const collapsed = ensureReadableTheme({
    backgroundColor: "#e8e0d4",
    textColor: "#e2d8c8",
  });
  assert(
    hexContrastRatio(collapsed.backgroundColor, collapsed.textColor) >= MIN_THEME_CONTRAST,
    "ensureReadableTheme lifts near-identical sand colors"
  );
}

{
  const dump = parseColorVariablesDump({
    collections: [
      {
        name: "Brand Colors",
        variables: [
          { name: "Sand 100", hex: "#E8E0D4" },
          { name: "Sand 200", hex: "#E2D8C8" },
          { name: "Context/Primary", hex: "#DDD1BC" },
        ],
      },
    ],
  });
  const themeSuggested: any = { accentColors: [] };
  normalizeColorsFromDump({ dump: dump!, sections: [], themeSuggested });
  assert(
    hexContrastRatio(themeSuggested.backgroundColor, themeSuggested.textColor) >=
      MIN_THEME_CONTRAST,
    "low-chroma palettes do not collapse page contrast"
  );
  assert(
    themeSuggested.textColor !== "#DDD1BC",
    "Context/Primary is not treated as page text color"
  );
}

{
  const fromStrings = ensureKeyedList(
    ["Maintain journalistic independence", "Maintain journalistic independence"],
    "text"
  );
  assert(fromStrings.items.length === 2, "string list becomes two rows");
  assert(fromStrings.items[0].id !== fromStrings.items[1].id, "duplicate copy still gets unique ids");
  const edited = fromStrings.items.map((row) =>
    row.id === fromStrings.items[0].id ? { ...row, text: "Only the first" } : row
  );
  assert(edited[0].text === "Only the first", "first row updates by id");
  assert(edited[1].text === "Maintain journalistic independence", "second row stays put");

  const blankIds = ensureKeyedList(
    [{ word: "Neutral" }, { word: "Pragmatic" }],
    "word"
  );
  assert(blankIds.items[0].id !== blankIds.items[1].id, "objects missing id get unique keys");
  assert(blankIds.changed, "missing ids are reported as changed");
}

{
  const munichVars = {
    meta: {
      variableCollections: {
        Brand: {
          id: "Brand",
          name: "Brand",
          defaultModeId: "solid",
          modes: [
            { modeId: "solid", name: "Solid" },
            { modeId: "trans", name: "Transparency" },
          ],
          variableIds: ["Vmid", "Valp", "Vcyan", "Valias"],
        },
      },
      variables: {
        Vmid: {
          id: "Vmid",
          name: "Brand Colors/Main/MIDNIGHT/Main - 500",
          variableCollectionId: "Brand",
          resolvedType: "COLOR" as const,
          valuesByMode: {
            solid: { r: 0.07, g: 0.15, b: 0.23, a: 1 },
            trans: { r: 0.07, g: 0.15, b: 0.23, a: 0 },
          },
        },
        Valp: {
          id: "Valp",
          name: "Brand Colors/Main/ALPINE CLOUD/Main - 500",
          variableCollectionId: "Brand",
          resolvedType: "COLOR" as const,
          valuesByMode: { solid: { r: 0.94, g: 0.96, b: 0.96, a: 1 } },
        },
        Vcyan: {
          id: "Vcyan",
          name: "Brand Colors/Accent/CYAN/Main - 500",
          variableCollectionId: "Brand",
          resolvedType: "COLOR" as const,
          valuesByMode: { solid: { r: 0, g: 0.93, b: 1, a: 1 } },
        },
        Valias: {
          id: "Valias",
          name: "Brand Colors/Accent/CYAN/600",
          variableCollectionId: "Brand",
          resolvedType: "COLOR" as const,
          valuesByMode: {
            solid: { type: "VARIABLE_ALIAS", id: "Vcyan" },
          },
        },
      },
    },
  };
  const sections: any[] = [];
  const themeSuggested: any = { accentColors: [] };
  const stats = normalizeColors({
    file: mockFile,
    variables: munichVars,
    sections,
    themeSuggested,
  });
  assert(stats.fromVariables === 4, "imports Brand color variables including aliases");
  const primary = sections.find((s) => s.section_type === "color_primary");
  const secondary = sections.find((s) => s.section_type === "color_secondary");
  const accent = sections.find((s) => s.section_type === "color_accent");
  assert(
    (primary?.data.swatches || []).some((s: any) => /midnight/i.test(s.name)),
    "Main/MIDNIGHT lands on the Primary color card"
  );
  assert(
    (secondary?.data.swatches || []).some((s: any) => /alpine/i.test(s.name)),
    "Main/ALPINE CLOUD lands on the Secondary color card"
  );
  assert(
    (accent?.data.swatches || []).some((s: any) => /cyan/i.test(s.name)),
    "Accent/CYAN lands on the Accent color card"
  );
  assert(
    (primary?.data.swatches || []).every((s: any) => s.rgb && s.cmyk),
    "Primary swatches carry RGB and CMYK on the card"
  );
  assert(
    !sections.some((s) => ["hex", "rgb", "cmyk", "color_scale"].includes(s.section_type || "")),
    "does not create HEX/RGB/CMYK/Scale as separate modules"
  );
}

{
  const dump = {
    source: "wide-os-figma-colors",
    version: 1,
    fileName: "Test-MS-BRAND-FILE-Test",
    collections: [
      {
        name: "Brand Colors",
        variables: [
          { name: "Midnight", hex: "#123456" },
          { name: "Alpine Cloud", hex: "#F0F4F4" },
          { name: "Cyan", hex: "#00ECFF" },
        ],
      },
    ],
  };
  const sections: any[] = [];
  const themeSuggested: any = { accentColors: [] };
  const parsedDump = parseColorVariablesDump(JSON.stringify(dump));
  assert(parsedDump?.collections[0].variables.length === 3, "parses Brand Colors dump JSON");
  const stats = normalizeColorsFromDump({
    dump: parsedDump!,
    sections,
    themeSuggested,
  });
  assert(stats.fromDump === 3, "dump imports 3 Brand Colors");
  assert(stats.fromVariables === 0, "dump path does not require REST variables");
  const primary = sections.find((s) => s.section_type === "color_primary");
  const names = (primary?.data.swatches || []).map((s: any) => s.name);
  assert(names.some((n: string) => /midnight/i.test(n)), "Midnight lands on Primary");
  assert(names.some((n: string) => /alpine/i.test(n)), "Alpine Cloud lands on Primary");
  assert(
    (primary?.data.swatches || []).every((s: any) => s.hex && s.name && s.hex !== "#0066ff"),
    "each dump swatch has a name and real hex"
  );
  assert(
    (primary?.data.swatches || []).every((s: any) => s.rgb && s.cmyk),
    "dump swatches carry RGB and CMYK on the card"
  );
  assert(
    !sections.some((s) => ["hex", "rgb", "cmyk"].includes(s.section_type || "")),
    "dump does not create HEX/RGB/CMYK modules"
  );
}

{
  const dump = parseColorVariablesDump({
    collections: [{ name: "Brand Colors", variables: [{ name: "Ink", hex: "#111111" }] }],
  });
  const sections: any[] = [
    {
      id: "logo-1",
      section_type: "primary_logo",
      data: { assetId: "keep-me" },
    },
  ];
  normalizeColorsFromDump({ dump: dump!, sections, themeSuggested: { accentColors: [] } });
  const logo = sections.find((s) => s.section_type === "primary_logo");
  assert(logo?.data?.assetId === "keep-me", "dump does not rewrite non-color sections");
}

{
  const slotId = "11111111-1111-4111-8111-111111111111";
  const sections: any[] = [
    {
      id: "sec-primary",
      section_type: "color_primary",
      data: {
        swatches: [
          { id: slotId, name: "Color", hex: "#000000", cssVar: "--color-token" },
        ],
      },
    },
  ];
  const canvasFile: FigmaFileResponse = {
    name: "CI Canvas Colors",
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
              id: "4:0",
              name: "04. Colors Systems",
              type: "SECTION",
              children: [
                {
                  id: "4:p",
                  name: "Primary",
                  type: "FRAME",
                  children: [
                    {
                      id: "4:p1",
                      name: "Midnight",
                      type: "RECTANGLE",
                      fills: [{ type: "SOLID", color: { r: 0.05, g: 0.08, b: 0.16 } }],
                      children: [
                        {
                          id: "4:p1t",
                          name: "hex",
                          type: "TEXT",
                          characters: "#0D1429",
                        },
                      ],
                    },
                    {
                      id: "4:p2",
                      name: "Ink",
                      type: "RECTANGLE",
                      fills: [{ type: "SOLID", color: { r: 0.1, g: 0.12, b: 0.2 } }],
                    },
                  ],
                },
                {
                  id: "4:h",
                  name: "HEX",
                  type: "FRAME",
                  children: [
                    {
                      id: "4:h1",
                      name: "Hex card",
                      type: "TEXT",
                      characters: "Midnight #0D1429",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
  const stats = normalizeColors({
    file: canvasFile,
    variables: null,
    sections,
    themeSuggested: {},
  });
  assert(stats.fromCanvas >= 1, "reads color fills from Colors Systems frames");
  const primary = sections.find((s) => s.section_type === "color_primary");
  const filled = (primary?.data.swatches || []).find((s: any) => s.id === slotId);
  assert(filled?.hex?.toLowerCase() === "#0d1429", "imports hex onto the existing Primary swatch");
  assert(filled?.rgb && filled?.cmyk, "imported Primary swatch includes RGB and CMYK");
}

{
  const canvasFile: FigmaFileResponse = {
    name: "CI Canvas Colors",
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
              id: "4:0",
              name: "04. Colors Systems",
              type: "SECTION",
              children: [
                {
                  id: "4:p",
                  name: "Primary",
                  type: "FRAME",
                  children: [
                    {
                      id: "4:pc",
                      name: "Primary_Container",
                      type: "FRAME",
                      children: [
                        {
                          id: "4:sw",
                          name: "Swatch",
                          type: "RECTANGLE",
                          fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
  const visual = collectVisualPendings({ file: canvasFile, sections: [] });
  assert(
    !visual.pendings.some((p) => p.sectionType === "ui_primary"),
    "Colors Systems Primary is not imported as a UI button"
  );
  assert(
    !visual.pendings.some((p) => p.sectionType === "color_primary"),
    "color frames are not exported as images — hex goes onto swatches"
  );
}

{
  const sections: any[] = [];
  const themeSuggested: any = {};
  const stats = normalizeTypography({ file: mockFile, sections, themeSuggested });
  assert(stats.rowCount >= 1, "typography rows from text styles");
  assert(themeSuggested.fontFamily === "Inter", "theme font from text");
  const scaleSec = sections.find((s) => s.section_type === "typography_scale");
  assert(
    !(scaleSec?.data.scale || []).some((e: any) => /^text-\d+$/.test(e.token)),
    "does not invent text-N scale from every TEXT node"
  );
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
  // Flat Brand System mock has no CI canvas Section/Frame hierarchy.
  assert(typeof visual.assigned === "number", "visual ingest returns stats");
  assert(typeof visual.unassigned === "number", "unmapped frames are counted");
}

{
  const logoFile: FigmaFileResponse = {
    name: "CI Canvas",
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
              id: "3:0",
              name: "03. Logo System",
              type: "SECTION",
              children: [
                {
                  id: "3:cs",
                  name: "Clear Space",
                  type: "FRAME",
                  children: [
                    {
                      id: "3:cs1",
                      name: "Clear Space_Container",
                      type: "FRAME",
                      children: [{ id: "3:cs1v", name: "mark", type: "VECTOR" }],
                    },
                    {
                      id: "3:cs2",
                      name: "Clear Space_Container",
                      type: "FRAME",
                      children: [{ id: "3:cs2v", name: "mark2", type: "VECTOR" }],
                    },
                  ],
                },
                {
                  id: "3:mis",
                  name: "Misuse Examples",
                  type: "FRAME",
                  children: [
                    {
                      id: "3:mis1",
                      name: "Misuse Examples_Container",
                      type: "FRAME",
                      children: [{ id: "3:mis1r", name: "bad1", type: "RECTANGLE" }],
                    },
                    {
                      id: "3:mis2",
                      name: "Misuse Examples_Container",
                      type: "FRAME",
                      children: [{ id: "3:mis2r", name: "bad2", type: "RECTANGLE" }],
                    },
                  ],
                },
                {
                  id: "3:do",
                  name: "Correct Use",
                  type: "FRAME",
                  children: [
                    {
                      id: "3:do1",
                      name: "Correct Use_Container",
                      type: "FRAME",
                      children: [{ id: "3:do1r", name: "good1", type: "RECTANGLE" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };

  const sections: any[] = [];
  const visual = collectVisualPendings({ file: logoFile, sections });
  const clearIds = visual.pendings
    .filter((p) => p.sectionType === "clear_space")
    .map((p) => p.nodeId);
  assert(
    clearIds.includes("3:cs1") && clearIds.includes("3:cs2") && !clearIds.includes("3:cs"),
    "Clear Space exports each _Container, not the parent frame"
  );
  const misuseIds = visual.pendings
    .filter((p) => p.sectionType === "misuse_examples")
    .map((p) => p.nodeId);
  assert(
    misuseIds.includes("3:mis1") &&
      misuseIds.includes("3:mis2") &&
      !misuseIds.includes("3:mis"),
    "Misuse Examples exports each inner container"
  );
  assert(misuseIds.includes("3:do1") && !misuseIds.includes("3:do"), "Correct Use exports inner containers");

  const items = sections.find((s) => s.section_type === "misuse_examples")?.data.items || [];
  const dos = items.filter((i: any) => i.type === "do");
  const donts = items.filter((i: any) => i.type === "dont");
  assert(donts.length === 2, "Misuse Examples containers are dont");
  assert(dos.length === 1, "Correct Use containers are do");

  const clear = sections.find((s) => s.section_type === "clear_space");
  assert(
    Array.isArray(clear?.data.variants) && clear.data.variants.length === 2,
    "Clear Space keeps both container versions as variants"
  );
}

{
  const logoFile: FigmaFileResponse = {
    name: "CI Canvas",
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
              id: "3:0",
              name: "03. Logo System",
              type: "SECTION",
              children: [
                {
                  id: "3:pl",
                  name: "Primary Logo",
                  type: "FRAME",
                  children: [
                    {
                      id: "3:plc",
                      name: "Primary Logo_Container",
                      type: "FRAME",
                      children: [{ id: "3:plv", name: "mark", type: "VECTOR" }],
                    },
                  ],
                },
                {
                  id: "3:im1",
                  name: "Image Mark",
                  type: "FRAME",
                  children: [
                    {
                      id: "3:im1c",
                      name: "Image Mark_Container",
                      type: "FRAME",
                      children: [{ id: "3:im1v", name: "v", type: "VECTOR" }],
                    },
                  ],
                },
                {
                  id: "3:im2",
                  name: "Image Mark",
                  type: "FRAME",
                  children: [
                    {
                      id: "3:im2c",
                      name: "Image Mark_Container",
                      type: "FRAME",
                      children: [{ id: "3:im2v", name: "v2", type: "VECTOR" }],
                    },
                  ],
                },
                {
                  id: "3:cs",
                  name: "Clear Space",
                  type: "FRAME",
                  children: [
                    { id: "3:cs1", name: "Clear Space_Container", type: "FRAME" },
                    { id: "3:cs2", name: "Clear Space_Container", type: "FRAME" },
                  ],
                },
                {
                  id: "3:mis",
                  name: "Misuse Examples",
                  type: "FRAME",
                  children: [
                    {
                      id: "3:mis1",
                      name: "Misuse Examples_Container",
                      type: "FRAME",
                      children: [
                        {
                          id: "3:mis1t",
                          name: "Text",
                          type: "FRAME",
                          children: [
                            { id: "3:mis1n", name: "NO", type: "TEXT", characters: "NO" },
                            {
                              id: "3:mis1c",
                              name: "rule",
                              type: "TEXT",
                              characters: "Do not rotate the logo",
                            },
                          ],
                        },
                        { id: "3:mis1r", name: "Component 1", type: "INSTANCE" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };

  const sections: any[] = [];
  const visual = collectVisualPendings({ file: logoFile, sections });

  const logoIds = visual.pendings
    .filter((p) => p.sectionType === "primary_logo")
    .map((p) => p.nodeId);
  assert(
    logoIds.includes("3:plc") && !logoIds.includes("3:pl"),
    "Primary Logo exports _Container, not the parent frame"
  );

  const markIds = visual.pendings
    .filter((p) => p.sectionType === "image_mark")
    .map((p) => p.nodeId);
  assert(
    markIds.includes("3:im1c") && markIds.includes("3:im2c"),
    "both Image Mark_Container frames are imported"
  );

  const clearIds = visual.pendings
    .filter((p) => p.sectionType === "clear_space")
    .map((p) => p.nodeId);
  assert(
    clearIds.includes("3:cs1") && clearIds.includes("3:cs2") && !clearIds.includes("3:cs"),
    "Clear Space still exports _Container when REST omits nested children"
  );

  const misuse = visual.pendings.find((p) => p.sectionType === "misuse_examples");
  assert(
    misuse?.caption === "Do not rotate the logo",
    "Misuse Examples caption comes from inner instruction text"
  );
}

{
  const fontVars = {
    meta: {
      variableCollections: {
        C2: {
          id: "C2",
          name: "Type",
          defaultModeId: "20:1",
          modes: [{ modeId: "20:1", name: "Desktop" }],
          variableIds: ["Vsize", "Vlh", "Vps", "Vcs", "Vw"],
        },
      },
      variables: {
        Vsize: {
          id: "Vsize",
          name: "Font/Heading/Primary/text size",
          variableCollectionId: "C2",
          resolvedType: "FLOAT" as const,
          valuesByMode: { "20:1": 100 },
        },
        Vlh: {
          id: "Vlh",
          name: "Font/Heading/Primary/line height",
          variableCollectionId: "C2",
          resolvedType: "FLOAT" as const,
          valuesByMode: { "20:1": 88 },
        },
        Vps: {
          id: "Vps",
          name: "Font/Heading/Primary/paragraph spacing",
          variableCollectionId: "C2",
          resolvedType: "FLOAT" as const,
          valuesByMode: { "20:1": 76 },
        },
        Vcs: {
          id: "Vcs",
          name: "Font/Heading/Primary/character spacing",
          variableCollectionId: "C2",
          resolvedType: "FLOAT" as const,
          valuesByMode: { "20:1": -2 },
        },
        Vw: {
          id: "Vw",
          name: "Font/Heading/Primary/font weight",
          variableCollectionId: "C2",
          resolvedType: "STRING" as const,
          valuesByMode: {
            "20:1": { type: "VARIABLE_ALIAS", id: "Valias" },
          },
        },
        Valias: {
          id: "Valias",
          name: "Fonts/Inter/Weight/Extra Bold Italic",
          variableCollectionId: "C2",
          resolvedType: "STRING" as const,
          valuesByMode: { "20:1": "Extra Bold Italic" },
        },
      },
    },
  };

  const sections: any[] = [];
  const themeSuggested: any = {};
  const stats = normalizeTypography({
    file: mockFile,
    sections,
    themeSuggested,
    variables: fontVars as any,
  });
  assert(stats.scaleCount === 1, "scale is the Font/Heading/Primary group, not a px waterfall");
  const scale = sections.find((s) => s.section_type === "typography_scale")?.data.scale || [];
  assert(scale[0]?.token === "Heading / Primary", "scale token uses the Figma group name");
  assert(scale[0]?.value === "100px", "scale visualizes the stated text size");
  assert(scale[0]?.lineHeight === "88px", "scale keeps line height from the variable");
  assert(scale[0]?.fontWeight === "Extra Bold Italic", "scale resolves font weight alias name");
  const h1 = sections.find((s) => s.section_type === "headline_primary");
  assert(h1?.data.fontSize === "100px", "Headline Primary gets Font/Heading/Primary");
  assert(h1?.data.fontFamily === "Inter", "Headline Primary family from Fonts/Inter alias");
}

console.log("\nAll Figma normalize tests passed.\n");
