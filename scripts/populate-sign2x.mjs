/**
 * One-shot: load Sign2X Startup Launch from the marketing mastersheet +
 * LinkedIn / GSC / GA4 / YouTube exports into content, blog, reports, tasks.
 *
 * Usage: node scripts/populate-sign2x.mjs
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const PROJECT_ID = "96468999-a1df-4393-9a5a-6b1cd5b970ae";
const COMPANY_ID = "c4ef4be8-9d61-4de6-a327-db4b39f9d733";
const STARTUP_LAUNCH_PLAYBOOK = "634598a9-1637-4f17-b376-502646d2bdaa";

const FILES = {
  mastersheet: "/Users/alihashemi/Downloads/Sign2x - Marketing Mastersheet.xlsx",
  marketing: "/Users/alihashemi/Desktop/WIDE/WIDE Ops/App stuff/Marketing Data OS/Sign2x Marketing Data.xlsx",
  gsc: "/Users/alihashemi/Downloads/sign2x.com-Performance-on-Search-2026-08-17.xlsx",
  liFollowers: "/Users/alihashemi/Downloads/sign2x_followers_1786950471348.xls",
  liVisitors: "/Users/alihashemi/Downloads/sign2x_visitors_1786950465048.xls",
  liContent: "/Users/alihashemi/Downloads/sign2x_content_1786950460203.xls",
  ytTable: "/Users/alihashemi/Downloads/Content 2026-05-18_2026-08-16 Sign2x/Table data.csv",
  ytChart: "/Users/alihashemi/Downloads/Content 2026-05-18_2026-08-16 Sign2x/Chart data.csv",
};

const LIVE_BLOG = [
  {
    match: /souveräne|souverane|docusign alternative/i,
    url: "https://www.sign2x.com/blog/die-souverane-e-signatur-alternative-aus-deutschland",
    slug: "die-souverane-e-signatur-alternative-aus-deutschland",
  },
  {
    match: /white-label-leitfaden|elektronische signatur als api/i,
    url: "https://www.sign2x.com/blog/die-elektronische-signatur-als-api-der-white-label-leitfaden-fur-softwarehersteller",
    slug: "die-elektronische-signatur-als-api-der-white-label-leitfaden-fur-softwarehersteller",
  },
  {
    match: /cloud act|dsgvo vs/i,
    url: "https://www.sign2x.com/blog/dsgvo-vs-us-cloud-act-esignatur-api",
    slug: "dsgvo-vs-us-cloud-act-esignatur-api",
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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isoFromParts(y, m, d) {
  if (!y || !m || !d) return null;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** Mastersheet = D/M/Y. LinkedIn US exports = M/D/Y. */
function parseDate(value, order = "mdy") {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoFromParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{8}$/.test(raw)) return isoFromParts(raw.slice(0, 4), raw.slice(4, 6), raw.slice(6, 8));
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
      "location",
      "seniority",
      "industry",
      "job function",
      "company size",
      "video title",
      "content",
      "sessionsource",
    ].some((k) => c === k || c.includes(k))
  );
}

function aoaToObjects(aoa) {
  if (!aoa.length) return [];
  let headerIdx = 0;
  for (let i = 0; i < Math.min(8, aoa.length); i++) {
    const cells = (aoa[i] || []).map((c) => String(c ?? "").trim());
    if (looksLikeHeader(cells)) {
      headerIdx = i;
      break;
    }
  }
  const headers = (aoa[headerIdx] || []).map((c, i) => String(c ?? "").trim() || `Column_${i + 1}`);
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
  const wb = XLSX.readFile(file, { cellDates: true });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  return aoaToObjects(aoa);
}

function csvRows(file) {
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
    return next;
  });
}

