/**
 * Repair Sign2x currents by merging all retired dataset versions into current
 * (restores June LinkedIn and other history lost on partial supersede).
 *
 * Usage: node scripts/repair-sign2x-dataset-merge.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const PROJECT_ID = "96468999-a1df-4393-9a5a-6b1cd5b970ae";

const MERGE = new Set([
  "linkedin_metrics",
  "linkedin_followers",
  "linkedin_visitors",
  "linkedin_posts",
  "instagram_posts",
  "gsc_dates",
  "ga4",
  "youtube_chart",
]);

function loadEnvLocal() {
  const raw = readFileSync(resolve(root, ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function admin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normDate(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

function firstDateKey(row) {
  for (const k of Object.keys(row)) {
    if (!/date|day|time|created|publish/i.test(k)) continue;
    const iso = normDate(row[k]);
    if (iso) return iso;
  }
  return null;
}

function rowKey(subcategory, row) {
  if (subcategory === "linkedin_posts") {
    const url = row["Post URL"] || row["Post url"];
    if (url) return `url:${String(url).trim()}`;
    const created = normDate(row["Created date"] || row["Created Date"]);
    const title = String(row["Post title"] || row["Post Title"] || "")
      .trim()
      .slice(0, 96);
    if (created && title) return `post:${created}:${title}`;
    if (created) return `post:${created}`;
    return null;
  }
  if (subcategory === "instagram_posts") {
    const id = row.media_id;
    if (id) return `ig:${id}`;
    const created = normDate(row.created_at);
    const cap = String(row.caption || "").trim().slice(0, 64);
    if (created && cap) return `ig:${created}:${cap}`;
    return null;
  }
  const d = firstDateKey(row);
  return d ? `d:${d}` : null;
}

function mergeRows(subcategory, newRows, priorRows) {
  if (!MERGE.has(subcategory) || !priorRows.length) return newRows;
  const map = new Map();
  for (const row of priorRows) {
    const key = rowKey(subcategory, row);
    if (key) map.set(key, { ...row });
  }
  for (const row of newRows) {
    const key = rowKey(subcategory, row);
    if (key) map.set(key, { ...row });
  }
  if (!map.size) return newRows;
  return [...map.values()].sort((a, b) => {
    const da = firstDateKey(a) || "";
    const db = firstDateKey(b) || "";
    return da.localeCompare(db);
  });
}

function columnsFromRows(rows) {
  const keys = [];
  const seen = new Set();
  for (const row of rows.slice(0, 50)) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys.map((key) => ({
    key,
    label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    type: /date|time|created/i.test(key) ? "date" : "text",
    sampleValues: [],
    uniqueCount: 0,
    fillRate: 1,
    ignored: false,
  }));
}

async function fetchRows(sb, datasetId) {
  const { data } = await sb
    .from("dataset_rows")
    .select("row_data")
    .eq("dataset_id", datasetId)
    .order("row_index");
  return (data || []).map((r) => r.row_data);
}

async function repairStream(sb, currentDs) {
  const { subcategory, name, id: currentId, row_count: beforeCount } = currentDs;
  if (!MERGE.has(subcategory)) return null;

  const { data: retired } = await sb
    .from("datasets")
    .select("id, created_at, row_count")
    .eq("project_id", PROJECT_ID)
    .eq("subcategory", subcategory)
    .eq("name", name)
    .eq("is_current", false)
    .order("created_at", { ascending: true });

  let priorAcc = [];
  for (const ds of retired || []) {
    const chunk = await fetchRows(sb, ds.id);
    priorAcc = mergeRows(subcategory, chunk, priorAcc);
  }

  const currentRows = await fetchRows(sb, currentId);
  const merged = mergeRows(subcategory, currentRows, priorAcc);
  if (merged.length <= beforeCount) {
    console.log(`  skip ${subcategory} (${beforeCount} rows, no gain)`);
    return null;
  }

  const minDate = merged.map(firstDateKey).filter(Boolean).sort()[0];
  const maxDate = merged.map(firstDateKey).filter(Boolean).sort().pop();

  const now = new Date().toISOString();
  const { data: ds, error } = await sb
    .from("datasets")
    .insert({
      project_id: PROJECT_ID,
      name,
      category: currentDs.category,
      subcategory,
      columns: columnsFromRows(merged),
      row_count: merged.length,
      file_size_bytes: 0,
      is_current: true,
      source_type: "upload",
      synced_at: now,
      sync_window_start: minDate || currentDs.sync_window_start,
      sync_window_end: maxDate || currentDs.sync_window_end,
      external_account_label: "Sign2x merge repair 2026-08-26",
    })
    .select("id")
    .single();
  if (error) throw new Error(`${name}: ${error.message}`);

  await sb.from("datasets").update({ is_current: false }).eq("id", currentId);
  await sb.from("datasets").update({ supersedes_id: currentId }).eq("id", ds.id);

  const CHUNK = 400;
  for (let i = 0; i < merged.length; i += CHUNK) {
    const chunk = merged.slice(i, i + CHUNK).map((row, idx) => ({
      dataset_id: ds.id,
      row_index: i + idx,
      row_data: row,
    }));
    const { error: rowErr } = await sb
      .from("dataset_rows")
      .upsert(chunk, { onConflict: "dataset_id, row_index" });
    if (rowErr) throw new Error(rowErr.message);
  }

  console.log(
    `  FIXED ${subcategory}: ${beforeCount} → ${merged.length} rows (${minDate || "?"} … ${maxDate || "?"})`
  );
  return { subcategory, before: beforeCount, after: merged.length, minDate, maxDate };
}

async function main() {
  loadEnvLocal();
  const sb = admin();
  console.log("Repair Sign2x dataset merge for", PROJECT_ID);

  const { data: currents } = await sb
    .from("datasets")
    .select("id, name, category, subcategory, row_count, sync_window_start, sync_window_end")
    .eq("project_id", PROJECT_ID)
    .eq("is_current", true)
    .order("subcategory");

  const results = [];
  for (const ds of currents || []) {
    const r = await repairStream(sb, ds);
    if (r) results.push(r);
  }

  console.log("\n=== Summary ===");
  if (!results.length) {
    console.log("No streams needed repair.");
  } else {
    for (const r of results) {
      console.log(
        `${r.subcategory}: ${r.before} → ${r.after} (${r.minDate} … ${r.maxDate})`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
