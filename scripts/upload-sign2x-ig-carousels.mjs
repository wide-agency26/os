/**
 * Upload IG carousel slides for Im Stack bleiben posts.
 * Usage: node scripts/upload-sign2x-ig-carousels.mjs
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
  67: ["IG_P67_01.jpg", "IG_P67_02.jpg", "IG_P67_03.jpg", "IG_P67_04.jpg"],
  86: ["IG_P86_01.jpg", "IG_P86_02.jpg", "IG_P86_03.jpg"],
  91: ["IG_P91_01.jpg", "IG_P91_02.jpg", "IG_P91_03.jpg", "IG_P91_04.jpg"],
  95: ["IG_P95_01.jpg", "IG_P95_02.jpg", "IG_P95_03.jpg"],
  98: ["IG_P98_01.jpg", "IG_P98_02.jpg", "IG_P98_03.jpg", "IG_P98_04.jpg"],
  70: ["IG_P70_01.jpg", "IG_P70_02.jpg", "IG_P70_03.jpg"],
  107: ["IG_P107_01.jpg", "IG_P107_02.jpg", "IG_P107_03.jpg", "IG_P107_04.jpg"],
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
      console.log(`Missing #${num}`);
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

    const { error: saveErr } = await admin
      .from("content_posts")
      .update({
        media,
        media_by_platform: {},
        media_kind: "carousel",
        is_video: false,
        visual_format: "feed",
        visual_asset_url: media[0].url,
        remarks: [post.remarks || "", "IG carousel uploaded"].filter(Boolean).join(" | "),
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
    if (saveErr) throw new Error(`Save #${num}: ${saveErr.message}`);
    console.log(`#${num} ← ${files.length} carousel`);
    ok++;
  }
  console.log(`Done. ${ok} carousels.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
