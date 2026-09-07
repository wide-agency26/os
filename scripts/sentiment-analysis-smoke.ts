/**
 * Sentiment adapter smoke — TARA MVB.
 * Uses the existing /app/sentiment analyzer; no demo payload.
 * Extra strategy is deleted. Test stub reports (slug __test__) are deleted.
 * Usage: npx tsx scripts/sentiment-analysis-smoke.ts
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { runSentimentAnalysis, slugifySentimentPart } from "../lib/sentiment/analyze";
import { linkSentimentReportToProject } from "../lib/sentiment/load-project";
import { sentimentHeadline, sentimentSnapshot } from "../lib/sentiment/strategy";
import { syncSentimentModuleStatus } from "../lib/sentiment/sync";
import { moduleToCard } from "../lib/strategy/load";
import { SENTIMENT_MODULE_KEY } from "../lib/strategy/modules";
import type { SentimentReportRow } from "../lib/sentiment/types";

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
const STRATEGY_ID = "0fbcae5a-1473-44ea-a895-31880debef94";
const BD_RECORD_ID = "22c11fe7-5c56-47ec-b67d-b664d3127d01";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function mapReport(row: Record<string, unknown>): SentimentReportRow {
  return {
    id: row.id as string,
    public_slug: row.public_slug as string,
    brand_name: row.brand_name as string,
    website_url: (row.website_url as string | null) ?? null,
    status: row.status as SentimentReportRow["status"],
    score: (row.score as number | null) ?? null,
    report: (row.report as SentimentReportRow["report"]) || ({} as SentimentReportRow["report"]),
    bd_record_id: (row.bd_record_id as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

async function slotStatuses(admin: any, strategyIds: string[]) {
  const { data, error } = await admin
    .from("strategy_modules")
    .select("strategy_id, status")
    .eq("module_key", SENTIMENT_MODULE_KEY)
    .in("strategy_id", strategyIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as { strategy_id: string; status: string }[];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const admin = createClient(url, key);

  console.log("phase 1: adapter join");
  const { data: join, error: joinErr } = await admin
    .from("sentiment_analysis_links")
    .select("id, project_id, sentiment_result_id, status, sentiment_reports:sentiment_result_id ( id, brand_name, status, score, public_slug )")
    .eq("project_id", PROJECT_ID)
    .maybeSingle();
  if (joinErr) throw new Error(joinErr.message);
  if (join?.sentiment_result_id) {
    const report = Array.isArray(join.sentiment_reports)
      ? join.sentiment_reports[0]
      : join.sentiment_reports;
    console.log(
      "  existing link",
      join.id,
      "→",
      report?.id,
      report?.brand_name,
      report?.score,
      report?.status
    );
    assert(report?.id === join.sentiment_result_id, "FK did not resolve to sentiment_reports");
  } else {
    console.log("  no link yet (ok)");
  }

  console.log("phase 2: real /app/sentiment run + embed card");
  const payload = await runSentimentAnalysis({ brandName: "TF Tax" });
  const slug = `${slugifySentimentPart("TF Tax")}-${Date.now().toString(36).slice(-6)}`;
  const { data: inserted, error: insErr } = await admin
    .from("sentiment_reports")
    .insert({
      public_slug: slug,
      brand_name: "TF Tax",
      website_url: payload.website_url,
      status: "ready",
      score: payload.score,
      report: payload,
      bd_record_id: BD_RECORD_ID,
    })
    .select("*")
    .single();
  if (insErr || !inserted) throw new Error(insErr?.message || "insert report failed");
  const live = mapReport(inserted as Record<string, unknown>);

  await linkSentimentReportToProject(admin as any, PROJECT_ID, live.id);
  await syncSentimentModuleStatus(admin as any, PROJECT_ID);

  const headline = sentimentHeadline(live);
  const expected = `${live.score} / 100 · ${live.report.overall}`;
  assert(headline === expected, `headline mismatch: ${headline} vs ${expected}`);
  assert(
    headline === `${payload.score} / 100 · ${payload.overall}`,
    "embed headline does not match analyzer output"
  );

  const snap = sentimentSnapshot(live, false);
  assert(snap?.href === `/app/sentiment/${live.id}`, `href ${snap?.href}`);
  const card = moduleToCard(
    { moduleKey: SENTIMENT_MODULE_KEY, status: "finalized" },
    { sentiment: snap }
  );
  assert(card.summary === headline, `card summary ${card.summary}`);
  assert(card.href === `/app/sentiment/${live.id}`, `card href ${card.href}`);
  assert(card.sentimentHeadline === headline, "card missing sentimentHeadline");
  const clientHidden = sentimentSnapshot({ ...live, status: "running" }, true);
  assert(!clientHidden, "client snapshot leaked a non-ready report");
  console.log("  embed", headline, "→", card.href);

  console.log("phase 3: slot sync across strategies");
  const { data: extra, error: extraErr } = await admin
    .from("strategies")
    .insert({
      scope_id: SCOPE_ID,
      strategy_type: "communication",
      status: "draft",
    })
    .select("id")
    .single();
  if (extraErr || !extra) throw new Error(extraErr?.message || "extra strategy insert failed");
  const extraId = extra.id as string;
  const { error: modErr } = await admin.from("strategy_modules").insert({
    strategy_id: extraId,
    module_key: SENTIMENT_MODULE_KEY,
    status: "not_started",
    sort_order: 1,
  });
  if (modErr) throw new Error(modErr.message);

  await admin
    .from("sentiment_reports")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", live.id);
  const running = await syncSentimentModuleStatus(admin as any, PROJECT_ID);
  assert(running === "in_progress", `running mapped to ${running}`);
  const runningSlots = await slotStatuses(admin, [STRATEGY_ID, extraId]);
  assert(runningSlots.length === 2, `expected 2 slots, got ${runningSlots.length}`);
  assert(
    runningSlots.every((s) => s.status === "in_progress"),
    `running slots ${JSON.stringify(runningSlots)}`
  );

  await admin
    .from("sentiment_reports")
    .update({ status: "ready", updated_at: new Date().toISOString() })
    .eq("id", live.id);
  const done = await syncSentimentModuleStatus(admin as any, PROJECT_ID);
  assert(done === "finalized", `ready mapped to ${done}`);
  const doneSlots = await slotStatuses(admin, [STRATEGY_ID, extraId]);
  assert(
    doneSlots.every((s) => s.status === "finalized"),
    `ready slots ${JSON.stringify(doneSlots)}`
  );
  console.log("  both strategies finalized off sentiment_reports.status=ready");

  await admin.from("strategy_modules").delete().eq("strategy_id", extraId);
  await admin.from("strategies").delete().eq("id", extraId);

  const { data: stubs } = await admin
    .from("sentiment_reports")
    .select("id")
    .like("public_slug", "__test__%");
  for (const s of stubs ?? []) {
    await admin.from("sentiment_analysis_links").update({ sentiment_result_id: live.id }).eq("sentiment_result_id", s.id);
    await admin.from("sentiment_reports").delete().eq("id", s.id);
  }
  await linkSentimentReportToProject(admin as any, PROJECT_ID, live.id);
  await syncSentimentModuleStatus(admin as any, PROJECT_ID);

  const taraSlots = await slotStatuses(admin, [STRATEGY_ID]);
  assert(taraSlots[0]?.status === "finalized", `TARA slot ${taraSlots[0]?.status}`);
  console.log("ok", live.id, headline);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
