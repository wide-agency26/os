"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { postProposeAction } from "@/lib/propose/client-action";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { Button, Panel } from "@/components/frappe-ui/primitives";
import { StrategyNav } from "@/components/strategy/StrategyNav";
import { ModuleCard } from "@/components/strategy/ModuleCard";
import { ConnectionNotice } from "@/components/strategy/ConnectionNotice";
import {
  AUDIENCE_MODULE_KEY,
  COMPETITION_MODULE_KEY,
  MARKET_MODULE_KEY,
  SENTIMENT_MODULE_KEY,
  SYNTHESIS_MODULE_KEY,
  MODULE_KEYS,
  MODULE_LABELS,
  type ModuleKey,
  type ModuleStatus,
  type StrategyType,
} from "@/lib/strategy/modules";
import { moduleToCard } from "@/lib/strategy/load";
import { workPaths } from "@/lib/work/paths";
import type { StrategyRow } from "@/lib/strategy/types";

function strategyAction(action: string, input: object) {
  return postProposeAction("strategy", action, input);
}

const OWNED = new Set<ModuleKey>([
  AUDIENCE_MODULE_KEY,
  COMPETITION_MODULE_KEY,
  MARKET_MODULE_KEY,
  SENTIMENT_MODULE_KEY,
  SYNTHESIS_MODULE_KEY,
]);

export function StrategyBuilderView({
  project,
  scopeId,
  strategy,
  sentimentHref,
  audienceHref,
  audience,
  marketHref,
  market,
  sentiment,
  positioningHref,
  positioning,
  competitionHref,
  competition,
  aiConfigured,
  docsCount,
}: {
  project: { id: string; title: string; company: string };
  scopeId: string;
  strategy: StrategyRow;
  sentimentHref: string;
  audienceHref: string;
  audience?: import("@/lib/audience/types").AudienceSnapshot;
  marketHref?: string;
  market?: import("@/lib/market/types").MarketSnapshot;
  sentiment?: import("@/lib/sentiment/strategy").SentimentSnapshot;
  positioningHref?: string;
  positioning?: import("@/lib/positioning/types").PositioningSnapshot;
  competitionHref?: string;
  competition?: import("@/lib/competition/types").CompetitionSnapshot;
  aiConfigured: boolean;
  docsCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const attached = new Set(strategy.modules.map((m) => m.moduleKey));
  const available = MODULE_KEYS.filter((k) => !attached.has(k));
  const shareHref = workPaths.proposeShare(project.id, scopeId, strategy.id);
  const hrefFor = (key: ModuleKey) =>
    key === AUDIENCE_MODULE_KEY
      ? audienceHref
      : key === COMPETITION_MODULE_KEY
        ? competitionHref
        : key === MARKET_MODULE_KEY
          ? marketHref
          : key === SENTIMENT_MODULE_KEY
            ? sentimentHref
            : key === SYNTHESIS_MODULE_KEY
              ? positioningHref
              : undefined;
  const nextMod = strategy.modules.find((m) => OWNED.has(m.moduleKey) && m.status !== "finalized");
  const nextHref = nextMod ? hrefFor(nextMod.moduleKey) : shareHref;
  const nextLabel = nextMod
    ? `Open ${MODULE_LABELS[nextMod.moduleKey]}`
    : "Open the presentation";

  return (
    <Workspace>
      <StrategyNav
        projectId={project.id}
        scopeId={scopeId}
        strategyId={strategy.id}
        strategyType={strategy.strategyType as StrategyType}
        active="builder"
        company={project.company}
      />
      <ConnectionNotice
        aiConfigured={aiConfigured}
        docsCount={docsCount}
        contextHref={workPaths.proposeContext(project.id, scopeId, strategy.id)}
        generateNeeds="Audience, Market, Competition, and Synthesis use AI. Sentiment uses the existing Sentiment tool."
      />
      <Panel className="p-4 mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-text-secondary">
          {nextMod
            ? `Next: finish ${MODULE_LABELS[nextMod.moduleKey]}. Synthesis needs Audience finalized first.`
            : "Analyzers are done. Review the client presentation, then Print / Save PDF."}
        </p>
        {nextHref ? (
          <Link
            href={nextHref}
            className="text-[13px] font-medium text-blue-700 shrink-0"
          >
            {nextLabel} →
          </Link>
        ) : null}
      </Panel>
      {msg ? <p className="text-[13px] text-text-secondary mb-4">{msg}</p> : null}

      <div className="space-y-3">
        {strategy.modules.map((mod) => {
          const card = moduleToCard(mod, {
            sentimentHref,
            audienceHref,
            audience,
            marketHref,
            market,
            sentiment,
            positioningHref,
            positioning,
            competitionHref,
            competition,
          });
          const owned = OWNED.has(mod.moduleKey);
          return (
            <ModuleCard
              key={mod.id}
              card={card}
              actions={
                <div className="flex flex-wrap gap-1">
                  {owned
                    ? null
                    : (["not_started", "in_progress", "finalized"] as ModuleStatus[]).map(
                        (st) => (
                          <Button
                            key={st}
                            variant={mod.status === st ? "primary" : "ghost"}
                            disabled={pending}
                            onClick={() =>
                              start(async () => {
                                await strategyAction("setStrategyModuleStatus", {
                                  projectId: project.id,
                                  scopeId,
                                  strategyId: strategy.id,
                                  moduleId: mod.id,
                                  status: st,
                                });
                                router.refresh();
                              })
                            }
                          >
                            {st.replace("_", " ")}
                          </Button>
                        )
                      )}
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await strategyAction("removeStrategyModule", {
                          projectId: project.id,
                          scopeId,
                          strategyId: strategy.id,
                          moduleId: mod.id,
                        });
                        router.refresh();
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              }
            />
          );
        })}
      </div>

      {available.length ? (
        <Panel className="mt-6 p-4 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-text-muted mr-2">Add module</span>
          {available.map((key: ModuleKey) => (
            <Button
              key={key}
              variant="secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await strategyAction("addStrategyModule", {
                    projectId: project.id,
                    scopeId,
                    strategyId: strategy.id,
                    moduleKey: key,
                  });
                  setMsg(res.ok ? null : res.error || "Failed");
                  router.refresh();
                })
              }
            >
              {MODULE_LABELS[key]}
            </Button>
          ))}
        </Panel>
      ) : null}
    </Workspace>
  );
}
