/**
 * Resize generated LinkedIn covers, upload to content-media, seed social_assets + copy.
 * Usage: node scripts/seed-sign2x-linkedin-kit.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const ASSETS =
  "/Users/alihashemi/.cursor/projects/Users-alihashemi-Desktop-WIDE-wide-portal-V02/assets";
const OUT = join(ASSETS, "li-kit-out");
const PROJECT_ID = "96468999-a1df-4393-9a5a-6b1cd5b970ae";
const SIGN2X_LI = "https://www.linkedin.com/company/sign2x/";

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

const COVERS = [
  {
    file: "LI_COVER_CO_01.jpg",
    kind: "company",
    label: "Datensouveränität",
    w: 4200,
    h: 700,
    preferred: true,
  },
  {
    file: "LI_COVER_CO_02.jpg",
    kind: "company",
    label: "Hosting · Telekom OTC",
    w: 4200,
    h: 700,
    preferred: false,
  },
  {
    file: "LI_COVER_EMP_01.jpg",
    kind: "employee",
    label: "Datensouveränität",
    w: 1584,
    h: 396,
    preferred: true,
  },
  {
    file: "LI_COVER_EMP_02.jpg",
    kind: "employee",
    label: "Native im Stack",
    w: 1584,
    h: 396,
    preferred: false,
  },
  {
    file: "LI_COVER_EMP_03.jpg",
    kind: "employee",
    label: "Bester Preis · Volle Funktion",
    w: 1584,
    h: 396,
    preferred: false,
  },
];

const COPY = {
  company_url: SIGN2X_LI,
  about_de: `Ich arbeite mit Sign2x — der souveränen E-Signatur-API für Softwarehersteller und ISVs.

Datensouveränität ohne US-Portal-Umweg: Hosting bei Deutsche Telekom · Open Telekom Cloud (OTC), native White-label-Schicht, eIDAS SES · AES · QES.

Mehr: https://www.sign2x.com · LinkedIn: ${SIGN2X_LI}`,
  about_en: `I work with Sign2x — the sovereign e-signature API for software manufacturers and ISVs.

Data sovereignty without a US portal detour: hosting on Deutsche Telekom · Open Telekom Cloud (OTC), native white-label layer, eIDAS SES · AES · QES.

More: https://www.sign2x.com · LinkedIn: ${SIGN2X_LI}`,
  experience_bullets_de: [
    "Sign2x als native White-label-Signatur-Schicht in B2B-Software eingebunden (kein Extra-Portal-Tab).",
    "Datensouveränität: Hosting Deutsche Telekom · Open Telekom Cloud (OTC), optional on-prem.",
    "eIDAS-Stufen SES · AES · QES nach Haftung gewählt — GwG-fähige Strecken ohne Ausweis-Export ins Ausland.",
    "Sichtbarkeit für das Produkt: Firmenseite folgen und teilen → https://www.linkedin.com/company/sign2x/",
  ],
  experience_bullets_en: [
    "Embedded Sign2x as a native white-label signature layer in B2B software (no extra portal tab).",
    "Data sovereignty: Deutsche Telekom · Open Telekom Cloud (OTC) hosting, on-prem when needed.",
    "eIDAS SES · AES · QES chosen by liability — AML-ready flows without shipping IDs abroad.",
    "Amplify the product: follow and share the company page → https://www.linkedin.com/company/sign2x/",
  ],
};

async function resizeCover(src, dest, w, h) {
  await sharp(src)
    .resize(w, h, { fit: "cover", position: "centre" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(dest);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const company_covers = [];
  const employee_covers = [];

  for (const c of COVERS) {
    const src = join(ASSETS, c.file);
    const destName = c.file.replace(/\.jpg$/i, `_${c.w}x${c.h}.jpg`);
    const dest = join(OUT, destName);
    await resizeCover(src, dest, c.w, c.h);
    const bytes = readFileSync(dest);
    const path = `${PROJECT_ID}/social-assets/${Date.now()}-${destName}`;
    const { error: upErr } = await admin.storage.from("content-media").upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (upErr) throw new Error(`${c.file}: ${upErr.message}`);
    const { data: pub } = admin.storage.from("content-media").getPublicUrl(path);
    const option = {
      id: randomUUID(),
      label: c.label,
      url: pub.publicUrl,
      kind: c.kind,
      preferred: c.preferred,
    };
    if (c.kind === "company") company_covers.push(option);
    else employee_covers.push(option);
    console.log(`Uploaded ${c.kind}: ${c.label} → ${pub.publicUrl}`);
  }

  const preferredEmp = employee_covers.find((x) => x.preferred) || employee_covers[0];
  const social_assets = {
    linkedin_employee_cover_url: preferredEmp?.url || null,
    company_covers,
    employee_covers,
    linkedin_employee_copy: COPY,
  };

  const { data: existing, error: getErr } = await admin
    .from("content_settings")
    .select("project_id, social_assets")
    .eq("project_id", PROJECT_ID)
    .maybeSingle();
  if (getErr) throw new Error(getErr.message);

  if (!existing) {
    const { error: insErr } = await admin.from("content_settings").insert({
      project_id: PROJECT_ID,
      social_assets,
      updated_at: new Date().toISOString(),
    });
    if (insErr) throw new Error(insErr.message);
  } else {
    const { error: upErr } = await admin
      .from("content_settings")
      .update({ social_assets, updated_at: new Date().toISOString() })
      .eq("project_id", PROJECT_ID);
    if (upErr) throw new Error(upErr.message);
  }

  writeFileSync(join(OUT, "social_assets.json"), JSON.stringify(social_assets, null, 2));
  console.log("Seeded content_settings.social_assets for Sign2x");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
