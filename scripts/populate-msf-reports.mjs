/**
 * Ingest MSF (Munich Startup Festival) report CSVs into Data Hub
 * and assign them to project "MSF MVB & Digital".
 *
 * Usage: node scripts/populate-msf-reports.mjs
 */
import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const Papa = require("papaparse");

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const PROJECT_ID = "d3261454-7835-473e-bbe3-4ee76a4cf5ee";
const OS = "/Users/alihashemi/Desktop/WIDE/WIDE Ops/App stuff/Marketing Data OS";
const GSC = `${OS}/https___festival.munich-startup.de_-Performance-on-Search-2026-08-19`;

const FILES = [
  { path: `${GSC}/Chart.csv`, name: "GSC · Dates", category: "SEO", subcategory: "gsc_dates" },
  { path: `${GSC}/Queries.csv`, name: "GSC · Queries", category: "SEO", subcategory: "gsc_queries" },
  { path: `${GSC}/Pages.csv`, name: "GSC · Pages", category: "SEO", subcategory: "gsc_pages" },
  { path: `${GSC}/Countries.csv`, name: "GSC · Countries", category: "SEO", subcategory: "gsc_countries" },
  { path: `${GSC}/Devices.csv`, name: "GSC · Devices", category: "SEO", subcategory: "gsc_devices" },
  {
    path: `${GSC}/Search appearance.csv`,
    name: "GSC · Search appearance",
    category: "SEO",
    subcategory: "gsc_search_appearance",
  },
  { path: `${OS}/GA MSF.csv`, name: "GA4 · Session source", category: "Website", subcategory: "ga4" },
  {
    path: `${OS}/Acquisition_overview.csv`,
    name: "GA4 · Acquisition overview (weekly)",
    category: "Website",
    subcategory: null,
  },
  {
    path: `${OS}/download (7).csv`,
    name: "GA4 · First user channel group",
    category: "Website",
    subcategory: null,
  },
  {
    path: `${OS}/Munich-Startup-Campaigns-Apr-1-2026-Aug-19-2026.csv`,
    name: "Meta · Campaigns",
    category: "Ads",
    subcategory: "meta_ads",
  },
  {
    path: `${OS}/Munich-Startup-Ad-sets-Apr-1-2026-Aug-19-2026.csv`,
    name: "Meta · Ad sets",
    category: "Ads",
    subcategory: "meta_ads",
  },
  {
    path: `${OS}/Munich-Startup-Ads-Apr-1-2026-Aug-19-2026.csv`,
    name: "Meta · Ads",
    category: "Ads",
    subcategory: "meta_ads",
  },
  {
    path: `${OS}/Campaign performance.csv`,
    name: "Google Ads · Campaigns",
    category: "Ads",
    subcategory: "google_ads",
  },
  {
    path: `${OS}/campaign_806305163_creative_performance_report (1).csv`,
    name: "LinkedIn Ads · Creatives",
    category: "Ads",
    subcategory: "linkedin_ads",
  },
];

function loadEnvLocal() {
  const raw = readFileSync(resolve(root, ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL or service role key");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function decodeFileText(buf) {
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
  if (nulls > sample * 0.15) return new TextDecoder("utf-16le").decode(buf);
  return new TextDecoder("utf-8").decode(buf);
}

function looksLikeHeader(cells) {
  const joined = cells.map((c) => String(c).toLowerCase().trim()).filter(Boolean);
  if (joined.length < 2) return false;
  const blob = joined.join(" | ");
  return [
    "campaign",
    "ad name",
    "ad set",
    "amount spent",
    "impressions",
    "clicks",
    "sessions",
    "sessionsource",
    "session source",
    "top queries",
    "top pages",
    "search appearance",
    "total spent",
    "start date",
    "nth week",
    "first user primary channel",
    "reporting starts",
    "campaign type",
  ].some((k) => blob.includes(k));
}

function splitLine(line) {
  if (line.includes("\t")) return line.split("\t").map((c) => c.replace(/^"|"$/g, "").trim());
  return line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
}

function stripPreamble(text) {
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((line) => {
    const t = line.trim();
    return t.length > 0 && !t.startsWith("#");
  });
  let start = 0;
  for (let i = 0; i < Math.min(12, lines.length); i++) {
    if (looksLikeHeader(splitLine(lines[i]))) {
      start = i;
      break;
    }
  }
  return lines.slice(start).join("\n");
}

function parseCsvFile(filePath) {
  const buf = readFileSync(filePath);
  const text = stripPreamble(decodeFileText(buf));
  const delimiter = text.includes("\t") ? "\t" : undefined;
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter });
  const rows = (parsed.data || [])
    .map((row) => {
      const next = {};
      for (const [k, v] of Object.entries(row)) {
        const key = String(k || "").trim();
        if (!key || key.startsWith("_")) continue;
        next[key] = v == null ? "" : String(v).trim();
      }
      return next;
    })
    .filter((row) => {
      const vals = Object.values(row).filter(Boolean);
      if (!vals.length) return false;
      const first = String(vals[0] || "").toLowerCase();
      if (first === "total" || first === "totals" || first === "grand total") return false;
      if (Object.values(row).some((v) => String(v).toLowerCase() === "grand total")) return false;
      return true;
    });
  return rows;
}

