/**
 * Market Analysis smoke — TARA MVB, then deletes its own rows.
 * Usage: npx tsx scripts/market-analysis-smoke.ts
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { draftMarketAnalysis, draftMarketField } from "../lib/market/generate";
import { syncMarketModuleStatus } from "../lib/market/sync";
import { MARKET_MODULE_KEY } from "../lib/strategy/modules";
import type { ContextDoc } from "../lib/content/types";

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

const PROJECT_ID = "2eb67cac-9150-4a48-9d5d-54d340da7e24"; // TARA MVB
const SCOPE_ID = "3a3659bf-6581-4452-aadf-d08d636d9ae1";
const DOC_ID = "496b2233-ecef-48f2-9f6b-163602c5b06f";
const MARKER = "__TEST__ market";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const admin = createClient(url, key);

  const { data: docRow, error: docErr } = await admin
    .from("content_context_docs")
    .select("id")
    .eq("id", DOC_ID)
    .maybeSingle();
  if (docErr || !docRow) throw new Error(docErr?.message || "Context doc missing (sanity)");

  const docs = [
    {
      id: "synthetic-market-doc",
      project_id: PROJECT_ID,
      filename: "market-brief.md",
      file_url: null,
      file_path: null,
      mime_type: "text/markdown",
      extracted_text: `TF Tax / TARA operates in German tax-advisory and accounting for Mittelstand.
Category size: DATEV-aligned Steuerberatung is a multi-billion euro professional-services market in Germany, with tens of thousands of Kanzleien.
Trend: digitization of Buchhaltung (DATEV, DATEV Unternehmen online) and client portals is the dominant 2024–2026 shift; inbound demand for automated USt and Lohn is rising.
Timing: now — E-Rechnung mandate and growing shortage of Steuerfachangestellte make software-enabled practices urgent.
Risk: fee pressure from Lohnsteuerhilfevereine and DIY tools; reputation risk if digital advice is not signed off by a Steuerberater.`,
      active: true,
      uploaded_at: new Date().toISOString(),
    },
  ] as ContextDoc[];

  console.log("phase 2: draft with research docs");
  const withDocs = await draftMarketAnalysis({
    company: "TF Tax",
    projectTitle: "TARA MVB",
    category: "Accounting",
    docs,
    unverified: false,
  });
  assert(withDocs.ok, `with-docs failed: ${!withDocs.ok ? withDocs.error : ""}`);
  const sourced = Object.values(withDocs.fields).filter((f) => f.origin === "sourced").length;
  assert(sourced >= 1, `with-docs expected at least one sourced field, got ${sourced}`);
  const inferredOnlyPrefix = Object.values(withDocs.fields).every((f) =>
    f.text.startsWith("[Unverified inference]")
  );
  assert(!inferredOnlyPrefix, "with-docs draft was flagged unverified — expected grounding");
  console.log(`  sourced fields: ${sourced}/4`);

  console.log("phase 2: draft with no docs (unverified)");
  const noDocs = await draftMarketAnalysis({
    company: "TF Tax",
    projectTitle: "TARA MVB",
    category: "Accounting",
    docs: [],
    unverified: true,
  });
  assert(noDocs.ok, `no-docs failed: ${!noDocs.ok ? noDocs.error : ""}`);
  for (const [k, f] of Object.entries(noDocs.fields)) {
    assert(f.origin === "inferred", `${k} should be inferred`);
    assert(
      f.text.includes("Unverified") || f.text.toLowerCase().includes("infer"),
      `${k} missing unverified flag: ${f.text.slice(0, 80)}`
    );
  }
  console.log("  all four sections inferred + flagged");

  const { error: upsertErr } = await admin.from("market_analysis").upsert(
    {
      project_id: PROJECT_ID,
      category: "Accounting",
      size_notes: noDocs.fields.size_notes.text,
      trend_notes: noDocs.fields.trend_notes.text,
      timing_notes: noDocs.fields.timing_notes.text,
      risk_notes: noDocs.fields.risk_notes.text,
      status: "draft",
      ai_generated: true,
      field_meta: Object.fromEntries(
        Object.entries(noDocs.fields).map(([k, v]) => [k, { origin: v.origin }])
      ),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" }
  );
  if (upsertErr) throw new Error(upsertErr.message);

  const { data: row } = await admin
    .from("market_analysis")
    .select("id, size_notes, trend_notes")
    .eq("project_id", PROJECT_ID)
    .maybeSingle();
  assert(row?.id, "row missing after upsert");

  console.log("phase 3: manual size edit, regenerate trends");
  const manual = `${MARKER} MANUAL SIZE — do not clobber`;
  await admin
    .from("market_analysis")
    .update({ size_notes: manual, updated_at: new Date().toISOString() })
    .eq("id", row.id);

  const regen = await draftMarketField({
    company: "TF Tax",
    projectTitle: "TARA MVB",
    category: "Accounting",
    field: "trend_notes",
    docs: [],
    unverified: true,
  });
  assert(regen.ok, `field regen failed: ${!regen.ok ? regen.error : ""}`);
  await admin
    .from("market_analysis")
    .update({
      trend_notes: regen.text,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  const { data: after } = await admin
    .from("market_analysis")
    .select("size_notes, trend_notes")
    .eq("id", row.id)
    .maybeSingle();
  assert(after?.size_notes === manual, "manual size edit was clobbered");
  assert(after?.trend_notes !== row.trend_notes, "trend_notes did not change");
  console.log("  size survived; trends replaced");

  console.log("phase 4: second strategy slot + finalize sync");
  const { data: extra, error: extraErr } = await admin
    .from("strategies")
    .insert({
      scope_id: SCOPE_ID,
      strategy_type: "website",
      status: "draft",
    })
    .select("id")
    .single();
  if (extraErr || !extra) throw new Error(extraErr?.message || "extra strategy insert failed");

  const { error: modErr } = await admin.from("strategy_modules").insert({
    strategy_id: extra.id,
    module_key: MARKET_MODULE_KEY,
    status: "not_started",
    sort_order: 1,
  });
  if (modErr) throw new Error(modErr.message);

  await admin
    .from("market_analysis")
    .update({ status: "finalized", updated_at: new Date().toISOString() })
    .eq("id", row.id);
  const finalStatus = await syncMarketModuleStatus(admin as any, PROJECT_ID);
  assert(finalStatus === "finalized", `expected finalized, got ${finalStatus}`);

  const { data: slots } = await admin
    .from("strategy_modules")
    .select("strategy_id, status, module_key")
    .eq("module_key", MARKET_MODULE_KEY)
    .in("strategy_id", [
      extra.id,
      ...(
        await admin
          .from("strategies")
          .select("id")
          .eq("scope_id", SCOPE_ID)
      ).data?.map((s) => s.id) ?? [],
    ]);
  const marketSlots = (slots ?? []).filter((s) => s.module_key === MARKET_MODULE_KEY);
  assert(
    marketSlots.length >= 2 && marketSlots.every((s) => s.status === "finalized"),
    `not every slot finalized: ${JSON.stringify(marketSlots)}`
  );
  console.log(`  ${marketSlots.length} market-analysis slots finalized`);

  const { mapMarketAnalysis } = await import("../lib/market/load");
  const { marketSnapshot } = await import("../lib/market/types");
  const { data: full } = await admin
    .from("market_analysis")
    .select("*")
    .eq("id", row.id)
    .maybeSingle();
  const mapped = mapMarketAnalysis(full);
  const client = marketSnapshot(mapped, true);
  assert(client, "finalized row should appear in client snapshot");
  assert(client.category === "Accounting", "client category missing");

  await admin
    .from("market_analysis")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", row.id);
  const reopened = await syncMarketModuleStatus(admin as any, PROJECT_ID);
  assert(reopened === "in_progress", `expected in_progress after un-finalize, got ${reopened}`);
  const hidden = marketSnapshot({ ...mapped, status: "draft" }, true);
  assert(!hidden, "draft market analysis leaked into client snapshot");
  console.log("  un-finalize reverted slots; client embed hides draft");

  await admin.from("strategy_modules").delete().eq("strategy_id", extra.id);
  await admin.from("strategies").delete().eq("id", extra.id);
  await admin.from("market_analysis").delete().eq("id", row.id);
  await admin
    .from("context_entries")
    .delete()
    .eq("source_table", "market_analysis")
    .eq("source_id", row.id);
  await syncMarketModuleStatus(admin as any, PROJECT_ID);

  const { data: leftover } = await admin
    .from("market_analysis")
    .select("id")
    .eq("project_id", PROJECT_ID);
  assert(!(leftover ?? []).length, "test market_analysis row was not deleted");
  console.log("cleanup ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
