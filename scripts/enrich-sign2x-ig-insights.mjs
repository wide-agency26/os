/**
 * Merge Meta GDPR `past_instagram_insights` into Sign2X Social datasets.
 *
 * Usage:
 *   node scripts/enrich-sign2x-ig-insights.mjs
 *   INSIGHTS_DIR=/path/to/past_instagram_insights node scripts/enrich-sign2x-ig-insights.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const PROJECT_ID = "96468999-a1df-4393-9a5a-6b1cd5b970ae";
const INSIGHTS_DIR =
  process.env.INSIGHTS_DIR ||
  resolve(root, ".tmp-ig-insights");

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

function readInsight(name) {
  return JSON.parse(readFileSync(resolve(INSIGHTS_DIR, name), "utf8"));
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

function smd(entry) {
  const map = entry?.string_map_data || {};
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = v?.value ?? "";
    if (v?.timestamp && !out[`__ts_${k}`]) out[`__ts_${k}`] = v.timestamp;
  }
  return out;
}

function parseNum(raw) {
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (!s || s === "--" || s === "—") return 0;
  const cleaned = s.replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parsePct(raw) {
  if (raw == null) return 0;
  const m = String(raw).match(/([\d.,]+)\s*%/);
  if (!m) return parseNum(raw);
  return parseNum(m[1]);
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

function isoFromTs(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Date(n * 1000).toISOString();
}

function columnsFromRows(rows) {
  const keys = [];
  const seen = new Set();
  for (const row of rows.slice(0, 40)) {
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
    type: /date|created_at/i.test(key)
      ? "date"
      : /_pct$|reached|impressions|visits|taps|likes|comments|shares|saves|follows|interactions|engaged|published|pieces/i.test(
            key
          )
        ? "number"
        : "text",
    sampleValues: rows
      .map((r) => r[key])
      .filter((v) => v != null && v !== "")
      .slice(0, 3)
      .map(String),
    uniqueCount: new Set(rows.map((r) => String(r[key] ?? ""))).size,
    fillRate: 1,
    ignored: false,
  }));
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
      external_account_label: "instagram-sign2x.de insights",
    })
    .select("id")
    .single();
  if (error) throw new Error(`${name}: ${error.message}`);

  const { data: priors } = await sb
    .from("datasets")
    .select("id")
    .eq("project_id", PROJECT_ID)
    .eq("subcategory", subcategory)
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
    const { error: rowErr } = await sb.from("dataset_rows").insert(chunk);
    if (rowErr) throw new Error(`${name} rows: ${rowErr.message}`);
  }
  console.log(`  dataset ${subcategory} · ${rows.length} rows · ${name}`);
  return ds.id;
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

async function main() {
  loadEnvLocal();
  const sb = admin();
  const thumbs = await loadExistingThumbs(sb);
  console.log(`loaded ${thumbs.size} existing thumbnails`);

  const reach = readInsight("profiles_reached.json").organic_insights_reach?.[0];
  const interactions =
    readInsight("content_interactions.json").organic_insights_interactions?.[0];
  const audience =
    readInsight("audience_insights.json").organic_insights_audience?.[0];
  const insightPosts =
    readInsight("posts.json").organic_insights_posts || [];

  const R = smd(reach);
  const I = smd(interactions);
  const A = smd(audience);
  const engaged = parseEngagedSplit(I["Engaged Account By Follow Type"]);

  const periodRaw = R["Date Range"] || I["Date Range"] || A["Date Range"] || "";
  // Export dated 2026-08-17; Insights window is "May 19 - Aug 16"
  const period = periodRaw
    ? `${periodRaw.replace(/\s*-\s*/, " – ")} (2026)`
    : "2026-05-19 – 2026-08-16";

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
      source: "instagram-sign2x.de past_instagram_insights 2026-08-17",
    },
  ];

  console.log("summary", summary[0]);

  const postRows = insightPosts.map((entry) => {
    const m = smd(entry);
    const thumb = entry.media_map_data?.["Media Thumbnail"] || {};
    const uri = thumb.uri || "";
    const id = mediaIdFromUri(uri);
    const ts =
      m["__ts_Creation Timestamp"] ||
      thumb.creation_timestamp ||
      0;
    const created_at = isoFromTs(ts);
    const caption = fixText(thumb.title || "");
    return {
      _ig_kind: "post",
      media_id: id,
      caption,
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

  const withReach = postRows.filter((p) => p.accounts_reached > 0).length;
  console.log(
    `posts ${postRows.length} · with reach ${withReach} · thumbs hit ${
      postRows.filter((p) => p.thumbnail_url).length
    }`
  );

  await writeDataset(sb, {
    name: "Instagram · Posts / Reels / Stories",
    category: "Social",
    subcategory: "instagram_posts",
    rows: postRows,
  });
  await writeDataset(sb, {
    name: "Instagram · Content mix",
    category: "Social",
    subcategory: "instagram_content_interactions",
    rows: summary,
  });
  await writeDataset(sb, {
    name: "Instagram · Organic summary",
    category: "Social",
    subcategory: "instagram_profiles_reached",
    rows: summary,
  });
  await writeDataset(sb, {
    name: "Instagram · Organic summary",
    category: "Social",
    subcategory: "instagram_organic",
    rows: summary,
  });

  console.log("DONE — hard-refresh Social → Instagram for Sign2X");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
