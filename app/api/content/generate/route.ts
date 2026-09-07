import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/reports/sync/require-staff";
import { runContentMonthGeneration, type GenerateMonthStep } from "@/lib/content/generate-month";
import { monthStart } from "@/lib/content/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const staff = await requireStaffUser();
  if ("error" in staff && staff.error) return staff.error;

  let body: {
    step?: GenerateMonthStep;
    projectId?: string;
    periodStart?: string;
    themeNotes?: string;
    postId?: string;
    replace?: boolean;
    regenerateDrafts?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const step = body.step;
  const projectId = body.projectId;
  if (!step || !projectId) {
    return NextResponse.json({ ok: false, error: "step and projectId required" }, { status: 400 });
  }

  try {
    const result = await runContentMonthGeneration(staff.supabase as any, {
      step,
      projectId,
      periodStart: body.periodStart || monthStart(new Date()),
      themeNotes: body.themeNotes,
      postId: body.postId,
      replace: body.replace,
      regenerateDrafts: body.regenerateDrafts,
    });
    if (!result.ok) {
      const status =
        result.error.includes("already has posts") ||
        result.error.includes("waiting for copy") ||
        result.error.includes("Copy failed for")
          ? 422
          : result.error.includes("not found")
            ? 404
            : result.error.includes("locked")
              ? 409
              : 500;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json({
      ok: true,
      calendarId: result.calendarId,
      created: result.created,
      generated: result.generated,
      failed: result.failed,
      postId: result.postId,
      hook_angle: result.hook_angle,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
