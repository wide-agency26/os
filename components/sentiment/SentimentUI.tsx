"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2, Smile } from "lucide-react";
import { runSentimentReport } from "@/app/actions/sentiment";
import type { SentimentReportRow } from "@/lib/sentiment/types";

export function SentimentLauncher({
  initialBrand = "",
  initialUrl = "",
  bdRecordId = null,
  recent = [],
}: {
  initialBrand?: string;
  initialUrl?: string;
  bdRecordId?: string | null;
  recent?: SentimentReportRow[];
}) {
  const router = useRouter();
  const [brand, setBrand] = useState(initialBrand);
  const [url, setUrl] = useState(initialUrl);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const res = await runSentimentReport({
        brandName: brand,
        websiteUrl: url || null,
        bdRecordId,
      });
      if (!res.ok) {
        setMessage(res.error || "Failed");
        return;
      }
      if (res.id) router.push(`/app/sentiment/${res.id}`);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Sentiment Analysis</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          First-pass brand sentiment from the company site, schema ratings, and
          presence signals. Shareable report for prospects.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 max-w-xl">
        <label className="block space-y-1 text-xs font-medium text-gray-700">
          Brand / company name
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-xs font-medium text-gray-700">
          Website URL (optional)
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
          />
        </label>
        {bdRecordId && (
          <p className="text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
            Will link back to BD record {bdRecordId.slice(0, 8)}…
          </p>
        )}
        {message && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {message}
          </p>
        )}
        <button
          type="button"
          disabled={pending || !brand.trim()}
          onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Smile size={14} />}
          Run analysis
        </button>
      </div>

      {recent.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white divide-y">
          <p className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            Recent
          </p>
          {recent.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <Link
                  href={`/app/sentiment/${r.id}`}
                  className="text-sm font-semibold text-gray-900 hover:underline"
                >
                  {r.brand_name}
                </Link>
                <p className="text-xs text-gray-500">
                  score {r.score ?? "—"} · {r.status}
                </p>
              </div>
              {r.status === "ready" && (
                <a
                  href={`/n/${r.public_slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-700 inline-flex items-center gap-1"
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

export function SentimentReportView({
  report,
  sharePath,
}: {
  report: SentimentReportRow;
  sharePath: string;
}) {
  const payload = report.report;
  const [copied, setCopied] = useState(false);

  return (
    <article className="space-y-6 max-w-3xl">
      <header className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
          WIDE Sentiment
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          {report.brand_name}
        </h1>
        {report.website_url && (
          <p className="text-sm text-gray-500 break-all">{report.website_url}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-4xl font-bold tabular-nums">
            {report.score ?? "—"}
            <span className="text-base font-medium text-gray-400"> / 100</span>
          </p>
          {payload?.overall && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold uppercase text-gray-700">
              {payload.overall}
            </span>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium"
            onClick={async () => {
              const abs =
                typeof window !== "undefined"
                  ? `${window.location.origin}${sharePath}`
                  : sharePath;
              try {
                await navigator.clipboard.writeText(abs);
                setCopied(true);
              } catch {
                /* ignore */
              }
            }}
          >
            <Copy size={12} /> {copied ? "Copied" : "Copy share link"}
          </button>
        </div>
      </header>

      {payload?.themes?.length ? (
        <div className="flex flex-wrap gap-2">
          {payload.themes.map((t) => (
            <span
              key={t.label}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600"
            >
              {t.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        {(payload?.findings || []).map((f) => (
          <div key={f.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.detail}</p>
              </div>
              <span className="shrink-0 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">
                {f.polarity}
              </span>
            </div>
          </div>
        ))}
      </div>

      {payload?.limitations?.length ? (
        <ul className="text-[11px] text-gray-400 list-disc pl-4 space-y-1">
          {payload.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
