import { NextResponse } from "next/server";
import { resolveExecutiveAccess } from "@/lib/wide-os/resolve-access";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ client_id: string }> }
) {
  try {
    const { client_id } = await params;
    await resolveExecutiveAccess();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("dashboard_layouts")
      .select("*")
      .eq("client_id", client_id)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return NextResponse.json({ layout: data?.layout_config ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ client_id: string }> }
) {
  try {
    const { client_id } = await params;
    await resolveExecutiveAccess();

    const body = await req.json();
    const supabase = createAdminClient();

    const { error } = await supabase.from("dashboard_layouts").upsert({
      client_id,
      layout_config: body.layout_config,
      updated_at: new Date().toISOString(),
    }, { onConflict: "client_id" });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
