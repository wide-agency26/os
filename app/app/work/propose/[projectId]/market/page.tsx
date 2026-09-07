import { redirect } from "next/navigation";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { MarketAnalysisApp } from "@/components/market/MarketAnalysisApp";
import { loadProjectForPropose } from "@/lib/strategy/load";
import { loadContextDocs } from "@/lib/audience/load";
import { loadMarketAnalysis } from "@/lib/market/load";
import { hasGatewayCredentials } from "@/lib/ai/gateway-json";
import { workPaths } from "@/lib/work/paths";
import { requireStaffPage } from "@/lib/auth/staff-session";

export default async function MarketAnalysisPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;
  const { supabase } = session;

  const [project, docs, analysis] = await Promise.all([
    loadProjectForPropose(supabase, projectId),
    loadContextDocs(supabase, projectId),
    loadMarketAnalysis(supabase, projectId),
  ]);
  if (!project) redirect(workPaths.propose);

  return (
    <MarketAnalysisApp
      project={project}
      docs={docs}
      analysis={analysis}
      aiConfigured={hasGatewayCredentials()}
    />
  );
}
