import type { ReactNode } from "react";
import Link from "next/link";
import {
  AUDIENCE_MODULE_KEY,
  COMPETITION_MODULE_KEY,
  MARKET_MODULE_KEY,
  SENTIMENT_MODULE_KEY,
  SYNTHESIS_MODULE_KEY,
  type StrategyModuleCard,
} from "@/lib/strategy/modules";
import { Panel } from "@/components/frappe-ui/primitives";

const STATUS_COPY: Record<StrategyModuleCard["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  finalized: "Finalized",
};

export function ModuleCard({
  card,
  actions,
  compact = false,
}: {
  card: StrategyModuleCard;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const isAudience = card.moduleKey === AUDIENCE_MODULE_KEY;
  const isMarket = card.moduleKey === MARKET_MODULE_KEY;
  const isSentiment = card.moduleKey === SENTIMENT_MODULE_KEY;
  const isPositioning = card.moduleKey === SYNTHESIS_MODULE_KEY;
  const isCompetition = card.moduleKey === COMPETITION_MODULE_KEY;
  const wired = isAudience || isMarket || isSentiment || isPositioning || isCompetition;

  return (
    <Panel className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-text-primary">{card.title}</p>
          <p className="text-[12px] text-text-muted mt-0.5">
            {STATUS_COPY[card.status]}
            {isAudience && card.totalCount != null
              ? ` · ${card.finalizedCount ?? 0} of ${card.totalCount} segments finalized`
              : ""}
            {isMarket && card.categoryLabel ? ` · ${card.categoryLabel}` : ""}
            {isSentiment && card.sentimentHeadline ? ` · ${card.sentimentHeadline}` : ""}
          </p>
          {compact && !isMarket && !isSentiment && !isPositioning && !isCompetition ? null : (
            <p className="text-[13px] text-text-secondary mt-2">{card.summary}</p>
          )}
          {isAudience && card.segments?.length ? (
            <ul className="mt-2 space-y-1">
              {card.segments.map((seg) => (
                <li key={seg.name} className="text-[13px] text-text-secondary">
                  <span className="font-medium text-text-primary">{seg.name}</span>
                  {seg.summary ? ` — ${seg.summary}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {isMarket && card.sections?.length ? (
            <details className="mt-2">
              <summary className="text-[12px] text-text-muted cursor-pointer">
                {card.takeaway ? "Full market picture" : "Details"}
              </summary>
              <div className="mt-2 space-y-2">
                {card.sections.map((sec) => (
                  <p key={sec.label} className="text-[13px] text-text-secondary">
                    <span className="font-medium text-text-primary">{sec.label}.</span>{" "}
                    {sec.text}
                  </p>
                ))}
              </div>
            </details>
          ) : null}
          {isPositioning && card.positioningRationale ? (
            <details className="mt-2">
              <summary className="text-[12px] text-text-muted cursor-pointer">
                Rationale
              </summary>
              <p className="mt-2 text-[13px] text-text-secondary whitespace-pre-wrap">
                {card.positioningRationale}
              </p>
            </details>
          ) : null}
          {isCompetition && (card.competitors?.length || card.competitionBody) ? (
            <div className="mt-2">
              {card.competitors?.length ? (
                <ul className="space-y-1">
                  {card.competitors.map((c) => (
                    <li key={c.name} className="text-[13px] text-text-secondary">
                      <span className="font-medium text-text-primary">{c.name}</span>
                      {c.summary ? ` — ${c.summary}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              {card.competitionBody ? (
                <details className="mt-2">
                  <summary className="text-[12px] text-text-muted cursor-pointer">
                    Gaps we can occupy
                  </summary>
                  <p className="mt-2 text-[13px] text-text-secondary whitespace-pre-wrap">
                    {card.competitionBody}
                  </p>
                </details>
              ) : null}
            </div>
          ) : null}
          {!wired && !compact ? (
            <p className="text-[12px] text-text-muted mt-2">Coming soon.</p>
          ) : null}
          {card.href ? (
            <Link
              href={card.href}
              className="inline-block mt-2 text-[13px] font-medium text-blue-700 no-print"
            >
              {isAudience
                ? "Open Audience Analysis →"
                : isMarket
                  ? "Open Market Analysis →"
                  : isSentiment
                    ? "Open Sentiment →"
                    : isPositioning
                      ? "Open Synthesis →"
                      : isCompetition
                        ? "Open Competition Analysis →"
                        : "Open →"}
            </Link>
          ) : null}
        </div>
      </div>
      {actions ? <div className="mt-3">{actions}</div> : null}
    </Panel>
  );
}
