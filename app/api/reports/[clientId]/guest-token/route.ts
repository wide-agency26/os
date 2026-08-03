import { NextResponse } from "next/server";
import { generateGuestToken } from "@/lib/superset/client";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder, isClient } from "@/lib/rbac";
import { getWorkspaceClientId } from "@/lib/workspace";

/**
 * GET /api/reports/[clientId]/guest-token
 * Generate a secure Superset Guest Token with RLS for the embedded viewer.
 * 
 * Access: Founders can generate for any client. Clients only for their own workspace.
 */
export async function GET(
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
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    // Access control: founders can access any client, clients only their own
    if (isClient(profile.role)) {
      const workspaceId = await getWorkspaceClientId(supabase, user.id);
      if (workspaceId !== clientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isFounder(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch the active report configuration for this client
    const adminDb = createAdminClient();
    const { data: config } = await adminDb
      .from("report_configurations")
      .select("superset_dashboard_uuid, package_tier")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!config || !config.superset_dashboard_uuid) {
      return NextResponse.json(
        { error: "No active report configured for this client." },
        { status: 404 }
      );
    }

    // Generate a guest token with RLS: client_id = '<clientId>'
    const guestToken = await generateGuestToken(
      config.superset_dashboard_uuid,
      [{ clause: `client_id = '${clientId}'` }]
    );

    return NextResponse.json({
      guestToken,
      dashboardUuid: config.superset_dashboard_uuid,
      packageTier: config.package_tier,
    });
  } catch (error: any) {
    console.error("GET /api/reports/[clientId]/guest-token error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
