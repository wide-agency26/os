import Link from "next/link";
import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";
import { createClient } from "@/utils/supabase/server";
import { PACKAGE_LABELS, type PackageTier } from "@/lib/reports/report-types";
import { parsePeriodLabel } from "@/lib/reports/report-helpers";

const STATUS_STYLES: Record<string, string> = {
  published: "bg-success/10 text-success",
  draft: "bg-text-muted/10 text-text-muted",
  generating: "bg-warning/10 text-warning",
  failed: "bg-danger/10 text-danger",
};

export default async function Page({
  params,
}: {
  params: Promise<{ client_id: string }>;
}) {
  const { client_id } = await params;
  const access = await resolveClientReadAccess(client_id);

  if (!access) {
    return <div className="p-8 text-zinc-500">Access Denied</div>;
  }

  const supabase = await createClient();
  const isFounder = access.executive || access.role !== "client";

  // Clients see only published; founders see all
  let query = supabase
    .from("performance_reports")
    .select(
      "id, report_period_start, report_period_end, package_tier, status, published_at, created_at"
    )
    .eq("client_id", client_id)
    .order("report_period_start", { ascending: false });

  if (!isFounder) {
    query = query.eq("status", "published");
  }

  const { data: reports } = await query;

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-8 px-4 page-enter">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          Performance Reports
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          High-velocity performance analysis for each reporting period.
        </p>
      </header>

      {!reports || reports.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <p className="text-sm text-text-muted">
            No reports available yet. Your team is preparing your first
            performance report.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const period = parsePeriodLabel(
              report.report_period_start,
              report.report_period_end
            );
            const tierLabel =
              PACKAGE_LABELS[report.package_tier as PackageTier] ??
              report.package_tier;
            const statusClass =
              STATUS_STYLES[report.status] ?? STATUS_STYLES.draft;

            return (
              <Link
                key={report.id}
                href={`/client/${client_id}/reports/${report.id}`}
                className="group flex items-center justify-between rounded-xl border border-border bg-surface p-5 transition-all hover:border-accent/40 hover:bg-surface-raised"
              >
                <div>
                  <p className="text-sm font-semibold text-text-primary group-hover:text-accent">
                    {period}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {tierLabel} ·{" "}
                    {report.published_at
                      ? `Published ${new Date(report.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                      : `Created ${new Date(report.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {isFounder && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}
                    >
                      {report.status}
                    </span>
                  )}
                  <span className="text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100">
                    View →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
