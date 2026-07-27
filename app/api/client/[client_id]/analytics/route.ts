import { NextResponse } from "next/server";
import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ client_id: string }> }
) {
  try {
    const { client_id } = await params;
    await resolveClientReadAccess(client_id);

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch the dashboard layout to send it back with the analytics data
    const { data: layoutData } = await supabase
      .from("dashboard_layouts")
      .select("layout_config")
      .eq("client_id", client_id)
      .single();

    // Fetch daily snapshots within date range
    const { data: snapshots, error: snapshotsError } = await supabase
      .from("marketing_daily_snapshots")
      .select("*")
      .eq("client_id", client_id)
      .gte("log_date", startDate)
      .lte("log_date", endDate)
      .order("log_date", { ascending: true });

    if (snapshotsError) {
      throw snapshotsError;
    }

    // Aggregate data by source to make it easy for frontend charts
    // E.g. { meta: { clicks: 100, cost: 50 }, ga4: { sessions: 500 } }
    const aggregated = (snapshots || []).reduce((acc: any, snap: any) => {
      const src = snap.source;
      if (!acc[src]) {
        acc[src] = { impressions: 0, clicks: 0, cost: 0, sessions: 0, users: 0, conversions: 0 };
      }
      acc[src].impressions += Number(snap.impressions || 0);
      acc[src].clicks += Number(snap.clicks || 0);
      acc[src].cost += Number(snap.cost || 0);
      acc[src].sessions += Number(snap.sessions || 0);
      acc[src].users += Number(snap.users || 0);
      acc[src].conversions += Number(snap.conversions || 0);
      return acc;
    }, {});

    return NextResponse.json({
      layout: layoutData?.layout_config ?? [],
      snapshots: snapshots || [],
      aggregated,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
