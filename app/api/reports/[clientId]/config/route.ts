import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder, isClient } from "@/lib/rbac";
import { getWorkspaceClientId } from "@/lib/workspace";

/**
 * GET /api/reports/[clientId]/config
 * Returns the active report configuration for a client.
 * 
 * Access: Founders can view any client. Clients only their own.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

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

    if (isClient(profile.role)) {
      const workspaceId = await getWorkspaceClientId(supabase, user.id);
      if (workspaceId !== clientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isFounder(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminDb = createAdminClient();
    const { data: configs, error } = await adminDb
      .from("report_configurations")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ configs: configs || [] });
  } catch (error: any) {
    console.error("GET /api/reports/[clientId]/config error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
