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
      .from("client_integrations")
      .select("*")
      .eq("client_id", client_id);

    if (error) throw error;

    return NextResponse.json({ integrations: data || [] });
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
    const { provider, credentials, is_connected } = body;

    if (!provider) {
      return NextResponse.json({ error: "Missing provider name" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("client_integrations")
      .upsert(
        {
          client_id,
          provider,
          credentials: credentials || {},
          is_connected: is_connected !== undefined ? is_connected : true,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id,provider" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, integration: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
