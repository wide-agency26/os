"use client";

import Link from "next/link";
import { useEffect, useRef, type AnchorHTMLAttributes, type MouseEvent } from "react";

const PENDING_TIMEOUT_MS = 8000;

/** Full document navigation — used as a fallback if App Router pending hangs. */
export function hardNavigate(href: string) {
  window.location.assign(href);
}

function locKey() {
  return `${window.location.pathname}${window.location.search}`;
}

function hrefKey(href: string) {
  try {
    if (href.startsWith("http://") || href.startsWith("https://")) {
      const u = new URL(href);
      return `${u.pathname}${u.search}`;
    }
  } catch {
    /* fall through */
  }
  const q = href.indexOf("?");
  if (q === -1) return href;
  return `${href.slice(0, q)}${href.slice(q)}`;
}

/**
 * Soft App Router navigation so the shell stays mounted.
 * If the route is still on the starting URL after PENDING_TIMEOUT_MS
 * (stuck pending lock), fall back to a full document load.
 */
export function HardLink({
  href,
  onClick,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function go(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const dest = hrefKey(href);
    const start = locKey();
    if (dest === start) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (locKey() === start) {
        window.location.assign(href);
      }
    }, PENDING_TIMEOUT_MS);
  }

  return (
    <Link href={href} onClick={go} {...rest}>
      {children}
    </Link>
  );
}
