import Link from "next/link";
import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";
import { createClient } from "@/utils/supabase/server";
import { ReportRenderer } from "@/components/reports/ReportRenderer";
import type {
  GeneratedReport,
  PackageTier,
} from "@/lib/reports/report-types";
import { parsePeriodLabel } from "@/lib/reports/report-helpers";

export default async function Page({
  params,
}: {
  params: Promise<{ client_id: string; report_id: string }>;
}) {
  const { client_id, report_id } = await params;
  const access = await resolveClientReadAccess(client_id);

  if (!access) {
    return <div className="p-8 text-zinc-500">Access Denied</div>;
  }

  const supabase = await createClient();
  const isFounder = access.executive || access.role !== "client";

  let query = supabase
    .from("performance_reports")
    .select("*")
    .eq("id", report_id)
    .eq("client_id", client_id);

  if (!isFounder) {
    query = query.eq("status", "published");
  }

  const { data: report } = await query.single();

  if (!report) {
    return (
      <div className="mx-auto max-w-5xl py-8 px-4 page-enter">
        <p className="text-sm text-text-muted">Report not found.</p>
        <Link
          href={`/client/${client_id}/reports`}
          className="mt-2 inline-flex text-sm text-accent hover:underline"
        >
          ← Back to reports
        </Link>
      </div>
    );
  }

  const generated = report.generated_report as GeneratedReport | null;
  const tier = (report.package_tier ?? "launch") as PackageTier;
  const period = parsePeriodLabel(
    report.report_period_start,
    report.report_period_end
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8 px-4 page-enter">
      <div className="flex items-center justify-between">
        <Link
          href={`/client/${client_id}/reports`}
          className="text-xs text-text-muted hover:text-accent"
        >
          ← All Reports
        </Link>
        {isFounder && (
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              report.status === "published"
                ? "bg-success/10 text-success"
                : report.status === "draft"
                  ? "bg-text-muted/10 text-text-muted"
                  : report.status === "generating"
                    ? "bg-warning/10 text-warning"
                    : "bg-danger/10 text-danger"
            }`}
          >
            {report.status}
          </span>
        )}
      </div>

      {generated ? (
        <ReportRenderer report={generated} tier={tier} />
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <p className="text-lg font-semibold text-text-primary">
            Report for {period}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            {report.status === "generating"
              ? "This report is currently being generated. Check back shortly."
              : report.status === "failed"
                ? "Report generation failed. Your team will re-generate it."
                : "This report has not been generated yet."}
          </p>
        </div>
      )}
    </div>
  );
}
