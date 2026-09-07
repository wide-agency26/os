/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadAudienceSegments } from "@/lib/audience/load";
import {
  audienceModuleStatus,
  pairIsFinalized,
  type AudienceSegment,
} from "@/lib/audience/types";
import { loadCompetitors, loadCompetitionSynthesis } from "@/lib/competition/load";
import { competitionModuleStatus } from "@/lib/competition/types";
import { loadMarketAnalysis } from "@/lib/market/load";
import { MARKET_FIELD_LABELS, marketModuleStatus } from "@/lib/market/types";
import {
  AUDIENCE_MODULE_KEY,
  COMPETITION_MODULE_KEY,
  MARKET_MODULE_KEY,
  MODULE_LABELS,
} from "@/lib/strategy/modules";
import { loadStrategy } from "@/lib/strategy/load";
import type {
  PositioningGate,
  PositioningInputChip,
  PositioningInputsUsed,
} from "@/lib/positioning/types";

type Sb = any;

export type PositioningPack = {
  gate: PositioningGate;
  pack: string;
  inputsUsed: PositioningInputsUsed;
  strategyType: string;
};

async function latestTimestamp(
  supabase: Sb,
  table: string,
  filter: { column: string; value: string },
  extraEq?: { column: string; value: string }
): Promise<string> {
  let q = supabase.from(table).select("updated_at").eq(filter.column, filter.value);
  if (extraEq) q = q.eq(extraEq.column, extraEq.value);
  const { data } = await q.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return data?.updated_at || new Date().toISOString();
}

/**
 * Audience is required at the *project* level even when this strategy type
 * does not attach audience-analysis (business / go-to-market defaults).
 * Competition and Market only feed the draft when they are attached to *this*
 * strategy and finalized. Sentiment is an analyzer on some types but is not a
 * positioning input — the brief names Audience + optional Competition/Market.
 */
export async function collectPositioningContext(
  supabase: Sb,
  projectId: string,
  strategyId: string
): Promise<PositioningPack | { ok: false; error: string }> {
  const strategy = await loadStrategy(supabase, strategyId);
  if (!strategy) return { ok: false, error: "Strategy not found" };

  const attached = new Set(strategy.modules.map((m) => m.moduleKey));
  const segments = await loadAudienceSegments(supabase, projectId);
  const audienceFinal = audienceModuleStatus(segments) === "finalized";

  const market = await loadMarketAnalysis(supabase, projectId);
  const marketFinal = marketModuleStatus(market) === "finalized";
  const marketAttached = attached.has(MARKET_MODULE_KEY);

  const synthesis = await loadCompetitionSynthesis(supabase, projectId);
  const competitors = await loadCompetitors(supabase, projectId);
  const competitionFinal = competitionModuleStatus(synthesis) === "finalized";
  const competitionAttached = attached.has(COMPETITION_MODULE_KEY);

  const chips: PositioningInputChip[] = [
    {
      moduleKey: AUDIENCE_MODULE_KEY,
      label: MODULE_LABELS[AUDIENCE_MODULE_KEY],
      attached: attached.has(AUDIENCE_MODULE_KEY),
      finalized: audienceFinal,
      optional: false,
      note: audienceFinal
        ? `${segments.filter(pairIsFinalized).length} segment${
            segments.filter(pairIsFinalized).length === 1 ? "" : "s"
          } ready`
        : attached.has(AUDIENCE_MODULE_KEY)
          ? "Required — finalize Audience Analysis before generating"
          : "Required on this project even if this strategy type does not list it",
    },
  ];

  if (competitionAttached) {
    chips.push({
      moduleKey: COMPETITION_MODULE_KEY,
      label: MODULE_LABELS[COMPETITION_MODULE_KEY],
      attached: true,
      finalized: competitionFinal,
      optional: true,
      note: competitionFinal
        ? "Included in this draft"
        : "Optional — finalizing it will strengthen the next draft",
    });
  }

  if (marketAttached) {
    chips.push({
      moduleKey: MARKET_MODULE_KEY,
      label: MODULE_LABELS[MARKET_MODULE_KEY],
      attached: true,
      finalized: marketFinal,
      optional: true,
      note: marketFinal
        ? "Included in this draft"
        : "Optional — finalizing it will strengthen the next draft",
    });
  }

  const canGenerate = audienceFinal;
  const reason = canGenerate
    ? null
    : "Audience Analysis must be finalized before drafting positioning. Competition and Market are optional — they strengthen the draft when they are finalized.";

  const inputsUsed: PositioningInputsUsed = {};
  const parts: string[] = [];

  if (audienceFinal) {
    inputsUsed[AUDIENCE_MODULE_KEY] = {
      finalizedAt: await latestTimestamp(supabase, "audience_segments", {
        column: "project_id",
        value: projectId,
      }, { column: "status", value: "finalized" }),
      label: MODULE_LABELS[AUDIENCE_MODULE_KEY],
    };
    parts.push(packAudience(segments.filter(pairIsFinalized)));
  }

  if (competitionAttached && competitionFinal && synthesis) {
    inputsUsed[COMPETITION_MODULE_KEY] = {
      finalizedAt: await latestTimestamp(supabase, "competition_synthesis", {
        column: "project_id",
        value: projectId,
      }),
      label: MODULE_LABELS[COMPETITION_MODULE_KEY],
    };
    const names = competitors
      .filter((c) => c.accepted || c.status === "finalized")
      .map((c) => `- ${c.name}: ${c.positioningSummary || c.notes || ""}`)
      .join("\n");
    parts.push(
      `## Competition analysis\nGaps / opportunities:\n${synthesis.gapsAndOpportunities || "(none)"}\n${
        names ? `\nCompetitors:\n${names}` : ""
      }`
    );
  }

  if (marketAttached && marketFinal && market) {
    inputsUsed[MARKET_MODULE_KEY] = {
      finalizedAt: await latestTimestamp(supabase, "market_analysis", {
        column: "project_id",
        value: projectId,
      }),
      label: MODULE_LABELS[MARKET_MODULE_KEY],
    };
    parts.push(
      `## Market analysis\nCategory: ${market.category}\n${MARKET_FIELD_LABELS.size_notes}: ${market.sizeNotes}\n${MARKET_FIELD_LABELS.trend_notes}: ${market.trendNotes}\n${MARKET_FIELD_LABELS.timing_notes}: ${market.timingNotes}\n${MARKET_FIELD_LABELS.risk_notes}: ${market.riskNotes}`
    );
  }

  return {
    gate: { canGenerate, reason, chips },
    pack: parts.join("\n\n") || "(no finalized analyzer output)",
    inputsUsed,
    strategyType: strategy.strategyType,
  };
}

function packAudience(segments: AudienceSegment[]): string {
  const blocks = segments.map((s) => {
    const p = s.profile;
    return `### ${s.name}
Demographic: ${s.demographicSummary}
Value: ${s.sizeOrValue}
Why this cut: ${s.rationale}
Pains: ${p?.pains || ""}
Motivations: ${p?.motivations || ""}
Language: ${p?.languageCues || ""}
Triggers: ${p?.triggers || ""}`;
  });
  return `## Audience analysis\n${blocks.join("\n\n")}`;
}
