import { generateJsonFromGateway, hasGatewayCredentials } from "@/lib/ai/gateway-json";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM = `You are an elite Senior Performance Director. Analyze the provided multi-channel marketing data. Identify the top 3 critical strategic insights, highlighting conversion efficiency, budget allocation anomalies, and funnel drop-offs. Output your analysis exclusively as a JSON object with key "insights" containing an array of objects with: id (string), category (string), title (string), impact ('high'|'medium'|'positive'|'attention'), observation (string), recommended_action (string).`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId = body.projectId as string;
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!hasGatewayCredentials()) {
      return NextResponse.json(
        { error: "AI Gateway is not configured (AI_GATEWAY_API_KEY)." },
        { status: 503 }
      );
    }

    const payload = {
      project_name: body.projectName || "Project",
      date_range: body.dateRange || "all",
      funnel_metrics: body.funnelMetrics || {},
      channel_spend: body.channelSpend || {},
      channel_conversions: body.channelConversions || {},
    };

    const raw = await generateJsonFromGateway({
      system: SYSTEM,
      prompt: JSON.stringify(payload, null, 2),
      maxOutputTokens: 2500,
    });

    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Model returned empty response" }, { status: 502 });
    }

    const insights = Array.isArray((raw as any).insights)
      ? (raw as any).insights
      : Array.isArray(raw)
        ? raw
        : [];

    const rows = insights.slice(0, 5).map((ins: any, i: number) => ({
      project_id: projectId,
      category: String(ins.category || "Funnel"),
      title: String(ins.title || `Insight ${i + 1}`),
      impact: ["high", "medium", "positive", "attention"].includes(ins.impact)
        ? ins.impact
        : "medium",
      observation: String(ins.observation || ""),
      recommended_action: String(ins.recommended_action || ""),
      pinned: false,
      visible: true,
      source: "ai",
      sort_order: i,
      created_by: user.id,
    }));

    if (rows.length) {
      // Clear previous AI-generated cards (keep manual)
      await (supabase as any)
        .from("project_ai_insights")
        .delete()
        .eq("project_id", projectId)
        .eq("source", "ai");

      const { error } = await (supabase as any).from("project_ai_insights").insert(rows);
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, count: rows.length, insights: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Generation failed" }, { status: 500 });
  }
}
