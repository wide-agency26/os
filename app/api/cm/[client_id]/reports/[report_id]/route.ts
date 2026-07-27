import { requireSuperadmin } from "@/lib/auth-guards";

export const maxDuration = 10;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * GET /api/cm/[client_id]/reports/[report_id]
 * Fetch a single report with full generated content.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ client_id: string; report_id: string }> }
) {
  const { client_id, report_id } = await params;
  const gate = await requireSuperadmin();
  if (!gate.ok) return jsonError("Founder access required.", 403);

  const { data, error } = await gate.supabase
    .from("performance_reports")
    .select("*")
    .eq("id", report_id)
    .eq("client_id", client_id)
    .single();

  if (error) return jsonError(error.message, 404);
  return Response.json({ report: data });
}

/**
 * PATCH /api/cm/[client_id]/reports/[report_id]
 * Update input payload, package tier, or publish/unpublish.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ client_id: string; report_id: string }> }
) {
  const { client_id, report_id } = await params;
  const gate = await requireSuperadmin();
  if (!gate.ok) return jsonError("Founder access required.", 403);

  const body = (await req.json()) as {
    input_payload?: Record<string, unknown>;
    package_tier?: string;
    action?: "publish" | "unpublish";
  };

  const patch: any = {};

  if (body.input_payload !== undefined) {
    patch.input_payload = body.input_payload;
  }
  if (body.package_tier !== undefined) {
    patch.package_tier = body.package_tier;
  }
  if (body.action === "publish") {
    patch.status = "published";
    patch.published_at = new Date().toISOString();
  }
  if (body.action === "unpublish") {
    patch.status = "draft";
    patch.published_at = null;
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("No valid fields to update.", 400);
  }

  const { data, error } = await gate.supabase
    .from("performance_reports")
    .update(patch)
    .eq("id", report_id)
    .eq("client_id", client_id)
    .select("id, status, package_tier, published_at")
    .single();

  if (error) return jsonError(error.message, 500);
  return Response.json({ report: data });
}

/**
 * DELETE /api/cm/[client_id]/reports/[report_id]
 * Delete a report (founder only).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ client_id: string; report_id: string }> }
) {
  const { client_id, report_id } = await params;
  const gate = await requireSuperadmin();
  if (!gate.ok) return jsonError("Founder access required.", 403);

  const { error } = await gate.supabase
    .from("performance_reports")
    .delete()
    .eq("id", report_id)
    .eq("client_id", client_id);

  if (error) return jsonError(error.message, 500);
  return new Response(null, { status: 204 });
}
