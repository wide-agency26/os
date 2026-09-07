/**
 * Batch 1 redo: replace media + patch hooks/captions/briefs for posts 79,63,71,50.
 * Usage: node scripts/upload-sign2x-sept-batch1-redo.mjs
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
    patch: {
      hook_angle: "#062 Native layer. Not a portal.",
      visual_brief: {
        background: "Electric blue #1041F4.",
        style_notes:
          "4-slide carousel. Cream/white Open Sans. One 3D glass object per slide. Real Sign2x logo once per slide. Slide 4 screen = real Upload UI mockup.",
        graphic_description:
          "1 NATIVE LAYER — Kein Extra-Portal. 2 YOUR BRAND — White-label envelope. 3 YOUR SERVERS — STACKIT + Telekom type-only. 4 TWO MINUTES — quiz URL + Sign2x Upload UI on monitor.",
        slide_1: "NATIVE LAYER — Kein Extra-Portal. Sign2x sitzt in eurem Stack.",
        slide_2: "YOUR BRAND — White-label. Der Envelope trägt euren Namen.",
        slide_3: "YOUR SERVERS — STACKIT + Telekom. Oder on-prem.",
        slide_4: "TWO MINUTES — www.sign2x.com/quiz + product UI on screen.",
      },
      remarks:
        "Batch1 redo 2 Sep. LI logos ok sparse. Slide 4 uses real Upload mockup. Style lock candidate. Not Live.",
    },
  },
  {
    postId: "095698ab-e1ec-4395-a024-69153b1ea6d3",
    postNumber: 63,
    mediaKind: "image",
    files: ["Post63.jpg"],
    patch: {
      hook_angle: "#047 Homecare table. Kein Extra Tab.",
      visual_brief: {
        background: "Homecare living room, cream sofa table, daylight, no kitchen, no people.",
        style_notes:
          "3:4 lifestyle. Open Sans. Big type KEIN EXTRA TAB with depth. Tablet shows Reporting UI. Branded contract header. No floating IG logo. No sticky notes.",
        graphic_description:
          "Two mugs, tablet with Sign2x Reporting UI, blue-header contract. Overlay/depth type: KEIN EXTRA TAB.",
      },
      captions: {
        instagram: {
          de: "Kein Extra-Tab. 🔷\nAuch wenn es auf dem Couchtisch startet.\n\nKein US-Portal. Native im Stack.\nSTACKIT + Telekom. 100% Datensouveränität. 🇩🇪\n\n#sign2x #Datensouveränität",
          en: "No extra tab. 🔷\nEven when it starts on the coffee table.\n\nNo US portal. Native in the stack.\nSTACKIT + Telekom. 100% data sovereignty. 🇩🇪\n\n#sign2x #DataSovereignty",
        },
      },
      remarks:
        "Batch1 redo 2 Sep. Hook diversified off Die Unterhaltung. Reporting UI on tablet. No IG logo. Not Live.",
    },
  },
  {
    postId: "2485746f-9942-4847-b47f-094f9a48a936",
    postNumber: 71,
    mediaKind: "image",
    files: ["Post71.jpg"],
    patch: {
      hook_angle: "#061 Bleibt im Haus. Blue Sign2x folder in the bag.",
      visual_brief: {
        background: "Cream hallway / entry, daylight.",
        style_notes:
          "3:4 lifestyle. Blue #1041F4 folder with white SIGN2x type. Overlay BLEIBT IM HAUS. No floating logo. No sticky.",
        graphic_description: "Branded blue Sign2x folder sliding into leather bag. BLEIBT IM HAUS.",
      },
      captions: {
        instagram: {
          de: "Bleibt im Haus. 🔷\nDer Vertrag muss nicht durch ein US-Portal.\n\nSTACKIT + Telekom. 100% Datensouveränität. 🇩🇪\n\n#sign2x #Datensouveränität",
          en: "Stays in the house. 🔷\nThe contract does not need a US portal.\n\nSTACKIT + Telekom. 100% data sovereignty. 🇩🇪\n\n#sign2x #DataSovereignty",
        },
      },
      remarks:
        "Batch1 redo 2 Sep. Branded blue folder. No floating IG logo. Not Live.",
    },
  },
  {
    postId: "d17b5487-28c4-48ae-86e7-263001380cd8",
    postNumber: 50,
    mediaKind: "image",
    files: ["Post50.jpg"],
    patch: {
      hook_angle: "#046 Kitchen table. Ohne US-Portal.",
      visual_brief: {
        background: "Cream stone kitchen table, morning window light, no people.",
        style_notes:
          "3:4 lifestyle. Large Open Sans OHNE US-PORTAL behind/around objects — no sticky notes, no handwriting. Tablet shows Upload UI. No floating IG logo.",
        graphic_description:
          "Kitchen still: cups + tablet with Sign2x Upload UI. Depth typography OHNE US-PORTAL partially behind objects.",
      },
      captions: {
        instagram: {
          de: "Ohne US-Portal. 🔷\nKüchentisch. Vertrag. Fertig.\n\nNative E-Signatur. 100% Datensouveränität. 🔒\n\n#sign2x #Datensouveränität",
          en: "Without a US portal. 🔷\nKitchen table. Contract. Done.\n\nNative e-signature. 100% data sovereignty. 🔒\n\n#sign2x #DataSovereignty",
        },
      },
      remarks:
        "Batch1 redo 2 Sep. New hook OHNE US-PORTAL — not Die Unterhaltung clone. No sticky. Upload UI on tablet. Not Live.",
    },
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

    // Best-effort delete prior storage objects for this post
    const oldMedia = Array.isArray(existing.media) ? existing.media : [];
    const paths = oldMedia.map((m) => m?.storage_path).filter(Boolean);
    if (paths.length) {
      await admin.storage.from("content-media").remove(paths);
    }

    const projectId = String(existing.project_id);
    const media = [];
    for (const file of job.files) {
      const item = await uploadFile(projectId, job.postId, file);
      media.push(item);
      console.log(`#${job.postNumber} + ${file}`);
    }

    const { error: saveErr } = await admin
      .from("content_posts")
      .update({
        ...job.patch,
        media,
        media_by_platform: {},
        media_kind: job.mediaKind,
        is_video: false,
        visual_asset_url: media[0]?.url || null,
        visual_format: "feed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.postId);
    if (saveErr) throw new Error(`Save #${job.postNumber}: ${saveErr.message}`);
    console.log(`#${job.postNumber} replaced (${job.mediaKind}, ${media.length})`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
