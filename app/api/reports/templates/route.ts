import { NextResponse } from "next/server";
import { listDashboards } from "@/lib/superset/client";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";

/**
 * GET /api/reports/templates
 * Returns a list of master Superset dashboard templates.
 * Access: Founders only.
 */
export async function GET() {
  try {
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

    if (!profile || !isFounder(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dashboards = await listDashboards();

    return NextResponse.json({ dashboards });
  } catch (error: any) {
    console.error("GET /api/reports/templates error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
