/**
 * Full Figma → Brand Guideline normalize pipeline (P2–P5).
 * Hierarchy: Section=Module → Frame=Sub-Module → *_Container=data shell.
 */

import {
  getFigmaFile,
  getLocalVariables,
  type FigmaFileResponse,
  type FigmaVariablesResponse,
} from "@/lib/ci-builder/figma/client";
import type { CISection, CIAsset, SectionType } from "@/lib/ci-builder/types";
import { generateUUID } from "@/lib/ci-builder/types";
import type { ParseResult } from "@/lib/ci-builder/parser";
import { extractFigmaSummary, type FigmaExtractSummary } from "@/lib/ci-builder/figma/extract";
import { normalizeColors } from "./normalize/colors";
import { normalizeTypography } from "./normalize/typography";
import {
  normalizeButtons,
  collectVisualPendings,
  pendingsToAssets,
} from "./normalize/visuals";
import { ensureSection, wireVisualAsset } from "./normalize/helpers";
import { getSubModule } from "@/lib/ci-builder/modules-catalog";
import { exportAndUploadAssets } from "./normalize/upload-assets";
import { suggestSectionsForUnmapped } from "@/lib/ci-builder/figma/classify/ai-suggest";

export type FigmaPipelineResult = {
  summary: FigmaExtractSummary;
  parsed: ParseResult;
  file: FigmaFileResponse;
  variablesAvailable: boolean;
  stats: {
    colors: number;
    typographyRows: number;
    buttonSamples: number;
    assetsUploaded: number;
    assetsFailed: number;
    aiSuggestions: number;
    skippedEmptyUi: number;
    subModules: number;
  };
};

export async function runFigmaImportPipeline(opts: {
  accessToken: string;
  fileKey: string;
  guidelineId: string;
  existingSections: Partial<CISection>[];
  supabase: any;
  previewOnly?: boolean;
  skipAssetUpload?: boolean;
  runAiSuggest?: boolean;
}): Promise<FigmaPipelineResult> {
  const {
    accessToken,
    fileKey,
    guidelineId,
    existingSections,
    supabase,
    previewOnly = false,
    skipAssetUpload = false,
    runAiSuggest = false, // off by default — hierarchy map is authoritative
  } = opts;

  const file = await getFigmaFile(accessToken, fileKey);
  const summary = extractFigmaSummary(file);

  let variables: FigmaVariablesResponse | null = null;
  try {
    variables = await getLocalVariables(accessToken, fileKey);
  } catch {
    variables = null;
  }

  if (previewOnly) {
    const empty: ParseResult = {
      sections: existingSections,
      assets: [],
      themeSuggested: {},
      report: {
        format: "items_manifest",
        totalItems: summary.items.length,
        assignedCount: summary.items.filter((i) => i.confidence !== "unmapped").length,
        unassignedCount: summary.items.filter((i) => i.confidence === "unmapped").length,
        missingFiles: 0,
        detectedNameKeys: ["name"],
        detectedFileKeys: [],
        missingFileRows: [],
        message: `Preview: ${summary.pageCount} pages · ${summary.frameCount} sub-module frames · ${summary.componentCount} components · ${summary.styleCount} styles · variables ${variables?.meta ? "available" : "n/a"}`,
      },
    };
    return {
      summary,
      parsed: empty,
      file,
      variablesAvailable: Boolean(variables?.meta),
      stats: {
        colors: 0,
        typographyRows: 0,
        buttonSamples: 0,
        assetsUploaded: 0,
        assetsFailed: 0,
        aiSuggestions: 0,
        skippedEmptyUi: 0,
        subModules: 0,
      },
    };
  }

  const sections: Partial<CISection>[] = existingSections.map((s) => ({
    ...s,
    data: s.data ? { ...s.data } : s.data,
  }));
  const themeSuggested: Record<string, any> = { accentColors: [] };

  const colorStats = normalizeColors({ file, variables, sections, themeSuggested });
  const typeStats = normalizeTypography({
    file,
    sections,
    themeSuggested,
    variables,
  });
  const visual = collectVisualPendings({ file, sections });
  const buttonStats = normalizeButtons({ file, sections });

  // Optional AI for truly unmapped leftover pendings (rare with canvas map)
  let aiSuggestions = 0;
  if (runAiSuggest) {
    const unmatched = visual.pendings.filter((p) => p.sectionType === "unmatched");
    if (unmatched.length) {
      const suggestions = await suggestSectionsForUnmapped(
        unmatched.map((p) => ({ sourceId: p.nodeId, sourceName: p.label }))
      );
      for (const s of suggestions) {
        if (!s.suggestedSection) continue;
        const pending = unmatched.find((p) => p.nodeId === s.sourceId);
        if (!pending) continue;
        pending.sectionType = s.suggestedSection;
        pending.kind = s.suggestedSection;
        aiSuggestions++;
        const sec = ensureSection(sections, s.suggestedSection, file.name);
        wireSuggestedAsset(sec, pending.assetId, pending.label, s.suggestedSection);
      }
    }
  }

  let assets = pendingsToAssets(visual.pendings, sections);

  let uploaded = 0;
  let failed = 0;
  if (!skipAssetUpload && assets.length) {
    const result = await exportAndUploadAssets({
      accessToken,
      fileKey,
      guidelineId,
      assets,
      supabase,
    });
    uploaded = result.uploaded;
    failed = result.failed;
  }

  // Only count truly failed uploads as "missing" — never pending_export phantoms
  const missingFileRows = assets
    .filter((a) => a.metadata?.pending_export && !a.public_url)
    .map((a) => a.label || "")
    .slice(0, 40);

  const assignedCount =
    visual.assigned +
    (colorStats.swatchCount > 0 ? 1 : 0) +
    (typeStats.familyCount > 0 || typeStats.scaleCount > 0 ? 1 : 0) +
    aiSuggestions;

  const parsed: ParseResult = {
    sections,
    assets,
    themeSuggested,
    report: {
      format: "items_manifest",
      totalItems: visual.subModules + colorStats.swatchCount + typeStats.rowCount,
      assignedCount,
      unassignedCount: Math.max(0, visual.unassigned - aiSuggestions),
      missingFiles: failed,
      detectedNameKeys: ["name"],
      detectedFileKeys: ["figma_node_id"],
      missingFileRows: failed > 0 ? missingFileRows : [],
      message: [
        `Figma import complete for “${summary.fileName}”.`,
        `Sub-modules: ${visual.subModules} (1 section each).`,
        `Assets exported: ${uploaded} parent frames.`,
        visual.skippedEmptyUi
          ? `Skipped empty UI frames: ${visual.skippedEmptyUi}.`
          : "",
        `Colors: ${colorStats.swatchCount} (${colorStats.fromVariables} vars / ${colorStats.fromStyles} styles).`,
        `Typography: ${typeStats.familyCount} families · ${typeStats.scaleCount} scale steps.`,
        buttonStats.sampleCount ? `Button samples: ${buttonStats.sampleCount}.` : "",
        failed ? `Upload failures: ${failed}.` : "",
        aiSuggestions ? `AI suggestions applied: ${aiSuggestions}.` : "",
        variables?.meta ? "" : "Variables API unavailable (non-Enterprise or missing scope).",
      ]
        .filter(Boolean)
        .join(" "),
    },
  };

  return {
    summary,
    parsed,
    file,
    variablesAvailable: Boolean(variables?.meta),
    stats: {
      colors: colorStats.swatchCount,
      typographyRows: typeStats.rowCount,
      buttonSamples: buttonStats.sampleCount,
      assetsUploaded: uploaded,
      assetsFailed: failed,
      aiSuggestions,
      skippedEmptyUi: visual.skippedEmptyUi,
      subModules: visual.subModules,
    },
  };
}

