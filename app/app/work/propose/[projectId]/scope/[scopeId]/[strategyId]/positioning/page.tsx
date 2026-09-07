import { redirect } from "next/navigation";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { PositioningApp } from "@/components/positioning/PositioningApp";
import { loadProjectForPropose, loadScope, loadStrategy } from "@/lib/strategy/load";
import { collectPositioningContext } from "@/lib/positioning/inputs";
import { loadPositioning } from "@/lib/positioning/load";
import { hasGatewayCredentials } from "@/lib/ai/gateway-json";
import { STRATEGY_TYPE_LABELS } from "@/lib/strategy/modules";
import { workPaths } from "@/lib/work/paths";
import { requireStaffPage } from "@/lib/auth/staff-session";

export default async function PositioningPage({
  params,
}: {
  params: Promise<{ projectId: string; scopeId: string; strategyId: string }>;
}) {
  const { projectId, scopeId, strategyId } = await params;
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;
  const { supabase } = session;

  const [project, scope, strategy, ctx, positioning] = await Promise.all([
    loadProjectForPropose(supabase, projectId),
    loadScope(supabase, scopeId),
    loadStrategy(supabase, strategyId),
    collectPositioningContext(supabase, projectId, strategyId),
    loadPositioning(supabase, strategyId),
  ]);
  if (!project || !scope || !strategy || strategy.scopeId !== scopeId) {
    redirect(workPaths.proposeProject(projectId));
  }

  const gate =
    "gate" in ctx
      ? ctx.gate
      : {
          canGenerate: false,
          reason: "ok" in ctx ? ctx.error : "Could not evaluate inputs",
          chips: [],
        };

  return (
    <PositioningApp
      project={project}
      scopeId={scopeId}
      strategyId={strategyId}
      strategyLabel={STRATEGY_TYPE_LABELS[strategy.strategyType]}
      gate={gate}
      positioning={positioning}
      aiConfigured={hasGatewayCredentials()}
    />
  );
}
