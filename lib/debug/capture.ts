import { locationLabelFromSnapshot } from "@/lib/debug/brief";
import type {
  DebugConsoleLine,
  DebugNetworkFail,
  DebugSnapshot,
  DebugTrailEvent,
} from "@/lib/debug/types";

const TRAIL_KEY = "wide-debug-trail";
const MAX_TRAIL = 30;
const MAX_CONSOLE = 40;
const MAX_NETWORK = 20;

let started = false;
const consoleBuf: DebugConsoleLine[] = [];
const networkBuf: DebugNetworkFail[] = [];

function nowIso() {
  return new Date().toISOString();
}

function clip(s: string, n = 400) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function readTrail(): DebugTrailEvent[] {
  try {
    const raw = sessionStorage.getItem(TRAIL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DebugTrailEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTrail(events: DebugTrailEvent[]) {
  try {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(events.slice(-MAX_TRAIL)));
  } catch {
    // ignore
  }
}

export function pushDebugTrail(event: Omit<DebugTrailEvent, "at"> & { at?: string }) {
  const next = [
    ...readTrail(),
    { ...event, at: event.at || nowIso() },
  ];
  writeTrail(next);
}

function stringifyArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function selectedTabLabel(): string | null {
  const selected =
    document.querySelector('[role="tab"][aria-selected="true"]') ||
    document.querySelector('[role="tab"][data-state="active"]') ||
    document.querySelector('[aria-current="page"]') ||
    document.querySelector("[data-active='true']");
  const text = selected?.textContent?.trim();
  return text ? clip(text, 80) : null;
}

function visibleHeadings(): string[] {
  return Array.from(document.querySelectorAll("h1, h2"))
    .map((el) => el.textContent?.replace(/\s+/g, " ").trim() || "")
    .filter(Boolean)
    .slice(0, 8);
}

function isTabish(el: HTMLElement): boolean {
  if (el.getAttribute("role") === "tab") return true;
  if (el.closest('[role="tablist"]')) return true;
  const parent = el.parentElement;
  if (!parent) return false;
  const siblings = Array.from(parent.children).filter(
    (n) => n instanceof HTMLElement && (n.tagName === "BUTTON" || n.getAttribute("role") === "tab")
  );
  return siblings.length >= 2 && siblings.length <= 12 && siblings.includes(el);
}

function startConsoleCapture() {
  const wrap = (level: "error" | "warn", orig: (...a: unknown[]) => void) =>
    (...args: unknown[]) => {
      consoleBuf.push({
        at: nowIso(),
        level,
        message: clip(args.map(stringifyArg).join(" ")),
      });
      if (consoleBuf.length > MAX_CONSOLE) consoleBuf.shift();
      orig.apply(console, args);
    };
  console.error = wrap("error", console.error.bind(console));
  console.warn = wrap("warn", console.warn.bind(console));

  window.addEventListener("error", (e) => {
    consoleBuf.push({
      at: nowIso(),
      level: "error",
      message: clip(`${e.message} @ ${e.filename}:${e.lineno}`),
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    consoleBuf.push({
      at: nowIso(),
      level: "error",
      message: clip(`unhandledrejection ${stringifyArg(e.reason)}`),
    });
  });
}

function startNetworkCapture() {
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    try {
      const res = await orig(input, init);
      if (!res.ok && res.status >= 400) {
        networkBuf.push({
          at: nowIso(),
          method,
          url: clip(url, 180),
          status: res.status,
        });
        if (networkBuf.length > MAX_NETWORK) networkBuf.shift();
      }
      return res;
    } catch (err) {
      networkBuf.push({
        at: nowIso(),
        method,
        url: clip(url, 180),
        status: null,
      });
      if (networkBuf.length > MAX_NETWORK) networkBuf.shift();
      throw err;
    }
  };
}

export function startDebugCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  startConsoleCapture();
  startNetworkCapture();

  document.addEventListener(
    "click",
    (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const el = target.closest("button, a, [role='tab']");
      if (!(el instanceof HTMLElement)) return;
      const label = clip(el.textContent || el.getAttribute("aria-label") || "", 80);
      if (!label) return;
      if (isTabish(el)) {
        pushDebugTrail({ kind: "tab", label, href: window.location.href });
        return;
      }
      if (el.tagName === "A") {
        const href = el.getAttribute("href") || undefined;
        pushDebugTrail({ kind: "click", label, href });
      }
    },
    true
  );
}

export function recordDebugRoute(pathname: string, search: string) {
  pushDebugTrail({
    kind: "route",
    label: `${pathname}${search}`,
    href: typeof window !== "undefined" ? window.location.href : pathname,
  });
}

function nextErrorDigest(): string | null {
  try {
    const fromDom = document.querySelector("[data-debug-digest]")?.getAttribute("data-debug-digest");
    if (fromDom) return fromDom;
    const text = document.body?.innerText || "";
    const match = text.match(/ERROR\s+([A-Za-z0-9_-]{6,})/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export function captureDebugSnapshot(): DebugSnapshot {
  const href = window.location.href;
  const pathname = window.location.pathname;
  const search = window.location.search;
  const hash = window.location.hash;
  const heading =
    document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() || "";
  const selectedTab = selectedTabLabel();
  const pageTitle = document.title || "";
  const snapshot: DebugSnapshot = {
    capturedAt: nowIso(),
    href,
    origin: window.location.origin,
    pathname,
    search,
    hash,
    pageTitle,
    heading,
    selectedTab,
    locationLabel: "",
    trail: readTrail(),
    console: [...consoleBuf],
    networkFails: [...networkBuf],
    headings: visibleHeadings(),
    viewport: {
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    },
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: navigator.onLine,
    referrer: document.referrer || "",
    digest: nextErrorDigest(),
  };
  snapshot.locationLabel = locationLabelFromSnapshot(snapshot);
  return snapshot;
}
