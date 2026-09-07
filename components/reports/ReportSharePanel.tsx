"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import {
  getReportShare,
  saveReportShare,
  type ReportSharePublicMeta,
} from "@/app/actions/report-share";

export function ReportSharePanel({ projectId }: { projectId: string }) {
  const [share, setShare] = useState<ReportSharePublicMeta | null>(null);
  const [password, setPassword] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setPassword("");
    setMessage(null);
    void getReportShare(projectId).then((row) => {
      setShare(row);
      setSlug(row?.slug || "");
    });
  }, [projectId]);

  if (!projectId) return null;

  const save = async (enabled?: boolean) => {
    setBusy(true);
    setMessage(null);
    const result = await saveReportShare({
      projectId,
      password: password || undefined,
      slug: slug || undefined,
      enabled,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setShare(result.share);
    setSlug(result.share.slug);
    setPassword("");
    setMessage(
      enabled === false
        ? "Public link turned off."
        : "Public link saved. Share the URL and password."
    );
  };

  const copy = async () => {
    if (!share?.url) return;
    await navigator.clipboard.writeText(share.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Public link
          </p>
          <p className="text-[13px] text-text-secondary mt-0.5 leading-relaxed">
            Password-gated viewer with no sidebar. Anyone with the URL and pass
            can open published tabs.
          </p>
        </div>
        {share ? (
          <span
            className={`text-[11px] font-semibold px-2 py-1 rounded-md ${
              share.enabled
                ? "bg-emerald-50 text-emerald-800"
                : "bg-surface-raised text-text-muted"
            }`}
          >
            {share.enabled ? "Live" : "Off"}
          </span>
        ) : null}
      </div>

      <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        URL slug
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[12px] text-text-muted shrink-0">/r/</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="client-name"
            className="flex-1 border border-border rounded-lg px-3 py-2 text-[13px] bg-white text-text-primary outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </label>

      <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {share?.hasPassword ? "New password (leave blank to keep)" : "Password"}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={share?.hasPassword ? "••••••••" : "Set a pass"}
          className="mt-1.5 w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-white text-text-primary outline-none focus:ring-1 focus:ring-accent"
        />
      </label>

      {share?.url ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2">
          <Link2 size={14} className="text-text-muted shrink-0" />
          <code className="text-[12px] text-text-primary truncate flex-1">{share.url}</code>
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-secondary hover:text-text-primary shrink-0"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="text-[12px] text-text-secondary">{message}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {share ? "Save link" : "Create public link"}
        </button>
        {share?.enabled ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(false)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[13px] font-medium text-text-secondary hover:bg-surface-raised disabled:opacity-50"
          >
            Turn off
          </button>
        ) : share ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[13px] font-medium text-text-secondary hover:bg-surface-raised disabled:opacity-50"
          >
            Turn on
          </button>
        ) : null}
      </div>
    </div>
  );
}
