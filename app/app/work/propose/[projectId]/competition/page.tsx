import { redirect } from "next/navigation";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { CompetitionAnalysisApp } from "@/components/competition/CompetitionAnalysisApp";
import { loadProjectForPropose } from "@/lib/strategy/load";
import { loadContextDocs } from "@/lib/audience/load";
import { loadCompetitionSynthesis, loadCompetitors } from "@/lib/competition/load";
import { hasGatewayCredentials } from "@/lib/ai/gateway-json";
import { workPaths } from "@/lib/work/paths";
import { requireStaffPage } from "@/lib/auth/staff-session";

export default async function CompetitionAnalysisPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;
  const { supabase } = session;

  const [project, docs, competitors, synthesis] = await Promise.all([
    loadProjectForPropose(supabase, projectId),
    loadContextDocs(supabase, projectId),
    loadCompetitors(supabase, projectId),
    loadCompetitionSynthesis(supabase, projectId),
  ]);
  if (!project) redirect(workPaths.propose);

  return (
    <CompetitionAnalysisApp
      project={project}
      docs={docs}
      competitors={competitors}
      synthesis={synthesis}
      aiConfigured={hasGatewayCredentials()}
    />
  );
}
