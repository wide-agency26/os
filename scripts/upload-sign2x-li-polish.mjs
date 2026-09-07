/**
 * Upload polished LinkedIn visuals (exclude #78).
 * Usage: node scripts/upload-sign2x-li-polish.mjs
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

const MAP = {
  84: ["LI_P84.jpg"],
  79: ["LI_P79_01.jpg", "LI_P79_02.jpg", "LI_P79_03.jpg", "LI_P79_04.jpg"],
  87: ["LI_P87.jpg"],
  88: ["LI_P88.jpg"],
  90: ["LI_P90.jpg"],
  52: ["LI_P52_01.jpg", "LI_P52_02.jpg", "LI_P52_03.jpg", "LI_P52_04.jpg"],
  68: ["LI_P68.jpg"],
  93: ["LI_P93.jpg"],
  94: ["LI_P94.jpg"],
  53: ["LI_P53.jpg"],
  51: ["LI_P51.jpg"],
  54: ["LI_P54.jpg"],
  69: ["LI_P69_01.jpg", "LI_P69_02.jpg", "LI_P69_03.jpg", "LI_P69_04.jpg"],
  99: ["LI_P99.jpg"],
  100: ["LI_P100.jpg"],
  102: ["LI_P102.jpg"],
  82: ["LI_P82_01.jpg", "LI_P82_02.jpg", "LI_P82_03.jpg", "LI_P82_04.jpg"],
  55: ["LI_P55.jpg"],
  105: ["LI_P105.jpg"],
  106: ["LI_P106.jpg"],
  56: ["LI_P56.jpg"],
  58: ["LI_P58.jpg"],
};

async function main() {
  mkdirSync(SEPT, { recursive: true });
  const { data: posts, error } = await admin
    .from("content_posts")
    .select("id, post_number, project_id, media, remarks, status_production")
    .eq("calendar_id", CALENDAR_ID);
  if (error) throw new Error(error.message);
  const byNum = Object.fromEntries((posts || []).map((p) => [p.post_number, p]));

  let ok = 0;
  for (const [numStr, files] of Object.entries(MAP)) {
    const num = Number(numStr);
    const post = byNum[num];
    if (!post) {
      console.log(`Missing post #${num}`);
      continue;
    }
    if (post.status_production === "live") {
      console.log(`Skip live #${num}`);
      continue;
    }
    const missing = files.filter((f) => !existsSync(join(ASSETS, f)));
    if (missing.length) {
      console.log(`#${num} missing: ${missing.join(", ")}`);
      continue;
    }
    for (const f of files) copyFileSync(join(ASSETS, f), join(SEPT, f));

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
        remarks: [post.remarks || "", "LI glass polish: medium type + glass clusters."]
          .filter(Boolean)
          .join(" | "),
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
    if (saveErr) throw new Error(`Save #${num}: ${saveErr.message}`);
    console.log(`#${num} ← ${files.length} (${mediaKind})`);
    ok++;
  }
  console.log(`Done. Updated ${ok} LI posts. #78 untouched.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
