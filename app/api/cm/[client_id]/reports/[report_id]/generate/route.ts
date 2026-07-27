import { requireSuperadmin } from "@/lib/auth-guards";
import { generateReport } from "@/lib/reports/generate-report";

export const maxDuration = 120;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * POST /api/cm/[client_id]/reports/[report_id]/generate
 * Trigger AI generation for a specific report.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ client_id: string; report_id: string }> }
) {
  const { report_id } = await params;
  const gate = await requireSuperadmin();
  if (!gate.ok) return jsonError("Founder access required.", 403);

  const result = await generateReport(gate.supabase, report_id);

  if (!result.ok) {
    return jsonError(result.error, 422);
  }

  return Response.json({
    ok: true,
    report: result.report,
  });
}
