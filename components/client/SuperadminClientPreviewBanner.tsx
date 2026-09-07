"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, ArrowLeft, Loader2 } from "lucide-react";
import {
  clearViewAsClient,
  getViewAsPreview,
  startViewAsClient,
  type ViewAsPreview,
} from "@/app/actions/view-as-client";
import { portalAccessLabel } from "@/lib/client/permissions";
import { isClientFacingPath } from "@/lib/activity/surfaces";

/**
 * Shown when a founder/superadmin is browsing client-facing /app/client-* URLs.
 * They see the client chrome, but this banner makes the preview mode explicit.
 */
export function SuperadminClientPreviewBanner() {
  const pathname = usePathname();
  const ciPreview = pathname.startsWith("/app/client-guidelines/preview/");
  const [preview, setPreview] = useState<ViewAsPreview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void getViewAsPreview().then((c) => {
      setPreview(c);
      setLoaded(true);
    });
  }, []);

  const backLabel = preview?.returnHref
    ? "Back to CI Builder"
    : preview
      ? "Back to Clients"
      : "Pick a client";

  return (
    <div className="shrink-0 z-50 bg-amber-50 border-b border-amber-200 text-amber-950">
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Shield className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          {!loaded ? (
            <p className="font-medium">Loading preview…</p>
          ) : preview ? (
            <>
              <p className="font-medium leading-snug">
                {ciPreview ? (
                  <>
                    You are an admin viewing this as a client
                    {preview.companyName ? (
                      <>
                        {" — "}
                        <span className="font-bold">{preview.companyName}</span>
                      </>
                    ) : null}
                    . This is the sidebar and view they will have.
                  </>
                ) : preview.contactName ? (
                  <>
                    Viewing portal as{" "}
                    <span className="font-bold">{preview.contactName}</span>
                    {" · "}
                    <span className="font-bold">{preview.companyName}</span>
                  </>
                ) : (
                  <>
                    Viewing portal as{" "}
                    <span className="font-bold">{preview.companyName}</span>
                  </>
                )}
              </p>
              {preview.contactId ? (
                <span className="text-amber-800/80">
                  {preview.isMember
                    ? portalAccessLabel(preview.portalAccess)
                    : "CRM only — not a portal member yet"}
                </span>
              ) : (
                <span className="text-amber-800/80">Company view</span>
              )}
              {preview.contacts.length > 0 ? (
                <select
                  value={preview.contactId || ""}
                  disabled={pending}
                  onChange={(e) => {
                    const next = e.target.value;
                    startTransition(() => {
                      void startViewAsClient(preview.companyId, next || null, {
                        next: pathname,
                      });
                    });
                  }}
                  className="border border-amber-300 bg-white rounded-md px-2 py-1 text-[12px] max-w-[14rem]"
                >
                  <option value="">Company (no specific member)</option>
                  {preview.contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.isMember ? " · portal member" : " · CRM only"}
                    </option>
                  ))}
                </select>
              ) : null}
            </>
          ) : (
            <p className="font-medium leading-snug">
              You are signed in as <span className="font-bold">admin</span> and
              viewing the client experience.
            </p>
          )}
        </div>
        {preview ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => void clearViewAsClient())}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-900 text-white font-semibold hover:bg-black transition-colors shrink-0 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowLeft className="w-3.5 h-3.5" />
            )}
            {backLabel}
          </button>
        ) : (
          <Link
            href="/app/work/view-as"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-900 text-white font-semibold hover:bg-black transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Pick a client
          </Link>
        )}
      </div>
    </div>
  );
}

export function isClientFacingAppPath(pathname: string): boolean {
  return isClientFacingPath(pathname);
}
