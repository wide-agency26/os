/**
 * Parse CSV / TSV / XLS / XLSX / Instagram HTML into sheet payloads for Data Hub import.
 * Handles Google Ads preamble, LinkedIn UTF-16 TSV + metadata rows, Meta IG HTML dumps.
 */

import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  isInstagramHtmlFilename,
  parseInstagramHtml,
} from "@/lib/data-hub/parse-instagram-html";

export interface ParsedSheet {
  name: string;
  rows: Record<string, string>[];
}

function looksLikeHeaderRow(cells: string[]): boolean {
  const joined = cells.map((c) => c.toLowerCase().trim()).filter(Boolean);
  if (joined.length < 2) return false;

  const hasCampaign = joined.some(
    (c) =>
      c === "campaign" ||
      c === "campaign name" ||
      c === "ad name" ||
      c === "campaignname"
  );
  const hasMetric = joined.some(
    (c) =>
      c === "cost" ||
      c === "impr." ||
      c === "impressions" ||
      c === "clicks" ||
      c === "amount spent" ||
      c.startsWith("amount spent") ||
      c === "total spent" ||
      c === "views" ||
      c === "sessions" ||
      c.includes("click through rate") ||
      c.includes("clicks to landing page")
  );
  const hasLiAds =
    joined.some((c) => c.includes("start date")) &&
    joined.some((c) => c.includes("total spent") || c === "impressions");

  // LinkedIn Page Analytics organic metrics / visitors / followers
  const hasLiOrganic =
    joined.some((c) => c === "date") &&
    joined.some(
      (c) =>
        c.includes("impressions (organic)") ||
        c.includes("reactions (organic)") ||
        c.includes("engagement rate") ||
        c.includes("organic followers") ||
        c.includes("overview page views") ||
        c.includes("total page views") ||
        c.includes("unique visitors")
    );

  const hasLiPosts =
    joined.some((c) => c.includes("post title") || c === "post type") &&
    joined.some((c) => c === "impressions" || c === "likes");

  return (hasCampaign && hasMetric) || hasLiAds || hasLiOrganic || hasLiPosts;
}

function splitDelimitedLine(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((c) => c.replace(/^"|"$/g, "").trim());
  }
  // crude CSV split
  return line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
}

function aoaToObjects(aoa: unknown[][]): Record<string, string>[] {
  if (!aoa.length) return [];

  let headerIdx = 0;
  for (let i = 0; i < Math.min(8, aoa.length); i++) {
    const cells = (aoa[i] || []).map((c) => String(c ?? "").trim());
    if (looksLikeHeaderRow(cells)) {
      headerIdx = i;
      break;
    }
  }

  const headers = (aoa[headerIdx] || []).map((c, i) => {
    const h = String(c ?? "").trim();
    return h || `Column_${i + 1}`;
  });

  const out: Record<string, string>[] = [];
  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const obj: Record<string, string> = {};
    let any = false;
    for (let c = 0; c < headers.length; c++) {
      const val = row[c] == null ? "" : String(row[c]).trim();
      if (val) any = true;
      obj[headers[c]] = val;
    }
    if (any) out.push(obj);
  }
  return out;
}

function sheetToRows(sheet: XLSX.WorkSheet): Record<string, string>[] {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  return aoaToObjects(aoa);
}

/** Detect UTF-16 / UTF-8 and decode */
export async function readFileText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buf);
  }
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buf);
  }
  let nulls = 0;
  const sample = Math.min(400, u8.length);
  for (let i = 0; i < sample; i++) if (u8[i] === 0) nulls++;
  if (nulls > sample * 0.15) {
    return new TextDecoder("utf-16le").decode(buf);
  }
  return new TextDecoder("utf-8").decode(buf);
}

/** Strip Google / LinkedIn metadata preamble so the first line is headers */
export function stripExportPreamble(text: string): string {
  // Normalize BOM leftovers
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/);
  if (lines.length < 2) return cleaned;

  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const cells = splitDelimitedLine(lines[i]);
    if (looksLikeHeaderRow(cells) && i >= 0) {
      // LinkedIn often has headers at line 5 (0-indexed 5) after 5 meta rows
      return lines.slice(i).join("\n");
    }
  }
  return cleaned;
}

export async function parseUploadFile(file: File): Promise<ParsedSheet[]> {
  const name = file.name;
  const lower = name.toLowerCase();

  if (isInstagramHtmlFilename(name) || lower.endsWith(".html") || lower.endsWith(".htm")) {
    const html = await readFileText(file);
    const sheet = await parseInstagramHtml(name, html);
    if (!sheet.rows.length) {
      throw new Error(
        "HTML file produced no extractable metrics. Use Instagram Meta HTML exports (Profiles Reached, Content Interactions, Posts)."
      );
    }
    return [sheet];
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const workbook = XLSX.read(buf, { type: "array", cellDates: true });
    const sheets: ParsedSheet[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = sheetToRows(sheet);
      if (!rows.length) continue;
      sheets.push({ name: sheetName, rows });
    }
    if (!sheets.length) throw new Error("Excel workbook has no non-empty sheets.");
    return sheets;
  }

  const raw = await readFileText(file);
  const text = stripExportPreamble(raw);
  const delimiter = text.includes("\t") ? "\t" : undefined;

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      delimiter,
      complete: (results) => {
        if (!results.data?.length) {
          reject(new Error("File appears to be empty."));
          return;
        }
        const base = name.replace(/\.(csv|tsv|txt)$/i, "");
        resolve([
          {
            name: base,
            rows: results.data as Record<string, string>[],
          },
        ]);
      },
      error: (err: Error) => reject(err),
    });
  });
}

export function isAcceptedUploadName(filename: string): boolean {
  return /\.(csv|tsv|txt|xlsx|xls|html|htm)$/i.test(filename);
}
