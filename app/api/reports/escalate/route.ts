import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function resolveCompanyId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: string | null,
  projectId: string
): Promise<{ ok: true; companyId: string | null } | { ok: false; status: number; error: string }> {
  if (isFounder(role)) {
    const { data } = await supabase
      .from("projects")
      .select("client_id")
      .eq("id", projectId)
      .maybeSingle();
    if (!data) return { ok: false, status: 404, error: "Project not found" };
    return { ok: true, companyId: (data as any).client_id || null };
  }

  const { data: members } = await (supabase as any)
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("status", "active");
  const companyIds = ((members || []) as { company_id: string }[]).map((m) => m.company_id);
  if (!companyIds.length) {
    return { ok: false, status: 403, error: "No active organization membership" };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .in("client_id", companyIds)
    .maybeSingle();

  if (!project) return { ok: false, status: 403, error: "Project not in your organization" };
  return { ok: true, companyId: (project as any).client_id || null };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId = body.projectId as string;
    const question = String(body.question || "").trim();
    if (!projectId || !question) {
      return NextResponse.json(
        { error: "projectId and question are required" },
        { status: 400 }
      );
    }

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

    const access = await resolveCompanyId(
      supabase,
      user.id,
      profile?.role ?? null,
      projectId
    );
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const row = {
      project_id: projectId,
      company_id: access.companyId,
      user_id: user.id,
      tab: String(body.tab || "General"),
      date_range: body.dateRange ? String(body.dateRange) : null,
      question,
      thread_snapshot: body.threadSnapshot || [],
      report_snapshot: body.reportSnapshot || {},
      status: "open",
    };

    const { data: inserted, error } = await (supabase as any)
      .from("client_report_escalations")
      .insert(row)
      .select("id, created_at")
      .single();

    if (error) throw new Error(error.message);

    const webhook = process.env.CLIENT_ESCALATION_WEBHOOK_URL;
    if (webhook) {
      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "client_report_escalation",
            id: inserted?.id,
            projectId,
            companyId: access.companyId,
            projectName: body.projectName,
            organization: body.organization,
            tab: row.tab,
            dateRange: row.date_range,
            question,
            userEmail: user.email,
            createdAt: inserted?.created_at,
          }),
        });
      } catch (err) {
        console.error("Escalation webhook failed:", err);
      }
    }

    return NextResponse.json({ ok: true, id: inserted?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Escalation failed" }, { status: 500 });
  }
}
