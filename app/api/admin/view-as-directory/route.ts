import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isSuperadmin } from "@/lib/rbac";

export type ViewAsEntry = {
  workspaceId: string;
  label: string;
  lifecycle: string;
  clientProfileId: string | null;
  prospectId: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isSuperadmin(profile?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: workspaces, error: wsErr } = await supabase
    .from("workspaces")
    .select("id, company_name, lifecycle_status, client_profile_id")
    .order("company_name", { ascending: true });

  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 });

  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, workspace_id")
    .not("workspace_id", "is", null);

  const prospectByWorkspace = new Map(
    (prospects ?? []).map((p) => [p.workspace_id as string, p.id as string])
  );

  const entries: ViewAsEntry[] = (workspaces ?? []).map((w) => ({
    workspaceId: w.id,
    label: w.company_name?.trim() || "Workspace",
    lifecycle: w.lifecycle_status,
    clientProfileId: w.client_profile_id,
    prospectId: prospectByWorkspace.get(w.id) ?? null,
  }));

  return NextResponse.json({ entries });
}
