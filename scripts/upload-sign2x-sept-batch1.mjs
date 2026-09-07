/**
 * Upload Batch 1 Sign2x Sept stills into content calendar posts.
 * Usage: node scripts/upload-sign2x-sept-batch1.mjs
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
    postId: "fb54050f-e723-4d69-9eae-0d7ca676b262",
    postNumber: 79,
    mediaKind: "carousel",
    files: ["Post79_01.jpg", "Post79_02.jpg", "Post79_03.jpg", "Post79_04.jpg"],
    remarksNote: "Batch1 AI stills attached 2 Sep for review. Open Sans. Logo sparse on LI only.",
  },
  {
    postId: "095698ab-e1ec-4395-a024-69153b1ea6d3",
    postNumber: 63,
    mediaKind: "image",
    files: ["Post63.jpg"],
    remarksNote: "Batch1 AI still attached 2 Sep for review. No logo. Overlay baked.",
  },
  {
    postId: "2485746f-9942-4847-b47f-094f9a48a936",
    postNumber: 71,
    mediaKind: "image",
    files: ["Post71.jpg"],
    remarksNote: "Batch1 AI still attached 2 Sep for review. No logo. Overlay baked.",
  },
  {
    postId: "d17b5487-28c4-48ae-86e7-263001380cd8",
    postNumber: 50,
    mediaKind: "image",
    files: ["Post50.jpg"],
    remarksNote: "Batch1 AI still attached 2 Sep for review. No logo. Type on Post-it.",
  },
];

function createMediaItem({ url: mediaUrl, storage_path }) {
  return {
    id: randomUUID(),
    url: mediaUrl,
    kind: "image",
    source: "upload",
    storage_path,
  };
}

async function uploadFile(projectId, postId, filename) {
  const bytes = readFileSync(resolve(SEPT, filename));
  const path = `${projectId}/${postId}/${Date.now()}-${basename(filename)}`;
  const { error: upErr } = await admin.storage.from("content-media").upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (upErr) throw new Error(`Upload ${filename}: ${upErr.message}`);
  const { data: pub } = admin.storage.from("content-media").getPublicUrl(path);
  return createMediaItem({ url: pub.publicUrl, storage_path: path });
}

async function main() {
  for (const job of JOBS) {
    const { data: existing, error: loadErr } = await admin
      .from("content_posts")
      .select("*")
      .eq("id", job.postId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!existing) throw new Error(`Post ${job.postNumber} not found`);
    if (existing.status_production === "live") {
      throw new Error(`Post ${job.postNumber} is live — skip`);
    }

    const projectId = String(existing.project_id);
    const media = [];
    for (const file of job.files) {
      const item = await uploadFile(projectId, job.postId, file);
      media.push(item);
      console.log(`#${job.postNumber} + ${file} → ${item.url}`);
    }

    const cover = media[0]?.url || null;
    const remarks = [existing.remarks || "", job.remarksNote].filter(Boolean).join(" | ");
    const { error: saveErr } = await admin
      .from("content_posts")
      .update({
        media,
        media_by_platform: {},
        media_kind: job.mediaKind,
        is_video: false,
        visual_asset_url: cover,
        visual_format: "feed",
        remarks,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.postId);
    if (saveErr) throw new Error(`Save #${job.postNumber}: ${saveErr.message}`);
    console.log(`#${job.postNumber} saved (${job.mediaKind}, ${media.length} slides)`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
