"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, EyeOff, Loader2, RotateCcw, Play } from "lucide-react";
import {
  updateDebugReportStatus,
  type DebugReportRow,
} from "@/app/actions/debug-reports";
import { compileOpenReportsMarkdown } from "@/lib/debug/brief";
import type { DebugStatus } from "@/lib/debug/types";
import { triggerToast } from "@/components/ci-builder/Toast";

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function displayTitle(r: DebugReportRow) {
  const generic = !r.title || /^wide os workspace$/i.test(r.title.trim());
  const fromReport = r.what_happened?.trim();
  if (generic && fromReport) return fromReport.slice(0, 140);
  return r.title;
}

const FILTERS: { id: "active" | "resolved" | "hidden" | "all"; label: string }[] = [
  { id: "active", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "hidden", label: "Hidden" },
  { id: "all", label: "All" },
];

const TYPE_FILTERS: { id: "all" | "bug" | "enhancement"; label: string }[] = [
  { id: "all", label: "All types" },
  { id: "bug", label: "Bugs" },
  { id: "enhancement", label: "Enhancements" },
];

export function DebugCenterClient({ initial }: { initial: DebugReportRow[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]["id"]>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const open = rows.filter((r) => r.status === "open" || r.status === "in_progress").length;
    const resolved = rows.filter((r) => r.status === "resolved").length;
    const hidden = rows.filter((r) => r.status === "hidden").length;
    return { active: open, resolved, hidden, all: rows.length };
  }, [rows]);

  const visible = useMemo(() => {
    let list = rows;
    if (filter === "active") {
      list = list.filter((r) => r.status === "open" || r.status === "in_progress");
    } else if (filter === "resolved") {
      list = list.filter((r) => r.status === "resolved");
    } else if (filter === "hidden") {
      list = list.filter((r) => r.status === "hidden");
    }
    if (typeFilter !== "all") {
      list = list.filter((r) => (r.report_type || "bug") === typeFilter);
    }
    return list;
  }, [rows, filter, typeFilter]);

  const setStatus = (id: string, status: DebugStatus) => {
    let resolutionNote: string | undefined;
    if (status === "resolved") {
      const answer = window.prompt(
        "What shipped? Add a short note for the Debug center (optional)."
      );
      if (answer === null) return;
      resolutionNote = answer.trim() || undefined;
    }

    startTransition(async () => {
      const res = await updateDebugReportStatus(id, status, resolutionNote);
      if (!res.ok) {
        triggerToast(res.error || "Could not update report");
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status,
                resolution_note:
                  status === "resolved" && resolutionNote
                    ? resolutionNote
                    : status === "open" || status === "in_progress"
                      ? null
                      : r.resolution_note,
                resolved_at:
                  status === "resolved" || status === "hidden"
                    ? new Date().toISOString()
                    : status === "open" || status === "in_progress"
                      ? null
                      : r.resolved_at,
              }
            : r
        )
      );
    });
  };

  const copyBank = async () => {
    const md = compileOpenReportsMarkdown(
      visible.map((r) => ({
        title: r.title,
        created_at: r.created_at,
        status: r.status,
        severity: r.severity,
        reporter_name: r.reporter_name,
        location_label: r.location_label,
        agent_brief: r.agent_brief,
      }))
    );
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${
                filter === f.id
                  ? "bg-accent text-white border-accent"
                  : "bg-surface text-text-secondary border-border"
              }`}
            >
              {f.label}
              {counts[f.id] ? ` · ${counts[f.id]}` : ""}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTypeFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${
                typeFilter === f.id
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-surface text-text-secondary border-border"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void copyBank()}
          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-11 rounded-lg border border-border bg-surface text-[12px] font-semibold text-text-primary hover:bg-surface-raised"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          Copy markdown for Cursor
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-[13px] text-text-secondary">Nothing in this list.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => {
            const open = openId === r.id;
            return (
              <article
                key={r.id}
                className="rounded-lg border border-border bg-surface overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="w-full text-left px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      {r.report_type === "enhancement" ? "enhancement" : "bug"}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      {r.severity}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        r.status === "resolved"
                          ? "text-success"
                          : r.status === "in_progress"
                            ? "text-warning"
                            : "text-text-muted"
                      }`}
                    >
                      {r.status.replace("_", " ")}
                    </span>
                    {r.viewing_as_client ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-warning">
                        view as {r.view_as_company_name || "client"}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-[14px] font-semibold text-text-primary mt-1">
                    {displayTitle(r)}
                  </h2>
                  <p className="text-[12px] text-text-secondary mt-0.5">
                    {r.reporter_name || "Founder"} · {fmt(r.created_at)}
                    {r.location_label ? ` · ${r.location_label}` : ""}
                    {r.project_id ? ` · project ${r.project_id.slice(0, 8)}…` : ""}
                  </p>
                  {r.status === "resolved" && r.resolution_note ? (
                    <p className="text-[12px] text-text-primary mt-1.5">
                      {r.resolution_note}
                    </p>
                  ) : null}
                </button>
                {open ? (
                  <div className="px-4 pb-4 space-y-3 border-t border-border">
                    {r.what_happened ? (
                      <div className="pt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          Report
                        </p>
                        <p className="mt-1 text-[13px] text-text-primary whitespace-pre-wrap">
                          {r.what_happened}
                        </p>
                      </div>
                    ) : null}
                    {r.resolution_note ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          What shipped
                        </p>
                        <p className="mt-1 text-[13px] text-text-primary whitespace-pre-wrap">
                          {r.resolution_note}
                        </p>
                        {r.resolved_at ? (
                          <p className="mt-1 text-[12px] text-text-secondary">
                            Marked resolved {fmt(r.resolved_at)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {r.attachment_urls && r.attachment_urls.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-3">
                        {r.attachment_urls.map((a) => (
                          <a
                            key={a.url}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                          >
                            <img
                              src={a.url}
                              alt={a.name}
                              className="h-24 w-24 object-cover rounded-lg border border-border"
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <pre className="mt-3 whitespace-pre-wrap text-[12px] leading-relaxed text-text-primary font-mono bg-surface-raised rounded-lg p-3 max-h-[420px] overflow-y-auto">
                      {r.agent_brief}
                    </pre>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(r.agent_brief)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[12px] font-semibold"
                      >
                        <Copy size={13} /> Copy this
                      </button>
                      {r.status !== "in_progress" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setStatus(r.id, "in_progress")}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[12px] font-semibold"
                        >
                          <Play size={13} /> In progress
                        </button>
                      ) : null}
                      {r.status !== "resolved" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setStatus(r.id, "resolved")}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-[12px] font-semibold"
                        >
                          {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          Resolved
                        </button>
                      ) : null}
                      {r.status !== "hidden" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setStatus(r.id, "hidden")}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[12px] font-semibold"
                        >
                          <EyeOff size={13} /> Hide
                        </button>
                      ) : null}
                      {r.status === "resolved" || r.status === "hidden" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setStatus(r.id, "open")}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[12px] font-semibold"
                        >
                          <RotateCcw size={13} /> Reopen
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
