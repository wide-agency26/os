import { redirect } from "next/navigation";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { AudienceAnalysisApp } from "@/components/audience/AudienceAnalysisApp";
import { loadProjectForPropose } from "@/lib/strategy/load";
import { loadAudienceSegments, loadAudienceSources, loadContextDocs } from "@/lib/audience/load";
import { hasGatewayCredentials } from "@/lib/ai/gateway-json";
import { workPaths } from "@/lib/work/paths";
import { requireStaffPage } from "@/lib/auth/staff-session";

export default async function AudienceAnalysisPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;
  const { supabase } = session;

  const [project, docs, segments] = await Promise.all([
    loadProjectForPropose(supabase, projectId),
    loadContextDocs(supabase, projectId),
    loadAudienceSegments(supabase, projectId),
  ]);
  if (!project) redirect(workPaths.propose);
  const sources = await loadAudienceSources(
    supabase,
    segments.map((s) => s.id)
  );

  return (
    <AudienceAnalysisApp
      project={project}
      docs={docs}
      segments={segments}
      sources={sources}
      aiConfigured={hasGatewayCredentials()}
    />
  );
}
