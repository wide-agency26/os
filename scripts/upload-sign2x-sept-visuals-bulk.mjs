/**
 * Upload all Sept_P* assets from Cursor assets + copy into Sign2x/Social/Sept.
 * Usage: node scripts/upload-sign2x-sept-visuals-bulk.mjs
 */
import { readFileSync, copyFileSync, existsSync, readdirSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { resolve, dirname, basename, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const ASSETS =
  "/Users/alihashemi/.cursor/projects/Users-alihashemi-Desktop-WIDE-wide-portal-V02/assets";
const SEPT = "/Users/alihashemi/Desktop/WIDE/Sign2x/Social/Sept";
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

/** post_number → ordered local filenames (relative to ASSETS, also copied to SEPT) */
const MAP = {
  84: ["Sept_P84.jpg"],
  85: ["Sept_P85.jpg"],
  86: ["Sept_P86.jpg"],
  87: ["Sept_P87.jpg"],
  88: ["Sept_P88.jpg"],
  89: ["Sept_P89.jpg"],
  90: ["Sept_P90.jpg"],
  52: ["Sept_P52_01.jpg", "Sept_P52_02.jpg", "Sept_P52_03.jpg", "Sept_P52_04.jpg"],
  91: ["Sept_P91.jpg"],
  68: ["Sept_P68.jpg"],
  92: ["Sept_P92.jpg"],
  64: ["Sept_P64.jpg"],
  93: ["Sept_P93.jpg"],
  94: ["Sept_P94.jpg"],
  95: ["Sept_P95.jpg"],
  53: ["Sept_P53.jpg"],
  96: ["Sept_P96.jpg"],
  51: ["Sept_P51.jpg"],
  80: ["Sept_P80.jpg"],
  54: ["Sept_P54.jpg"],
  97: ["Sept_P97.jpg"],
  69: ["Sept_P69_01.jpg", "Sept_P69_02.jpg", "Sept_P69_03.jpg", "Sept_P69_04.jpg"],
  98: ["Sept_P98.jpg"],
  81: ["Sept_P81.jpg"],
  99: ["Sept_P99.jpg"],
  100: ["Sept_P100.jpg"],
  101: ["Sept_P101.jpg"],
  70: ["Sept_P70.jpg"],
  102: ["Sept_P102.jpg"],
  82: ["Sept_P82_01.jpg", "Sept_P82_02.jpg", "Sept_P82_03.jpg", "Sept_P82_04.jpg"],
  103: ["Sept_P103.jpg"],
  55: ["Sept_P55.jpg"],
  104: ["Sept_P104.jpg"],
  57: ["Sept_P57.jpg"],
  105: ["Sept_P105.jpg"],
  83: ["Sept_P83.jpg"],
  106: ["Sept_P106.jpg"],
  107: ["Sept_P107.jpg"],
  56: ["Sept_P56.jpg"],
  108: ["Sept_P108.jpg"],
  58: ["Sept_P58.jpg"],
  109: ["Sept_P109.jpg"],
};

async function main() {
  mkdirSync(SEPT, { recursive: true });
  const { data: posts, error } = await admin
    .from("content_posts")
    .select("id, post_number, project_id, media, status_production")
    .eq("calendar_id", CALENDAR_ID);
  if (error) throw new Error(error.message);
  const byNum = Object.fromEntries((posts || []).map((p) => [p.post_number, p]));

  let ok = 0;
  let skip = 0;
  for (const [numStr, files] of Object.entries(MAP)) {
    const num = Number(numStr);
    const post = byNum[num];
    if (!post) {
      console.log(`No post #${num}`);
      skip++;
      continue;
    }
    if (post.status_production === "live") {
      console.log(`Skip live #${num}`);
      skip++;
      continue;
    }
    const missing = files.filter((f) => !existsSync(join(ASSETS, f)));
    if (missing.length) {
      console.log(`Missing files for #${num}: ${missing.join(", ")}`);
      skip++;
      continue;
    }

    for (const f of files) {
      copyFileSync(join(ASSETS, f), join(SEPT, f));
    }

    const oldPaths = (Array.isArray(post.media) ? post.media : [])
      .map((m) => m?.storage_path)
      .filter(Boolean);
    if (oldPaths.length) await admin.storage.from("content-media").remove(oldPaths);

    const media = [];
    for (const f of files) {
      const bytes = readFileSync(join(ASSETS, f));
      const path = `${post.project_id}/${post.id}/${Date.now()}-${basename(f)}`;
      const { error: upErr } = await admin.storage.from("content-media").upload(path, bytes, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (upErr) throw new Error(`#${num} ${f}: ${upErr.message}`);
      const { data: pub } = admin.storage.from("content-media").getPublicUrl(path);
      media.push({
        id: randomUUID(),
        url: pub.publicUrl,
        kind: "image",
        source: "upload",
        storage_path: path,
      });
    }

    const { data: fresh } = await admin
      .from("content_posts")
      .select("remarks")
      .eq("id", post.id)
      .single();
    const mediaKind = media.length > 1 ? "carousel" : "image";
    const { error: saveErr } = await admin
      .from("content_posts")
      .update({
        media,
        media_by_platform: {},
        media_kind: mediaKind,
        is_video: false,
        visual_format: "feed",
        visual_asset_url: media[0].url,
        remarks: [fresh?.remarks || "", "Sept daily visuals attached."]
          .filter(Boolean)
          .join(" | "),
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    if (saveErr) throw new Error(`Save #${num}: ${saveErr.message}`);
    console.log(`#${num} ← ${files.length} slide(s) (${mediaKind})`);
    ok++;
  }

  const { data: check } = await admin
    .from("content_posts")
    .select("post_number, visual_asset_url")
    .eq("calendar_id", CALENDAR_ID);
  const missingVisual = (check || []).filter((p) => !p.visual_asset_url);
  console.log(`\nUploaded ${ok}, skipped ${skip}. Still without visual: ${missingVisual.length}`);
  if (missingVisual.length) {
    console.log(missingVisual.map((p) => p.post_number).join(", "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
