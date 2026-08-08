/**
 * Cross-channel / Overall aggregation with single-source fallback.
 * Missing channels never crash the view — active streams are detected and blended.
 */

import {
  normalizeMetaRows,
  computeMetaHeadline,
  filterMetaByRange,
  customDateRange as metaCustomRange,
  isMetaAdsDataset,
  looksLikeGoogleAdsRows,
  type MetaAdsRow,
} from "@/lib/reports/meta-ads";
import {
  normalizeGoogleRows,
  aggregateGoogle,
  filterGoogleByMonths,
  filterGoogleByRange,
  customGoogleRange,
  isGoogleAdsDataset,
  type GoogleAdsRow,
} from "@/lib/reports/google-ads";
import {
  normalizeLinkedInAdsRows,
  aggregateLinkedInAds,
  filterLinkedInAdsByMonths,
  filterLinkedInAdsByRange,
  customLinkedInAdsRange,
  isLinkedInAdsDataset,
  looksLikeLinkedInAdsRows,
  moneyRound,
  formatMultiCurrencySpend,
  toEur,
  linkedInAdsExportTotalSpend,
  type LinkedInAdsRow,
} from "@/lib/reports/linkedin-ads";
import {
  buildLinkedInBundle,
  computeLiHeadline,
  filterBundleByMonths,
  filterBundleByRange,
  hasLinkedInData,
  type LinkedInBundle,
  type LiHeadline,
  type DatasetPayload,
} from "@/lib/reports/linkedin-organic";
import {
  buildYouTubeBundle,
  computeYtHeadline,
  filterYtBundleByMonths,
  filterYtBundleByRange,
  hasYouTubeData,
  type YouTubeBundle,
  type YtHeadline,
  type DatasetPayload as YtDatasetPayload,
} from "@/lib/reports/youtube-organic";
import {
  buildInstagramBundle,
  computeIgHeadline,
  hasInstagramData,
  type IgBundle,
  type IgHeadline,
  type DatasetPayload as IgDatasetPayload,
} from "@/lib/reports/instagram-organic";
import {
  normalizeRows,
  computeHeadline,
  filterByMonths,
  filterByRange,
  customDateRange,
} from "@/lib/reports/ga4-website";
import {
  buildGscBundle,
  computeGscHeadline,
  filterGscBundleByMonths,
  filterGscBundleByRange,
  customGscRange,
  hasGscData,
  type GscBundle,
  type DatasetPayload as GscDatasetPayload,
} from "@/lib/reports/gsc";
import {
  isLinkedInOrganicSub,
  isYouTubeOrganicSub,
  isInstagramOrganicSub,
  isMetaAdsSub,
  isGoogleAdsSub,
  isLinkedInAdsSub,
  isGscSub,
  subcategoryLabel,
  detectSubcategory,
} from "@/lib/data-hub/subcategory";

export interface LoadedDataset {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  createdAt?: string | null;
  rowCount: number;
  columns: { key: string }[];
  rows: Record<string, unknown>[];
}

export interface ActiveChannelTag {
  id: string;
  label: string;
  datasetName: string;
}

export interface PeriodOpts {
  mode: "all" | "months" | "custom";
  months: string[];
  customStart: string;
  customEnd: string;
}

export interface PaidNetworkStats {
  id: string;
  label: string;
  spend: number;
  /** ISO currency of `spend` (source export — never silently FX-converted). */
  currency: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  spendShare: number;
  conversionShare: number;
}

