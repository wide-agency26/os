"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { AccessRequestRow } from "@/components/notifications/AccessRequestRow";
import {
  resolveFounderNotification,
  type InboxItem,
} from "@/app/actions/founder-notifications";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/founder/inbox", { cache: "no-store" });
      const payload = (await res.json()) as { items?: InboxItem[] };
      setItems(payload.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh();
    }, 1200);
    return () => window.clearTimeout(t);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refresh]);

  const count = items.length;

  return (
    <div ref={rootRef} className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-11 h-11 rounded-md text-text-primary hover:bg-surface-raised"
        aria-label={count ? `${count} notifications` : "Notifications"}
        aria-expanded={open}
      >
        <Bell size={18} strokeWidth={1.75} />
        {count > 0 ? (
          <span className="absolute top-2 right-2 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold leading-4 text-center">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full mt-1 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Notifications
            </p>
            <Link
              href="/app/crm/access"
              onClick={() => setOpen(false)}
              className="text-[12px] font-medium text-text-secondary hover:text-text-primary"
            >
              Access
            </Link>
          </div>
          {loading ? (
            <p className="px-3 py-6 text-[13px] text-text-secondary">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-[13px] text-text-secondary">
              Nothing waiting.
            </p>
          ) : (
            <ul className="max-h-[min(24rem,70vh)] overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="px-3 py-3 border-b border-border last:border-0">
                  {item.kind === "company_access" && item.member ? (
                    <AccessRequestRow member={item.member} onReviewed={() => void refresh()} />
                  ) : item.kind === "deal_finder" ? (
                    <Link href={item.href} onClick={() => setOpen(false)} className="block min-w-0">
                      <p className="text-[13px] font-semibold text-text-primary">
                        {item.title}
                      </p>
                      <p className="text-[12px] text-text-secondary mt-0.5 leading-snug">
                        {item.message}
                      </p>
                      <p className="text-[11px] font-medium text-blue-700 mt-1">
                        Review on Home →
                      </p>
                    </Link>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-text-primary">
                          {item.title}
                        </p>
                        <p className="text-[12px] text-text-secondary mt-0.5 leading-snug">
                          {item.message}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await resolveFounderNotification(item.id);
                          void refresh();
                        }}
                        className="text-[11px] font-medium text-text-muted hover:text-text-primary shrink-0"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
