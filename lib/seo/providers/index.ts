import {
  unavailable,
  type BacklinkProvider,
  type BacklinkResult,
  type ProviderResult,
  type SerpProvider,
  type SerpResult,
  type TrendResult,
  type TrendsProvider,
  type VolumeProvider,
  type VolumeResult,
} from "./types";

export * from "./types";

const UPGRADE_HINT =
  "Connect a paid SEO data provider (for example DataForSEO, roughly $0.60 per 1,000 SERP lookups with no subscription) to switch this on.";

/**
 * Default providers: none configured.
 *
 * These are deliberately not stubs that return zeros. Returning `available:
 * false` with a reason forces every consumer to handle the gap explicitly, and
 * the UI renders it as "Not connected" rather than an empty chart that looks
 * like real data showing nothing.
 */

class NoSerpProvider implements SerpProvider {
  readonly name = "none";
  isConfigured() {
    return false;
  }
  async getSerp(): Promise<ProviderResult<SerpResult>> {
    return unavailable(
      "Live ranking positions and People Also Ask boxes require SERP data, which has no reliable free source. Scraping Google directly from our servers is blocked within a few requests.",
      UPGRADE_HINT
    );
  }
}

class NoVolumeProvider implements VolumeProvider {
  readonly name = "none";
  isConfigured() {
    return false;
  }
  async getVolumes(): Promise<ProviderResult<VolumeResult[]>> {
    return unavailable(
      "Monthly search volume comes from Google Ads data and is not available for free. The question engine shows an autocomplete popularity proxy instead, which reflects relative demand but is not a volume figure.",
      UPGRADE_HINT
    );
  }
}

class NoTrendsProvider implements TrendsProvider {
  readonly name = "none";
  isConfigured() {
    return false;
  }
  async getTrends(): Promise<ProviderResult<TrendResult[]>> {
    return unavailable(
      "Google Trends has no official API. Where Search Console is connected, month-over-month movement in your own impressions is shown instead, which is real data for your site.",
      UPGRADE_HINT
    );
  }
}

class NoBacklinkProvider implements BacklinkProvider {
  readonly name = "none";
  isConfigured() {
    return false;
  }
  async getBacklinks(): Promise<ProviderResult<BacklinkResult>> {
    return unavailable(
      "Backlink and domain authority data comes from proprietary link indexes. There is no free source, so this audit makes no claims about off-site authority.",
      UPGRADE_HINT
    );
  }
}

/**
 * Registry. To enable a paid provider, implement the interface from `./types`
 * and return it here when its credentials are present.
 */
export function getSerpProvider(): SerpProvider {
  return new NoSerpProvider();
}

export function getVolumeProvider(): VolumeProvider {
  return new NoVolumeProvider();
}

export function getTrendsProvider(): TrendsProvider {
  return new NoTrendsProvider();
}

export function getBacklinkProvider(): BacklinkProvider {
  return new NoBacklinkProvider();
}

export type CapabilityStatus = {
  key: "serp" | "volume" | "trends" | "backlinks";
  label: string;
  available: boolean;
  reason: string;
  upgradeHint: string;
};

/** Drives the "Not connected" cards so the report states its own limits. */
export function capabilityStatuses(): CapabilityStatus[] {
  const serp = getSerpProvider();
  const volume = getVolumeProvider();
  const trends = getTrendsProvider();
  const backlinks = getBacklinkProvider();

  return [
    {
      key: "serp",
      label: "Live ranking positions",
      available: serp.isConfigured(),
      reason:
        "No SERP provider connected, so we cannot show where you currently rank for a given keyword.",
      upgradeHint: UPGRADE_HINT,
    },
    {
      key: "volume",
      label: "Search volume",
      available: volume.isConfigured(),
      reason:
        "No keyword volume provider connected. Question popularity is shown as an autocomplete-derived proxy, never as a volume number.",
      upgradeHint: UPGRADE_HINT,
    },
    {
      key: "trends",
      label: "Trend and seasonality",
      available: trends.isConfigured(),
      reason:
        "No trends provider connected. Search Console impressions provide real trend data for your own site where available.",
      upgradeHint: UPGRADE_HINT,
    },
    {
      key: "backlinks",
      label: "Backlinks and authority",
      available: backlinks.isConfigured(),
      reason:
        "No backlink provider connected. This audit covers on-site factors only and makes no claims about off-site authority.",
      upgradeHint: UPGRADE_HINT,
    },
  ];
}