function columnsFromRows(rows) {
  const keys = [];
  const seen = new Set();
  for (const row of rows.slice(0, 80)) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys.map((key) => {
    const samples = rows
      .map((r) => r[key])
      .filter((v) => v != null && v !== "")
      .slice(0, 5)
      .map(String);
    const k = key.toLowerCase();
    let type = "text";
    if (k.includes("date") || k === "day" || k.includes("reporting starts")) type = "date";
    else if (k.includes("ctr") || k.includes("rate") || k.includes("%")) type = "percentage";
    else if (k.includes("spent") || k.includes("cost") || k.includes("cpc") || k.includes("cpm"))
      type = "currency";
    else if (samples.length && samples.every((s) => /^-?[\d,.]+%?$/.test(s.replace(/\s/g, ""))))
      type = "number";
    return {
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      type,
      sampleValues: samples.slice(0, 3),
      uniqueCount: new Set(rows.map((r) => String(r[key] ?? ""))).size,
      fillRate: rows.length ? samples.length / Math.min(rows.length, 5) : 0,
      ignored: false,
    };
  });
}

async function writeDataset(sb, { name, category, subcategory, rows }) {
  if (!rows.length) {
    console.log("  skip empty", name);
    return null;
  }
  const columns = columnsFromRows(rows);
  const { data: ds, error } = await sb
    .from("datasets")
    .insert({
      project_id: PROJECT_ID,
      name,
      category,
      subcategory,
      columns,
      row_count: rows.length,
      file_size_bytes: 0,
      is_current: true,
      source_type: "upload",
      synced_at: new Date().toISOString(),
      external_account_label: "MSF import Aug 2026",
    })
    .select("id")
    .single();
  if (error) throw new Error(`${name}: ${error.message}`);

  let priorQ = sb
    .from("datasets")
    .select("id")
    .eq("project_id", PROJECT_ID)
    .eq("name", name)
    .eq("is_current", true)
    .neq("id", ds.id);
  if (subcategory) priorQ = priorQ.eq("subcategory", subcategory);
  else priorQ = priorQ.is("subcategory", null);
  const { data: priors } = await priorQ;
  const priorIds = (priors || []).map((p) => p.id);
  if (priorIds.length) {
    await sb.from("datasets").update({ is_current: false }).in("id", priorIds);
    await sb.from("datasets").update({ supersedes_id: priorIds[0] }).eq("id", ds.id);
  }

  const CHUNK = 400;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((row, idx) => ({
      dataset_id: ds.id,
      row_index: i + idx,
      row_data: row,
    }));
    const { error: rowErr } = await sb.from("dataset_rows").insert(chunk);
    if (rowErr) throw new Error(`${name} rows: ${rowErr.message}`);
  }
  console.log(`  ${category}/${subcategory || "untagged"} · ${rows.length} rows · ${name}`);
  return ds.id;
}

async function main() {
  loadEnvLocal();
  const sb = admin();
  const { data: project, error } = await sb
    .from("projects")
    .select("id, title")
    .eq("id", PROJECT_ID)
    .maybeSingle();
  if (error || !project) throw new Error("MSF project not found");
  console.log(`Assigning datasets to ${project.title} (${PROJECT_ID})`);

  for (const file of FILES) {
    if (!existsSync(file.path)) {
      console.log("  MISSING", file.path);
      continue;
    }
    const rows = parseCsvFile(file.path);
    await writeDataset(sb, { ...file, rows });
  }

  const { data: ds } = await sb
    .from("datasets")
    .select("name, category, subcategory, row_count, is_current")
    .eq("project_id", PROJECT_ID)
    .eq("is_current", true)
    .order("category")
    .order("name");
  console.log("\nCurrent MSF datasets:");
  for (const d of ds || []) {
    console.log(`  ${d.category.padEnd(8)} ${(d.subcategory || "-").padEnd(22)} ${String(d.row_count).padStart(5)}  ${d.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
