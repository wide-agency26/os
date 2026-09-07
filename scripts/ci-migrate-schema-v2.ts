/**
 * One-time batch helper for published CI guidelines → schemaVersion 2.
 * Run from an admin script / Node REPL with service role — not a public API.
 *
 * Usage (example):
 *   npx tsx scripts/ci-migrate-schema-v2.ts
 *
 * For each ci_guidelines row with published status (or all), call the same
 * migrateLogoSlotsToMarks + theme.schemaVersion bump that AdminEditor uses.
 */

import {
  migrateLogoSlotsToMarks,
  needsLogoMarksMigration,
  needsLegacyMigration,
  migrateLegacySections,
} from "../lib/ci-builder/migrate-legacy-sections";
import { CI_SCHEMA_VERSION, type CITheme } from "../lib/ci-builder/types";

export type BatchMigrateRow = {
  id: string;
  theme: CITheme | null;
  sections: Parameters<typeof migrateLogoSlotsToMarks>[0];
  assets: Parameters<typeof migrateLegacySections>[2];
};

export function planGuidelineMigration(row: BatchMigrateRow): {
  needsWork: boolean;
  nextTheme: CITheme;
  nextSections: BatchMigrateRow["sections"];
  deletedSectionIds: string[];
  assetSectionMap: Record<string, string>;
} {
  let sections = row.sections;
  const deletedSectionIds: string[] = [];
  const assetSectionMap: Record<string, string> = {};
  let needsWork = false;

  if (needsLegacyMigration(sections)) {
    const r = migrateLegacySections(row.id, sections, row.assets || []);
    sections = r.sections;
    deletedSectionIds.push(...r.deletedSectionIds);
    Object.assign(assetSectionMap, r.assetSectionMap);
    needsWork = true;
  }
  if (needsLogoMarksMigration(sections)) {
    const r = migrateLogoSlotsToMarks(sections, row.id);
    sections = r.sections;
    deletedSectionIds.push(...r.deletedSectionIds);
    Object.assign(assetSectionMap, r.assetSectionMap);
    needsWork = true;
  }

  const theme = row.theme || {};
  if ((theme.schemaVersion ?? 0) < CI_SCHEMA_VERSION) needsWork = true;

  return {
    needsWork,
    nextTheme: {
      ...theme,
      schemaVersion: CI_SCHEMA_VERSION,
      clientTemplate: theme.clientTemplate || "greenpoint",
    },
    nextSections: sections,
    deletedSectionIds,
    assetSectionMap,
  };
}
