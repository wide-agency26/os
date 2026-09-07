import { redirect } from "next/navigation";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { StrategyList } from "@/components/strategy/StrategyList";
import {
  loadCatalogServices,
  loadProjectForPropose,
  loadScope,
  loadStrategiesForScope,
  loadStrategyTypeServices,
} from "@/lib/strategy/load";
import { workPaths } from "@/lib/work/paths";
import { isUuid } from "@/lib/routing";
import { requireStaffPage } from "@/lib/auth/staff-session";

export default async function ProposeScopePage({
  params,
}: {
  params: Promise<{ projectId: string; scopeId: string }>;
}) {
  const { projectId, scopeId } = await params;
  if (!isUuid(scopeId)) redirect(workPaths.proposeProject(projectId));
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;
  const { supabase } = session;

  const [project, scope, strategies, typeServices, services] = await Promise.all([
    loadProjectForPropose(supabase, projectId),
    loadScope(supabase, scopeId),
    loadStrategiesForScope(supabase, scopeId),
    loadStrategyTypeServices(supabase),
    loadCatalogServices(supabase),
  ]);
  if (!project || !scope || scope.projectId !== projectId) {
    redirect(workPaths.proposeProject(projectId));
  }

  return (
    <StrategyList
      project={project}
      scope={scope}
      strategies={strategies}
      typeServices={typeServices}
      services={services}
    />
  );
}