function wireSuggestedAsset(
  sec: Partial<CISection>,
  assetId: string,
  label: string,
  section: SectionType
) {
  if (!sec.data) return;

  if (getSubModule(section)) {
    wireVisualAsset(sec, section, assetId, label);
    return;
  }

  if (section === "logo") {
    if (!sec.data.logos) sec.data.logos = [];
    sec.data.logos.push({
      id: generateUUID(),
      assetId,
      label,
      stage: "any",
      fit: "contain",
    });
  } else if (section === "backgrounds") {
    if (!sec.data.groups) sec.data.groups = [];
    let g = sec.data.groups[0];
    if (!g) {
      g = { id: generateUUID(), groupLabel: "AI suggested", assets: [] };
      sec.data.groups.push(g);
    }
    g.assets.push({ id: generateUUID(), assetId, label });
  } else if (section === "grid_frames") {
    if (!sec.data.frames) sec.data.frames = [];
    sec.data.frames.push({ id: generateUUID(), label, assetId });
  } else if (section === "applications") {
    if (!sec.data.apps) sec.data.apps = [];
    sec.data.apps.push({
      id: generateUUID(),
      label,
      assetId,
      tag: "AI suggested",
    });
  } else if (section === "dos_donts") {
    if (!sec.data.items) sec.data.items = [];
    sec.data.items.push({
      id: generateUUID(),
      type: /dont|don't|falsch/i.test(label) ? "dont" : "do",
      assetId,
      caption: label,
    });
  }
}

export type SyncDiff = {
  previousVersion: string | null;
  currentVersion: string | null;
  changed: boolean;
  fileName: string;
};

export async function checkFigmaSyncStatus(opts: {
  accessToken: string;
  fileKey: string;
  previousVersion: string | null;
}): Promise<SyncDiff> {
  const file = await getFigmaFile(opts.accessToken, opts.fileKey, { depth: 1 });
  const current = file.version || null;
  return {
    previousVersion: opts.previousVersion,
    currentVersion: current,
    changed: Boolean(current && current !== opts.previousVersion),
    fileName: file.name,
  };
}
