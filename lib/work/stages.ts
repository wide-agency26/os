import type { BdStage } from "@/lib/bd/types";

export const LOSE_STAGES: BdStage[] = ["on_hold", "declined", "archived"];

export const QUALIFY_STAGES: BdStage[] = [
  "prospect",
  "qualifying",
  "qualified_lead",
  "outreach",
  "discovery_call",
];

export const PROPOSE_STAGES: BdStage[] = ["proposal_sent"];
export const CONTRACT_STAGES: BdStage[] = ["contract", "quotation"];
export const LIVE_BD_STAGES: BdStage[] = ["client_won"];

export type WorkGroup =
  | "find"
  | "qualify"
  | "propose"
  | "contract"
  | "live"
  | "done"
  | "lose";

export const WORK_GROUP_LABELS: Record<WorkGroup, string> = {
  find: "Find",
  qualify: "Qualify",
  propose: "Propose",
  contract: "Contract",
  live: "Live",
  done: "Done",
  lose: "Lose",
};

export function isLoseStage(stage: string | null | undefined): boolean {
  return LOSE_STAGES.includes(stage as BdStage);
}

export function isDoneProject(p: {
  stage?: string | null;
  status?: string | null;
}): boolean {
  return p.stage === "completed" || p.status === "completed";
}

export function isLostProject(p: {
  stage?: string | null;
  status?: string | null;
}): boolean {
  return p.status === "expired";
}

export function isLiveProject(p: {
  stage?: string | null;
  status?: string | null;
}): boolean {
  if (isDoneProject(p) || isLostProject(p)) return false;
  // A leftover running lead is still a lead — Live is signed delivery work.
  return (
    (p.stage === "client" || p.stage === "signed") &&
    (p.status === "running" || !p.status)
  );
}

export function projectWorkLabel(p: {
  stage?: string | null;
  status?: string | null;
}): string {
  if (isLostProject(p)) return "Lost";
  if (isDoneProject(p)) return "Done";
  if (isLiveProject(p)) return "Live";
  if (p.stage === "lead" || p.status === "pipeline") return "Lead";
  if (p.stage === "prospect") return "Prospect";
  return p.stage || p.status || "—";
}

export function workGroupFromBdStage(stage: BdStage): WorkGroup {
  if (LOSE_STAGES.includes(stage)) return "lose";
  if (LIVE_BD_STAGES.includes(stage)) return "live";
  if (CONTRACT_STAGES.includes(stage)) return "contract";
  if (PROPOSE_STAGES.includes(stage)) return "propose";
  if (QUALIFY_STAGES.includes(stage)) return "qualify";
  return "find";
}

/** Pipeline card grouping — a finished/expired project beats leftover BD stage. */
export function workGroupForBdCard(input: {
  stage: string;
  projectStage?: string | null;
  projectStatus?: string | null;
}): WorkGroup {
  if (input.projectStatus === "expired") return "lose";
  if (isDoneProject({ stage: input.projectStage, status: input.projectStatus })) {
    return "done";
  }
  return workGroupFromBdStage(input.stage as BdStage);
}

export function workGroupForCompany(input: {
  crmStatus: string | null;
  bdStages: string[];
  projectStages: string[];
  projectStatuses: string[];
  hasPublishedSow: boolean;
  hasLeadProject: boolean;
}): WorkGroup {
  const n = Math.max(input.projectStages.length, input.projectStatuses.length);
  const projects = Array.from({ length: n }, (_, i) => ({
    stage: input.projectStages[i] || null,
    status: input.projectStatuses[i] || null,
  }));

  if (projects.some(isLiveProject)) return "live";

  const active = input.bdStages.filter((s) => !isLoseStage(s));
  const lost = input.bdStages.filter((s) => isLoseStage(s));
  if (active.length === 0 && lost.length > 0) return "lose";
  if (projects.some(isLostProject) && active.length === 0) return "lose";

  // Finished delivery leaves the active pipeline even if the BD card is still client_won.
  if (!input.hasLeadProject && projects.some(isDoneProject)) return "done";

  if (active.some((s) => CONTRACT_STAGES.includes(s as BdStage))) return "contract";
  if (
    active.some((s) => PROPOSE_STAGES.includes(s as BdStage)) ||
    input.hasPublishedSow
  ) {
    return "propose";
  }
  if (active.some((s) => QUALIFY_STAGES.includes(s as BdStage))) return "qualify";
  if (input.hasLeadProject) return "propose";
  if (input.crmStatus === "Client") return "live";
  return "find";
}

/** Company is only Lose — hide from SOW / proposal pickers. */
export function companyIsLostOnly(bdStages: string[]): boolean {
  if (bdStages.length === 0) return false;
  return bdStages.every((s) => isLoseStage(s));
}

export function lostCompanyIdSet(
  records: { company_id: string | null; stage: string }[]
): Set<string> {
  const byCompany = new Map<string, string[]>();
  for (const r of records) {
    if (!r.company_id) continue;
    const list = byCompany.get(r.company_id) ?? [];
    list.push(r.stage);
    byCompany.set(r.company_id, list);
  }
  const lost = new Set<string>();
  for (const [id, stages] of byCompany) {
    if (companyIsLostOnly(stages)) lost.add(id);
  }
  return lost;
}
