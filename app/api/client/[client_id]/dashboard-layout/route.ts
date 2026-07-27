import { NextResponse } from "next/server";
import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ client_id: string }> }
) {
  try {
    const { client_id } = await params;
    await resolveClientReadAccess(client_id);

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
