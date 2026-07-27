/**
 * WIDE OS — Report Generation Pipeline
 *
 * Server-side function that orchestrates AI report generation.
 * Reads input from the DB row, builds the prompt, calls the
 * AI gateway, and writes the structured result back.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateJsonFromGateway } from "@/lib/ai/gateway-json";
import { buildReportSystemPrompt } from "./report-prompt";
import { parsePeriodLabel } from "./report-helpers";
import type {
  PackageTier,
  GeneratedReport,
  ReportInputPayload,
} from "./report-types";

export async function generateReport(
  supabase: SupabaseClient,
  reportId: string
): Promise<{ ok: true; report: GeneratedReport } | { ok: false; error: string }> {
  // 1. Fetch the report row
  const { data: row, error: fetchErr } = await supabase
    .from("performance_reports")
    .select("*")
    .eq("id", reportId)
    .single();

  if (fetchErr || !row) {
    return { ok: false, error: fetchErr?.message ?? "Report not found" };
  }

  // 2. Resolve package tier
  const tier = (row.package_tier ?? "launch") as PackageTier;
  if (tier === "mvb") {
    return {
      ok: false,
      error: "MVB is a one-off tier — monthly reports are not generated.",
    };
  }

  // 3. Resolve client name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_name")
    .eq("id", row.client_id)
    .maybeSingle();

  const clientName =
    profile?.company_name?.trim() ||
    profile?.full_name?.trim() ||
    "Client";

  // 4. Mark as generating
  await supabase
    .from("performance_reports")
    .update({ status: "generating" })
    .eq("id", reportId);

  // 5. Build the prompt
  const periodLabel = parsePeriodLabel(
    row.report_period_start,
    row.report_period_end
  );

  const systemPrompt = buildReportSystemPrompt({
    packageTier: tier,
    clientName,
    reportPeriodLabel: periodLabel,
  });

  const inputPayload = (row.input_payload ?? {}) as ReportInputPayload;

  const userPrompt = `Here is the raw data payload for the ${periodLabel} report for ${clientName}.

Generate the 13-step performance report as a single JSON object.

RAW DATA:
${JSON.stringify(inputPayload, null, 2)}`;

  // 6. Call the AI gateway
  try {
    const result = await generateJsonFromGateway({
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 8000,
    });

    if (!result) {
      await supabase
        .from("performance_reports")
        .update({ status: "failed" })
        .eq("id", reportId);
      return {
        ok: false,
        error:
          "No AI gateway credentials configured. Set AI_GATEWAY_API_KEY or deploy to Vercel.",
      };
    }

    const generated = result as GeneratedReport;

    // 7. Write back
    await supabase
      .from("performance_reports")
      .update({
        generated_report: generated as unknown as Record<string, unknown>,
        status: "draft",
        generated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    return { ok: true, report: generated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("performance_reports")
      .update({ status: "failed" })
      .eq("id", reportId);
    return { ok: false, error: message };
  }
}
