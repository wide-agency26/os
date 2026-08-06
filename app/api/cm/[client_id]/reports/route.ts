import { requireSuperadmin } from "@/lib/auth-guards";
import type { PackageTier } from "@/lib/reports/report-types";
import type { Json } from "@/types/supabase";

export const maxDuration = 10;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * GET /api/cm/[client_id]/reports
 * List all performance reports for this client.
 * Founders see all statuses; clients see published only (enforced by RLS).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ client_id: string }> }
) {
  const { client_id } = await params;
  const gate = await requireSuperadmin();
  if (!gate.ok) return jsonError("Founder access required.", 403);

  const { data, error } = await gate.supabase
    .from("performance_reports")
    .select(
      "id, report_period_start, report_period_end, package_tier, status, generated_at, published_at, created_at"
    )
    .eq("client_id", client_id)
    .order("report_period_start", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return Response.json({ reports: data ?? [] });
}

/**
 * POST /api/cm/[client_id]/reports
 * Create a new report draft.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ client_id: string }> }
) {
  const { client_id } = await params;
  const gate = await requireSuperadmin();
  if (!gate.ok) return jsonError("Founder access required.", 403);

  const body = (await req.json()) as {
    period_start: string;
    period_end: string;
    input_payload?: Record<string, unknown>;
    package_tier?: PackageTier;
  };

  if (!body.period_start || !body.period_end) {
    return jsonError("period_start and period_end are required.", 400);
  }

  // Resolve tier from workspace if not explicitly provided
  let tier: PackageTier = body.package_tier ?? "launch";
  if (!body.package_tier) {
    const { data: ws } = await gate.supabase
      .from("workspaces")
      .select("current_tier")
      .eq("client_profile_id", client_id)
      .maybeSingle();
    if (ws?.current_tier) {
      tier = ws.current_tier as PackageTier;
    }
  }

  const { data, error } = await gate.supabase
    .from("performance_reports")
    .insert({
      client_id,
      report_period_start: body.period_start,
      report_period_end: body.period_end,
      package_tier: tier,
      input_payload: (body.input_payload ?? {}) as Json,
      status: "draft",
      created_by: gate.user.id,
    })
    .select("id, status, package_tier")
    .single();

  if (error) return jsonError(error.message, 500);
  return Response.json({ report: data }, { status: 201 });
}
