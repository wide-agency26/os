import type { ModuleStatus } from "@/lib/strategy/modules";
import type { SentimentReportRow } from "@/lib/sentiment/types";

export type SentimentSnapshot = {
  reportId: string;
  headline: string;
  score: number | null;
  overall: string | null;
  href: string;
};

/** /app/sentiment "done" = status ready. Map onto strategy_modules.status. */
export function sentimentStatusFromReport(
  report: { status: SentimentReportRow["status"] } | null
): ModuleStatus {
  if (!report) return "not_started";
  if (report.status === "ready") return "finalized";
  return "in_progress";
}

export function sentimentHeadline(report: SentimentReportRow): string {
  const score = report.score ?? report.report?.score ?? null;
  const overall = report.report?.overall || null;
  const parts = [
    score != null ? `${score} / 100` : null,
    overall,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Sentiment report";
}

export function sentimentSnapshot(
  report: SentimentReportRow | null,
  clientSafe: boolean
): SentimentSnapshot | undefined {
  if (!report) return undefined;
  if (clientSafe && report.status !== "ready") return undefined;
  return {
    reportId: report.id,
    headline: sentimentHeadline(report),
    score: report.score,
    overall: report.report?.overall ?? null,
    href: `/app/sentiment/${report.id}`,
  };
}

export function sentimentLauncherHref(project: {
  id: string;
  company: string;
  website?: string | null;
  bdRecordId?: string | null;
}): string {
  const q = new URLSearchParams();
  if (project.company) q.set("brand", project.company);
  if (project.website) q.set("url", project.website);
  q.set("project", project.id);
  if (project.bdRecordId) q.set("bd", project.bdRecordId);
  return `/app/sentiment?${q.toString()}`;
}
