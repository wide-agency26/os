import { redirect } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { StrategyNav } from "@/components/strategy/StrategyNav";
import { ModuleCard } from "@/components/strategy/ModuleCard";
import { Panel } from "@/components/frappe-ui/primitives";
import { loadProjectForPropose, loadScope, loadStrategy, moduleToCard } from "@/lib/strategy/load";
import { loadAudienceSegments } from "@/lib/audience/load";
import { audienceSnapshot } from "@/lib/audience/types";
import { loadMarketAnalysis } from "@/lib/market/load";
import { marketSnapshot } from "@/lib/market/types";
import { loadCompetitionSynthesis, loadCompetitors } from "@/lib/competition/load";
import { competitionSnapshot } from "@/lib/competition/types";
import { loadProjectSentimentReport, projectSentimentCard } from "@/lib/sentiment/load-project";
import { loadPositioning } from "@/lib/positioning/load";
import { positioningSnapshot } from "@/lib/positioning/types";
import { PrintPresentationButton } from "@/components/strategy/PrintPresentationButton";
import { framingCopy, strategyFramingFromProjectStage } from "@/lib/strategy/framing";
import { workPaths } from "@/lib/work/paths";
import type { StrategyType } from "@/lib/strategy/modules";
import { requireStaffPage } from "@/lib/auth/staff-session";

export default async function StrategySharePage({
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
    loadCompetitors(supabase, projectId),
    loadCompetitionSynthesis(supabase, projectId),
    loadStrategy(supabase, strategyId),
    loadProjectSentimentReport(supabase, projectId),
    loadPositioning(supabase, strategyId),
  ]);
  if (!project || !scope) {
    redirect(workPaths.proposeProject(projectId));
  }

  const framing = strategyFramingFromProjectStage(project.stage);
  const copy = framingCopy(framing);
  const audienceHref = workPaths.proposeAudience(projectId);
  const marketHref = workPaths.proposeMarket(projectId);
  const competitionHref = workPaths.proposeCompetition(projectId);
  const clientAudience = audienceSnapshot(segments, true);
  const staffAudience = audienceSnapshot(segments, false);
  const clientMarket = marketSnapshot(marketRow, true);
  const staffMarket = marketSnapshot(marketRow, false);
  const clientCompetition = competitionSnapshot(competitors, competitionRow, true);
  const staffCompetition = competitionSnapshot(competitors, competitionRow, false);
  if (!strategy || strategy.scopeId !== scopeId) {
    redirect(workPaths.proposeProject(projectId));
  }
  const clientSentiment = projectSentimentCard(project, sentimentReport, true);
  const staffSentiment = projectSentimentCard(project, sentimentReport, false);
  const clientPositioning = positioningSnapshot(positioningRow, true);
  const staffPositioning = positioningSnapshot(positioningRow, false);
  const positioningHref = workPaths.proposePositioning(projectId, scopeId, strategyId);

  const cardOpts = {
    audienceHref,
    marketHref,
    competitionHref,
    positioningHref,
  };
  const clientCards = strategy.modules.map((m) =>
    moduleToCard(m, {
      ...cardOpts,
      sentimentHref: clientSentiment.href,
      audience: clientAudience,
      market: clientMarket,
      sentiment: clientSentiment.snapshot,
      positioning: clientPositioning,
      competition: clientCompetition,
    })
  );
  const staffCards = strategy.modules.map((m) =>
    moduleToCard(m, {
      ...cardOpts,
      sentimentHref: staffSentiment.href,
      audience: staffAudience,
      market: staffMarket,
      sentiment: staffSentiment.snapshot,
      positioning: staffPositioning,
      competition: staffCompetition,
    })
  );

  return (
    <Workspace>
      <div className="no-print">
        <StrategyNav
          projectId={projectId}
          scopeId={scopeId}
          strategyId={strategyId}
          strategyType={strategy.strategyType as StrategyType}
          active="share"
          company={project.company}
        />
      </div>

      <Panel className="p-5 mb-6 no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {copy.eyebrow} · {project.company}
          </p>
          <h3 className="text-[18px] font-semibold text-text-primary mt-1">{copy.title}</h3>
          <p className="text-[13px] text-text-secondary mt-1">{copy.subtitle}</p>
          <p className="text-[12px] text-text-muted mt-3">
            This is the client presentation. Print / Save PDF when the analyzers you want
            shown are finalized. Unfinished modules stay hidden from the client view.
          </p>
        </div>
        <PrintPresentationButton />
      </Panel>

      <div className="strategy-print-surface">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
          {project.company}
        </h3>
        <p className="text-[18px] font-semibold text-text-primary mb-4">
          {copy.title}
        </p>
        <div className="space-y-2 mb-8">
          {clientCards.map((card) =>
            card.status === "finalized" ? (
              <ModuleCard key={card.moduleKey} card={card} compact />
            ) : (
              <Panel key={card.moduleKey} className="px-4 py-3 no-print">
                <p className="text-[14px] font-semibold text-text-primary">{card.title}</p>
                <p className="text-[12px] text-text-muted mt-0.5">In progress</p>
              </Panel>
            )
          )}
        </div>
      </div>

      <div className="no-print">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
          Full list (staff)
        </h3>
        <div className="space-y-2">
          {staffCards.map((card) => (
            <ModuleCard key={`staff-${card.moduleKey}`} card={card} />
          ))}
        </div>
      </div>
    </Workspace>
  );
}
