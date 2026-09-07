/**
 * TypeScript entry for the Sign2x 26 Aug report import.
 * Prefer: `node scripts/import-sign2x-report-26aug.mjs`
 *
 * This file documents the pipeline and re-exports the Instagram JSON adapter
 * used by Data Hub / future TS runners.
 */
export { parseInstagramExportJson } from "@/lib/data-hub/parse-instagram-export-json";

console.log(
  "Run: node scripts/import-sign2x-report-26aug.mjs\n" +
    "Instagram adapter: lib/data-hub/parse-instagram-export-json.ts"
);
