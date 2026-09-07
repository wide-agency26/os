import { fetchJson, sleep } from "./fetcher";
import { templateSignature } from "./url";
import type { StoredPage } from "./store";

/**
 * PageSpeed Insights + CrUX.
 *
 * PSI returns the same Lighthouse audit that powers pagespeed.web.dev, run on
 * Google's own infrastructure, so we do not have to run headless Chrome inside
 * a serverless function. Free, 25,000 requests/day, ~240/minute.
 * CrUX supplies real-user (field) data, which PSI is phasing out of its own
 * response, so we query it separately at origin level.
 */

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CRUX_ENDPOINT = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";

/** Google allows ~240/min; 4/s with a small gap keeps us comfortably inside. */
export const PSI_THROTTLE_MS = 260;

export function hasPsiKey(): boolean {
  return Boolean(process.env.PAGESPEED_API_KEY);
}

export type PerfSample = {
  url: string;
  strategy: "mobile" | "desktop";
  scope: "page" | "origin";
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  labLcpMs: number | null;
  labCls: number | null;
  labTbtMs: number | null;
  labFcpMs: number | null;
  labSpeedIndexMs: number | null;
  labTtfbMs: number | null;
  fieldLcpMs: number | null;
  fieldInpMs: number | null;
  fieldCls: number | null;
  fieldTtfbMs: number | null;
  fieldLcpRating: string | null;
  fieldInpRating: string | null;
  fieldClsRating: string | null;
  hasFieldData: boolean;
  opportunities: { id: string; title: string; savingsMs: number; description: string }[];
  error: string | null;
};

type PsiAudit = {
  id?: string;
  title?: string;
  description?: string;
  score?: number | null;
  numericValue?: number;
  details?: { overallSavingsMs?: number };
};

type PsiResponse = {
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, PsiAudit>;
  };
  loadingExperience?: {
    metrics?: Record<string, { percentile?: number; category?: string }>;
  };
  error?: { message?: string };
};

function scoreOf(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : Math.round(value * 100);
}

function numeric(audit: PsiAudit | undefined): number | null {
  const v = audit?.numericValue;
  return typeof v === "number" ? Math.round(v) : null;
}

export async function runPsi(
  url: string,
  strategy: "mobile" | "desktop"
): Promise<PerfSample> {
  const empty: PerfSample = {
    url, strategy, scope: "page",
    performanceScore: null, accessibilityScore: null,
    bestPracticesScore: null, seoScore: null,
    labLcpMs: null, labCls: null, labTbtMs: null,
    labFcpMs: null, labSpeedIndexMs: null, labTtfbMs: null,
    fieldLcpMs: null, fieldInpMs: null, fieldCls: null, fieldTtfbMs: null,
    fieldLcpRating: null, fieldInpRating: null, fieldClsRating: null,
    hasFieldData: false, opportunities: [], error: null,
  };

  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return { ...empty, error: "PAGESPEED_API_KEY is not configured" };

  const params = new URLSearchParams({ url, strategy, key });
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) {
    params.append("category", c);
  }

  const data = await fetchJson<PsiResponse>(`${PSI_ENDPOINT}?${params.toString()}`, {
    timeoutMs: 60000,
  });

  if (!data || data.error) {
    return { ...empty, error: data?.error?.message ?? "PageSpeed Insights request failed" };
  }

  const categories = data.lighthouseResult?.categories ?? {};
  const audits = data.lighthouseResult?.audits ?? {};

  const opportunities = Object.values(audits)
    .filter(
      (a) =>
        typeof a.details?.overallSavingsMs === "number" &&
        (a.details.overallSavingsMs ?? 0) > 100 &&
        (a.score ?? 1) < 0.9
    )
    .map((a) => ({
      id: a.id ?? "",
      title: a.title ?? "",
      savingsMs: Math.round(a.details?.overallSavingsMs ?? 0),
      description: (a.description ?? "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").slice(0, 400),
    }))
    .sort((a, b) => b.savingsMs - a.savingsMs)
    .slice(0, 12);

  const field = data.loadingExperience?.metrics ?? {};
  const lcpField = field.LARGEST_CONTENTFUL_PAINT_MS;
  const inpField = field.INTERACTION_TO_NEXT_PAINT;
  const clsField = field.CUMULATIVE_LAYOUT_SHIFT_SCORE;

  return {
    ...empty,
    performanceScore: scoreOf(categories.performance?.score),
    accessibilityScore: scoreOf(categories.accessibility?.score),
    bestPracticesScore: scoreOf(categories["best-practices"]?.score),
    seoScore: scoreOf(categories.seo?.score),
    labLcpMs: numeric(audits["largest-contentful-paint"]),
    labCls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    labTbtMs: numeric(audits["total-blocking-time"]),
    labFcpMs: numeric(audits["first-contentful-paint"]),
    labSpeedIndexMs: numeric(audits["speed-index"]),
    labTtfbMs: numeric(audits["server-response-time"]),
    fieldLcpMs: lcpField?.percentile ?? null,
    fieldInpMs: inpField?.percentile ?? null,
    fieldCls:
      clsField?.percentile !== undefined ? clsField.percentile / 100 : null,
    fieldLcpRating: lcpField?.category ?? null,
    fieldInpRating: inpField?.category ?? null,
    fieldClsRating: clsField?.category ?? null,
    hasFieldData: Boolean(lcpField || inpField || clsField),
    opportunities,
  };
}

