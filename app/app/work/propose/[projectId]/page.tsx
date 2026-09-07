import { redirect } from "next/navigation";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { ScopeBuilder } from "@/components/strategy/ScopeBuilder";
import {
  loadCatalogPackages,
  loadCatalogServices,
  loadProjectForPropose,
  loadProjectOfferingsServiceIds,
  loadScopesForProject,
} from "@/lib/strategy/load";
import { workPaths } from "@/lib/work/paths";
import { requireStaffPage } from "@/lib/auth/staff-session";

export default async function ProposeProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;
  const { supabase } = session;

  const [project, scopes, packages, services, prefill] = await Promise.all([
    loadProjectForPropose(supabase, projectId),
    loadScopesForProject(supabase, projectId),
    loadCatalogPackages(supabase),
    loadCatalogServices(supabase),
    loadProjectOfferingsServiceIds(supabase, projectId),
  ]);
  if (!project) redirect(workPaths.propose);

  return (
    <ScopeBuilder
      project={project}
      scopes={scopes}
      packages={packages}
      services={services}
      prefill={prefill}
    />
  );
}
