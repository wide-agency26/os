import { generateText } from "ai";
import {
  GATEWAY_JSON_MODEL,
  hasGatewayCredentials,
} from "@/lib/ai/gateway-json";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM = `You are an elite Senior Performance Director answering questions from a client viewing their executive marketing report.
Rules:
- Use ONLY the provided report_context JSON. Never invent metrics outside it.
- Cite specific widgets or sections when possible (e.g. "As shown in the Hourglass funnel…" or "Blended CPA scorecard…").
- Be concise (2–4 short paragraphs max). No markdown tables.
- Do not reveal other organizations, raw CSV rows, or admin configuration.
- If the data cannot answer the question, say so and suggest contacting their agency strategist.
- Output plain text only (no JSON).`;

async function assertProjectAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: string | null,
  projectId: string
): Promise<{ ok: true; companyId: string | null } | { ok: false; status: number; error: string }> {
  if (isFounder(role)) {
    const { data } = await supabase
      .from("projects")
      .select("id, client_id")
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
    .select("id, client_id")
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

    const access = await assertProjectAccess(
      supabase,
      user.id,
      profile?.role ?? null,
      projectId
    );
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    if (!hasGatewayCredentials()) {
      return NextResponse.json(
        { error: "AI Gateway is not configured (AI_GATEWAY_API_KEY)." },
        { status: 503 }
      );
    }

    const context = {
      project_name: body.projectName || "Project",
      organization: body.organization || null,
      active_tab: body.tab || "General",
      date_range: body.dateRange || "all",
      report_context: body.reportContext || {},
    };

    const { text } = await generateText({
      model: GATEWAY_JSON_MODEL,
      system: SYSTEM,
      prompt: `Question: ${question}\n\nContext:\n${JSON.stringify(context, null, 2)}`,
      temperature: 0.35,
      maxOutputTokens: 1200,
    });

    return NextResponse.json({
      ok: true,
      answer: (text || "").trim() || "I could not generate an answer from the available report data.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Ask AI failed" }, { status: 500 });
  }
}