type CruxResponse = {
  record?: {
    metrics?: Record<string, { percentiles?: { p75?: number | string } }>;
  };
};

/**
 * Origin-level real-user data. Independent of PSI and worth querying even when
 * an individual page has too little traffic to have its own field data.
 */
export async function runCrux(
  origin: string,
  formFactor: "PHONE" | "DESKTOP"
): Promise<PerfSample | null> {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(`${CRUX_ENDPOINT}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin,
        formFactor,
        metrics: [
          "largest_contentful_paint",
          "interaction_to_next_paint",
          "cumulative_layout_shift",
          "experimental_time_to_first_byte",
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as CruxResponse;
    const metrics = data.record?.metrics ?? {};
    const p75 = (name: string): number | null => {
      const raw = metrics[name]?.percentiles?.p75;
      if (raw === undefined) return null;
      const n = typeof raw === "string" ? Number(raw) : raw;
      return Number.isFinite(n) ? n : null;
    };

    const lcp = p75("largest_contentful_paint");
    const inp = p75("interaction_to_next_paint");
    const cls = p75("cumulative_layout_shift");
    if (lcp === null && inp === null && cls === null) return null;

    return {
      url: origin,
      strategy: formFactor === "PHONE" ? "mobile" : "desktop",
      scope: "origin",
      performanceScore: null, accessibilityScore: null,
      bestPracticesScore: null, seoScore: null,
      labLcpMs: null, labCls: null, labTbtMs: null,
      labFcpMs: null, labSpeedIndexMs: null, labTtfbMs: null,
      fieldLcpMs: lcp,
      fieldInpMs: inp,
      fieldCls: cls,
      fieldTtfbMs: p75("experimental_time_to_first_byte"),
      fieldLcpRating: null, fieldInpRating: null, fieldClsRating: null,
      hasFieldData: true,
      opportunities: [],
      error: null,
    };
  } catch {
    return null;
  }
}

/**
 * Picks a representative sample rather than testing every page: the homepage
 * first, then one page per URL template. Twenty near-identical blog posts tell
 * us nothing that one of them does not.
 */
export function selectPerfSample(pages: StoredPage[], limit: number): string[] {
  const eligible = pages.filter(
    (p) => p.indexable && p.status_code !== null && p.status_code >= 200 && p.status_code < 300
  );
  if (!eligible.length) return [];

  const byDepth = [...eligible].sort((a, b) => a.depth - b.depth);
  const picked: string[] = [];
  const seenTemplates = new Set<string>();

  for (const page of byDepth) {
    const signature = templateSignature(page.url);
    if (seenTemplates.has(signature)) continue;
    seenTemplates.add(signature);
    picked.push(page.url);
    if (picked.length >= limit) break;
  }

  // If the site has fewer templates than the limit, top up with the pages that
  // have the most internal links pointing at them — the ones that matter most.
  if (picked.length < limit) {
    const remaining = byDepth
      .filter((p) => !picked.includes(p.url))
      .sort((a, b) => b.internal_links_in - a.internal_links_in);
    for (const page of remaining) {
      picked.push(page.url);
      if (picked.length >= limit) break;
    }
  }

  return picked;
}

export async function throttle(): Promise<void> {
  await sleep(PSI_THROTTLE_MS);
}