function mergeByKey(base, overlay, keyFn) {
  const map = new Map();
  for (const r of base) map.set(keyFn(r), r);
  for (const r of overlay) map.set(keyFn(r), r);
  return [...map.values()];
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
    type: /date/i.test(key) ? "date" : /rate|ctr|percent/i.test(key) ? "percentage" : "text",
    sampleValues: rows.map((r) => r[key]).filter(Boolean).slice(0, 3).map(String),
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
      external_account_label: "Sign2X import",
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

function monthStart(iso) {
  return `${iso.slice(0, 7)}-01`;
}

function col(row, ...names) {
  for (const n of names) {
    if (row[n] != null && String(row[n]).trim()) return String(row[n]).trim();
    const hit = Object.keys(row).find((k) => k.toLowerCase() === n.toLowerCase());
    if (hit && String(row[hit]).trim()) return String(row[hit]).trim();
  }
  return "";
}

function mapAdStatus(raw) {
  const s = raw.toLowerCase();
  if (s.startsWith("paid") || s.includes("sponsored")) return "paid";
  return "organic";
}

function mapApproval(raw) {
  const s = raw.toLowerCase().replace(/\s+/g, "_");
  if (s.includes("on-hold") || s.includes("on_hold") || s.includes("hold")) return "on_hold";
  if (s.includes("revision")) return "needs_revision";
  if (s.includes("review") || s.includes("pending")) return "needs_review";
  if (s.includes("approved")) return "approved";
  return "draft";
}

function mapProduction(raw) {
  return raw.toLowerCase().includes("live") ? "live" : "wip";
}

function parseVisual(text) {
  const t = text || "";
  const bg = (t.match(/BG:\s*([^]*?)(?=Typo:|Graphic:|$)/i) || [])[1];
  const typo = (t.match(/Typo:\s*([^]*?)(?=Graphic:|BG:|$)/i) || [])[1];
  const graphic = (t.match(/Graphic:\s*([^]*?)$/i) || [])[1];
  return {
    background: (bg || t).trim().slice(0, 800),
    graphic_description: (graphic || "").trim().slice(0, 800),
    typography_notes: (typo || "").trim().slice(0, 400),
  };
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function htmlToText(html) {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, iframe, form").remove();
  const body = $("article, .w-richtext, main, .blog-post").first().text() || $("body").text();
  return body.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return "";
    return htmlToText(await res.text());
  } catch {
    return "";
  }
}

function sheetAoa(file, name) {
  const wb = XLSX.readFile(file, { cellDates: true });
  const sheet = wb.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
}

async function main() {
  loadEnvLocal();
  const sb = admin();
  const log = [];

  // --- Playbook tasks ---
  const { count: existingTpl } = await sb
    .from("pm_tasks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", PROJECT_ID)
    .eq("source", "template");
  if ((existingTpl || 0) === 0) {
    const { data: members } = await sb
      .from("package_playbook_members")
      .select("service_playbook_id")
      .eq("package_playbook_id", STARTUP_LAUNCH_PLAYBOOK);
    const cycleKey = "2026-08";
    const rows = [];
    let sortBase = 0;
    for (const m of members || []) {
      const { data: templates } = await sb
        .from("task_templates")
        .select("*")
        .eq("service_playbook_id", m.service_playbook_id)
        .order("sort_order", { ascending: true });
      for (const t of templates || []) {
        rows.push({
          project_id: PROJECT_ID,
          task_template_id: t.id,
          title: t.title,
          description: t.description,
          default_role: t.default_role,
          status: "todo",
          is_gate: t.is_gate,
          phase_label: t.phase_label,
          source: "template",
          cycle_key: t.recurs ? cycleKey : null,
          estimated_duration_hours: t.estimated_duration_hours,
          sort_order: sortBase + (t.sort_order ?? 0),
          last_activity_at: new Date().toISOString(),
          client_visible: true,
        });
      }
      sortBase += 100;
    }
    if (rows.length) {
      const { error } = await sb.from("pm_tasks").insert(rows);
      if (error) throw error;
      log.push(`playbook tasks ${rows.length}`);
    }
    await sb
      .from("projects")
      .update({
        package_playbook_id: STARTUP_LAUNCH_PLAYBOOK,
        pm_cycle_key: cycleKey,
        deal_frequency: "monthly",
      })
      .eq("id", PROJECT_ID);
  } else {
    log.push("playbook tasks already present");
    await sb
      .from("projects")
      .update({
        package_playbook_id: STARTUP_LAUNCH_PLAYBOOK,
        pm_cycle_key: "2026-08",
        deal_frequency: "monthly",
      })
      .eq("id", PROJECT_ID);
  }

  // --- Kickoff + SEO checklist as manual tasks ---
  await sb.from("pm_tasks").delete().eq("project_id", PROJECT_ID).eq("source", "manual");
  const kickAoa = sheetAoa(FILES.mastersheet, "Checklist kickoff");
  const kickRows = [];
  for (const r of kickAoa.slice(1)) {
    const title = String(r[1] || "").trim();
    if (!title) continue;
    const statusRaw = String(r[5] || "").toLowerCase();
    const status = statusRaw.includes("done")
      ? "done"
      : statusRaw.includes("wip")
        ? "in_progress"
        : statusRaw.includes("depend")
          ? "blocked"
          : "todo";
    kickRows.push({
      project_id: PROJECT_ID,
      title,
      description: [r[0], r[3], r[4], r[6]].filter(Boolean).map(String).join(" · "),
      phase_label: String(r[0] || "Kickoff"),
      status,
      source: "manual",
      source_ref: "mastersheet:kickoff",
      completed_at: status === "done" ? new Date().toISOString() : null,
      started_at: status === "in_progress" || status === "done" ? new Date().toISOString() : null,
      sort_order: 1000 + kickRows.length,
      last_activity_at: new Date().toISOString(),
      client_visible: true,
    });
  }
  const seoAoa = sheetAoa(FILES.mastersheet, "SEO, GEO ");
  for (const r of seoAoa.slice(1)) {
    const title = String(r[0] || "").trim();
    if (!title) continue;
    const statusRaw = String(r[6] || "").toLowerCase();
    const status = statusRaw.includes("done")
      ? "done"
      : statusRaw.includes("progress") || statusRaw.includes("daily") || statusRaw.includes("weekly")
        ? "in_progress"
        : statusRaw.includes("not started")
          ? "todo"
          : "todo";
    kickRows.push({
      project_id: PROJECT_ID,
      title,
      description: [r[1], r[4], r[5], r[7]].filter(Boolean).map(String).join("\n"),
      phase_label: "SEO",
      status,
      source: "manual",
      source_ref: "mastersheet:seo",
      completed_at: status === "done" ? new Date().toISOString() : null,
      sort_order: 2000 + kickRows.length,
      last_activity_at: new Date().toISOString(),
      client_visible: true,
    });
  }
  if (kickRows.length) {
    const { error } = await sb.from("pm_tasks").insert(kickRows);
    if (error) throw error;
    log.push(`manual tasks ${kickRows.length}`);
  }

  // --- Content settings + posts ---
  await sb.from("content_posts").delete().eq("project_id", PROJECT_ID);
  await sb.from("content_context_docs").delete().eq("project_id", PROJECT_ID);

  const personas = {
    linkedin:
      "Formal third-person brand voice for B2B software manufacturers. Short professional paragraphs. One clear CTA. DE primary, EN twin.",
    instagram:
      "First-person Sign2x security companion. Shorter, warmer, emoji-forward. Same idea as LinkedIn, different register.",
  };
  await sb.from("content_settings").upsert({
    project_id: PROJECT_ID,
    pillars: ["BRAND", "PRODUCT", "PEOPLE"],
    languages: ["de", "en"],
    client_languages: ["de", "en"],
    platform_personas: personas,
    cadence: { linkedin: 3, instagram: 3 },
    next_post_number: 46,
    updated_at: new Date().toISOString(),
  });

  const socialSheets = ["Social_June26", "Social_July26", "Social_Aug26"];
  const posts = [];
  for (const name of socialSheets) {
    const aoa = sheetAoa(FILES.mastersheet, name);
    const header = (aoa[0] || []).map((h) => String(h || "").trim());
    for (const r of aoa.slice(1)) {
      const obj = {};
      header.forEach((h, i) => (obj[h] = r[i] ?? ""));
      const id = String(obj["Post ID"] || "").trim();
      const date = parseDate(obj["Publish Date"], "dmy");
      if (!id || !date) continue;
      const num = Number(id.replace(/\D/g, "")) || posts.length + 1;
      const approval = mapApproval(col(obj, "Approval", "Client Approval"));
      const production = mapProduction(col(obj, "Status WIDE"));
      const vo = col(obj, "Video Voiceover Script (DE Only)");
      const story = col(obj, "Story Repost Strategy");
      const visual = col(obj, "Visual Layout & Graphics");
      const isVideo =
        /video/i.test(col(obj, "Visual")) ||
        (/vo:|voice/i.test(vo) && !/^n\/a/i.test(vo));
      posts.push({
        post_number: num,
        scheduled_date: date,
        pillar: (col(obj, "Pillar") || "BRAND").toUpperCase(),
        hook_angle: col(obj, "Hook / Angle"),
        visual_brief: parseVisual(visual),
        captions: {
          linkedin: {
            de: col(obj, "LinkedIn Caption (DE)"),
            en: col(obj, "LinkedIn Caption (EN)"),
          },
          instagram: {
            de: col(obj, "Instagram Caption (DE)(Security Companion)", "Instagram Caption (DE)"),
            en: col(obj, "Instagram Caption (EN)(Security Companion)", "Instagram Caption (EN)"),
          },
        },
        hashtags: {},
        voiceover_script: vo && !/^n\/a/i.test(vo) ? { de: vo } : {},
        ad_status: mapAdStatus(col(obj, "Ad Status")),
        story_repost: story ? { strategy_text: story, sticker_type: "" } : null,
        is_video: isVideo,
        status_production: production,
        status_approval: approval,
        angle_approved: approval === "approved",
        locked: approval === "approved" && production === "live",
        remarks: col(obj, "Remarks from sign2x", "Remarks"),
        version_history: [],
        platforms: ["linkedin", "instagram"],
      });
    }
  }
  posts.sort((a, b) => a.post_number - b.post_number);

  const months = [...new Set(posts.map((p) => monthStart(p.scheduled_date)))].sort();
  const calIds = {};
  for (const period of months) {
    const status = period < "2026-08-01" ? "approved" : "in_review";
    const { data: existing } = await sb
      .from("content_calendars")
      .select("id")
      .eq("project_id", PROJECT_ID)
      .eq("period_start", period)
      .maybeSingle();
    if (existing) {
      await sb
        .from("content_calendars")
        .update({
          status,
          theme_notes:
            period === "2026-06-01"
              ? "Hello-world / brand launch month. 15-post minimalist matrix."
              : period === "2026-07-01"
                ? "Product proof + first client milestone (ProLife)."
                : "QES / multi-tenancy / regulated FinTech. Mix of live and WIP.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      calIds[period] = existing.id;
    } else {
      const { data: created, error } = await sb
        .from("content_calendars")
        .insert({
          project_id: PROJECT_ID,
          period_start: period,
          status,
          theme_notes: "Imported from Sign2x Marketing Mastersheet",
        })
        .select("id")
        .single();
      if (error) throw error;
      calIds[period] = created.id;
    }
  }

  const postInserts = posts.map((p) => ({
    project_id: PROJECT_ID,
    calendar_id: calIds[monthStart(p.scheduled_date)],
    ...p,
  }));
  const CHUNK = 25;
  for (let i = 0; i < postInserts.length; i += CHUNK) {
    const { error } = await sb.from("content_posts").insert(postInserts.slice(i, i + CHUNK));
    if (error) throw error;
  }
  log.push(`content posts ${postInserts.length} across ${months.join(", ")}`);

  // Context docs from mastersheet tabs
  const ideaAoa = sheetAoa(FILES.mastersheet, "Content Idea Dump");
  const ideaText = ideaAoa
    .slice(1)
    .filter((r) => r[0])
    .map((r) => `${r[0]} [${r[1]}] ${r[2]}\nVisual: ${r[3]}\nCopy: ${r[4]}\nAds: ${r[5]}\nStatus: ${r[6]}`)
    .join("\n\n");
  const kwAoa = sheetAoa(FILES.mastersheet, "Keyword Strategy");
  const kwText = kwAoa
    .filter((r) => String(r[0] || "").trim() && String(r[0]) !== "Target Search Query / Keyword")
    .map((r) => r.map(String).join(" | "))
    .join("\n");
  const docs = [
    { filename: "Content Idea Dump.md", extracted_text: ideaText },
    { filename: "Keyword Strategy.md", extracted_text: kwText },
  ];
  await sb.from("content_context_docs").insert(
    docs
      .filter((d) => d.extracted_text.length > 40)
      .map((d) => ({
        project_id: PROJECT_ID,
        filename: d.filename,
        extracted_text: d.extracted_text.slice(0, 20000),
        mime_type: "text/markdown",
        active: true,
      }))
  );

  // --- Blog ---
  await sb.from("blog_articles").delete().eq("project_id", PROJECT_ID);
  await sb.from("blog_opportunities").delete().eq("project_id", PROJECT_ID);
  await sb.from("blog_corpus").delete().eq("project_id", PROJECT_ID);

  const liveBodies = {};
  for (const live of LIVE_BLOG) {
    liveBodies[live.slug] = await fetchText(live.url);
  }

  await sb.from("blog_settings").upsert({
    project_id: PROJECT_ID,
    enabled: true,
    autonomy: "assisted",
    site_url: "https://www.sign2x.com",
    languages: ["de", "en"],
    brand_notes:
      "Sign2x is the axxessio-group e-signature API for software manufacturers. eIDAS, DSGVO, 100% German hosting (STACKIT / Telekom), white-label, API-first, on-prem capable. Audience: CTOs, product managers, compliance in DACH B2B SaaS. Never pitch as a DocuSign clone for SMBs — multiplier / embedded signing only.",
    preferred_external_domains: ["eidas.europa.eu", "bfdi.bund.de", "stackit.de"],
    commercial_pages: [
      { url: "https://www.sign2x.com/", label: "Home", intent: "brand" },
      { url: "https://www.sign2x.com/quiz", label: "Provider comparison quiz", intent: "commercial" },
      { url: "https://www.sign2x.com/developer-hub", label: "Developer hub", intent: "commercial" },
      { url: "https://www.sign2x.com/help", label: "Help center", intent: "support" },
    ],
    timezone: "Europe/Berlin",
    updated_at: new Date().toISOString(),
  });

  const blogAoa = sheetAoa(FILES.mastersheet, "Blog Posts");
  const headerIdx = blogAoa.findIndex(
    (r) => String(r[0] || "").trim() === "ID" && String(r[1] || "").includes("Name")
  );
  const bh = blogAoa[headerIdx].map((h) => String(h || "").trim());
  const articles = [];
  const corpus = [];
  for (const r of blogAoa.slice(headerIdx + 1)) {
    const obj = {};
    bh.forEach((h, i) => (obj[h] = r[i] ?? ""));
    const title = String(obj["Name of the Article"] || "").trim();
    if (!title) continue;
    const live = LIVE_BLOG.find((l) => l.match.test(title));
    const slug = live?.slug || slugify(title);
    const date = parseDate(obj["Publish Date"], "dmy");
    const progress = String(obj["Our Progress (Status)"] || "").toLowerCase();
    const approval = String(obj["Client Approval (Status)"] || "").toLowerCase();
    const isLive = Boolean(live) || progress === "live";
    const body =
      (live && liveBodies[live.slug]) ||
      String(obj["Objective"] || "") +
        (obj["Meta Description"] ? `\n\n${obj["Meta Description"]}` : "");
    const keywords = String(obj["SEO Keywords"] || "")
      .split(/,/)
      .map((s) => s.trim())
      .filter(Boolean);
    articles.push({
      project_id: PROJECT_ID,
      title,
      slug,
      language: "de",
      body_md: body.slice(0, 80000),
      meta_title: title.slice(0, 70),
      meta_description: String(obj["Meta Description"] || "").slice(0, 320),
      brief: {
        working_title: title,
        primary_keyword: keywords[0] || title,
        secondary_keywords: keywords.slice(1),
        search_intent: "informational",
        target_audience: String(obj["Target Persona"] || ""),
        recommended_angle: String(obj["Objective"] || ""),
        questions_to_answer: [],
        suggested_slug: slug,
      },
      research: {},
      translations: {},
      seo_issues: [],
      seo_scores: {},
      internal_links: [],
      external_links: [],
      version_history: [],
      audit_history: [],
      pipeline_stage: isLive ? "done" : progress.includes("wip") ? "draft" : "brief",
      status: isLive ? "published" : approval.includes("pending") ? "scheduled" : "brief",
      scheduled_for: date,
      published_at: isLive && date ? `${date}T09:00:00.000Z` : null,
      client_visible: true,
      seo_iterations: 0,
    });
    if (isLive && live) {
      corpus.push({
        project_id: PROJECT_ID,
        url: live.url,
        title,
        slug,
        excerpt: String(obj["Meta Description"] || "").slice(0, 280),
        body_text: body.slice(0, 20000),
        keywords,
        category: "blog",
        kind: "blog",
        published_at: date,
        source: "crawl",
      });
    }
  }
  if (articles.length) {
    const { error } = await sb.from("blog_articles").insert(articles);
    if (error) throw error;
    log.push(`blog articles ${articles.length}`);
  }
  corpus.push(
    {
      project_id: PROJECT_ID,
      url: "https://www.sign2x.com/",
      title: "Sign2x home",
      slug: "home",
      excerpt: "eIDAS-compliant e-signature API for software manufacturers.",
      body_text: "Sign2x — legally binding electronic signatures, GDPR, German hosting, white-label API.",
      keywords: ["sign2x", "e-signatur api"],
      kind: "commercial",
      source: "import",
    },
    {
      project_id: PROJECT_ID,
      url: "https://www.sign2x.com/quiz",
      title: "E-Signatur-Anbietervergleich",
      slug: "quiz",
      excerpt: "Provider comparison quiz.",
      body_text: "Interactive comparison of e-signature providers for software manufacturers.",
      keywords: ["e-signatur anbietervergleich"],
      kind: "commercial",
      source: "import",
    },
    {
      project_id: PROJECT_ID,
      url: "https://www.sign2x.com/developer-hub",
      title: "Developer hub",
      slug: "developer-hub",
      excerpt: "API-first integration hub.",
      body_text: "REST API, white-label, on-prem and cloud for software manufacturers.",
      keywords: ["e-signatur api", "white-label"],
      kind: "commercial",
      source: "import",
    }
  );
  const { error: corpusErr } = await sb.from("blog_corpus").insert(corpus);
  if (corpusErr) throw corpusErr;

  const seenQ = new Set();
  const opps = [];
  for (const r of kwAoa) {
    const q = String(r[0] || "").trim();
    if (!q || q.startsWith("Target Search") || /^\d+\.\s/.test(q) || q.length > 120) continue;
    if (q.toLowerCase().includes("the regulatory") || q.toLowerCase().includes("the multiplier")) continue;
    const key = q.toLowerCase();
    if (seenQ.has(key)) continue;
    seenQ.add(key);
    opps.push({
      project_id: PROJECT_ID,
      query: q,
      intent: String(r[2] || "informational"),
      score: /breakout|\+50/i.test(String(r[1] || "")) ? 82 : 64,
      score_breakdown: { demand: 20, trend: 18, business: 16 },
      rationale: String(r[4] || r[5] || "From Sign2X keyword strategy."),
      action: "create",
      status: "new",
      source: "import",
    });
  }
  if (opps.length) {
    const { error } = await sb.from("blog_opportunities").insert(opps);
    if (error) throw error;
    log.push(`blog opportunities ${opps.length}`);
  }

  // --- SEO site ---
  const { error: siteErr } = await sb.from("seo_sites").upsert(
    {
      domain: "sign2x.com",
      url: "https://www.sign2x.com",
      label: "Sign2X",
      company_id: COMPANY_ID,
      project_id: PROJECT_ID,
      gsc_property: "https://www.sign2x.com/",
      is_client_visible: true,
      monthly_rerun: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "domain" }
  );
  if (siteErr) throw siteErr;
  log.push("seo site sign2x.com");

  // --- Reports datasets ---
  const { data: oldDs } = await sb.from("datasets").select("id").eq("project_id", PROJECT_ID);
  if (oldDs?.length) {
    await sb.from("dataset_rows").delete().in(
      "dataset_id",
      oldDs.map((d) => d.id)
    );
    await sb.from("datasets").delete().eq("project_id", PROJECT_ID);
  }

  const liPosts = mergeByKey(
    normalizeRowDates(sheetRows(FILES.marketing, "Li - All posts"), "mdy"),
    normalizeRowDates(sheetRows(FILES.liContent, "All posts"), "mdy"),
    (r) => col(r, "Post link", "Post title")
  );
  const liMetrics = mergeByKey(
    normalizeRowDates(sheetRows(FILES.marketing, "Li - Metrics"), "mdy"),
    normalizeRowDates(sheetRows(FILES.liContent, "Metrics"), "mdy"),
    (r) => col(r, "Date")
  );
  const liVisitors = mergeByKey(
    normalizeRowDates(sheetRows(FILES.marketing, "Li - Visitor metrics"), "mdy"),
    normalizeRowDates(sheetRows(FILES.liVisitors, "Visitor metrics"), "mdy"),
    (r) => col(r, "Date")
  );
  const liFollowers = mergeByKey(
    normalizeRowDates(sheetRows(FILES.marketing, "Li - New followers"), "mdy"),
    normalizeRowDates(sheetRows(FILES.liFollowers, "New followers"), "mdy"),
    (r) => col(r, "Date")
  );

  const datasets = [
    {
      name: "LinkedIn · All posts",
      category: "Social",
      subcategory: "linkedin_posts",
      rows: liPosts,
    },
    {
      name: "LinkedIn · Metrics",
      category: "Social",
      subcategory: "linkedin_metrics",
      rows: liMetrics,
    },
    {
      name: "LinkedIn · Visitor metrics",
      category: "Social",
      subcategory: "linkedin_visitors",
      rows: liVisitors,
    },
    {
      name: "LinkedIn · New followers",
      category: "Social",
      subcategory: "linkedin_followers",
      rows: liFollowers,
    },
    {
      name: "LinkedIn · Visitor location",
      category: "Social",
      subcategory: "linkedin_demo_location",
      rows: sheetRows(FILES.liVisitors, "Location").length
        ? sheetRows(FILES.liVisitors, "Location")
        : sheetRows(FILES.marketing, "Li - Visitor - Location"),
    },
    {
      name: "LinkedIn · Visitor job function",
      category: "Social",
      subcategory: "linkedin_demo_job_function",
      rows: sheetRows(FILES.liVisitors, "Job function").length
        ? sheetRows(FILES.liVisitors, "Job function")
        : sheetRows(FILES.marketing, "Li - Visitor - Job function"),
    },
    {
      name: "LinkedIn · Visitor seniority",
      category: "Social",
      subcategory: "linkedin_demo_seniority",
      rows: sheetRows(FILES.liVisitors, "Seniority").length
        ? sheetRows(FILES.liVisitors, "Seniority")
        : sheetRows(FILES.marketing, "Li - Visitor - Seniority"),
    },
    {
      name: "LinkedIn · Visitor industry",
      category: "Social",
      subcategory: "linkedin_demo_industry",
      rows: sheetRows(FILES.liVisitors, "Industry").length
        ? sheetRows(FILES.liVisitors, "Industry")
        : sheetRows(FILES.marketing, "Li - Visitor - Industry"),
    },
    {
      name: "LinkedIn · Visitor company size",
      category: "Social",
      subcategory: "linkedin_demo_company_size",
      rows: sheetRows(FILES.liVisitors, "Company size").length
        ? sheetRows(FILES.liVisitors, "Company size")
        : sheetRows(FILES.marketing, "Li - Visitor - Company size"),
    },
    {
      name: "LinkedIn · Follower location",
      category: "Social",
      subcategory: "linkedin_demo_follower_location",
      rows: sheetRows(FILES.liFollowers, "Location"),
    },
    {
      name: "LinkedIn · Follower job function",
      category: "Social",
      subcategory: "linkedin_demo_follower_job_function",
      rows: sheetRows(FILES.liFollowers, "Job function"),
    },
    {
      name: "LinkedIn · Follower seniority",
      category: "Social",
      subcategory: "linkedin_demo_follower_seniority",
      rows: sheetRows(FILES.liFollowers, "Seniority"),
    },
    {
      name: "LinkedIn · Follower industry",
      category: "Social",
      subcategory: "linkedin_demo_follower_industry",
      rows: sheetRows(FILES.liFollowers, "Industry"),
    },
    {
      name: "LinkedIn · Follower company size",
      category: "Social",
      subcategory: "linkedin_demo_follower_company_size",
      rows: sheetRows(FILES.liFollowers, "Company size"),
    },
    {
      name: "GA4 · Sessions by source",
      category: "Website",
      subcategory: "ga4",
      rows: normalizeRowDates(sheetRows(FILES.marketing, "Web - GA - import"), "mdy").map((r) => {
        if (r.date && /^\d{8}$/.test(r.date)) r.date = parseDate(r.date);
        if (r.date && /^\d{8}$/.test(String(r.date))) {
          /* already handled */
        }
        const d = r.date || r.Date;
        if (d && /^\d{8}$/.test(String(d))) {
          r.date = parseDate(d);
        }
        return r;
      }),
    },
    {
      name: "GSC · Dates",
      category: "SEO",
      subcategory: "gsc_dates",
      rows: normalizeRowDates(sheetRows(FILES.gsc, "Chart"), "mdy"),
    },
    {
      name: "GSC · Queries",
      category: "SEO",
      subcategory: "gsc_queries",
      rows: sheetRows(FILES.gsc, "Queries"),
    },
    {
      name: "GSC · Pages",
      category: "SEO",
      subcategory: "gsc_pages",
      rows: sheetRows(FILES.gsc, "Pages"),
    },
    {
      name: "GSC · Countries",
      category: "SEO",
      subcategory: "gsc_countries",
      rows: sheetRows(FILES.gsc, "Countries"),
    },
    {
      name: "GSC · Devices",
      category: "SEO",
      subcategory: "gsc_devices",
      rows: sheetRows(FILES.gsc, "Devices"),
    },
    {
      name: "GSC · Search appearance",
      category: "SEO",
      subcategory: "gsc_search_appearance",
      rows: sheetRows(FILES.gsc, "Search appearance"),
    },
    {
      name: "YouTube · Table",
      category: "Social",
      subcategory: "youtube_table",
      rows: csvRows(FILES.ytTable).filter((r) => !/^total$/i.test(col(r, "Content", "Video title"))),
    },
    {
      name: "YouTube · Chart",
      category: "Social",
      subcategory: "youtube_chart",
      rows: normalizeRowDates(csvRows(FILES.ytChart), "mdy"),
    },
  ];

  for (const ds of datasets) {
    // GA4 date field is often `date` as YYYYMMDD
    if (ds.subcategory === "ga4") {
      ds.rows = ds.rows.map((r) => {
        const next = { ...r };
        const raw = next.date || next.Date;
        const iso = parseDate(raw, "mdy");
        if (iso) next.date = iso;
        return next;
      });
    }
    await writeDataset(sb, ds);
  }
  log.push(`datasets ${datasets.length}`);

  console.log("DONE", log.join(" · "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
