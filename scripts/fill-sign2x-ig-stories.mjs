/**
 * Create Sign2x Sept IG Story calendar rows + upload creatives.
 * Usage: node scripts/fill-sign2x-ig-stories.mjs
 */
import { readFileSync, copyFileSync, existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { resolve, dirname, basename, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const ASSETS =
  "/Users/alihashemi/.cursor/projects/Users-alihashemi-Desktop-WIDE-wide-portal-V02/assets";
const SEPT = "/Users/alihashemi/Desktop/WIDE/Sign2x/Social/Sept";
const PROJECT_ID = "96468999-a1df-4393-9a5a-6b1cd5b970ae";
const CALENDAR_ID = "19977dc0-c755-4a4b-93a1-f214230be38c";

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
loadEnvLocal();

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const TYPE =
  "Type contrast: dark bg → white/cream; light bg → blue #1041F4. No floating logo.";

/** Stories: linked_to = feed post_number or null for standalone */
const STORIES = [
  {
    date: "2026-09-01",
    file: "IG_STORY_01.jpg",
    linked: 85,
    hook: "Story · EU-Server genug? (Poll)",
    plan: {
      strategy_text:
        "Poll: „EU-Server reicht für Souveränität?“ → Feed Teil 1 Cloud Act. Ergebnis morgen in Story.",
      sticker_type: "poll",
      stickers: ["poll", "link"],
      link_url: "https://www.sign2x.com/quiz",
      link_label: "Quiz",
      cta_hint: "Poll + link to quiz",
      frame_notes: "Dark frame, white type EU-SERVER GENUG?",
    },
  },
  {
    date: "2026-09-02",
    file: "IG_STORY_02.jpg",
    linked: 67,
    hook: "Story · Quiz nach dem Stecker-Carousel",
    plan: {
      strategy_text: "Nach Carousel: Link-Sticker zum 2-Min-Quiz. „Passt der Stecker?“",
      sticker_type: "link",
      stickers: ["link"],
      link_url: "https://www.sign2x.com/quiz",
      link_label: "2 Min Quiz",
      cta_hint: "Link sticker",
      frame_notes: "Light frame QUIZ 2 MIN blue type",
    },
  },
  {
    date: "2026-09-03",
    file: "IG_STORY_03.jpg",
    linked: null,
    hook: "Story · Standalone — Morgen drei Fragen",
    plan: {
      strategy_text: "Standalone cliffhanger: morgen RFP-Fragen im Feed. Kein Link nötig.",
      sticker_type: "countdown",
      stickers: ["countdown", "question"],
      cta_hint: "Countdown to Monday / question sticker",
      frame_notes: "Dark MORGEN — DREI FRAGEN",
    },
  },
  {
    date: "2026-09-04",
    file: "IG_STORY_04.jpg",
    linked: 63,
    hook: "Story · Native oder Portal? (Poll)",
    plan: {
      strategy_text: "Poll Native vs Portal — tied to feed Teil 4 Couchtisch.",
      sticker_type: "poll",
      stickers: ["poll", "link"],
      link_url: "https://www.sign2x.com",
      link_label: "sign2x.com",
      cta_hint: "Poll + site link",
      frame_notes: "Light NATIVE ODER PORTAL?",
    },
  },
  {
    date: "2026-09-09",
    file: "IG_STORY_05.jpg",
    linked: 91,
    hook: "Story · STACKIT auf dem Board",
    plan: {
      strategy_text: "Behind the board: STACKIT + Telekom type-only. Link to feed carousel.",
      sticker_type: "link",
      stickers: ["link", "slider"],
      link_url: "https://www.sign2x.com",
      link_label: "Mehr",
      cta_hint: "Link + optional slider „Wie klar war der Mythos?“",
      frame_notes: "Light STACKIT AUF DEM BOARD",
    },
  },
  {
    date: "2026-09-11",
    file: "IG_STORY_06.jpg",
    linked: 64,
    hook: "Story · Wo landen die Minuten?",
    plan: {
      strategy_text: "Question sticker: Wo liegt euer Audit-Log? → Feed Teil 9.",
      sticker_type: "question",
      stickers: ["question", "link"],
      link_url: "https://www.sign2x.com/quiz",
      link_label: "Check",
      cta_hint: "Question + quiz link",
      frame_notes: "Dark WO LANDEN DIE MINUTEN?",
    },
  },
  {
    date: "2026-09-18",
    file: "IG_STORY_07.jpg",
    linked: 98,
    hook: "Story · SES · AES · QES",
    plan: {
      strategy_text: "After eIDAS carousel: quiz which level. Never EES/FES.",
      sticker_type: "link",
      stickers: ["link", "poll"],
      link_url: "https://www.sign2x.com/quiz",
      link_label: "Welches Level?",
      cta_hint: "Link + poll SES/AES/QES",
      frame_notes: "SES · AES · QES blue on light",
    },
  },
  {
    date: "2026-09-22",
    file: "IG_STORY_08.jpg",
    linked: 70,
    hook: "Story · GwG ohne Export",
    plan: {
      strategy_text: "Link sticker after GwG carousel — ID stays, log in DE.",
      sticker_type: "link",
      stickers: ["link", "dm"],
      link_url: "https://www.sign2x.com",
      link_label: "GwG-Pfad",
      cta_hint: "Link + DM for ISV questions",
      frame_notes: "GwG OHNE EXPORT",
    },
  },
  {
    date: "2026-09-25",
    file: "IG_STORY_09.jpg",
    linked: 57,
    hook: "Story · Marke bleibt",
    plan: {
      strategy_text: "After-hours brand still — reshare feed Teil 20.",
      sticker_type: "link",
      stickers: ["link"],
      link_url: "https://www.sign2x.com",
      cta_hint: "Link to site / feed",
      frame_notes: "Dark MARKE BLEIBT",
    },
  },
  {
    date: "2026-09-28",
    file: "IG_STORY_10.jpg",
    linked: 107,
    hook: "Story · Echte Namen",
    plan: {
      strategy_text: "Proof carousel companion — no invented quotes.",
      sticker_type: "link",
      stickers: ["link", "question"],
      link_url: "https://www.sign2x.com",
      link_label: "Namen",
      cta_hint: "Link + question „Wen kennt ihr?“",
      frame_notes: "ECHTE NAMEN",
    },
  },
  {
    date: "2026-09-30",
    file: "IG_STORY_11.jpg",
    linked: 109,
    hook: "Story · TCO bis 20% — Finale",
    plan: {
      strategy_text: "September close: honest TCO up to 20%. Link quiz + site.",
      sticker_type: "link",
      stickers: ["link", "countdown"],
      link_url: "https://www.sign2x.com/quiz",
      link_label: "Quiz",
      cta_hint: "Link quiz; optional countdown to Oct",
      frame_notes: "TCO BIS 20%",
    },
  },
];

async function main() {
  mkdirSync(SEPT, { recursive: true });

  const { data: existing } = await admin
    .from("content_posts")
    .select("id, post_number, scheduled_date, visual_format, hook_angle")
    .eq("calendar_id", CALENDAR_ID);
  const byNum = Object.fromEntries((existing || []).map((p) => [p.post_number, p]));

  // Skip if stories already created for these hooks
  const already = (existing || []).filter(
    (p) => p.visual_format === "story" && String(p.hook_angle || "").startsWith("Story ·")
  );
  if (already.length >= 10) {
    console.log(`Already have ${already.length} stories — skip insert.`);
    return;
  }

  const { data: settings } = await admin
    .from("content_settings")
    .select("next_post_number")
    .eq("project_id", PROJECT_ID)
    .single();
  let nextNum = Number(settings?.next_post_number || 200);

  let created = 0;
  for (const spec of STORIES) {
    if (!existsSync(join(ASSETS, spec.file))) {
      console.log(`Missing asset ${spec.file}`);
      continue;
    }
    copyFileSync(join(ASSETS, spec.file), join(SEPT, spec.file));

    const linkedId = spec.linked && byNum[spec.linked] ? byNum[spec.linked].id : null;
    const postNumber = nextNum++;
    const { data: row, error: insErr } = await admin
      .from("content_posts")
      .insert([
        {
          calendar_id: CALENDAR_ID,
          project_id: PROJECT_ID,
          post_number: postNumber,
          platforms: ["instagram"],
          scheduled_date: spec.date,
          pillar: "PRODUCT",
          hook_angle: spec.hook,
          visual_brief: {
            background: "IG Story 9:16",
            style_notes: TYPE,
            graphic_description: spec.plan.frame_notes,
            typography_notes: TYPE,
          },
          visual_format: "story",
          media_kind: "image",
          media: [],
          media_by_platform: {},
          captions: {
            instagram: {
              de: spec.plan.strategy_text,
              en: spec.plan.strategy_text,
            },
          },
          hashtags: {},
          team_reshare_captions: {},
          voiceover_script: {},
          ad_status: "organic",
          story_repost: spec.plan,
          linked_post_id: linkedId,
          is_video: false,
          status_production: "wip",
          status_approval: "draft",
          angle_approved: false,
          locked: false,
          remarks: linkedId ? `Linked Story → #${spec.linked}` : "Standalone Story",
        },
      ])
      .select("id, post_number")
      .single();
    if (insErr) throw new Error(insErr.message);

    const bytes = readFileSync(join(ASSETS, spec.file));
    const path = `${PROJECT_ID}/${row.id}/${Date.now()}-${basename(spec.file)}`;
    const { error: upErr } = await admin.storage.from("content-media").upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = admin.storage.from("content-media").getPublicUrl(path);
    const media = [
      {
        id: randomUUID(),
        url: pub.publicUrl,
        kind: "image",
        source: "upload",
        storage_path: path,
      },
    ];
    await admin
      .from("content_posts")
      .update({
        media,
        visual_asset_url: media[0].url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    console.log(
      `Story #${row.post_number} ${spec.date}${linkedId ? ` → #${spec.linked}` : " solo"}`
    );
    created++;
  }

  await admin
    .from("content_settings")
    .update({ next_post_number: nextNum, updated_at: new Date().toISOString() })
    .eq("project_id", PROJECT_ID);

  console.log(`Done. Created ${created} stories. next_post_number=${nextNum}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
