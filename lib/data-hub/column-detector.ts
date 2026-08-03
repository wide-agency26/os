/**
 * Column Detection Engine for the WIDE Data Hub
 *
 * Analyzes CSV rows and auto-detects column types:
 *   date, number, percentage, currency, category, text, empty
 */

export type ColumnType =
  | "date"
  | "number"
  | "percentage"
  | "currency"
  | "category"
  | "text"
  | "empty";

export interface ColumnSchema {
  key: string;           // original CSV header
  label: string;         // cleaned display name
  type: ColumnType;      // detected type
  sampleValues: string[];// up to 5 unique non-empty samples
  uniqueCount: number;   // distinct value count
  fillRate: number;      // 0–1, fraction of non-empty rows
  min?: number;          // for numeric columns
  max?: number;          // for numeric columns
  ignored: boolean;      // user can toggle this off
}

export interface DetectionResult {
  columns: ColumnSchema[];
  rows: Record<string, string>[];
  totalRows: number;
  duplicateCount: number;
}

// ── Date patterns ──────────────────────────────────────────────────
const DATE_PATTERNS = [
  /^\d{4}-\d{1,2}-\d{1,2}$/,                    // 2024-1-15
  /^\d{4}-\d{1,2}-\d{1,2}[T\s]\d{1,2}:\d{2}/,   // 2024-01-15 15:30:00
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,                // 1/15/2024 or 1/15/24
  /^\d{1,2}\.\d{1,2}\.\d{2,4}$/,                // 15.1.2024
  /^\d{1,2}\s\w{3,9}\s\d{2,4}$/,                // 15 January 2024
  /^\w{3,9}\s\d{1,2},?\s\d{2,4}$/,              // January 15, 2024
  /^\d{4}\/\d{1,2}\/\d{1,2}$/,                  // 2024/01/15
];

function looksLikeDate(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return DATE_PATTERNS.some((p) => p.test(trimmed));
}

// ── Currency detection ─────────────────────────────────────────────
const CURRENCY_REGEX = /^[$€£¥₹]\s?[\d,.]+$|^[\d,.]+\s?[$€£¥₹]$/;

function looksLikeCurrency(value: string): boolean {
  return CURRENCY_REGEX.test(value.trim());
}

// ── Percentage detection ───────────────────────────────────────────
function looksLikePercentage(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) return true;
  // Values like 0.45 that might be percentages — only if ALL values in column are 0–1
  return false;
}

// ── Number detection ───────────────────────────────────────────────
function looksLikeNumber(value: string): boolean {
  const trimmed = value.trim().replace(/,/g, "").replace(/[$€£¥₹%]/g, "").replace(/\s/g, "");
  if (!trimmed) return false;
  return !isNaN(Number(trimmed)) && trimmed !== "";
}

// ── Clean a header name into a readable label ──────────────────────
function cleanLabel(header: string): string {
  return header
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ── Extract numeric value from a string ────────────────────────────
function extractNumber(value: string): number | null {
  const cleaned = value.trim().replace(/,/g, "").replace(/[$€£¥₹%]/g, "").replace(/\s/g, "");
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

// ═══════════════════════════════════════════════════════════════════
// Main detection function
// ═══════════════════════════════════════════════════════════════════
export function detectColumns(rows: Record<string, string>[]): DetectionResult {
  if (!rows || rows.length === 0) {
    return { columns: [], rows: [], totalRows: 0, duplicateCount: 0 };
  }

  const headers = Object.keys(rows[0]);
  const totalRows = rows.length;

  // Sample up to 200 rows for detection
  const sampleSize = Math.min(totalRows, 200);
  const sampleRows = rows.slice(0, sampleSize);

  const columns: ColumnSchema[] = headers.map((key) => {
    const values = sampleRows.map((r) => (r[key] ?? "").toString().trim());
    const nonEmpty = values.filter((v) => v !== "");
    const fillRate = nonEmpty.length / sampleSize;

    // Gather unique values and samples
    const uniqueSet = new Set(nonEmpty);
    const uniqueCount = uniqueSet.size;
    const sampleValues = Array.from(uniqueSet).slice(0, 5);

    // Empty column?
    if (fillRate < 0.2) {
      return {
        key,
        label: cleanLabel(key),
        type: "empty" as ColumnType,
        sampleValues,
        uniqueCount,
        fillRate,
        ignored: true,
      };
    }

    // Type detection: check what fraction of non-empty values match each type
    let dateCount = 0;
    let numberCount = 0;
    let percentCount = 0;
    let currencyCount = 0;

    for (const v of nonEmpty) {
      if (looksLikeDate(v)) dateCount++;
      if (looksLikePercentage(v)) percentCount++;
      if (looksLikeCurrency(v)) currencyCount++;
      if (looksLikeNumber(v)) numberCount++;
    }

    const threshold = 0.8; // 80% of non-empty values must match

    let detectedType: ColumnType = "text";

    if (dateCount / nonEmpty.length >= threshold) {
      detectedType = "date";
    } else if (percentCount / nonEmpty.length >= threshold) {
      detectedType = "percentage";
    } else if (currencyCount / nonEmpty.length >= threshold) {
      detectedType = "currency";
    } else if (numberCount / nonEmpty.length >= threshold) {
      detectedType = "number";
    } else if (uniqueCount <= 25 && uniqueCount < totalRows * 0.5) {
      detectedType = "category";
    }

    // Compute min/max for numeric-ish columns
    let min: number | undefined;
    let max: number | undefined;
    if (["number", "percentage", "currency"].includes(detectedType)) {
      const nums = nonEmpty.map(extractNumber).filter((n): n is number => n !== null);
      if (nums.length > 0) {
        min = Math.min(...nums);
        max = Math.max(...nums);
      }
    }

    return {
      key,
      label: cleanLabel(key),
      type: detectedType,
      sampleValues,
      uniqueCount,
      fillRate,
      min,
      max,
      ignored: false,
    };
  });

  // Duplicate detection: create fingerprint from non-ignored text/category/date columns
  const fingerprints = new Set<string>();
  let duplicateCount = 0;
  for (const row of rows) {
    const fp = columns
      .filter((c) => !c.ignored && ["text", "category", "date"].includes(c.type))
      .map((c) => (row[c.key] ?? "").trim().toLowerCase())
      .join("|");
    if (fingerprints.has(fp)) {
      duplicateCount++;
    } else {
      fingerprints.add(fp);
    }
  }

  return {
    columns,
    rows,
    totalRows,
    duplicateCount,
  };
}

// ── Type badge helpers ─────────────────────────────────────────────
export const TYPE_BADGES: Record<ColumnType, { emoji: string; label: string; color: string }> = {
  date:       { emoji: "📅", label: "Date",       color: "bg-blue-100 text-blue-700" },
  number:     { emoji: "🔢", label: "Number",     color: "bg-emerald-100 text-emerald-700" },
  percentage: { emoji: "📊", label: "Percent",    color: "bg-violet-100 text-violet-700" },
  currency:   { emoji: "💰", label: "Currency",   color: "bg-amber-100 text-amber-700" },
  category:   { emoji: "🏷️", label: "Category",  color: "bg-orange-100 text-orange-700" },
  text:       { emoji: "📝", label: "Text",       color: "bg-gray-100 text-gray-700" },
  empty:      { emoji: "⬜", label: "Empty",      color: "bg-red-100 text-red-600" },
};