export interface AdsOverallTotals {
  spend: number;
  /** When networks mix currencies, prefer formatting via formatMultiCurrencySpend. */
  currency: string;
  mixedCurrency: boolean;
  spendByCurrency: { currency: string; amount: number }[];
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

export interface AdsOverallResult {
  mode: "empty" | "single" | "blended";
  channels: ActiveChannelTag[];
  networks: PaidNetworkStats[];
  totals: AdsOverallTotals | null;
  singleChannelId: "meta" | "google" | "linkedin" | null;
  metaRows: MetaAdsRow[];
  googleRows: GoogleAdsRow[];
  linkedInAdsRows: LinkedInAdsRow[];
  notice: string;
}

export interface SocialOverallResult {
  mode: "empty" | "single" | "blended";
  channels: ActiveChannelTag[];
  linkedIn: LiHeadline | null;
  linkedInBundle: LinkedInBundle | null;
  youTube: YtHeadline | null;
  youTubeBundle: YouTubeBundle | null;
  instagram: IgHeadline | null;
  instagramBundle: IgBundle | null;
  /** Combined organic reach (LI impressions + YT views + IG accounts reached) */
  blendedReach: number;
  /** Combined organic impressions when available */
  blendedImpressions: number;
  /** Combined engagements (LI interactions + IG content interactions) */
  blendedEngagements: number;
  /** Outbound / high-intent taps (IG external link taps) */
  outboundClicks: number;
  /** Profile visits (IG) */
  profileVisits: number;
  notice: string;
}

import {
  normalizeFunnelConfig,
  DEFAULT_FUNNEL_CONFIG,
  type ProjectFunnelConfig,
  type FunnelStreamId,
} from "@/lib/reports/funnel-config";

export interface GeneralFunnelResult {
  channels: ActiveChannelTag[];
  config: ProjectFunnelConfig;
  /** Absolute stage values driven by funnel config */
  stages: {
    awareness: number;
    consideration: number;
    conversion: number;
  };
  rates: {
    awarenessToConsideration: number | null;
    considerationToConversion: number | null;
    totalFunnelEfficiency: number | null;
  };
  awareness: {
    socialReach: number;
    paidImpressions: number;
    seoImpressions: number;
    totalFootprint: number;
  };
  engagement: {
    webSessions: number;
    seoClicks: number;
    paidClicks: number;
    totalInbound: number;
    costPerVisit: number | null;
  };
  conversions: {
    adSpend: number;
    /** Native multi-currency label e.g. "€2,077.69 + $566.50" */
    adSpendLabel: string;
    adConversions: number;
    webConversions: number;
    totalActions: number;
    cpa: number | null;
  };
  /** Per-stream raw values for attribution chart */
  streamValues: Partial<Record<FunnelStreamId, number>>;
  attribution: {
    channel: string;
    awareness: number;
    consideration: number;
    conversion: number;
  }[];
  notice: string;
}

function tagChannel(id: string, label: string, datasetName: string): ActiveChannelTag {
  return { id, label, datasetName };
}

function filterMetaRows(rows: MetaAdsRow[], opts: PeriodOpts): MetaAdsRow[] {
  if (opts.mode === "custom" && opts.customStart && opts.customEnd) {
    return filterMetaByRange(rows, metaCustomRange(opts.customStart, opts.customEnd));
  }
  if (opts.mode === "months" && opts.months.length) {
    const set = new Set(opts.months);
    return rows.filter((r) => set.has(r.monthKey));
  }
  return rows;
}

function filterGoogleRows(rows: GoogleAdsRow[], opts: PeriodOpts): GoogleAdsRow[] {
  if (opts.mode === "custom" && opts.customStart && opts.customEnd) {
    return filterGoogleByRange(rows, customGoogleRange(opts.customStart, opts.customEnd));
  }
  if (opts.mode === "months" && opts.months.length) {
    return filterGoogleByMonths(rows, opts.months);
  }
  return rows;
}

function networkStats(
  id: string,
  label: string,
  spend: number,
  impressions: number,
  clicks: number,
  conversions: number,
  currency = "EUR"
): Omit<PaidNetworkStats, "spendShare" | "conversionShare"> {
  return {
    id,
    label,
    spend,
    currency,
    impressions,
    clicks,
    conversions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
  };
}

function filterLinkedInAdsRows(rows: LinkedInAdsRow[], opts: PeriodOpts): LinkedInAdsRow[] {
  if (opts.mode === "custom" && opts.customStart && opts.customEnd) {
    return filterLinkedInAdsByRange(
      rows,
      customLinkedInAdsRange(opts.customStart, opts.customEnd)
    );
  }
  if (opts.mode === "months" && opts.months.length) {
    return filterLinkedInAdsByMonths(rows, opts.months);
  }
  return rows;
}

export function computeAdsOverall(
  datasets: LoadedDataset[],
  opts: PeriodOpts
): AdsOverallResult {
  const channels: ActiveChannelTag[] = [];
  const allMetaRows: MetaAdsRow[] = [];
  const allGoogleRows: GoogleAdsRow[] = [];
  const allLiAdsRows: LinkedInAdsRow[] = [];

  for (const d of datasets) {
    const sub = d.subcategory || detectSubcategory(d.name, d.columns);
    const isLiAds =
      isLinkedInAdsSub(sub) ||
      isLinkedInAdsDataset(d.columns, d.rows) ||
      looksLikeLinkedInAdsRows(d.rows);
    const isGoogle =
      !isLiAds &&
      (isGoogleAdsSub(sub) ||
        isGoogleAdsDataset(d.columns, d.rows) ||
        looksLikeGoogleAdsRows(d.rows));
    const isMeta =
      !isGoogle &&
      !isLiAds &&
      (isMetaAdsSub(sub) || isMetaAdsDataset(d.columns, d.rows));

    if (isLiAds) {
      const rows = normalizeLinkedInAdsRows(d.rows);
      if (!rows.length) continue;
      if (!channels.some((c) => c.id === "linkedin")) {
        channels.push(tagChannel("linkedin", "LinkedIn Ads", d.name));
      }
      allLiAdsRows.push(...rows);
      continue;
    }

    if (isGoogle) {
      const rows = normalizeGoogleRows(d.rows);
      if (!rows.length) continue;
      if (!channels.some((c) => c.id === "google")) {
        channels.push(tagChannel("google", "Google Ads", d.name));
      }
      allGoogleRows.push(...rows);
      continue;
    }

    if (isMeta) {
      const rows = normalizeMetaRows(d.rows);
      if (!rows.length) continue;
      if (!channels.some((c) => c.id === "meta")) {
        channels.push(tagChannel("meta", "Meta Ads", d.name));
      }
      allMetaRows.push(...rows);
    }
  }

  if (!channels.length) {
    return {
      mode: "empty",
      channels: [],
      networks: [],
      totals: null,
      singleChannelId: null,
      metaRows: [],
      googleRows: [],
      linkedInAdsRows: [],
      notice:
        "No paid media datasets found. Upload Meta, Google, or LinkedIn Ads under Ads.",
    };
  }

  const metaFiltered = filterMetaRows(allMetaRows, opts);
  const googleFiltered = filterGoogleRows(allGoogleRows, opts);
  const liFiltered = filterLinkedInAdsRows(allLiAdsRows, opts);

  const networksRaw: Omit<PaidNetworkStats, "spendShare" | "conversionShare">[] = [];

  if (channels.some((c) => c.id === "meta") && metaFiltered.length) {
    const h = computeMetaHeadline(metaFiltered, [], "results").current;
    networksRaw.push(
      networkStats(
        "meta",
        "Meta Ads",
        h.amountSpent,
        h.impressions,
        h.linkClicks,
        h.conversions,
        "EUR"
      )
    );
  }

  if (channels.some((c) => c.id === "google") && googleFiltered.length) {
    const h = aggregateGoogle(googleFiltered, "conversions");
    networksRaw.push(
      networkStats(
        "google",
        "Google Ads",
        h.cost,
        h.impressions,
        h.clicks,
        h.conversions,
        "EUR"
      )
    );
  }

  if (channels.some((c) => c.id === "linkedin") && liFiltered.length) {
    // Prefer Campaign Manager Total row when viewing all dates (matches LinkedIn UI)
    let exportTotal: { spend: number; currency: string } | null = null;
    if (opts.mode === "all") {
      for (const d of datasets) {
        const sub = d.subcategory || detectSubcategory(d.name, d.columns);
        const isLiAds =
          isLinkedInAdsSub(sub) ||
          isLinkedInAdsDataset(d.columns, d.rows) ||
          looksLikeLinkedInAdsRows(d.rows);
        if (!isLiAds) continue;
        const t = linkedInAdsExportTotalSpend(d.rows);
        if (t) {
          exportTotal = exportTotal
            ? { spend: moneyRound(exportTotal.spend + t.spend), currency: t.currency }
            : t;
        }
      }
    }
    const h = aggregateLinkedInAds(liFiltered, "landing_clicks", exportTotal);
    const clicks = h.landingPageClicks || h.clicks;
    networksRaw.push(
      networkStats(
        "linkedin",
        "LinkedIn Ads",
        h.spend,
        h.impressions,
        clicks,
        clicks,
        h.currency || "USD"
      )
    );
  }

  const spendByCurrencyMap = new Map<string, number>();
  for (const n of networksRaw) {
    const c = (n.currency || "EUR").toUpperCase();
    spendByCurrencyMap.set(c, (spendByCurrencyMap.get(c) || 0) + n.spend);
  }
  const spendByCurrency = [...spendByCurrencyMap.entries()].map(([currency, amount]) => ({
    currency,
    amount,
  }));
  const mixedCurrency = spendByCurrency.length > 1;
  // Numeric total is only meaningful for single-currency blends (and General CPA when all EUR).
  const totalSpend = networksRaw.reduce((s, n) => s + n.spend, 0);
  const totalImpr = networksRaw.reduce((s, n) => s + n.impressions, 0);
  const totalClicks = networksRaw.reduce((s, n) => s + n.clicks, 0);
  const totalConv = networksRaw.reduce((s, n) => s + n.conversions, 0);

  const networks: PaidNetworkStats[] = networksRaw.map((n) => ({
    ...n,
    spendShare: totalSpend > 0 ? (n.spend / totalSpend) * 100 : 0,
    conversionShare: totalConv > 0 ? (n.conversions / totalConv) * 100 : 0,
  }));

  const totals: AdsOverallTotals = {
    spend: totalSpend,
    currency: mixedCurrency ? "MIXED" : spendByCurrency[0]?.currency || "EUR",
    mixedCurrency,
    spendByCurrency,
    impressions: totalImpr,
    clicks: totalClicks,
    conversions: totalConv,
    ctr: totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    cpa: totalConv > 0 ? totalSpend / totalConv : 0,
  };

  const mode = channels.length === 1 ? "single" : "blended";
  const singleChannelId =
    mode === "single"
      ? (channels[0].id as "meta" | "google" | "linkedin")
      : null;

  return {
    mode,
    channels,
    networks,
    totals,
    singleChannelId,
    metaRows: metaFiltered,
    googleRows: googleFiltered,
    linkedInAdsRows: liFiltered,
    notice:
      mode === "single"
        ? `1 Active Channel Ingested: ${channels[0].label}`
        : `${channels.length} Active Channels blended: ${channels.map((c) => c.label).join(", ")}`,
  };
}

export function pickLinkedInPayloads(datasets: LoadedDataset[]): DatasetPayload[] {
  return datasets
    .filter((d) => {
      const sub = d.subcategory || detectSubcategory(d.name, d.columns);
      if (isYouTubeOrganicSub(sub)) return false;
      if (isLinkedInOrganicSub(sub)) return true;
      return false;
    })
    .map((d) => ({
      name: d.name,
      subcategory: d.subcategory || detectSubcategory(d.name, d.columns),
      columns: d.columns,
      rows: d.rows,
    }));
}

export function pickYouTubePayloads(datasets: LoadedDataset[]): YtDatasetPayload[] {
  return datasets
    .filter((d) => {
      const sub = d.subcategory || detectSubcategory(d.name, d.columns);
      return isYouTubeOrganicSub(sub);
    })
    .map((d) => ({
      name: d.name,
      subcategory: d.subcategory || detectSubcategory(d.name, d.columns),
      columns: d.columns,
      rows: d.rows,
    }));
}

export function pickInstagramPayloads(datasets: LoadedDataset[]): IgDatasetPayload[] {
  return datasets
    .filter((d) => {
      const sub = d.subcategory || detectSubcategory(d.name, d.columns);
      return isInstagramOrganicSub(sub);
    })
    .map((d) => ({
      name: d.name,
      subcategory: d.subcategory || detectSubcategory(d.name, d.columns),
      columns: d.columns,
      rows: d.rows,
    }));
}

export function buildFilteredInstagramBundle(
  datasets: LoadedDataset[],
  opts: PeriodOpts
): IgBundle {
  const bundle = buildInstagramBundle(pickInstagramPayloads(datasets));
  // Meta HTML is a period snapshot; optionally filter posts by creation month/range.
  if (opts.mode === "months" && opts.months.length) {
    const set = new Set(opts.months);
    return {
      ...bundle,
      posts: bundle.posts.filter((p) => {
        if (!p.createdAt) return true;
        const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, "0")}`;
        return set.has(key);
      }),
    };
  }
  if (opts.mode === "custom" && opts.customStart && opts.customEnd) {
    const a = new Date(opts.customStart + "T00:00:00").getTime();
    const b = new Date(opts.customEnd + "T23:59:59").getTime();
    return {
      ...bundle,
      posts: bundle.posts.filter((p) => {
        if (!p.createdAt) return true;
        const t = p.createdAt.getTime();
        return t >= a && t <= b;
      }),
    };
  }
  return bundle;
}

export function buildFilteredLinkedInBundle(
  datasets: LoadedDataset[],
  opts: PeriodOpts
): LinkedInBundle {
  let bundle = buildLinkedInBundle(pickLinkedInPayloads(datasets));
  if (opts.mode === "custom" && opts.customStart && opts.customEnd) {
    bundle = filterBundleByRange(bundle, customDateRange(opts.customStart, opts.customEnd));
  } else if (opts.mode === "months" && opts.months.length) {
    bundle = filterBundleByMonths(bundle, opts.months);
  }
  return bundle;
}

export function buildFilteredYouTubeBundle(
  datasets: LoadedDataset[],
  opts: PeriodOpts
): YouTubeBundle {
  let bundle = buildYouTubeBundle(pickYouTubePayloads(datasets));
  if (opts.mode === "custom" && opts.customStart && opts.customEnd) {
    bundle = filterYtBundleByRange(bundle, customDateRange(opts.customStart, opts.customEnd));
  } else if (opts.mode === "months" && opts.months.length) {
    bundle = filterYtBundleByMonths(bundle, opts.months);
  }
  return bundle;
}

export function pickGscPayloads(datasets: LoadedDataset[]): GscDatasetPayload[] {
  return datasets
    .filter((d) => {
      const sub = d.subcategory || detectSubcategory(d.name, d.columns);
      return d.category === "SEO" || isGscSub(sub);
    })
    .map((d) => ({
      name: d.name,
      subcategory: d.subcategory || detectSubcategory(d.name, d.columns),
      columns: d.columns,
      rows: d.rows,
    }));
}

export function buildFilteredGscBundle(
  datasets: LoadedDataset[],
  opts: PeriodOpts
): GscBundle {
  let bundle = buildGscBundle(pickGscPayloads(datasets));
  if (opts.mode === "custom" && opts.customStart && opts.customEnd) {
    bundle = filterGscBundleByRange(bundle, customGscRange(opts.customStart, opts.customEnd));
  } else if (opts.mode === "months" && opts.months.length) {
    bundle = filterGscBundleByMonths(bundle, opts.months);
  }
  return bundle;
}

export function computeSocialOverall(
  datasets: LoadedDataset[],
  opts: PeriodOpts
): SocialOverallResult {
  const liBundle = buildFilteredLinkedInBundle(datasets, opts);
  const ytBundle = buildFilteredYouTubeBundle(datasets, opts);
  const igBundle = buildFilteredInstagramBundle(datasets, opts);
  const channels: ActiveChannelTag[] = [];

  if (hasLinkedInData(liBundle)) {
    const srcName =
      liBundle.sources.find((s) => isLinkedInOrganicSub(s.subcategory))?.name ||
      liBundle.sources[0]?.name ||
      "LinkedIn Organic";
    channels.push(tagChannel("linkedin", "LinkedIn Organic", srcName));
  }

  if (hasYouTubeData(ytBundle)) {
    const srcName = ytBundle.sources[0]?.name || "YouTube Organic";
    channels.push(tagChannel("youtube", "YouTube Organic", srcName));
  }

  if (hasInstagramData(igBundle)) {
    const srcName = igBundle.sources[0]?.name || "Instagram Organic";
    channels.push(tagChannel("instagram", "Instagram Organic", srcName));
  }

  if (!channels.length) {
    return {
      mode: "empty",
      channels: [],
      linkedIn: null,
      linkedInBundle: null,
      youTube: null,
      youTubeBundle: null,
      instagram: null,
      instagramBundle: null,
      blendedReach: 0,
      blendedImpressions: 0,
      blendedEngagements: 0,
      outboundClicks: 0,
      profileVisits: 0,
      notice:
        "No organic social datasets found. Upload LinkedIn (Li - …), YouTube (YT - …), or Instagram HTML (Profiles Reached / Posts) under Social.",
    };
  }

  const linkedIn = hasLinkedInData(liBundle) ? computeLiHeadline(liBundle) : null;
  const youTube = hasYouTubeData(ytBundle) ? computeYtHeadline(ytBundle) : null;
  const instagram = hasInstagramData(igBundle) ? computeIgHeadline(igBundle) : null;

  const blendedReach =
    (linkedIn?.impressions || 0) +
    (youTube?.views || 0) +
    (instagram?.accountsReached || 0);
  const blendedImpressions =
    (linkedIn?.impressions || 0) +
    (youTube?.impressions || 0) +
    (instagram?.impressions || 0);
  const blendedEngagements =
    (linkedIn?.interactions || 0) + (instagram?.contentInteractions || 0);
  const outboundClicks = instagram?.externalLinkTaps || 0;
  const profileVisits = instagram?.profileVisits || 0;
  const mode = channels.length === 1 ? "single" : "blended";

  return {
    mode,
    channels,
    linkedIn,
    linkedInBundle: hasLinkedInData(liBundle) ? liBundle : null,
    youTube,
    youTubeBundle: hasYouTubeData(ytBundle) ? ytBundle : null,
    instagram,
    instagramBundle: hasInstagramData(igBundle) ? igBundle : null,
    blendedReach,
    blendedImpressions,
    blendedEngagements,
    outboundClicks,
    profileVisits,
    notice:
      mode === "single"
        ? `1 Active Channel Ingested: ${channels[0].label}`
        : `${channels.length} Active Channels blended: ${channels.map((c) => c.label).join(", ")}`,
  };
}

export function computeGeneralFunnel(
  datasets: LoadedDataset[],
  opts: PeriodOpts,
  funnelConfig?: ProjectFunnelConfig | null
): GeneralFunnelResult {
  const config = normalizeFunnelConfig(funnelConfig || DEFAULT_FUNNEL_CONFIG);
  const ads = computeAdsOverall(datasets, opts);
  const social = computeSocialOverall(datasets, opts);

  const webDs = datasets.filter((d) => {
    const sub = d.subcategory || detectSubcategory(d.name, d.columns);
    return d.category === "Website" || sub === "ga4";
  });

  let webSessions = 0;
  for (const d of webDs) {
    let rows = normalizeRows(d.rows);
    if (opts.mode === "custom" && opts.customStart && opts.customEnd) {
      rows = filterByRange(rows, customDateRange(opts.customStart, opts.customEnd));
    } else if (opts.mode === "months" && opts.months.length) {
      rows = filterByMonths(rows, opts.months);
    }
    webSessions += computeHeadline(rows, []).current.sessions;
  }

  let seoClicks = 0;
  let seoImpressions = 0;
  const gscBundle = buildFilteredGscBundle(datasets, opts);
  if (hasGscData(gscBundle)) {
    const h = computeGscHeadline(gscBundle);
    seoClicks = h.clicks;
    seoImpressions = h.impressions;
  }

  const seoDs = datasets.filter((d) => {
    const sub = d.subcategory || detectSubcategory(d.name, d.columns);
    return d.category === "SEO" || isGscSub(sub);
  });

  const channels: ActiveChannelTag[] = [
    ...ads.channels,
    ...social.channels,
    ...webDs
      .slice(0, 1)
      .map((d) => tagChannel("website", "Website (GA4)", d.name)),
    ...seoDs.slice(0, 1).map((d) => tagChannel("seo", "SEO (GSC)", d.name)),
  ];

  const metaNet = ads.networks.find((n) => n.id === "meta");
  const googleNet = ads.networks.find((n) => n.id === "google");
  const liNet = ads.networks.find((n) => n.id === "linkedin");

  const socialReach = social.blendedReach || 0;
  const socialImpressions = social.blendedImpressions || socialReach;
  const ytViews = social.youTube?.views || 0;
  const socialEngagements = social.blendedEngagements || 0;
  const igProfileVisits = social.profileVisits || 0;
  const igLinkTaps = social.outboundClicks || 0;
  const paidImpressions = ads.totals?.impressions || 0;
  const paidClicks = ads.totals?.clicks || 0;
  const spendParts = ads.totals?.spendByCurrency || [];
  const adSpendLabel = spendParts.length
    ? formatMultiCurrencySpend(
        spendParts.map((p) => ({ amount: p.amount, currency: p.currency }))
      )
    : "";
  // EUR-normalized for CPA / cost-per-visit only (Meta & Google are EUR; LI converted for math)
  const adSpend = moneyRound(
    spendParts.length
      ? spendParts.reduce((s, p) => s + toEur(p.amount, p.currency), 0)
      : ads.totals?.spend || 0
  );
  const adConversions = ads.totals?.conversions || 0;
  const webConversions = 0;

  // Meta reach from Meta datasets only
  let metaReach = 0;
  for (const d of datasets) {
    const sub = d.subcategory || detectSubcategory(d.name, d.columns);
    if (isGoogleAdsSub(sub) || isLinkedInAdsSub(sub) || looksLikeGoogleAdsRows(d.rows)) continue;
    if (!(isMetaAdsSub(sub) || isMetaAdsDataset(d.columns, d.rows))) continue;
    const rows = normalizeMetaRows(d.rows);
    const filtered = filterMetaRows(rows, opts);
    for (const r of filtered) metaReach += r.reach || 0;
  }

  const streamValues: Partial<Record<FunnelStreamId, number>> = {
    meta_impressions: metaNet?.impressions || 0,
    meta_reach: metaReach,
    meta_clicks: metaNet?.clicks || 0,
    meta_conversions: metaNet?.conversions || 0,
    google_impressions: googleNet?.impressions || 0,
    google_clicks: googleNet?.clicks || 0,
    google_conversions: googleNet?.conversions || 0,
    linkedin_ads_impressions: liNet?.impressions || 0,
    linkedin_ads_clicks: liNet?.clicks || 0,
    linkedin_ads_conversions: liNet?.conversions || 0,
    gsc_impressions: seoImpressions,
    gsc_clicks: seoClicks,
    social_impressions: socialImpressions || socialReach,
    social_engagements: socialEngagements,
    ig_profile_visits: igProfileVisits,
    ig_external_link_taps: igLinkTaps,
    youtube_views: ytViews,
    ga4_sessions: webSessions,
    ad_spend: adSpend,
  };

  const sumStreams = (ids: FunnelStreamId[]) =>
    ids.reduce((s, id) => s + (streamValues[id] || 0), 0);

  let awareness = sumStreams(config.awarenessStreams);
  if (config.awarenessMode === "reach" && metaReach > 0) {
    // Prefer unique reach streams when mode is reach
    const reachHeavy = config.awarenessStreams.includes("meta_reach")
      ? sumStreams(
          config.awarenessStreams.map((id) =>
            id === "meta_impressions" ? "meta_reach" : id
          ) as FunnelStreamId[]
        )
      : awareness;
    awareness = reachHeavy || awareness;
  }

  // Primary if present; otherwise sum of fallback streams (never double-count both).
  const primaryConsideration = streamValues[config.considerationPrimary] || 0;
  const fallbackConsideration = sumStreams(
    config.considerationFallback.filter((id) => id !== config.considerationPrimary)
  );
  const consideration =
    primaryConsideration > 0 ? primaryConsideration : fallbackConsideration;

  const conversion =
    sumStreams(config.conversionPrimary) + sumStreams(config.conversionSecondary);

  const totalInbound = consideration;
  const totalActions = conversion;
  const costPerVisit = totalInbound > 0 && adSpend > 0 ? adSpend / totalInbound : null;
  const cpa = totalActions > 0 && adSpend > 0 ? adSpend / totalActions : null;

  const awarenessToConsideration =
    awareness > 0 ? (consideration / awareness) * 100 : null;
  const considerationToConversion =
    consideration > 0 ? (conversion / consideration) * 100 : null;
  const totalFunnelEfficiency = awareness > 0 ? (conversion / awareness) * 100 : null;

  const attribution = [
    {
      channel: "Paid Media",
      awareness:
        (streamValues.meta_impressions || 0) +
        (streamValues.google_impressions || 0) +
        (streamValues.linkedin_ads_impressions || 0),
      consideration:
        (streamValues.meta_clicks || 0) +
        (streamValues.google_clicks || 0) +
        (streamValues.linkedin_ads_clicks || 0),
      conversion:
        (streamValues.meta_conversions || 0) +
        (streamValues.google_conversions || 0) +
        (streamValues.linkedin_ads_conversions || 0),
    },
    {
      channel: "Organic Search",
      awareness: streamValues.gsc_impressions || 0,
      consideration: streamValues.gsc_clicks || 0,
      conversion: 0,
    },
    {
      channel: "Social Organic",
      awareness: streamValues.social_impressions || 0,
      consideration:
        (streamValues.youtube_views || 0) +
        (streamValues.social_engagements || 0) +
        (streamValues.ig_profile_visits || 0),
      conversion: streamValues.ig_external_link_taps || 0,
    },
    {
      channel: "Direct Web",
      awareness: 0,
      consideration: streamValues.ga4_sessions || 0,
      conversion: 0,
    },
  ].filter((r) => r.awareness + r.consideration + r.conversion > 0);

  const notice =
    channels.length === 0
      ? "No channel data yet. Upload CSVs under Social, Ads, Website, or SEO."
      : channels.length === 1
        ? `1 Active Channel Ingested: ${channels[0].label}`
        : `${channels.length} Active Channels feeding this executive view`;

  return {
    channels,
    config,
    stages: { awareness, consideration, conversion },
    rates: {
      awarenessToConsideration,
      considerationToConversion,
      totalFunnelEfficiency,
    },
    awareness: {
      socialReach,
      paidImpressions,
      seoImpressions,
      totalFootprint: awareness,
    },
    engagement: {
      webSessions,
      seoClicks,
      paidClicks,
      totalInbound,
      costPerVisit,
    },
    conversions: {
      adSpend,
      adSpendLabel,
      adConversions,
      webConversions,
      totalActions,
      cpa,
    },
    streamValues,
    attribution,
    notice,
  };
}

export { subcategoryLabel };
