"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2, Search } from "lucide-react";
import { runSeoAudit } from "@/app/actions/seo-audit";
import type { SeoAuditRow } from "@/lib/seo-audit/types";

export function SeoAuditLauncher({
  initialUrl = "",
  bdRecordId = null,
  recent = [],
}: {
  initialUrl?: string;
  bdRecordId?: string | null;
  recent?: SeoAuditRow[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [competitor, setCompetitor] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const res = await runSeoAudit({
        url,
        competitorUrl: competitor || null,
        bdRecordId,
      });
      if (!res.ok) {
        setMessage(res.error || "Audit failed");
        return;
      }
      if (res.id) router.push(`/app/seo-audit/${res.id}`);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">SEO Audit</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Technical + on-page snapshot with a shareable public link. Used by BD
          qualification and as a standalone client tool.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 max-w-xl">
        <label className="block space-y-1 text-xs font-medium text-gray-700">
          Website URL
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
          />
        </label>
        <label className="block space-y-1 text-xs font-medium text-gray-700">
          Competitor URL (optional)
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={competitor}
            onChange={(e) => setCompetitor(e.target.value)}
            placeholder="https://competitor.com"
          />
        </label>
        {bdRecordId && (
          <p className="text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
            Results will be linked back to BD record {bdRecordId.slice(0, 8)}…
          </p>
        )}
        {message && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {message}
          </p>
        )}
        <button
          type="button"
          disabled={pending || !url.trim()}
          onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-2 text-xs font-semibold hover:bg-black disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
          Run audit
        </button>
      </div>

      {recent.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          <p className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            Recent audits
          </p>
          {recent.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/app/seo-audit/${a.id}`}
                  className="text-sm font-semibold text-gray-900 hover:underline truncate block"
                >
                  {a.title || a.normalized_url}
                </Link>
                <p className="text-xs text-gray-500 truncate">
                  {a.normalized_url} · score {a.score ?? "—"} · {a.status}
                </p>
              </div>
              {a.status === "ready" && (
                <a
                  href={`/a/${a.public_slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-700 inline-flex items-center gap-1 shrink-0"
                >
                  Share <ExternalLink size={12} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SeoAuditReportView({
  audit,
  sharePath,
}: {
  audit: SeoAuditRow;
  sharePath: string;
}) {
  const report = audit.report;
  const [copied, setCopied] = useState(false);

  async function copyShare() {
    const absolute =
      typeof window !== "undefined"
        ? `${window.location.origin}${sharePath}`
        : sharePath;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const statusColor = (s: string) =>
    s === "pass"
      ? "text-emerald-700 bg-emerald-50"
      : s === "warn"
        ? "text-amber-700 bg-amber-50"
        : s === "fail"
          ? "text-red-700 bg-red-50"
          : "text-gray-600 bg-gray-50";

  return (
    <article className="space-y-6 max-w-3xl">
      <header className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
          WIDE SEO Audit
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
          {audit.title || audit.normalized_url}
        </h1>
        <p className="text-sm text-gray-500 break-all">{audit.normalized_url}</p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-4xl font-bold tabular-nums text-gray-900">
            {audit.score ?? "—"}
            <span className="text-base font-medium text-gray-400"> / 100</span>
          </p>
          {report?.summary && (
            <p className="text-xs text-gray-500">
              {report.summary.pass} pass · {report.summary.warn} warn ·{" "}
              {report.summary.fail} fail
            </p>
          )}
          <button
            type="button"
            onClick={copyShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
          >
            <Copy size={12} /> {copied ? "Copied" : "Copy share link"}
          </button>
        </div>
      </header>

      {report?.competitor && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <p className="font-semibold text-gray-900">Competitor</p>
          <p className="text-gray-600 mt-1">
            {report.competitor.url} — score {report.competitor.score}.{" "}
            {report.competitor.note}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {(report?.checks || []).map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.detail}</p>
                {c.evidence && (
                  <p className="text-[11px] text-gray-400 mt-1 truncate">
                    {c.evidence}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor(c.status)}`}
              >
                {c.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {report?.limitations?.length ? (
        <ul className="text-[11px] text-gray-400 space-y-1 list-disc pl-4">
          {report.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
