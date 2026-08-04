import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = resolve(root, ".env.local");
  const raw = readFileSync(envPath, "utf8");
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

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projRef = "fxjntpgyikryuczaxqlv";

async function run() {
  const sqlPath = resolve(root, "supabase/migrations/20260804220000_secure_client_access_and_tables.sql");
  const sql = readFileSync(sqlPath, "utf8");
  console.log("Applying Migration SQL to live Supabase...");

  // Try Supabase SQL query API
  const endpoints = [
    `https://api.supabase.com/v1/projects/${projRef}/sql`,
    `https://api.supabase.co/v1/projects/${projRef}/sql`
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(ep, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`
        },
        body: JSON.stringify({ query: sql })
      });
      console.log(`Endpoint ${ep} status:`, resp.status);
      if (resp.ok) {
        const data = await resp.json();
        console.log("✓ Success response:", data);
        return;
      } else {
        const text = await resp.text();
        console.log("Response text:", text);
      }
    } catch (err) {
      console.log("Fetch error for", ep, err.message);
    }
  }
}

run().catch(console.error);
