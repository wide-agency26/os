"use client";

import { useState, useEffect, useCallback } from "react";
import { ReportInputForm } from "@/components/reports/ReportInputForm";
import { parsePeriodLabel } from "@/lib/reports/report-helpers";
import { PACKAGE_LABELS, type PackageTier } from "@/lib/reports/report-types";

type ReportListItem = {
  id: string;
  report_period_start: string;
  report_period_end: string;
  package_tier: string;
  status: string;
  generated_at: string | null;
  published_at: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  published: "bg-success/10 text-success",
  draft: "bg-zinc-700/30 text-zinc-400",
  generating: "bg-warning/10 text-warning",
  failed: "bg-danger/10 text-danger",
};

export function FounderReportsManager({ clientId }: { clientId: string }) {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cm/${clientId}/reports`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleCreated = useCallback(
    (reportId: string) => {
      setShowCreate(false);
      fetchReports();
      // Navigate to the editor
      window.location.href = `/admin/clients/${clientId}/reports/${reportId}`;
    },
    [clientId, fetchReports]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            Performance Reports
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Create, generate, and publish 13-step reports.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          {showCreate ? "Cancel" : "+ New Report"}
        </button>
      </div>

      {showCreate && (
        <div className="rounded-2xl border border-accent/25 bg-surface p-6">
          <h3 className="mb-4 text-sm font-semibold text-text-secondary">
            Create New Report
          </h3>
          <ReportInputForm clientId={clientId} onCreated={handleCreated} />
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">Loading reports…</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            No reports yet. Create the first one above.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
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
              <a
                key={report.id}
                href={`/admin/clients/${clientId}/reports/${report.id}`}
                className="group flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:border-accent/40 hover:bg-surface-raised"
              >
                <div>
                  <p className="text-sm font-semibold text-text-primary group-hover:text-accent">
                    {period}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {tierLabel} · Created{" "}
                    {new Date(report.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}
                  >
                    {report.status}
                  </span>
                  <span className="text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100">
                    Edit →
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
