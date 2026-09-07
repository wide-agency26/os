/**
 * When a partial platform export supersedes a longer prior current, merge rows
 * by stable key so history (e.g. June LinkedIn) is not lost.
 * New rows win on key collision.
 */

const MERGE_BY_KEY = new Set([
  "linkedin_metrics",
  "linkedin_followers",
  "linkedin_visitors",
  "linkedin_posts",
  "instagram_posts",
  "gsc_dates",
  "ga4",
  "youtube_chart",
]);

function normDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

function firstDateKey(row: Record<string, unknown>): string | null {
  for (const k of Object.keys(row)) {
    if (!/date|day|time|created|publish/i.test(k)) continue;
    const iso = normDate(row[k]);
    if (iso) return iso;
  }
  return null;
}

/** Stable merge key for a dataset row; null = do not merge this row. */
export function rowMergeKey(
  subcategory: string,
  row: Record<string, unknown>
): string | null {
  if (!MERGE_BY_KEY.has(subcategory)) return null;

  if (subcategory === "linkedin_posts") {
    const url = row["Post URL"] || row["Post url"] || row.post_url;
    if (url) return `url:${String(url).trim()}`;
    const created = normDate(
      row["Created date"] || row["Created Date"] || row["Publish date"]
    );
    const title = String(row["Post title"] || row["Post Title"] || "")
      .trim()
      .slice(0, 96);
    if (created && title) return `post:${created}:${title}`;
    if (created) return `post:${created}`;
    return null;
  }

  if (subcategory === "instagram_posts") {
    const id = row.media_id || row.mediaId;
    if (id) return `ig:${id}`;
    const created = normDate(row.created_at || row.created_label);
    const cap = String(row.caption || "").trim().slice(0, 64);
    if (created && cap) return `ig:${created}:${cap}`;
    return null;
  }

  const d = firstDateKey(row);
  if (d) return `d:${d}`;

  return null;
}

export function shouldMergeSubcategory(subcategory: string): boolean {
  return MERGE_BY_KEY.has(subcategory);
}

export function mergeDatasetRows(
  subcategory: string,
  newRows: Record<string, unknown>[],
  priorRows: Record<string, unknown>[]
): { rows: Record<string, unknown>[]; addedFromPrior: number; replaced: number } {
  if (!shouldMergeSubcategory(subcategory) || !priorRows.length) {
    return { rows: newRows, addedFromPrior: 0, replaced: 0 };
  }

  const map = new Map<string, Record<string, unknown>>();
  let addedFromPrior = 0;
  let replaced = 0;

  for (const row of priorRows) {
    const key = rowMergeKey(subcategory, row);
    if (key) map.set(key, { ...row });
  }

  for (const row of newRows) {
    const key = rowMergeKey(subcategory, row);
    if (!key) continue;
    if (map.has(key)) replaced += 1;
    map.set(key, { ...row });
  }

  if (map.size === 0) {
    return { rows: newRows, addedFromPrior: 0, replaced: 0 };
  }

  addedFromPrior = Math.max(0, map.size - newRows.length + replaced);

  const rows = [...map.values()].sort((a, b) => {
    const da = firstDateKey(a) || "";
    const db = firstDateKey(b) || "";
    if (da && db) return da.localeCompare(db);
    return 0;
  });

  return { rows, addedFromPrior, replaced };
}
