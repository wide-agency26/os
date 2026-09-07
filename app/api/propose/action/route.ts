import { NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/reports/sync/require-staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Fn = (input: never) => Promise<unknown>;

async function handlerFor(moduleName: string, action: string): Promise<Fn | null> {
  if (moduleName === "audience") {
    const m = await import("@/app/actions/audience");
    const map: Record<string, Fn> = {
      updateSegment: m.updateSegment as Fn,
      deleteSegment: m.deleteSegment as Fn,
      reorderSegments: m.reorderSegments as Fn,
      mergeSegments: m.mergeSegments as Fn,
      splitSegment: m.splitSegment as Fn,
      updateProfileField: m.updateProfileField as Fn,
      finalizePair: m.finalizePair as Fn,
    };
    return map[action] ?? null;
  }
  if (moduleName === "market") {
    const m = await import("@/app/actions/market");
    const map: Record<string, Fn> = {
      upsertMarketCategory: m.upsertMarketCategory as Fn,
      updateMarketField: m.updateMarketField as Fn,
      finalizeMarket: m.finalizeMarket as Fn,
    };
    return map[action] ?? null;
  }
  if (moduleName === "competition") {
    const m = await import("@/app/actions/competition");
    const map: Record<string, Fn> = {
      addCompetitor: m.addCompetitor as Fn,
      deleteCompetitor: m.deleteCompetitor as Fn,
      setCompetitorAccepted: m.setCompetitorAccepted as Fn,
      updateCompetitorField: m.updateCompetitorField as Fn,
      updateCompetitionSynthesis: m.updateCompetitionSynthesis as Fn,
      finalizeCompetition: m.finalizeCompetition as Fn,
    };
    return map[action] ?? null;
  }
  if (moduleName === "positioning") {
    const m = await import("@/app/actions/positioning");
    const map: Record<string, Fn> = {
      updatePositioning: m.updatePositioning as Fn,
      finalizePositioning: m.finalizePositioning as Fn,
    };
    return map[action] ?? null;
  }
  if (moduleName === "strategy") {
    const m = await import("@/app/actions/strategy");
    const map: Record<string, Fn> = {
      createScopeFromPackage: m.createScopeFromPackage as Fn,
      createScopeALaCarte: m.createScopeALaCarte as Fn,
      updateScopeStatus: m.updateScopeStatus as Fn,
      reorderScopeItems: m.reorderScopeItems as Fn,
      addScopeItem: m.addScopeItem as Fn,
      removeScopeItem: m.removeScopeItem as Fn,
      deleteScope: m.deleteScope as Fn,
      createStrategy: m.createStrategy as Fn,
      deleteStrategy: m.deleteStrategy as Fn,
      addStrategyModule: m.addStrategyModule as Fn,
      removeStrategyModule: m.removeStrategyModule as Fn,
      setStrategyModuleStatus: m.setStrategyModuleStatus as Fn,
    };
    return map[action] ?? null;
  }
  return null;
}

export async function POST(req: Request) {
  const staff = await requireStaffUser();
  if ("error" in staff && staff.error) return staff.error;

  let body: { module?: string; action?: string } & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const moduleName = String(body.module || "");
  const action = String(body.action || "");
  const fn = await handlerFor(moduleName, action);
  if (!fn) {
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  const { module: _m, action: _a, ...input } = body;
  try {
    const result = await fn(input as never);
    return NextResponse.json(result ?? { ok: true });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Action failed",
    });
  }
}
