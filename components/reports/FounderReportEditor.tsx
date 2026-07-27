"use client";

import { useState, useCallback, useEffect } from "react";
import { ReportRenderer } from "@/components/reports/ReportRenderer";
import { parsePeriodLabel } from "@/lib/reports/report-helpers";
import {
  PACKAGE_LABELS,
  type GeneratedReport,
  type PackageTier,
  type PerformanceReportRow,
} from "@/lib/reports/report-types";

type Props = {
  clientId: string;
  reportId: string;
};

export function FounderReportEditor({ clientId, reportId }: Props) {
  const [report, setReport] = useState<PerformanceReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cm/${clientId}/reports/${reportId}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data.report as PerformanceReportRow);
      }
    } finally {
      setLoading(false);
    }
  }, [clientId, reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(
        `/api/cm/${clientId}/reports/${reportId}/generate`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
        return;
      }
      setSuccessMsg("Report generated successfully.");
      await fetchReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setGenerating(false);
    }
  }, [clientId, reportId, fetchReport]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/cm/${clientId}/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Publish failed.");
        return;
      }
      setSuccessMsg("Report published — now visible to the client.");
      await fetchReport();
    } finally {
      setPublishing(false);
    }
  }, [clientId, reportId, fetchReport]);

  const handleUnpublish = useCallback(async () => {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/cm/${clientId}/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpublish" }),
      });
      if (res.ok) {
        setSuccessMsg("Report unpublished — hidden from client.");
        await fetchReport();
      }
    } finally {
      setPublishing(false);
    }
  }, [clientId, reportId, fetchReport]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-text-muted">Loading report…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-text-muted">Report not found.</p>
      </div>
    );
  }

  const tier = (report.package_tier ?? "launch") as PackageTier;
  const tierLabel = PACKAGE_LABELS[tier];
  const period = parsePeriodLabel(
    report.report_period_start,
    report.report_period_end
  );
  const generated = report.generated_report as GeneratedReport | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a
            href={`/admin/clients/${clientId}/reports`}
            className="text-xs text-text-muted hover:text-accent"
          >
            ← All Reports
          </a>
          <h2 className="mt-2 text-xl font-semibold text-text-primary">
            {period}
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            {tierLabel} · Status:{" "}
            <span className="font-semibold capitalize">{report.status}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
          >
            {generating
              ? "Generating…"
              : generated
                ? "Re-Generate"
                : "Generate Report"}
          </button>

          {generated && report.status !== "published" && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-50"
            >
              {publishing ? "Publishing…" : "Publish to Client"}
            </button>
          )}

          {report.status === "published" && (
            <button
              onClick={handleUnpublish}
              disabled={publishing}
              className="rounded-lg border border-danger/40 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              Unpublish
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          {successMsg}
        </div>
      )}

      {/* Input Summary */}
      <details className="rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-text-secondary hover:text-text-primary">
          Input Payload (raw data)
        </summary>
        <div className="border-t border-border p-5">
          <pre className="max-h-80 overflow-auto rounded-lg bg-surface-raised p-4 text-xs text-text-secondary">
            {JSON.stringify(report.input_payload, null, 2)}
          </pre>
        </div>
      </details>

      {/* Generated Report Preview */}
      {generated ? (
        <div>
          <h3 className="mb-4 text-sm font-semibold text-text-secondary">
            Report Preview
            <span className="ml-2 text-[10px] font-normal text-text-muted">
              (showing all sections — client will only see tier-filtered view)
            </span>
          </h3>
          <ReportRenderer report={generated} tier={tier} showAll />
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <p className="text-sm text-text-muted">
            {report.status === "generating"
              ? "Report is being generated by AI…"
              : report.status === "failed"
                ? "Generation failed. Edit the input payload and try again."
                : "Paste your raw data above, then click \u201cGenerate Report\u201d to create the 13-step analysis."}
          </p>
        </div>
      )}
    </div>
  );
}
