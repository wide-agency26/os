"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WideLogo } from "@/components/brand/WideLogo";
import { unlockReportShare } from "@/app/actions/report-share";

export function ReportSharePasswordGate({
  slug,
  organization,
}: {
  slug: string;
  organization: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="inline-flex items-center rounded-md bg-accent px-2 py-1.5 mb-6">
          <WideLogo variant="onDark" boxed={false} height={14} />
        </div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">
          {organization}
        </h1>
        <p className="text-[13px] text-text-secondary mt-1.5 leading-relaxed">
          This report is password-protected. Enter the pass you were given to
          open it.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const result = await unlockReportShare(slug, password);
            setBusy(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          }}
        >
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="mt-1.5 w-full border border-border rounded-lg px-3 py-2.5 text-[13px] bg-surface text-text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          {error ? (
            <p className="text-[12px] text-red-700">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={busy || password.length < 1}
            className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? "Checking…" : "Open report"}
          </button>
        </form>
      </div>
    </div>
  );
}
