/**
 * Load Sign2X Instagram GDPR export (posts, posts_1, reels, stories,
 * other_content, profile_photos) + attached creatives into the reporting hub.
 *
 * Usage: node scripts/populate-sign2x-instagram.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname, extname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const PROJECT_ID = "96468999-a1df-4393-9a5a-6b1cd5b970ae";
const MEDIA_DIR =
  "/Users/alihashemi/Downloads/instagram-sign2x.de-2026-08-17-yHUl1JFm/your_instagram_activity/media";
const INSIGHTS_DIR =
  process.env.INSIGHTS_DIR ||
  "/Users/alihashemi/Downloads/instagram-sign2x.de-2026-08-17-yHUl1JFm/logged_information/past_instagram_insights";
const ASSETS_DIR =
  "/Users/alihashemi/.cursor/projects/Users-alihashemi-Desktop-WIDE-wide-portal-V02/assets";

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

function readJson(name) {
  return JSON.parse(readFileSync(resolve(MEDIA_DIR, name), "utf8"));
}

function readInsight(name) {
  return JSON.parse(readFileSync(resolve(INSIGHTS_DIR, name), "utf8"));
}

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

function isMediaUri(uri) {
  return /\.(jpe?g|png|webp|gif|mp4|mov|m4v)$/i.test(String(uri || ""));
}

function kindFromUri(uri, fallback = "post") {
  const u = String(uri || "").toLowerCase();
  if (u.includes("/stories/")) return "story";
  if (u.includes("/reels/")) return "reel";
  if (u.includes("profile") || u.includes("ig_profile")) return "profile";
  return fallback;
}

function isoFromTs(ts) {
  if (!ts) return "";
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Date(n * 1000).toISOString();
}

function walkMedia(obj, out) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    for (const v of obj) walkMedia(v, out);
    return;
  }
  if (typeof obj !== "object") return;
  if (obj.uri && isMediaUri(obj.uri)) {
    out.push({
      uri: obj.uri,
      title: obj.title || "",
      creation_timestamp: obj.creation_timestamp || null,
    });
  }
  for (const v of Object.values(obj)) walkMedia(v, out);
}

function collectFromLabelPost(post, fallbackKind) {
  const found = [];
  walkMedia(post, found);
  const published = (post.label_values || []).find((lv) => lv.label === "Published")
    ?.value;
  const ts = post.timestamp || post.creation_timestamp;
  return found
    .filter((m) => m.uri)
    .map((m) => ({
      uri: m.uri,
      title: m.title,
      creation_timestamp: m.creation_timestamp || ts,
      published,
      kind: kindFromUri(m.uri, fallbackKind),
    }));
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
    type: /date|created_at/i.test(key) ? "date" : "text",
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
      external_account_label: "instagram-sign2x.de export",
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
  console.log(`  dataset ${subcategory} · ${rows.length} rows · ${name}`);
  return ds.id;
}

async function main() {
  loadEnvLocal();
  const sb = admin();

  const raw = [];
  for (const post of readJson("posts.json")) {
    raw.push(...collectFromLabelPost(post, "post"));
  }
  for (const post of readJson("posts_1.json")) {
    raw.push(...collectFromLabelPost(post, "post"));
  }
  for (const post of readJson("other_content.json")) {
    raw.push(...collectFromLabelPost(post, "post"));
  }
  for (const m of readJson("stories.json").ig_stories || []) {
    if (!m.uri) continue;
    raw.push({
      uri: m.uri,
      title: m.title || "",
      creation_timestamp: m.creation_timestamp,
      published: "True",
      kind: "story",
    });
  }
  for (const wrap of readJson("reels.json").ig_reels_media || []) {
    for (const m of wrap.media || []) {
      if (!m.uri) continue;
      raw.push({
        uri: m.uri,
        title: m.title || "",
        creation_timestamp: m.creation_timestamp,
        published: "True",
        kind: "reel",
      });
    }
  }
  for (const m of readJson("profile_photos.json").ig_profile_picture || []) {
    if (!m.uri) continue;
    raw.push({
      uri: m.uri,
      title: m.title || "Profile photo",
      creation_timestamp: m.creation_timestamp,
      published: "True",
      kind: "profile",
    });
  }

  const byId = new Map();
  for (const item of raw) {
    const id = mediaIdFromUri(item.uri);
    if (!id) continue;
    const prev = byId.get(id);
    const caption = fixText(item.title);
    if (!prev || (caption && caption.length > (prev.caption || "").length)) {
      byId.set(id, {
        id,
        uri: item.uri,
        kind: item.kind || kindFromUri(item.uri),
        caption,
        created_at: isoFromTs(item.creation_timestamp),
        published: item.published,
      });
    }
  }

  const assetById = new Map();
  for (const name of readdirSync(ASSETS_DIR)) {
    const id = name.split("-")[0];
    if (/^\d+$/.test(id)) assetById.set(id, resolve(ASSETS_DIR, name));
  }

  const thumbs = new Map();
  let uploaded = 0;
  for (const [id, filePath] of assetById) {
    const buf = readFileSync(filePath);
    const ext = extname(filePath).slice(1) || "png";
    const objectPath = `${PROJECT_ID}/instagram/${id}.${ext}`;
    const { error } = await sb.storage.from("content-context").upload(objectPath, buf, {
      contentType: ext === "png" ? "image/png" : `image/${ext}`,
      upsert: true,
    });
    if (error) {
      console.warn("  upload fail", id, error.message);
      continue;
    }
    const { data } = sb.storage.from("content-context").getPublicUrl(objectPath);
    thumbs.set(id, data.publicUrl);
    uploaded += 1;
  }
  console.log(`uploaded ${uploaded} creatives`);

  const items = [...byId.values()].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );

  // Prefer past_instagram_insights when present (real reach / impressions / likes).
  let insightById = new Map();
  let insightSummary = null;
  try {
    const reach = readInsight("profiles_reached.json").organic_insights_reach?.[0];
    const interactions =
      readInsight("content_interactions.json").organic_insights_interactions?.[0];
    const audience =
      readInsight("audience_insights.json").organic_insights_audience?.[0];
    const insightPosts = readInsight("posts.json").organic_insights_posts || [];
    const R = smd(reach);
    const I = smd(interactions);
    const A = smd(audience);
    const engaged = parseEngagedSplit(I["Engaged Account By Follow Type"]);
    const periodLabel = (R["Date Range"] || I["Date Range"] || "").replace(
      /\s*-\s*/,
      " – "
    );
    insightSummary = {
      period: periodLabel ? `${periodLabel} (2026)` : "",
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
      followers: parseNum(A.Followers),
      source: "instagram-sign2x.de past_instagram_insights + media",
    };
    for (const entry of insightPosts) {
      const m = smd(entry);
      const thumb = entry.media_map_data?.["Media Thumbnail"] || {};
      const id = mediaIdFromUri(thumb.uri);
      if (!id) continue;
      insightById.set(id, {
        caption: fixText(thumb.title || ""),
        created_at: isoFromTs(m["__ts_Creation Timestamp"] || thumb.creation_timestamp),
        accounts_reached: parseNum(m["Accounts reached"]),
        impressions: parseNum(m.Impressions),
        profile_visits: parseNum(m["Profile visits"]),
        follows: parseNum(m.Follows),
        saves: parseNum(m.Saves),
        likes: parseNum(m.Likes),
        comments: parseNum(m.Comments),
        shares: parseNum(m.Shares),
        uri: thumb.uri || "",
      });
    }
    console.log(`insights loaded · ${insightById.size} posts · reach ${insightSummary.accounts_reached}`);
  } catch (err) {
    console.warn("insights unavailable — metrics will be zero:", err.message);
  }

  // When insights exist, report posts are the insight set (with metrics);
  // otherwise fall back to the full media dump (captions only).
  let postRows;
  if (insightById.size) {
    postRows = [...insightById.entries()].map(([id, ig]) => {
      const media = byId.get(id);
      return {
        _ig_kind: "post",
        media_id: id,
        caption:
          ig.caption ||
          media?.caption ||
          "",
        created_at: ig.created_at || media?.created_at || "",
        created_label: (ig.created_at || media?.created_at)
          ? new Date(ig.created_at || media.created_at).toLocaleString("de-DE")
          : "",
        thumbnail_url: thumbs.get(id) || "",
        post_url: "https://www.instagram.com/sign2x.de/",
        format: media?.kind || kindFromUri(ig.uri || media?.uri),
        uri: ig.uri || media?.uri || "",
        accounts_reached: ig.accounts_reached,
        impressions: ig.impressions,
        profile_visits: ig.profile_visits,
        follows: ig.follows,
        saves: ig.saves,
        likes: ig.likes,
        comments: ig.comments,
        shares: ig.shares,
        external_link_taps: 0,
      };
    });
  } else {
    postRows = items
      .filter((i) => i.kind !== "profile")
      .map((i) => ({
        _ig_kind: "post",
        media_id: i.id,
        caption:
          i.caption ||
          (i.kind === "story" ? "Story" : i.kind === "reel" ? "Reel" : ""),
        created_at: i.created_at,
        created_label: i.created_at
          ? new Date(i.created_at).toLocaleString("de-DE")
          : "",
        thumbnail_url: thumbs.get(i.id) || "",
        post_url: "https://www.instagram.com/sign2x.de/",
        format: i.kind,
        uri: i.uri,
        accounts_reached: 0,
        impressions: 0,
        profile_visits: 0,
        follows: 0,
        saves: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        external_link_taps: 0,
      }));
  }

  postRows.sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );

  const nPostParents = readJson("posts.json").length;
  const nPost = items.filter((i) => i.kind === "post").length;
  const nReel = items.filter((i) => i.kind === "reel").length;
  const nStory = items.filter((i) => i.kind === "story").length;
  const dates = postRows.map((i) => i.created_at).filter(Boolean).sort();
  const periodFallback =
    dates.length >= 2
      ? `${dates[0].slice(0, 10)} – ${dates[dates.length - 1].slice(0, 10)}`
      : dates[0]?.slice(0, 10) || "";

  const summary = [
    insightSummary
      ? {
          ...insightSummary,
          period: insightSummary.period || periodFallback,
          posts_published: nPostParents,
          reels_published: nReel,
          stories_published: nStory,
          media_pieces: postRows.length,
        }
      : {
          period: periodFallback,
          accounts_reached: 0,
          impressions: 0,
          profile_visits: 0,
          external_link_taps: 0,
          content_interactions: 0,
          accounts_engaged: 0,
          post_interactions: nPostParents,
          reels_interactions: nReel,
          story_interactions: nStory,
          posts_published: nPostParents,
          reels_published: nReel,
          stories_published: nStory,
          media_pieces: postRows.length,
          source: "instagram-sign2x.de GDPR export 2026-08-17 (media only)",
        },
  ];

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

  console.log(
    `DONE posts=${nPost} reels=${nReel} stories=${nStory} reportRows=${postRows.length} thumbs=${thumbs.size} period=${summary[0].period} reach=${summary[0].accounts_reached}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
