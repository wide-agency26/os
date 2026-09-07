/**
 * Capability interfaces for paid SEO data.
 *
 * The auditor is built to run entirely on free, official sources. These four
 * capabilities are the ones that genuinely do not exist for free:
 *
 *   - live SERP positions and "People Also Ask" boxes
 *   - real monthly search volume
 *   - trend / seasonality curves
 *   - backlink and authority data
 *
 * Rather than fake them or silently omit them, every capability resolves to
 * either a working provider or an `unavailable` result carrying the reason,
 * which the UI renders as a "Not connected" card. Wiring a paid provider later
 * means implementing these interfaces and registering it in `./index.ts` — no
 * schema change, no UI change.
 */

export type ProviderResult<T> =
  | { available: true; data: T; source: string }
  | { available: false; reason: string; upgradeHint: string };

export function unavailable<T>(reason: string, upgradeHint: string): ProviderResult<T> {
  return { available: false, reason, upgradeHint };
}

export type SerpResult = {
  keyword: string;
  results: { position: number; url: string; title: string; domain: string }[];
  peopleAlsoAsk: string[];
};

export type VolumeResult = {
  keyword: string;
  monthlyVolume: number | null;
  cpc: number | null;
  competition: number | null;
};

export type TrendPoint = { date: string; value: number };

export type TrendResult = {
  keyword: string;
  points: TrendPoint[];
  direction: "rising" | "flat" | "falling";
};

export type BacklinkResult = {
  domain: string;
  referringDomains: number;
  backlinks: number;
  authorityScore: number | null;
};

export interface SerpProvider {
  readonly name: string;
  isConfigured(): boolean;
  getSerp(keyword: string, location?: string): Promise<ProviderResult<SerpResult>>;
}

export interface VolumeProvider {
  readonly name: string;
  isConfigured(): boolean;
  getVolumes(keywords: string[], location?: string): Promise<ProviderResult<VolumeResult[]>>;
}

export interface TrendsProvider {
  readonly name: string;
  isConfigured(): boolean;
  getTrends(keywords: string[], location?: string): Promise<ProviderResult<TrendResult[]>>;
}

export interface BacklinkProvider {
  readonly name: string;
  isConfigured(): boolean;
  getBacklinks(domain: string): Promise<ProviderResult<BacklinkResult>>;
}
