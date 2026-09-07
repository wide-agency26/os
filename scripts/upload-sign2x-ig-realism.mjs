/**
 * IG realism pass: replace media for posts 63, 71, 50 only.
 * Usage: node scripts/upload-sign2x-ig-realism.mjs
 */
import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const SEPT = "/Users/alihashemi/Desktop/WIDE/Sign2x/Social/Sept";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Missing Supabase URL or service role key");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const JOBS = [
  {
    postId: "095698ab-e1ec-4395-a024-69153b1ea6d3",
    postNumber: 63,
    file: "Post63.jpg",
    remarksNote: "IG realism pass 2 Sep — lived-in light/mess, less AI showroom.",
  },
  {
    postId: "2485746f-9942-4847-b47f-094f9a48a936",
    postNumber: 71,
    file: "Post71.jpg",
    remarksNote: "IG realism pass 2 Sep — worn leather/entryway, less AI showroom.",
  },
  {
    postId: "d17b5487-28c4-48ae-86e7-263001380cd8",
    postNumber: 50,
    file: "Post50.jpg",
    remarksNote: "IG realism pass 2 Sep — kitchen texture/coffee mess, less AI showroom.",
  },
];

async function main() {
  for (const job of JOBS) {
    const { data: existing, error } = await admin
      .from("content_posts")
      .select("*")
      .eq("id", job.postId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!existing) throw new Error(`Post ${job.postNumber} missing`);
    if (existing.status_production === "live") throw new Error(`#${job.postNumber} live`);

    const oldPaths = (Array.isArray(existing.media) ? existing.media : [])
      .map((m) => m?.storage_path)
      .filter(Boolean);
    if (oldPaths.length) await admin.storage.from("content-media").remove(oldPaths);

    const bytes = readFileSync(resolve(SEPT, job.file));
    const path = `${existing.project_id}/${job.postId}/${Date.now()}-${basename(job.file)}`;
    const { error: upErr } = await admin.storage.from("content-media").upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = admin.storage.from("content-media").getPublicUrl(path);
    const item = {
      id: randomUUID(),
      url: pub.publicUrl,
      kind: "image",
      source: "upload",
      storage_path: path,
    };
    const remarks = [existing.remarks || "", job.remarksNote].filter(Boolean).join(" | ");
    const { error: saveErr } = await admin
      .from("content_posts")
      .update({
        media: [item],
        media_by_platform: {},
        media_kind: "image",
        is_video: false,
        visual_asset_url: item.url,
        remarks,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.postId);
    if (saveErr) throw new Error(saveErr.message);
    console.log(`#${job.postNumber} replaced → ${item.url}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
