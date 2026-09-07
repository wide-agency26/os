import { redirect } from "next/navigation";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { StrategyBuilderView } from "@/components/strategy/StrategyBuilderView";
import { loadProjectForPropose, loadScope, loadStrategy } from "@/lib/strategy/load";
import { loadAudienceSegments, loadContextDocs } from "@/lib/audience/load";
import { audienceSnapshot } from "@/lib/audience/types";
import { loadMarketAnalysis } from "@/lib/market/load";
import { marketSnapshot } from "@/lib/market/types";
import { loadCompetitionSynthesis, loadCompetitors } from "@/lib/competition/load";
import { competitionSnapshot } from "@/lib/competition/types";
import { loadProjectSentimentReport, projectSentimentCard } from "@/lib/sentiment/load-project";
import { loadPositioning } from "@/lib/positioning/load";
import { positioningSnapshot } from "@/lib/positioning/types";
import { hasGatewayCredentials } from "@/lib/ai/gateway-json";
import { workPaths } from "@/lib/work/paths";
import { requireStaffPage } from "@/lib/auth/staff-session";

export default async function StrategyBuilderPage({
  params,
}: {
  params: Promise<{ projectId: string; scopeId: string; strategyId: string }>;
}) {
  const { projectId, scopeId, strategyId } = await params;
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;
  const { supabase } = session;

  const [
    project,
    scope,
    segments,
    marketRow,
    docs,
    competitors,
    competitionRow,
    strategy,
    sentimentReport,
    positioningRow,
  ] = await Promise.all([
    loadProjectForPropose(supabase, projectId),
    loadScope(supabase, scopeId),
    loadAudienceSegments(supabase, projectId),
    loadMarketAnalysis(supabase, projectId),
    loadContextDocs(supabase, projectId),
    loadCompetitors(supabase, projectId),
    loadCompetitionSynthesis(supabase, projectId),
    loadStrategy(supabase, strategyId),
    loadProjectSentimentReport(supabase, projectId),
    loadPositioning(supabase, strategyId),
  ]);
  if (!project || !scope) {
    redirect(workPaths.proposeProject(projectId));
  }
  if (!strategy || strategy.scopeId !== scopeId) {
    redirect(workPaths.proposeProject(projectId));
  }

  const audience = audienceSnapshot(segments, false);
  const market = marketSnapshot(marketRow, false);
  const competition = competitionSnapshot(competitors, competitionRow, false);
  const sentimentCard = projectSentimentCard(project, sentimentReport, false);
  const positioning = positioningSnapshot(positioningRow, false);

  return (
    <StrategyBuilderView
      project={project}
      scopeId={scopeId}
      strategy={strategy}
      sentimentHref={sentimentCard.href}
      audienceHref={workPaths.proposeAudience(projectId)}
      audience={audience}
      marketHref={workPaths.proposeMarket(projectId)}
      market={market}
      sentiment={sentimentCard.snapshot}
      positioningHref={workPaths.proposePositioning(projectId, scopeId, strategyId)}
      positioning={positioning}
      competitionHref={workPaths.proposeCompetition(projectId)}
      competition={competition}
      aiConfigured={hasGatewayCredentials()}
      docsCount={docs.filter((d) => d.active !== false).length}
    />
  );
}
