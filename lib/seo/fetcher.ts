import { CRAWL_TIMEOUT_MS, SEO_USER_AGENT } from "./constants";

export type FetchResult = {
  ok: boolean;
  status: number | null;
  url: string;
  finalUrl: string;
  redirectChain: string[];
  headers: Headers | null;
  body: string | null;
  bytes: number | null;
  ttfbMs: number | null;
  contentType: string | null;
  error: string | null;
  /** Set when the origin asked us to slow down, so the caller can back off. */
  rateLimited: boolean;
  retryAfterMs: number | null;
};

function parseRetryAfter(headers: Headers | null): number | null {
  const raw = headers?.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 60_000);
  const date = Date.parse(raw);
  if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 60_000);
  return null;
}

/**
 * Follows redirects manually so the audit can report the full chain — a
 * redirect hop is itself a finding, and `redirect: "follow"` hides it.
 */
export async function fetchPage(
  url: string,
  opts: { maxRedirects?: number; timeoutMs?: number; method?: "GET" | "HEAD" } = {}
): Promise<FetchResult> {
  const maxRedirects = opts.maxRedirects ?? 5;
  const timeoutMs = opts.timeoutMs ?? CRAWL_TIMEOUT_MS;
  const method = opts.method ?? "GET";

  const redirectChain: string[] = [];
  let current = url;
  const started = Date.now();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    let res: Response;
    try {
      res = await fetch(current, {
        method,
        redirect: "manual",
        headers: {
          "User-Agent": SEO_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const message =
        e instanceof Error
          ? e.name === "TimeoutError" || e.name === "AbortError"
            ? `Timed out after ${Math.round(timeoutMs / 1000)}s`
            : e.message
          : "Request failed";
      return {
        ok: false, status: null, url, finalUrl: current, redirectChain,
        headers: null, body: null, bytes: null,
        ttfbMs: Date.now() - started, contentType: null,
        error: message, rateLimited: false, retryAfterMs: null,
      };
    }

    const ttfbMs = Date.now() - started;

    if (res.status === 429 || res.status === 503) {
      return {
        ok: false, status: res.status, url, finalUrl: current, redirectChain,
        headers: res.headers, body: null, bytes: null, ttfbMs,
        contentType: res.headers.get("content-type"),
        error: `Origin returned ${res.status}`,
        rateLimited: true,
        retryAfterMs: parseRetryAfter(res.headers) ?? 5000,
      };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        return {
          ok: false, status: res.status, url, finalUrl: current, redirectChain,
          headers: res.headers, body: null, bytes: null, ttfbMs,
          contentType: res.headers.get("content-type"),
          error: `Redirect ${res.status} without a Location header`,
          rateLimited: false, retryAfterMs: null,
        };
      }
      let next: string;
      try {
        next = new URL(location, current).toString();
      } catch {
        return {
          ok: false, status: res.status, url, finalUrl: current, redirectChain,
          headers: res.headers, body: null, bytes: null, ttfbMs,
          contentType: null, error: `Invalid redirect target: ${location}`,
          rateLimited: false, retryAfterMs: null,
        };
      }
      redirectChain.push(next);
      current = next;
      continue;
    }

    const contentType = res.headers.get("content-type");
    const isHtml = !contentType || /html|xml|text\//i.test(contentType);
    let body: string | null = null;
    if (method === "GET" && isHtml) {
      try {
        body = await res.text();
      } catch {
        body = null;
      }
    } else {
      // Release the socket for non-HTML responses.
      try {
        await res.arrayBuffer();
      } catch {
        /* ignore */
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      url,
      finalUrl: current,
      redirectChain,
      headers: res.headers,
      body,
      bytes: body ? new TextEncoder().encode(body).length : null,
      ttfbMs,
      contentType,
      error: res.ok ? null : `HTTP ${res.status}`,
      rateLimited: false,
      retryAfterMs: null,
    };
  }

  return {
    ok: false, status: null, url, finalUrl: current, redirectChain,
    headers: null, body: null, bytes: null,
    ttfbMs: Date.now() - started, contentType: null,
    error: `Exceeded ${maxRedirects} redirects`,
    rateLimited: false, retryAfterMs: null,
  };
}

/** Fetch a plain-text resource (robots.txt, sitemap) without redirect tracking. */
export async function fetchText(
  url: string,
  timeoutMs = 15000
): Promise<{ ok: boolean; status: number | null; text: string | null }> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": SEO_USER_AGENT, Accept: "*/*" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, status: res.status, text: null };
    return { ok: true, status: res.status, text: await res.text() };
  } catch {
    return { ok: false, status: null, text: null };
  }
}

/** Fetch and parse JSON, returning null on any failure. Used by every provider. */
export async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {}
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": SEO_USER_AGENT, Accept: "application/json", ...opts.headers },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Bounded-concurrency map. Keeps us polite against a single origin. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker)
  );
  return results;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
