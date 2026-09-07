import type { SeoIssueCategory, SeoScores, SeoSeverity } from "../types";

type ScoredIssue = {
  category: SeoIssueCategory;
  severity: SeoSeverity;
  affected_count: number;
};

/** Penalty per issue, scaled by how much of the site it affects. */
const SEVERITY_PENALTY: Record<SeoSeverity, number> = {
  critical: 25,
  high: 14,
  medium: 7,
  low: 3,
  info: 0,
};

const PILLAR_CATEGORIES: Record<
  Exclude<keyof SeoScores, "overall" | "unavailable">,
  SeoIssueCategory[]
> = {
  technical: ["indexability", "technical", "links", "international", "mobile"],
  content: ["on_page", "content", "schema"],
  performance: ["performance"],
  search_presence: ["search_presence"],
};

function pillarScore(
  issues: ScoredIssue[],
  categories: SeoIssueCategory[],
  totalPages: number
): number {
  const relevant = issues.filter((i) => categories.includes(i.category));
  if (!relevant.length) return 100;

  let penalty = 0;
  for (const issue of relevant) {
    const base = SEVERITY_PENALTY[issue.severity];
    if (!base) continue;
    // An issue on one page out of 500 should not weigh the same as one on all
    // 500. Scale between 35% and 100% of the base penalty by prevalence.
    const share = totalPages > 0 ? Math.min(issue.affected_count / totalPages, 1) : 1;
    penalty += base * (0.35 + 0.65 * share);
  }

  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export type ScoreInput = {
  issues: ScoredIssue[];
  totalPages: number;
  /** Pillars we genuinely could not measure, kept out of the overall average. */
  unavailable: string[];
};

export function computeScores(input: ScoreInput): SeoScores {
  const { issues, totalPages, unavailable } = input;

  const technical = pillarScore(issues, PILLAR_CATEGORIES.technical, totalPages);
  const content = pillarScore(issues, PILLAR_CATEGORIES.content, totalPages);
  const performance = unavailable.includes("performance")
    ? 0
    : pillarScore(issues, PILLAR_CATEGORIES.performance, totalPages);
  const searchPresence = unavailable.includes("search_presence")
    ? 0
    : pillarScore(issues, PILLAR_CATEGORIES.search_presence, totalPages);

  const weights: { key: keyof SeoScores; value: number; weight: number }[] = [
    { key: "technical", value: technical, weight: 0.35 },
    { key: "content", value: content, weight: 0.3 },
    { key: "performance", value: performance, weight: 0.25 },
    { key: "search_presence", value: searchPresence, weight: 0.1 },
  ];

  const measured = weights.filter((w) => !unavailable.includes(w.key as string));
  const totalWeight = measured.reduce((s, w) => s + w.weight, 0);
  const overall = totalWeight
    ? Math.round(measured.reduce((s, w) => s + w.value * w.weight, 0) / totalWeight)
    : 0;

  return {
    overall,
    technical,
    content,
    performance,
    search_presence: searchPresence,
    unavailable,
  };
}
