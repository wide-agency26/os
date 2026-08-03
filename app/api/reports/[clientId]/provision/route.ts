import { NextResponse } from "next/server";
import { cloneDashboard } from "@/lib/superset/client";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder } from "@/lib/rbac";

/**
 * POST /api/reports/[clientId]/provision
 * Clone a master Superset dashboard for a client and save the mapping.
 * 
 * Body: { templateDashboardId: number, packageTier: string }
 * Access: Founders only.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    if (!profile || !isFounder(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { templateDashboardId, packageTier } = body;

    if (!templateDashboardId || !packageTier) {
      return NextResponse.json(
        { error: "Missing templateDashboardId or packageTier" },
        { status: 400 }
      );
    }

    const validTiers = ["mvb", "launch", "growth", "full_partnership"];
    if (!validTiers.includes(packageTier)) {
      return NextResponse.json(
        { error: `Invalid tier. Must be one of: ${validTiers.join(", ")}` },
        { status: 400 }
      );
    }

    // Get client name for the dashboard title
    const adminDb = createAdminClient();
    const { data: client } = await adminDb
      .from("profiles")
      .select("full_name, company_name")
      .eq("id", clientId)
      .single();

    const clientLabel = client?.company_name || client?.full_name || clientId;
    const tierLabel = packageTier.replace("_", " ").toUpperCase();
    const dashboardTitle = `[${tierLabel}] ${clientLabel} — Funnel Report`;

    // Clone the dashboard in Superset
    const cloned = await cloneDashboard(templateDashboardId, dashboardTitle);

    // Save to report_configurations
    const { data: config, error: dbError } = await adminDb
      .from("report_configurations")
      .upsert(
        {
          client_id: clientId,
          package_tier: packageTier,
          superset_dashboard_id: cloned.id,
          superset_dashboard_uuid: cloned.uuid,
          superset_dashboard_slug: cloned.slug,
          is_active: true,
          provisioned_by: user.id,
        },
        { onConflict: "client_id,package_tier" }
      )
      .select()
      .single();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    return NextResponse.json({
      message: "Report provisioned successfully",
      config,
    });
  } catch (error: any) {
    console.error("POST /api/reports/[clientId]/provision error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
