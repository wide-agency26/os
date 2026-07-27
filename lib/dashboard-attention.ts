import type { MilestoneRow } from "./project-helpers";

export type AttentionItem = {
  clientId: string;
  clientName: string;
  companyName: string | null;
  severity: "high" | "medium";
  headline: string;
  detail: string;
  projectTitle: string;
};

function daysBetween(isoDate: string, from = Date.now()) {
  const t = new Date(isoDate).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.floor((from - t) / 86400000);
}

/** Flags milestones stuck in client approval / review. */
export function attentionFromMilestones(
  clientId: string,
  clientName: string,
  companyName: string | null,
  projectTitle: string,
  milestones: MilestoneRow[]
): AttentionItem | null {
  for (const m of milestones) {
    if (m.status !== "awaiting_client") continue;
    const since = m.awaiting_client_since;
    if (!since) {
      return {
        clientId,
        clientName,
        companyName,
        severity: "medium",
        headline: `${clientName} — waiting on client`,
        detail: m.approval_label
          ? `${m.approval_label} (“${m.phase}”)`
          : `Action needed: ${m.phase}`,
        projectTitle,
      };
    }
    const d = daysBetween(since);
    if (d >= 3) {
      return {
        clientId,
        clientName,
        companyName,
        severity: "high",
        headline: `${clientName} has not approved ${m.approval_label ?? m.phase} for ${d} days`,
        detail: `Since ${since}. Consider a nudge or call.`,
        projectTitle,
      };
    }
    if (d >= 0) {
      return {
        clientId,
        clientName,
        companyName,
        severity: "medium",
        headline: `${clientName} — approval pending`,
        detail: m.approval_label
          ? `${m.approval_label} (since ${since})`
          : `${m.phase} awaiting client since ${since}`,
        projectTitle,
      };
    }
  }
  return null;
}

export type RenewalRow = {
  clientId: string;
  clientName: string;
  companyName: string | null;
  projectTitle: string;
  renewsOn: string;
  daysLeft: number;
};

export function renewalsWithinDays(
  rows: Array<{
    client_id: string;
    title: string;
    contract_renews_at: string | null;
  }>,
  clientMeta: Map<string, { name: string; company: string | null }>,
  withinDays = 30,
  from = new Date()
): RenewalRow[] {
  const out: RenewalRow[] = [];
  const now = from.getTime();
  for (const r of rows) {
    const raw = r.contract_renews_at;
    if (!raw) continue;
    const end = new Date(raw).getTime();
    if (!Number.isFinite(end)) continue;
    const daysLeft = Math.ceil((end - now) / 86400000);
    if (daysLeft < 0 || daysLeft > withinDays) continue;
    const meta = clientMeta.get(r.client_id);
    out.push({
      clientId: r.client_id,
      clientName: meta?.name ?? "Client",
      companyName: meta?.company ?? null,
      projectTitle: r.title,
      renewsOn: raw,
      daysLeft,
    });
  }
  out.sort((a, b) => a.daysLeft - b.daysLeft);
  return out;
}

export function launchCountdown(launchDate: string | null, endDate: string | null) {
  const raw = launchDate || endDate;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.ceil((t - Date.now()) / 86400000);
  return { targetLabel: launchDate ? "Launch" : "Engagement ends", date: raw, days };
}
