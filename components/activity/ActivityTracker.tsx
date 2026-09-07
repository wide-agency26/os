"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { recordPageView } from "@/app/actions/portal-activity";

const SESSION_KEY = "wide-activity-session";

function sessionId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `s-${Date.now()}`;
  window.sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

export function ActivityTracker() {
  const pathname = usePathname();
  const last = useRef<string>("");

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/app")) return;
    if (pathname === last.current) return;
    last.current = pathname;

    const key = `wide-activity:${pathname}`;
    try {
      const prev = Number(window.sessionStorage.getItem(key) || "0");
      if (Date.now() - prev < 60_000) return;
      window.sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // sessionStorage blocked — still try the server-side 60s dedupe
    }

    void recordPageView({ path: pathname, sessionId: sessionId() });
  }, [pathname]);

  return null;
}
