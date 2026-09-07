import type { ReportCategory } from "@/lib/reports/categories";
import { providerForSubcategory } from "@/lib/reports/sync/providers";

export type StreamKind = "live" | "file";

export interface FreshnessStream {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  sourceType?: string | null;
  syncedAt?: string | null;
  createdAt?: string | null;
  externalAccountLabel?: string | null;
  rowCount?: number;
}

export interface FreshnessConnection {
  provider: string;
  status: string;
  lastError?: string | null;
  lastSyncedAt?: string | null;
  externalAccountLabel?: string | null;
}

export interface TabChip {
  tab: Exclude<ReportCategory, "General">;
  kind: "live" | "file" | "mixed" | "empty";
  asOf: string | null;
  label: string;
  detail: string;
  provider?: string | null;
  subcategory?: string | null;
}

export interface ProjectFreshness {
  asOf: string | null;
  tabs: TabChip[];
  syncErrors: { tab: string; message: string; asOf?: string | null }[];
}

const TAB_ORDER: Exclude<ReportCategory, "General">[] = [
  "Website",
  "SEO",
  "Ads",
  "Social",
];

function reportTab(category: string, subcategory: string | null): Exclude<ReportCategory, "General"> | null {
  const sub = subcategory || "";
  if (category === "Website" || sub === "ga4") return "Website";
  if (category === "SEO" || sub.startsWith("gsc")) return "SEO";
  if (
    category === "Ads" ||
    category === "Digital" ||
    sub === "meta_ads" ||
    sub === "google_ads" ||
    sub === "linkedin_ads"
  ) {
    return "Ads";
  }
  if (category === "Social" || category === "Content") return "Social";
  return null;
}

function asOfOf(s: FreshnessStream): string | null {
  return s.syncedAt || s.createdAt || null;
}

export function relativeAge(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export function formatAsOf(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function streamKind(s: FreshnessStream): StreamKind {
  return s.sourceType === "sync" ? "live" : "file";
}

export function isLiveStale(iso: string | null | undefined, hours = 24): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > hours * 60 * 60 * 1000;
}

export function isFileStale(iso: string | null | undefined, days = 30): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > days * 24 * 60 * 60 * 1000;
}

export function computeProjectFreshness(
  streams: FreshnessStream[],
  connections: FreshnessConnection[] = []
): ProjectFreshness {
  const byTab = new Map<Exclude<ReportCategory, "General">, FreshnessStream[]>();
  for (const tab of TAB_ORDER) byTab.set(tab, []);
  for (const s of streams) {
    const tab = reportTab(s.category, s.subcategory);
    if (!tab) continue;
    byTab.get(tab)!.push(s);
  }

  const tabs: TabChip[] = TAB_ORDER.map((tab) => {
    const list = byTab.get(tab) ?? [];
    if (!list.length) {
      return {
        tab,
        kind: "empty",
        asOf: null,
        label: "No data",
        detail: "",
      };
    }
    const kinds = new Set(list.map(streamKind));
    const newest = list.reduce<(string | null)>((acc, s) => {
      const t = asOfOf(s);
      if (!t) return acc;
      if (!acc) return t;
      return new Date(t).getTime() > new Date(acc).getTime() ? t : acc;
    }, null);
    const live = list.filter((s) => streamKind(s) === "live");
    const file = list.filter((s) => streamKind(s) === "file");
    let kind: TabChip["kind"] = "file";
    if (kinds.has("live") && kinds.has("file")) kind = "mixed";
    else if (kinds.has("live")) kind = "live";

    let detail = relativeAge(newest);
    if (kind === "mixed") {
      const liveBit = live
        .map((s) => s.externalAccountLabel || s.name)
        .filter(Boolean)[0];
      const fileBit = file[0];
      detail = [
        liveBit ? `${liveBit} live` : "live",
        fileBit ? `file ${relativeAge(asOfOf(fileBit))}` : "file",
      ].join(" · ");
    }

    const provider = providerForSubcategory(list[0].subcategory);

    return {
      tab,
      kind,
      asOf: newest,
      label: kind === "live" ? "Live" : kind === "mixed" ? "Mixed" : "File",
      detail,
      provider,
      subcategory: list[0].subcategory,
    };
  });

  const dates = tabs.map((t) => t.asOf).filter((d): d is string => !!d);
  const asOf = dates.length
    ? dates.reduce((a, b) => (new Date(a).getTime() > new Date(b).getTime() ? a : b))
    : null;

  const syncErrors: ProjectFreshness["syncErrors"] = [];
  for (const c of connections) {
    if (c.status !== "error" || !c.lastError) continue;
    const metaTab =
      c.provider === "google_analytics"
        ? "Website"
        : c.provider === "google_search_console"
          ? "SEO"
          : c.provider === "meta_ads" || c.provider === "google_ads"
            ? "Ads"
            : "Social";
    syncErrors.push({
      tab: metaTab,
      message: c.lastError,
      asOf: c.lastSyncedAt,
    });
  }

  return { asOf, tabs, syncErrors };
}
