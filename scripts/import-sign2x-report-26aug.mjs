/**
 * Import Sign2x raw report files (through 26 Aug 2026) into datasets with
 * versioned supersede — no duplicate currents.
 *
 * Usage:
 *   node scripts/import-sign2x-report-26aug.mjs
 */
import { createRequire } from "module";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire as cr } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const PROJECT_ID = "96468999-a1df-4393-9a5a-6b1cd5b970ae";
const RAW = resolve(
  root,
  "temp/report data upload/Sign2x 26 Aug - raw report files"
);
const WINDOW_END = "2026-08-26";
const WINDOW_START = "2026-05-28";

const FILES = {
  liContent: join(RAW, "sign2x_content_1787758948596.xls"),
  liFollowers: join(RAW, "sign2x_followers_1787759797772.xls"),
  liVisitors: join(RAW, "sign2x_visitors_1787759794147.xls"),
  ga: join(RAW, "Sign2x Marketing Data - Web - GA - import.csv"),
  gaAcq: join(
    RAW,
    "User_acquisition_First_user_primary_channel_group_(Default_channel_group).csv"
  ),
  gsc: join(RAW, "sign2x.com-Performance-on-Search-2026-08-26.xlsx"),
  ytTable: join(
    RAW,
    "Content 2026-05-28_2026-08-26 Sign2x/Table data.csv"
  ),
  ytChart: join(
    RAW,
    "Content 2026-05-28_2026-08-26 Sign2x/Chart data.csv"
  ),
  ytTotals: join(
    RAW,
    "Content 2026-05-28_2026-08-26 Sign2x/Totals.csv"
  ),
  igInsights: join(
    RAW,
    "instagram-sign2x.de-2026-08-26-7zRPpjK9/logged_information/past_instagram_insights"
  ),
};

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
  if (!url || !key) throw new Error("Missing Supabase URL or service role key");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isoFromParts(y, m, d) {
  if (!y || !m || !d) return null;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function parseDate(value, order = "mdy") {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoFromParts(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate()
    );
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{8}$/.test(raw))
    return isoFromParts(raw.slice(0, 4), raw.slice(4, 6), raw.slice(6, 8));
  const slash = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    if (order === "dmy") return isoFromParts(y, b, a);
    return isoFromParts(y, a, b);
  }
  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) {
    return isoFromParts(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }
  return null;
}

function looksLikeHeader(cells) {
  const joined = cells.map((c) => String(c).toLowerCase().trim()).filter(Boolean);
  if (joined.length < 2) return false;
  return joined.some((c) =>
    [
      "date",
      "campaign",
      "post title",
      "impressions",
      "clicks",
      "views",
      "sessions",
      "top queries",
      "top pages",
      "query",
      "page",
      "country",
      "device",
      "location",
      "seniority",
      "industry",
      "job function",
      "company size",
      "video title",
      "content",
      "sessionsource",
      "activeusers",
      "search appearance",
      "ctr",
      "position",
    ].some((k) => c === k || c.includes(k))
  );
}

function aoaToObjects(aoa) {
  if (!aoa.length) return [];
  let headerIdx = 0;
  for (let i = 0; i < Math.min(12, aoa.length); i++) {
    const cells = (aoa[i] || []).map((c) => String(c ?? "").trim());
    if (looksLikeHeader(cells)) {
      headerIdx = i;
      break;
    }
  }
  const headers = (aoa[headerIdx] || []).map(
    (c, i) => String(c ?? "").trim() || `Column_${i + 1}`
  );
  const out = [];
  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const obj = {};
    let any = false;
    for (let c = 0; c < headers.length; c++) {
      let val = row[c];
      if (val instanceof Date) val = parseDate(val) || "";
      else val = val == null ? "" : String(val).trim();
      if (val) any = true;
      obj[headers[c]] = val;
    }
    if (any) out.push(obj);
  }
  return out;
}

function sheetRows(file, sheetName) {
  if (!existsSync(file)) {
    console.warn("missing file", file);
    return [];
  }
  const wb = XLSX.readFile(file, { cellDates: true });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    console.warn("missing sheet", sheetName, "in", file, "have", wb.SheetNames);
    return [];
  }
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  return aoaToObjects(aoa);
}

