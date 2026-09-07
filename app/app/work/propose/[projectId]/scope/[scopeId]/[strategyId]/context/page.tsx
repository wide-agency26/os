import { redirect } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { StrategyNav } from "@/components/strategy/StrategyNav";
import { Panel } from "@/components/frappe-ui/primitives";
import { ContextDocsPanel } from "@/components/content/ContextDocsPanel";
import { ConnectionNotice } from "@/components/strategy/ConnectionNotice";
import { loadProjectForPropose, loadScope, loadStrategy } from "@/lib/strategy/load";
import { loadContextDocs } from "@/lib/audience/load";
import { hasGatewayCredentials } from "@/lib/ai/gateway-json";
import { workPaths } from "@/lib/work/paths";
import type { StrategyType } from "@/lib/strategy/modules";
import { requireStaffPage } from "@/lib/auth/staff-session";

export default async function StrategyContextPage({
  params,
}: {
  params: Promise<{ projectId: string; scopeId: string; strategyId: string }>;
}) {
  const { projectId, scopeId, strategyId } = await params;
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;
  const { supabase } = session;

  const [project, scope, strategy, docs] = await Promise.all([
    loadProjectForPropose(supabase, projectId),
    loadScope(supabase, scopeId),
    loadStrategy(supabase, strategyId),
    loadContextDocs(supabase, projectId),
  ]);
  if (!project || !scope || !strategy || strategy.scopeId !== scopeId) {
    redirect(workPaths.proposeProject(projectId));
  }

  const activeDocs = docs.filter((d) => d.active !== false).length;

  return (
    <Workspace>
      <StrategyNav
        projectId={projectId}
        scopeId={scopeId}
        strategyId={strategyId}
        strategyType={strategy.strategyType as StrategyType}
        active="context"
        company={project.company}
      />
      <ConnectionNotice
        aiConfigured={hasGatewayCredentials()}
        docsCount={activeDocs}
        generateNeeds="These files feed Audience, Market, Competition, and Synthesis on this project. Upload once here, then generate from Builder."
      />
      <Panel className="p-5">
        <ContextDocsPanel projectId={projectId} docs={docs} />
      </Panel>
    </Workspace>
  );
}
