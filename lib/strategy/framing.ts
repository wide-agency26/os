/** Pitch vs living document — derived from project.stage, never stored. */

export type StrategyFraming = "pitch" | "living";

export function strategyFramingFromProjectStage(
  stage: string | null | undefined
): StrategyFraming {
  if (stage === "client" || stage === "signed" || stage === "completed") {
    return "living";
  }
  return "pitch";
}

export function framingCopy(framing: StrategyFraming): {
  eyebrow: string;
  title: string;
  subtitle: string;
} {
  if (framing === "living") {
    return {
      eyebrow: "Living strategy",
      title: "How we work this together",
      subtitle: "Active client document — analyses stay current as the work runs.",
    };
  }
  return {
    eyebrow: "Proposal",
    title: "The strategy we would run",
    subtitle: "A concise pitch of the engagement — more depth once we are live.",
  };
}
