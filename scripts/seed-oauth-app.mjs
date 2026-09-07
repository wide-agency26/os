/**
 * Upsert encrypted OAuth app credentials from a JSON file.
 * Usage: node scripts/seed-oauth-app.mjs /tmp/apps.json
 * JSON: { "apps": [{ "provider": "meta", "company_id": "...", "app_id": "...", "secret": "...", "label": "MSF" }] }
 * Never commit the JSON file.
 */
import { createCipheriv, randomBytes } from "crypto";
import { readFileSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function encryptionKey() {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  if (Buffer.byteLength(raw, "utf8") === 32) return Buffer.from(raw, "utf8");
  throw new Error("CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
}

function encryptSecret(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

loadEnvLocal();

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("Usage: node scripts/seed-oauth-app.mjs <apps.json>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!url || !serviceKey) {
  console.error("Missing Supabase URL or service role key in .env.local");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(jsonPath, "utf8"));
const apps = payload.apps || [];
if (!apps.length) {
  console.error("No apps in JSON");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const now = new Date().toISOString();
for (const app of apps) {
  if (!app.company_id || !app.app_id || !app.secret) {
    throw new Error("Each app needs company_id, app_id, and secret");
  }
  const row = {
    provider: app.provider || "meta",
    company_id: app.company_id,
    project_id: null,
    app_id: String(app.app_id).trim(),
    secret_ciphertext: encryptSecret(String(app.secret).trim()),
    label: app.label || null,
    updated_at: now,
  };
  const { data: existing, error: findErr } = await admin
    .from("project_oauth_apps")
    .select("id")
    .eq("provider", row.provider)
    .eq("company_id", row.company_id)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing?.id) {
    const { error } = await admin.from("project_oauth_apps").update(row).eq("id", existing.id);
    if (error) throw error;
    console.log(`updated ${row.label || row.company_id} app ${row.app_id}`);
  } else {
    const { error } = await admin.from("project_oauth_apps").insert(row);
    if (error) throw error;
    console.log(`inserted ${row.label || row.company_id} app ${row.app_id}`);
  }
}

if (process.argv.includes("--unlink")) {
  unlinkSync(jsonPath);
}
