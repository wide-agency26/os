import type { BdDemandSignal, BdLegitimacyStatus, BdRecord } from "./types";

export type BdQualificationRecommendation =
  | "promote"
  | "hold"
  | "disqualify";

export type BdQualificationAdvice = {
  recommendation: BdQualificationRecommendation;
  label: string;
  targetStage: "qualified_lead" | "on_hold" | "archived";
  reasoning: string[];
  requiresReason: boolean;
};

export const DEMAND_SIGNAL_TYPES = [
  "Funding",
  "Hiring",
  "Rebrand / launch",
  "Website rebuild",
  "SEO / content gap",
  "Paid acquisition",
  "Product launch",
  "Other",
] as const;

/** Guess a likely website from company name — stub for Phase 2 (no crawl). */
export function guessWebsiteFromCompany(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
  if (!slug) return "https://";
  return `https://www.${slug}.com`;
}

export function computeQualificationAdvice(input: {
  legitimacy_status: BdLegitimacyStatus | null;
  legitimacy_reason: string | null;
  demand_signals: BdDemandSignal[];
}): BdQualificationAdvice {
  const status = input.legitimacy_status;
  const signals = input.demand_signals.filter(
    (s) => s.type.trim() || s.description.trim()
  );
  const reason = input.legitimacy_reason?.trim() || "";

  if (!status) {
    return {
      recommendation: "hold",
      label: "Hold — incomplete qualification",
      targetStage: "on_hold",
      reasoning: [
        "Legitimacy status is not set yet.",
        "Fill legitimacy + at least one demand signal (or mark fail) before promoting.",
      ],
      requiresReason: false,
    };
  }

  if (status === "fail") {
    return {
      recommendation: "disqualify",
      label: "Disqualify — archive with reason",
      targetStage: "archived",
      reasoning: [
        "Legitimacy marked as fail.",
        reason
          ? `Reason on file: ${reason}`
          : "Add a legitimacy reason — it will be stored as the archive reason.",
        "Confirming will move this record to Archived. Nothing is deleted.",
      ],
      requiresReason: true,
    };
  }

  if (status === "uncertain") {
    return {
      recommendation: "hold",
      label: "Hold — legitimacy uncertain",
      targetStage: "on_hold",
      reasoning: [
        "Legitimacy is uncertain — keep researching before outreach spend.",
        signals.length
          ? `${signals.length} demand signal(s) logged — useful context while on hold.`
          : "No demand signals yet — add any signals you find while researching.",
        reason ? `Note: ${reason}` : "Consider adding a short legitimacy note.",
      ],
      requiresReason: false,
    };
  }

  // pass
  if (signals.length === 0) {
    return {
      recommendation: "hold",
      label: "Hold — no demand signals yet",
      targetStage: "on_hold",
      reasoning: [
        "Legitimacy passed, but no demand signals are logged.",
        "Add at least one concrete signal (hiring, funding, rebrand, etc.) before promoting to Qualified Lead.",
      ],
      requiresReason: false,
    };
  }

  return {
    recommendation: "promote",
    label: "Promote to Qualified Lead",
    targetStage: "qualified_lead",
    reasoning: [
      "Legitimacy passed.",
      `${signals.length} demand signal(s) recorded.`,
      reason ? `Context: ${reason}` : "Ready for outreach / next BD steps.",
    ],
    requiresReason: false,
  };
}

export function adviceFromRecord(record: BdRecord): BdQualificationAdvice {
  return computeQualificationAdvice({
    legitimacy_status: record.legitimacy_status,
    legitimacy_reason: record.legitimacy_reason,
    demand_signals: record.demand_signals,
  });
}
