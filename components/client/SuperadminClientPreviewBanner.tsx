"use client";

import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";

/**
 * Shown when a founder/superadmin is browsing client-facing /app/client-* URLs.
 * They see the client chrome, but this banner makes the preview mode explicit.
 */
export function SuperadminClientPreviewBanner() {
  return (
    <div className="shrink-0 z-50 bg-amber-50 border-b border-amber-200 text-amber-950">
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <p className="font-medium leading-snug">
            You are signed in as <span className="font-bold">superadmin</span> and viewing the
            client experience.
          </p>
        </div>
        <Link
          href="/app/home"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-900 text-white font-semibold hover:bg-black transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to admin dashboard
        </Link>
      </div>
    </div>
  );
}

export function isClientFacingAppPath(pathname: string): boolean {
  return (
    pathname === "/app/client-guidelines" ||
    pathname.startsWith("/app/client-guidelines/") ||
    pathname === "/app/client-reports" ||
    pathname === "/app/client-files"
  );
}
