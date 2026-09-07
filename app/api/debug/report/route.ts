import { NextResponse } from "next/server";
import { persistDebugReport } from "@/lib/debug/persist";
import type { DebugReportInput, DebugSeverity, DebugReportType } from "@/lib/debug/types";

export const runtime = "nodejs";

function asSeverity(value: unknown): DebugSeverity {
  return value === "blocker" || value === "high" || value === "medium" || value === "low"
    ? value
    : "medium";
}

function asReportType(value: unknown): DebugReportType {
  return value === "enhancement" ? "enhancement" : "bug";
}

export async function POST(req: Request) {
  let body: Partial<DebugReportInput> & { reportType?: string; projectId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid report payload." }, { status: 400 });
  }

  const result = await persistDebugReport({
    title: typeof body.title === "string" ? body.title : "",
    whatHappened: typeof body.whatHappened === "string" ? body.whatHappened : "",
    expected: typeof body.expected === "string" ? body.expected : "",
    actual: typeof body.actual === "string" ? body.actual : "",
    beforeExperience: typeof body.beforeExperience === "string" ? body.beforeExperience : "",
    afterExperience: typeof body.afterExperience === "string" ? body.afterExperience : "",
    reproSteps: typeof body.reproSteps === "string" ? body.reproSteps : "",
    severity: asSeverity(body.severity),
    reportType: asReportType(body.reportType),
    projectId: typeof body.projectId === "string" ? body.projectId : null,
    snapshot: body.snapshot as DebugReportInput["snapshot"],
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
