import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/reports/sync/require-staff";
import { syncProjectProviders } from "@/lib/reports/sync/run";
import type { DataProvider } from "@/lib/reports/sync/providers";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireStaffUser();
  if (auth.error) return auth.error;

  const body = (await req.json().catch(() => ({}))) as {
    projectId?: string;
    providers?: DataProvider[] | "all";
  };
  if (!body.projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  try {
    const results = await syncProjectProviders(
      body.projectId,
      body.providers ?? "all",
      auth.user.id
    );
    if (!results.length) {
      return NextResponse.json({
        ok: true,
        results: [],
        message: "No connected sources to sync. Connect Google or Meta on Sources first.",
      });
    }
    const failed = results.filter((r) => !r.ok);
    return NextResponse.json({
      ok: failed.length === 0,
      results,
      message:
        failed.length === 0
          ? `Synced ${results.reduce((s, r) => s + r.rows, 0)} rows.`
          : failed.map((f) => f.error).join(" · "),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
