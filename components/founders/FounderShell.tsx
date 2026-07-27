"use client";

import type { ReactNode } from "react";
import { FounderNav } from "@/components/founders/FounderNav";
import { FounderNotificationCenter } from "@/components/founders/FounderNotificationCenter";

/**
 * Persistent split-pane founder frame. Sidebar never unmounts across /admin/* navigations.
 */
export function FounderShell({
  children,
  banner,
}: {
  children: ReactNode;
  banner?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-zinc-950 text-zinc-50">
      <FounderNav />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0 lg:hidden h-14" aria-hidden />
        <div className="founder-canvas flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-end gap-2 border-b border-zinc-800/80 px-6 py-2 lg:px-8">
            <FounderNotificationCenter />
          </div>
          {banner ? <div className="shrink-0 px-6 pt-6 lg:px-8">{banner}</div> : null}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-4 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
