/**
 * Throwaway Context Bank smoke — Sign2x Digital Marketing, then deletes its own rows.
 * Usage: npx tsx scripts/context-bank-smoke.ts
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { logToContextBank } from "../lib/context-bank/log";
import { generateContextDigestForScope } from "../lib/context-bank/digest";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const match = t.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    let value = match[2] || "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

const COMPANY_ID = "c4ef4be8-9d61-4de6-a327-db4b39f9d733"; // Sign2x
const PROJECT_ID = "96468999-a1df-4393-9a5a-6b1cd5b970ae"; // Sign2x Digital Marketing
const MARKER = "__cb_smoke__";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const admin = createClient(url, key);

  const { data: company, error: cErr } = await admin
    .from("crm_customers")
    .select("id, record_kind, company, name")
    .eq("id", COMPANY_ID)
    .maybeSingle();
  if (cErr || !company) throw new Error(cErr?.message || "Sign2x company missing");
  if (company.record_kind !== "company") {
    throw new Error(`Expected record_kind=company, got ${company.record_kind}`);
  }

  const { data: staff } = await admin
    .from("profiles")
    .select("id, role")
    .in("role", ["superadmin", "admin", "client_manager"])
    .limit(1)
    .maybeSingle();

  const helper = await logToContextBank(
    {
      company_id: COMPANY_ID,
      project_id: PROJECT_ID,
      entry_type: "note",
      source_type: "manual",
      title: `${MARKER} helper payload`,
      content: "Full helper payload from smoke script.",
      is_system_generated: true,
      created_by: staff?.id ?? null,
    },
    admin as any
  );
  if (!helper.ok) throw new Error(`helper failed: ${helper.error}`);
  console.log("helper insert", helper.id);

  const manual = await logToContextBank(
    {
      company_id: COMPANY_ID,
      project_id: null,
      entry_type: "comment",
      source_type: "manual",
      title: `${MARKER} manual note`,
      content: "Company-wide manual note.",
      is_system_generated: false,
      created_by: staff?.id ?? null,
    },
    admin as any
  );
  if (!manual.ok) throw new Error(`manual failed: ${manual.error}`);
  console.log("manual insert", manual.id);

  const { data: manualRow } = await admin
    .from("context_entries")
    .select("is_system_generated, created_by, project_id")
    .eq("id", manual.id)
    .maybeSingle();
  if (!manualRow || manualRow.is_system_generated !== false) {
    throw new Error("manual note should have is_system_generated=false");
  }
  if (staff?.id && manualRow.created_by !== staff.id) {
    throw new Error("created_by mismatch");
  }
  if (manualRow.project_id !== null) throw new Error("company-wide note should have null project_id");

  const firstDigest = await generateContextDigestForScope(COMPANY_ID, PROJECT_ID);
  console.log("digest 1", firstDigest.ok, firstDigest.skipped, firstDigest.digest?.id || firstDigest.error);
  if (!firstDigest.ok) throw new Error(firstDigest.error || "digest 1 failed");

  const secondDigest = await generateContextDigestForScope(COMPANY_ID, PROJECT_ID);
  console.log("digest 2", secondDigest.ok, secondDigest.skipped, secondDigest.reason);
  if (!secondDigest.ok) throw new Error(secondDigest.error || "digest 2 failed");
  if (!secondDigest.skipped) {
    throw new Error("second digest should skip when no new entries");
  }

  await admin.from("context_entries").delete().like("title", `${MARKER}%`);
  if (firstDigest.digest?.id) {
    await admin.from("context_digests").delete().eq("id", firstDigest.digest.id);
  }

  console.log("ok — smoke rows removed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