function listSheets(file) {
  if (!existsSync(file)) return [];
  return XLSX.readFile(file, { cellDates: true }).SheetNames;
}

function csvRows(file) {
  if (!existsSync(file)) {
    console.warn("missing csv", file);
    return [];
  }
  const wb = XLSX.readFile(file, { cellDates: true });
  const name = wb.SheetNames[0];
  return sheetRows(file, name);
}

function normalizeRowDates(rows, order = "mdy") {
  return rows.map((row) => {
    const next = { ...row };
    for (const [k, v] of Object.entries(next)) {
      if (!/date|time|posted|created|publish/i.test(k)) continue;
      const iso = parseDate(v, order);
      if (iso) next[k] = iso;
    }
    // GA YYYYMMDD
    if (next.date && /^\d{8}$/.test(String(next.date))) {
      next.date = parseDate(next.date);
    }
    return next;
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
  return keys.map((key) => {
    const samples = rows
      .map((r) => r[key])
      .filter((v) => v != null && v !== "")
      .slice(0, 5)
      .map(String);
    const k = key.toLowerCase();
    let type = "text";
    if (k.includes("date") || k === "created_at") type = "date";
    else if (
      /impressions|clicks|views|sessions|users|likes|shares|saves|reached|position|ctr|rate|spend|cost|followers|engaged|interactions|visits|taps/i.test(
        k
      )
    )
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

async function loadPriorRows(sb, projectId, name, subcategory) {
  const { data: retired } = await sb
    .from("datasets")
    .select("id, created_at")
    .eq("project_id", projectId)
    .eq("subcategory", subcategory)
    .eq("name", name)
    .eq("is_current", false)
    .order("created_at", { ascending: true });

  let accumulated = [];
  for (const ds of retired || []) {
    const { data: rows } = await sb
      .from("dataset_rows")
      .select("row_data")
      .eq("dataset_id", ds.id)
      .order("row_index");
    const chunk = (rows || []).map((r) => r.row_data);
    if (!chunk.length) continue;
    accumulated = mergeRowsForStream(subcategory, chunk, accumulated).rows;
  }
  return accumulated;
}

function mergeRowsForStream(subcategory, newRows, priorRows) {
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
  if (!MERGE.has(subcategory) || !priorRows.length) return { rows: newRows, added: 0 };

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

  function rowKey(row) {
    if (subcategory === "linkedin_posts") {
      const url = row["Post URL"] || row["Post url"];
      if (url) return `url:${String(url).trim()}`;
      const created = normDate(row["Created date"] || row["Created Date"]);
      const title = String(row["Post title"] || row["Post Title"] || "").trim().slice(0, 96);
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

  const map = new Map();
  for (const row of priorRows) {
    const key = rowKey(row);
    if (key) map.set(key, { ...row });
  }
  const before = map.size;
  for (const row of newRows) {
    const key = rowKey(row);
    if (key) map.set(key, { ...row });
  }
  if (!map.size) return { rows: newRows, added: 0 };
  const merged = [...map.values()].sort((a, b) => {
    const da = firstDateKey(a) || "";
    const db = firstDateKey(b) || "";
    return da.localeCompare(db);
  });
  const added = Math.max(0, merged.length - newRows.length);
  return { rows: merged, added, priorBefore: before };
}

async function writeDataset(sb, { name, category, subcategory, rows }) {
  if (!rows.length) {
    console.log("  SKIP empty", name, subcategory);
    return null;
  }

  const priorRows = await loadPriorRows(sb, PROJECT_ID, name, subcategory);
  const { rows: mergedRows, added, priorBefore } = mergeRowsForStream(
    subcategory,
    rows,
    priorRows
  );
  if (added > 0) {
    console.log(
      `  MERGE ${subcategory}: +${added} prior rows (${priorRows.length} prior → ${mergedRows.length} total)`
    );
  }
  rows = mergedRows;

  const columns = columnsFromRows(rows);
  const now = new Date().toISOString();
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
      synced_at: now,
      sync_window_start: WINDOW_START,
      sync_window_end: WINDOW_END,
      external_account_label: "Sign2x raw upload 2026-08-26",
    })
    .select("id")
    .single();
  if (error) throw new Error(`${name}: ${error.message}`);

  const { data: priors } = await sb
    .from("datasets")
    .select("id")
    .eq("project_id", PROJECT_ID)
    .eq("subcategory", subcategory)
    .eq("name", name)
    .eq("is_current", true)
    .neq("id", ds.id);
  const priorIds = (priors || []).map((p) => p.id);
  if (priorIds.length) {
    await sb.from("datasets").update({ is_current: false }).in("id", priorIds);
    await sb
      .from("datasets")
      .update({ supersedes_id: priorIds[0] })
      .eq("id", ds.id);
  }

  const CHUNK = 400;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((row, idx) => ({
      dataset_id: ds.id,
      row_index: i + idx,
      row_data: row,
    }));
    const { error: rowErr } = await sb
      .from("dataset_rows")
      .upsert(chunk, { onConflict: "dataset_id, row_index" });
    if (rowErr) throw new Error(`${name} rows: ${rowErr.message}`);
  }
  console.log(`  OK ${subcategory} · ${rows.length} rows · ${name}`);
  return ds.id;
}

/* ---- Instagram JSON (same shapes as lib/data-hub/parse-instagram-export-json) ---- */

function smd(entry) {
  const map = entry?.string_map_data || {};
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = v?.value ?? "";
    if (v?.timestamp) out[`__ts_${k}`] = v.timestamp;
  }
  return out;
}
function parseNum(raw) {
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (!s || s === "--" || s === "—") return 0;
  const n = parseFloat(s.replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function parsePct(raw) {
  if (raw == null) return 0;
  const m = String(raw).match(/([\d.,]+)\s*%/);
  return m ? parseNum(m[1]) : parseNum(raw);
}
function parseEngagedSplit(raw) {
  const s = String(raw || "");
  const f = s.match(/Followers:\s*([\d.,]+)%/i);
  const n = s.match(/Non-followers:\s*([\d.,]+)%/i);
  return {
    engagedFollowersPct: f ? parseNum(f[1]) : 0,
    engagedNonFollowersPct: n ? parseNum(n[1]) : 0,
  };
}
function fixText(s) {
  if (!s) return "";
  try {
    return Buffer.from(String(s), "latin1").toString("utf8").trim();
  } catch {
    return String(s).trim();
  }
}
function mediaIdFromUri(uri) {
  if (!uri) return "";
  const base = String(uri).split("/").pop() || "";
  return base.replace(/\.[^.]+$/, "");
}
function isoFromTs(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Date(n * 1000).toISOString();
}
function readInsight(dir, name) {
  const p = join(dir, name);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

async function loadExistingThumbs(sb) {
  const thumbs = new Map();
  const { data: ds } = await sb
    .from("datasets")
    .select("id")
    .eq("project_id", PROJECT_ID)
    .eq("subcategory", "instagram_posts")
    .eq("is_current", true)
    .maybeSingle();
  if (!ds?.id) return thumbs;
  const { data: rows } = await sb
    .from("dataset_rows")
    .select("row_data")
    .eq("dataset_id", ds.id);
  for (const r of rows || []) {
    const id = r.row_data?.media_id;
    const url = r.row_data?.thumbnail_url;
    if (id && url) thumbs.set(String(id), String(url));
  }
  return thumbs;
}

function buildIgDatasets(insightsDir, thumbs) {
  const reach = readInsight(insightsDir, "profiles_reached.json")
    ?.organic_insights_reach?.[0];
  const interactions = readInsight(insightsDir, "content_interactions.json")
    ?.organic_insights_interactions?.[0];
  const audience = readInsight(insightsDir, "audience_insights.json")
    ?.organic_insights_audience?.[0];
  const insightPosts =
    readInsight(insightsDir, "posts.json")?.organic_insights_posts || [];

  const R = smd(reach);
  const I = smd(interactions);
  const A = smd(audience);
  const engaged = parseEngagedSplit(I["Engaged Account By Follow Type"]);
  const periodRaw = R["Date Range"] || I["Date Range"] || A["Date Range"] || "";
  const period = periodRaw
    ? `${String(periodRaw).replace(/\s*-\s*/, " – ")} (2026)`
    : "2026-05-28 – 2026-08-26";

  const summary = [
    {
      period,
      accounts_reached: parseNum(R["Accounts Reached"]),
      impressions: parseNum(R.Impressions),
      profile_visits: parseNum(R["Profile visits"]),
      external_link_taps: parseNum(R["External link taps"]),
      content_interactions: parseNum(I["Content Interactions"]),
      accounts_engaged: parseNum(I["Accounts engaged"]),
      followers_pct: parsePct(R.Followers),
      non_followers_pct: parsePct(R["Non-Followers"]),
      engaged_followers_pct: engaged.engagedFollowersPct,
      engaged_non_followers_pct: engaged.engagedNonFollowersPct,
      post_interactions: parseNum(I["Post Interactions"]),
      reels_interactions: parseNum(I["Reels Interactions"]),
      story_interactions: parseNum(I["Story Interactions"]),
      post_likes: parseNum(I["Post Likes"]),
      post_shares: parseNum(I["Post Shares"]),
      post_saves: parseNum(I["Post Saves"]),
      reels_likes: parseNum(I["Reels Likes"]),
      reels_shares: parseNum(I["Reels Shares"]),
      followers: parseNum(A.Followers),
      source: "instagram-sign2x.de past_instagram_insights 2026-08-26",
    },
  ];

  const postRows = insightPosts.map((entry) => {
    const m = smd(entry);
    const thumb = entry.media_map_data?.["Media Thumbnail"] || {};
    const uri = thumb.uri || "";
    const id = mediaIdFromUri(uri);
    const ts = m["__ts_Creation Timestamp"] || thumb.creation_timestamp || 0;
    const created_at = isoFromTs(ts);
    return {
      _ig_kind: "post",
      media_id: id,
      caption: fixText(thumb.title || ""),
      created_at,
      created_label: created_at
        ? new Date(created_at).toLocaleString("de-DE")
        : "",
      thumbnail_url: thumbs.get(id) || "",
      post_url: "https://www.instagram.com/sign2x.de/",
      format: /\/reels\//i.test(uri)
        ? "reel"
        : /\/stories\//i.test(uri)
          ? "story"
          : "post",
      uri,
      accounts_reached: parseNum(m["Accounts reached"]),
      impressions: parseNum(m.Impressions),
      profile_visits: parseNum(m["Profile visits"]),
      follows: parseNum(m.Follows),
      saves: parseNum(m.Saves),
      likes: parseNum(m.Likes),
      comments: parseNum(m.Comments),
      shares: parseNum(m.Shares),
      external_link_taps: parseNum(
        m["External link taps"] || m["Link taps"] || m["Website taps"]
      ),
    };
  });
  postRows.sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );

  return [
    {
      name: "Instagram · Posts / Reels / Stories",
      category: "Social",
      subcategory: "instagram_posts",
      rows: postRows,
    },
    {
      name: "Instagram · Content mix",
      category: "Social",
      subcategory: "instagram_content_interactions",
      rows: summary,
    },
    {
      name: "Instagram · Organic summary",
      category: "Social",
      subcategory: "instagram_profiles_reached",
      rows: summary,
    },
    {
      name: "Instagram · Organic summary",
      category: "Social",
      subcategory: "instagram_organic",
      rows: summary,
    },
  ];
}

function pickSheet(file, candidates) {
  const names = listSheets(file);
  for (const c of candidates) {
    const hit = names.find((n) => n.toLowerCase() === c.toLowerCase());
    if (hit) return hit;
  }
  for (const c of candidates) {
    const hit = names.find((n) => n.toLowerCase().includes(c.toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

async function publishReports(sb) {
  const now = new Date().toISOString();
  for (const category of ["General", "Social", "Website", "SEO"]) {
    const { error } = await sb.from("published_reports").upsert(
      {
        project_id: PROJECT_ID,
        category,
        status: "published",
        published_at: now,
        updated_by: null,
        config: {
          version: "sign2x-26aug-import",
          saved_at: now,
          window_end: WINDOW_END,
        },
      },
      { onConflict: "project_id, category" }
    );
    if (error) throw new Error(`publish ${category}: ${error.message}`);
    console.log("  published", category);
  }
}

function num(v) {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function writeInsights(sb, aggregates) {
  await sb
    .from("project_ai_insights")
    .delete()
    .eq("project_id", PROJECT_ID)
    .in("source", ["ai", "import"]);

  const cards = [
    {
      category: "Social",
      title: "LinkedIn page engagement through 26 Aug",
      impact: aggregates.liImpressions > 0 ? "positive" : "attention",
      observation: `LinkedIn metrics stream refreshed through ${WINDOW_END}: ~${aggregates.liImpressions.toLocaleString()} total impressions and ~${aggregates.liEngagement.toLocaleString()} reactions across the window (superseding the 17 Aug snapshot).`,
      recommended_action:
        "Keep organic cadence; push high-reaction posts into Amplify and track follower demography shifts weekly.",
    },
    {
      category: "Social",
      title: "Instagram organic reach update",
      impact: aggregates.igReached > 500 ? "positive" : "medium",
      observation: `Instagram insights re-imported: ${aggregates.igReached.toLocaleString()} accounts reached, ${aggregates.igInteractions.toLocaleString()} content interactions, ${aggregates.igFollowers} followers (${aggregates.igPosts} posts with insights).`,
      recommended_action:
        "Double down on formats with highest reach/interaction ratio; keep stubs out of Live until creatives are ready.",
    },
    {
      category: "Website",
      title: "GA4 sessions by source extended to 26 Aug",
      impact: "medium",
      observation: `Website dataset now has ${aggregates.gaRows} daily source rows through ${WINDOW_END}. Direct + organic + social sources remain the primary acquisition mix.`,
      recommended_action:
        "Compare LinkedIn/IG referral spikes against content publish dates on the Website tab.",
    },
    {
      category: "SEO",
      title: "Search Console through 26 Aug",
      impact: aggregates.gscClicks > 0 ? "positive" : "attention",
      observation: `GSC Chart refreshed (${aggregates.gscDateRows} days): ~${aggregates.gscClicks.toLocaleString()} clicks / ~${aggregates.gscImpressions.toLocaleString()} impressions in the export window.`,
      recommended_action:
        "Prioritize queries with rising impressions but weak CTR on the SEO → Queries sheet.",
    },
    {
      category: "General",
      title: "Sign2x multi-channel refresh (26 Aug)",
      impact: "high",
      observation:
        "All live client tabs (Social, Website, SEO, General) republished from versioned dataset supersedes — no duplicate currents. Ads left draft (no ads export in this dump). YouTube Chart/Table replaced with the May 28–Aug 26 Studio export.",
      recommended_action:
        "Review /app/tools/reports for Sign2x end-to-end, then walk the client through Social → Website → SEO in that order.",
    },
  ];

  const rows = cards.map((c, i) => ({
    project_id: PROJECT_ID,
    category: c.category,
    title: c.title,
    impact: c.impact,
    observation: c.observation,
    recommended_action: c.recommended_action,
    pinned: i === 0,
    visible: true,
    source: "ai",
    sort_order: i,
    created_by: null,
  }));

  const { error } = await sb.from("project_ai_insights").insert(rows);
  if (error) throw new Error(`insights: ${error.message}`);
  console.log(`  insights ${rows.length} cards`);
}

async function main() {
  loadEnvLocal();
  const sb = admin();
  console.log("RAW root", RAW);
  if (!existsSync(RAW)) throw new Error("Raw folder missing: " + RAW);

  const aggregates = {
    liImpressions: 0,
    liEngagement: 0,
    igReached: 0,
    igInteractions: 0,
    igFollowers: 0,
    igPosts: 0,
    gaRows: 0,
    gscDateRows: 0,
    gscClicks: 0,
    gscImpressions: 0,
  };

  console.log("\n=== LinkedIn ===");
  console.log("content sheets", listSheets(FILES.liContent));
  console.log("followers sheets", listSheets(FILES.liFollowers));
  console.log("visitors sheets", listSheets(FILES.liVisitors));

  const liMetricsName = pickSheet(FILES.liContent, ["Metrics"]);
  const liPostsName = pickSheet(FILES.liContent, ["All posts", "Posts"]);
  const liFollowersName = pickSheet(FILES.liFollowers, ["New followers"]);
  const liVisitorsName = pickSheet(FILES.liVisitors, ["Visitor metrics"]);

  const liMetrics = normalizeRowDates(
    sheetRows(FILES.liContent, liMetricsName || "Metrics"),
    "mdy"
  );
  const liPosts = normalizeRowDates(
    sheetRows(FILES.liContent, liPostsName || "All posts"),
    "mdy"
  );
  const liFollowers = normalizeRowDates(
    sheetRows(FILES.liFollowers, liFollowersName || "New followers"),
    "mdy"
  );
  const liVisitors = normalizeRowDates(
    sheetRows(FILES.liVisitors, liVisitorsName || "Visitor metrics"),
    "mdy"
  );

  for (const r of liMetrics) {
    aggregates.liImpressions += num(
      r["Impressions (total)"] || r["Impressions (organic)"] || r.Impressions
    );
    aggregates.liEngagement += num(
      r["Reactions (total)"] || r["Reactions (organic)"] || r.Reactions
    );
  }

  await writeDataset(sb, {
    name: "LinkedIn · Metrics",
    category: "Social",
    subcategory: "linkedin_metrics",
    rows: liMetrics,
  });
  await writeDataset(sb, {
    name: "LinkedIn · All posts",
    category: "Social",
    subcategory: "linkedin_posts",
    rows: liPosts,
  });
  await writeDataset(sb, {
    name: "LinkedIn · New followers",
    category: "Social",
    subcategory: "linkedin_followers",
    rows: liFollowers,
  });
  await writeDataset(sb, {
    name: "LinkedIn · Visitor metrics",
    category: "Social",
    subcategory: "linkedin_visitors",
    rows: liVisitors,
  });

  const visitorDemos = [
    ["Location", "linkedin_demo_location", "LinkedIn · Visitor location"],
    [
      "Job function",
      "linkedin_demo_job_function",
      "LinkedIn · Visitor job function",
    ],
    ["Seniority", "linkedin_demo_seniority", "LinkedIn · Visitor seniority"],
    ["Industry", "linkedin_demo_industry", "LinkedIn · Visitor industry"],
    [
      "Company size",
      "linkedin_demo_company_size",
      "LinkedIn · Visitor company size",
    ],
  ];
  for (const [sheet, sub, name] of visitorDemos) {
    const sn = pickSheet(FILES.liVisitors, [sheet]);
    await writeDataset(sb, {
      name,
      category: "Social",
      subcategory: sub,
      rows: sheetRows(FILES.liVisitors, sn || sheet),
    });
  }
  const followerDemos = [
    [
      "Location",
      "linkedin_demo_follower_location",
      "LinkedIn · Follower location",
    ],
    [
      "Job function",
      "linkedin_demo_follower_job_function",
      "LinkedIn · Follower job function",
    ],
    [
      "Seniority",
      "linkedin_demo_follower_seniority",
      "LinkedIn · Follower seniority",
    ],
    [
      "Industry",
      "linkedin_demo_follower_industry",
      "LinkedIn · Follower industry",
    ],
    [
      "Company size",
      "linkedin_demo_follower_company_size",
      "LinkedIn · Follower company size",
    ],
  ];
  for (const [sheet, sub, name] of followerDemos) {
    const sn = pickSheet(FILES.liFollowers, [sheet]);
    await writeDataset(sb, {
      name,
      category: "Social",
      subcategory: sub,
      rows: sheetRows(FILES.liFollowers, sn || sheet),
    });
  }

  console.log("\n=== YouTube (one folder only) ===");
  const ytTable = csvRows(FILES.ytTable).filter(
    (r) => String(r.Content || r.content || "").toLowerCase() !== "total"
  );
  const ytChart = normalizeRowDates(csvRows(FILES.ytChart), "mdy");
  await writeDataset(sb, {
    name: "YouTube · Table",
    category: "Social",
    subcategory: "youtube_table",
    rows: ytTable,
  });
  await writeDataset(sb, {
    name: "YouTube · Chart",
    category: "Social",
    subcategory: "youtube_chart",
    rows: ytChart,
  });

  console.log("\n=== Website GA ===");
  const ga = normalizeRowDates(csvRows(FILES.ga), "mdy");
  aggregates.gaRows = ga.length;
  await writeDataset(sb, {
    name: "GA4 · Sessions by source",
    category: "Website",
    subcategory: "ga4",
    rows: ga,
  });
  // Channel acquisition is a short static sheet — store under Website unknown-friendly name
  const gaAcq = csvRows(FILES.gaAcq);
  if (gaAcq.length) {
    await writeDataset(sb, {
      name: "GA4 · User acquisition by channel",
      category: "Website",
      subcategory: "ga4",
      rows: gaAcq,
    });
  }

  console.log("\n=== GSC ===");
  console.log("gsc sheets", listSheets(FILES.gsc));
  const gscDates = normalizeRowDates(
    sheetRows(FILES.gsc, pickSheet(FILES.gsc, ["Chart"]) || "Chart"),
    "mdy"
  );
  aggregates.gscDateRows = gscDates.length;
  for (const r of gscDates) {
    aggregates.gscClicks += num(r.Clicks || r.clicks);
    aggregates.gscImpressions += num(r.Impressions || r.impressions);
  }
  await writeDataset(sb, {
    name: "GSC · Dates",
    category: "SEO",
    subcategory: "gsc_dates",
    rows: gscDates,
  });
  await writeDataset(sb, {
    name: "GSC · Queries",
    category: "SEO",
    subcategory: "gsc_queries",
    rows: sheetRows(FILES.gsc, pickSheet(FILES.gsc, ["Queries"]) || "Queries"),
  });
  await writeDataset(sb, {
    name: "GSC · Pages",
    category: "SEO",
    subcategory: "gsc_pages",
    rows: sheetRows(FILES.gsc, pickSheet(FILES.gsc, ["Pages"]) || "Pages"),
  });
  await writeDataset(sb, {
    name: "GSC · Countries",
    category: "SEO",
    subcategory: "gsc_countries",
    rows: sheetRows(
      FILES.gsc,
      pickSheet(FILES.gsc, ["Countries"]) || "Countries"
    ),
  });
  await writeDataset(sb, {
    name: "GSC · Devices",
    category: "SEO",
    subcategory: "gsc_devices",
    rows: sheetRows(FILES.gsc, pickSheet(FILES.gsc, ["Devices"]) || "Devices"),
  });
  await writeDataset(sb, {
    name: "GSC · Search appearance",
    category: "SEO",
    subcategory: "gsc_search_appearance",
    rows: sheetRows(
      FILES.gsc,
      pickSheet(FILES.gsc, ["Search appearance"]) || "Search appearance"
    ),
  });

  console.log("\n=== Instagram insights JSON ===");
  const thumbs = await loadExistingThumbs(sb);
  console.log("preserved thumbs", thumbs.size);
  const igSets = buildIgDatasets(FILES.igInsights, thumbs);
  for (const ds of igSets) {
    if (ds.subcategory === "instagram_posts") {
      aggregates.igPosts = ds.rows.length;
    }
    if (ds.subcategory === "instagram_organic" && ds.rows[0]) {
      aggregates.igReached = num(ds.rows[0].accounts_reached);
      aggregates.igInteractions = num(ds.rows[0].content_interactions);
      aggregates.igFollowers = num(ds.rows[0].followers);
    }
    await writeDataset(sb, ds);
  }

  console.log("\n=== Publish reports ===");
  await publishReports(sb);

  console.log("\n=== Insights Center ===");
  await writeInsights(sb, aggregates);

  // Verify currents
  const { data: currents } = await sb
    .from("datasets")
    .select("name, subcategory, row_count, is_current, sync_window_end")
    .eq("project_id", PROJECT_ID)
    .eq("is_current", true)
    .order("category")
    .order("name");
  console.log("\n=== Current datasets ===");
  for (const c of currents || []) {
    console.log(
      `  ${c.subcategory} · ${c.row_count} · ${c.name} · end=${c.sync_window_end}`
    );
  }

  console.log("\nDONE Sign2x report import through", WINDOW_END);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
