/**
 * Upload revised Sep 7 Sign2x creatives + align captions.
 * Usage: node scripts/revise-sign2x-sep7.mjs
 */
import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const ASSETS =
  "/Users/alihashemi/.cursor/projects/Users-alihashemi-Desktop-WIDE-wide-portal-V02/assets";

const PROJECT_ID = "96468999-a1df-4393-9a5a-6b1cd5b970ae";
const LI_ID = "13a706c7-c15c-423b-a57e-bb561bf6cb91";
const IG_ID = "0e9b72aa-927f-4973-b8e1-227850fdc139";

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

async function uploadResized(postId, srcPath, w, h, basename) {
  const bytes = await sharp(srcPath)
    .resize(w, h, { fit: "cover", position: "centre" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  const path = `${PROJECT_ID}/${postId}/${Date.now()}-${basename}`;
  const { error: upErr } = await admin.storage.from("content-media").upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);
  const { data: pub } = admin.storage.from("content-media").getPublicUrl(path);
  return {
    id: randomUUID(),
    url: pub.publicUrl,
    kind: "image",
    source: "upload",
    storage_path: path,
  };
}

const LI_CAPTIONS = {
  de: `Drei Fragen, bevor ihr einen E-Signatur-Anbieter festnagelt.

1. Wo liegen die Server — und unter welchem Recht?
   (Standort und Anbieterland sind zwei Antworten.)

2. Wer prüft die Identität — und wo landet der Ausweis?
   (GwG braucht Kontrolle, keinen Export in ein Fremdportal.)

3. Bleibt eure Marke auf dem Envelope — und geht on-prem, wenn nötig?
   (White-label und Deploy-Optionen gehören in denselben Vertrag.)

Wenn eine dieser Antworten weich wird, wird es später teuer.

Sign2x antwortet klar: Deutsche Telekom · Open Telekom Cloud (OTC), native Layer, White-label, on-prem möglich. Garantiert bester Preis in Deutschland bei voller Funktion — ehrlich bis zu 20 % TCO.

Self-Check:
https://www.sign2x.com/quiz

#sign2x #RFP #TCO #Datensouveränität`,
  en: `Three questions before you lock an e-sign vendor.

1. Where do the servers sit — and under which law?
   (Location and provider jurisdiction are two answers.)

2. Who checks identity — and where does the ID land?
   (AML needs control, not export into a foreign portal.)

3. Does your brand stay on the envelope — and can it run on-prem if needed?
   (White-label and deploy options belong in the same contract.)

If any answer goes soft, it gets expensive later.

Sign2x answers clearly: Deutsche Telekom · Open Telekom Cloud (OTC), native layer, white-label, on-prem when needed. Guaranteed best price in Germany at full feature set — honestly up to 20% TCO.

Self-check:
https://www.sign2x.com/quiz

#sign2x #RFP #TCO #DataSovereignty`,
};

const IG_CAPTIONS = {
  de: `Drei Spalten. Eine Entscheidung. 🔷

Server · Identität · On-prem

Wenn eine Spalte weich bleibt, wird der Vendor-Deal teuer.

https://www.sign2x.com/quiz

#sign2x #ImStackBleiben`,
  en: `Three columns. One decision. 🔷

Servers · Identity · On-prem

If one column stays soft, the vendor deal gets expensive.

https://www.sign2x.com/quiz

#sign2x #StayInTheStack`,
};

async function main() {
  // LI #88
  const { data: liRow, error: liGetErr } = await admin
    .from("content_posts")
    .select("id, media")
    .eq("id", LI_ID)
    .single();
  if (liGetErr) throw new Error(liGetErr.message);
  const oldLi = (Array.isArray(liRow.media) ? liRow.media : [])
    .map((m) => m?.storage_path)
    .filter(Boolean);
  if (oldLi.length) await admin.storage.from("content-media").remove(oldLi);

  const liMedia = [
    await uploadResized(
      LI_ID,
      join(ASSETS, "LI_P88_drei_fragen.jpg"),
      1350,
      1080,
      "LI_P88_drei_fragen.jpg"
    ),
  ];

  const { error: liUp } = await admin
    .from("content_posts")
    .update({
      hook_angle: "Drei RFP-Fragen: Server, ID, White-label / On-prem",
      captions: { linkedin: LI_CAPTIONS },
      media: liMedia,
      media_kind: "image",
      visual_brief: {
        background: "Electric blue #1041F4.",
        style_notes: "Drei kurze DE-Fragen mit ?. Logo once.",
        graphic_description:
          "DREI FRAGEN. Wo Server — welches Recht? Wer prüft die ID? Marke + On-prem?",
      },
      team_reshare_captions: {
        de: "Aus dem Team #sign2x: drei harte RFP-Fragen vor dem nächsten E-Signatur-Deal. Speichern lohnt sich.",
        en: "From Team #sign2x: three hard RFP questions before the next e-sign deal. Worth saving.",
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", LI_ID);
  if (liUp) throw new Error(liUp.message);
  console.log("LI #88 updated:", liMedia[0].url);

  // IG #89
  const { data: igRow, error: igGetErr } = await admin
    .from("content_posts")
    .select("id, media")
    .eq("id", IG_ID)
    .single();
  if (igGetErr) throw new Error(igGetErr.message);
  const oldIg = (Array.isArray(igRow.media) ? igRow.media : [])
    .map((m) => m?.storage_path)
    .filter(Boolean);
  if (oldIg.length) await admin.storage.from("content-media").remove(oldIg);

  const igMedia = [
    await uploadResized(
      IG_ID,
      join(ASSETS, "IGU_P89_drei_spalten.jpg"),
      1080,
      1350,
      "IGU_P89_drei_spalten.jpg"
    ),
  ];

  const { error: igUp } = await admin
    .from("content_posts")
    .update({
      hook_angle: "Whiteboard — Server / ID / On-prem",
      captions: { instagram: IG_CAPTIONS },
      media: igMedia,
      media_kind: "image",
      visual_brief: {
        background: "Window sill / office ledge, soft light.",
        style_notes: "Three whiteboard columns all filled.",
        typography_notes: "Blue marker on white board.",
        graphic_description:
          "DREI SPALTEN — SERVER | IDENTITÄT | ON-PREM. All three headers present.",
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", IG_ID);
  if (igUp) throw new Error(igUp.message);
  console.log("IG #89 updated:", igMedia[0].url);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
