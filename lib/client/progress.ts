/** Hand-fed client progress snapshot (agency Portal → /app/client-progress). */

export const PROGRESS_STAT_KEYS = [
  "social_produced",
  "social_live",
  "landings_building",
  "blogs_published",
  "other",
] as const;

export type ProgressStatKey = (typeof PROGRESS_STAT_KEYS)[number];

export type ProgressPeriodKind = "month" | "last_month" | "custom";

export type ProgressItemType = "social" | "landing" | "blog" | "other";
export type ProgressItemStatus = "live" | "in_build" | "scheduled" | "in_review";

export type ProgressStat = {
  key: ProgressStatKey;
  label: string;
  count: number;
  note?: string;
};

export type ProgressItem = {
  id: string;
  type: ProgressItemType;
  title: string;
  status: ProgressItemStatus;
  url?: string;
  date?: string;
};

export type ProjectProgress = {
  project_id: string;
  show_on_client: boolean;
  period: ProgressPeriodKind;
  period_start: string; // YYYY-MM-DD
  period_end: string;
  summary: string;
  stats: ProgressStat[];
  items: ProgressItem[];
  published_at: string | null;
  published_by: string | null;
  updated_at: string;
};

export const DEFAULT_STAT_LABELS: Record<ProgressStatKey, string> = {
  social_produced: "Social posts produced",
  social_live: "Social posts live",
  landings_building: "Landing pages in build",
  blogs_published: "Blogs published",
  other: "Other live work",
};

export const PROGRESS_ITEM_TYPE_LABEL: Record<ProgressItemType, string> = {
  social: "Social",
  landing: "Landing",
  blog: "Blog",
  other: "Other",
};

export const PROGRESS_ITEM_STATUS_LABEL: Record<ProgressItemStatus, string> = {
  live: "Live",
  in_build: "In build",
  scheduled: "Scheduled",
  in_review: "In review",
};

const BERLIN = "Europe/Berlin";

function berlinYmd(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function berlinParts(d = new Date()) {
  const [y, m] = berlinYmd(d).split("-").map(Number);
  return { y, m };
}

/** Calendar month bounds in Europe/Berlin (as YYYY-MM-DD strings). */
export function periodBoundsFor(
  kind: ProgressPeriodKind,
  customStart?: string,
  customEnd?: string
): { period_start: string; period_end: string } {
  if (kind === "custom" && customStart && customEnd) {
    return {
      period_start: customStart.slice(0, 10),
      period_end: customEnd.slice(0, 10),
    };
  }
  const { y, m } = berlinParts();
  if (kind === "last_month") {
    const lm = m === 1 ? 12 : m - 1;
    const ly = m === 1 ? y - 1 : y;
    const lastDay = new Date(Date.UTC(ly, lm, 0)).getUTCDate();
    return {
      period_start: `${ly}-${String(lm).padStart(2, "0")}-01`,
      period_end: `${ly}-${String(lm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    period_start: `${y}-${String(m).padStart(2, "0")}-01`,
    period_end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function defaultProgressStats(): ProgressStat[] {
  return PROGRESS_STAT_KEYS.map((key) => ({
    key,
    label: DEFAULT_STAT_LABELS[key],
    count: 0,
    note: "",
  }));
}

export function emptyProjectProgress(projectId: string): ProjectProgress {
  const bounds = periodBoundsFor("month");
  return {
    project_id: projectId,
    show_on_client: false,
    period: "month",
    period_start: bounds.period_start,
    period_end: bounds.period_end,
    summary: "",
    stats: defaultProgressStats(),
    items: [],
    published_at: null,
    published_by: null,
    updated_at: new Date().toISOString(),
  };
}

export function isProgressPublished(p: ProjectProgress | null | undefined): boolean {
  return Boolean(p?.show_on_client && p?.published_at);
}

/** Stats shown on the client: hide "other" when count is 0 and no note. */
export function clientVisibleStats(stats: ProgressStat[]): ProgressStat[] {
  return stats.filter((s) => {
    if (s.key !== "other") return true;
    return s.count > 0 || Boolean(s.note?.trim());
  });
}

export function clientVisibleItems(items: ProgressItem[], max = 8): ProgressItem[] {
  return items.slice(0, max);
}

export function hasClientFacingContent(p: ProjectProgress): boolean {
  if (p.summary.trim()) return true;
  if (clientVisibleStats(p.stats).some((s) => s.count > 0 || Boolean(s.note?.trim()))) {
    return true;
  }
  if (p.items.length > 0) return true;
  return false;
}

export function progressSummaryForList(p: ProjectProgress | null | undefined) {
  if (!p) {
    return {
      show_on_client: false,
      published_at: null as string | null,
      counts: {
        social_produced: 0,
        social_live: 0,
        landings_building: 0,
        blogs_published: 0,
        other: 0,
      },
    };
  }
  const byKey = Object.fromEntries(p.stats.map((s) => [s.key, s.count])) as Record<
    ProgressStatKey,
    number
  >;
  return {
    show_on_client: Boolean(p.show_on_client),
    published_at: p.published_at,
    counts: {
      social_produced: byKey.social_produced ?? 0,
      social_live: byKey.social_live ?? 0,
      landings_building: byKey.landings_building ?? 0,
      blogs_published: byKey.blogs_published ?? 0,
      other: byKey.other ?? 0,
    },
  };
}

function asStatKey(v: unknown): ProgressStatKey | null {
  return PROGRESS_STAT_KEYS.includes(v as ProgressStatKey)
    ? (v as ProgressStatKey)
    : null;
}

function asItemType(v: unknown): ProgressItemType {
  if (v === "social" || v === "landing" || v === "blog" || v === "other") return v;
  return "other";
}

function asItemStatus(v: unknown): ProgressItemStatus {
  if (v === "live" || v === "in_build" || v === "scheduled" || v === "in_review") {
    return v;
  }
  return "in_build";
}

export function parseProjectProgress(
  projectId: string,
  raw: unknown
): ProjectProgress {
  const base = emptyProjectProgress(projectId);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;

  const period: ProgressPeriodKind =
    o.period === "last_month" || o.period === "custom" || o.period === "month"
      ? o.period
      : "month";

  let stats = defaultProgressStats();
  if (Array.isArray(o.stats)) {
    const mapped = new Map<ProgressStatKey, ProgressStat>();
    for (const row of o.stats) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const key = asStatKey(r.key);
      if (!key) continue;
      mapped.set(key, {
        key,
        label: String(r.label || DEFAULT_STAT_LABELS[key]),
        count: Math.max(0, Math.floor(Number(r.count) || 0)),
        note: r.note != null ? String(r.note) : "",
      });
    }
    stats = PROGRESS_STAT_KEYS.map(
      (key) => mapped.get(key) || { key, label: DEFAULT_STAT_LABELS[key], count: 0, note: "" }
    );
  }

  const items: ProgressItem[] = Array.isArray(o.items)
    ? o.items
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
        .map((r) => ({
          id: String(r.id || cryptoRandomId()),
          type: asItemType(r.type),
          title: String(r.title || "").trim() || "Untitled",
          status: asItemStatus(r.status),
          url: r.url ? String(r.url) : undefined,
          date: r.date ? String(r.date).slice(0, 10) : undefined,
        }))
    : [];

  const period_start =
    typeof o.period_start === "string" && o.period_start
      ? o.period_start.slice(0, 10)
      : base.period_start;
  const period_end =
    typeof o.period_end === "string" && o.period_end
      ? o.period_end.slice(0, 10)
      : base.period_end;

  return {
    project_id: projectId,
    show_on_client: Boolean(o.show_on_client),
    period,
    period_start,
    period_end,
    summary: typeof o.summary === "string" ? o.summary : "",
    stats,
    items,
    published_at: typeof o.published_at === "string" ? o.published_at : null,
    published_by: typeof o.published_by === "string" ? o.published_by : null,
    updated_at:
      typeof o.updated_at === "string" ? o.updated_at : new Date().toISOString(),
  };
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newProgressItemId() {
  return cryptoRandomId();
}

export function mergeProgressPartial(
  current: ProjectProgress,
  partial: Partial<ProjectProgress>
): ProjectProgress {
  const next: ProjectProgress = {
    ...current,
    ...partial,
    project_id: current.project_id,
    stats: partial.stats
      ? PROGRESS_STAT_KEYS.map((key) => {
          const hit = partial.stats!.find((s) => s.key === key);
          return (
            hit ||
            current.stats.find((s) => s.key === key) || {
              key,
              label: DEFAULT_STAT_LABELS[key],
              count: 0,
              note: "",
            }
          );
        })
      : current.stats,
    items: partial.items !== undefined ? partial.items : current.items,
  };
  if (partial.period && partial.period !== "custom" && !partial.period_start) {
    const b = periodBoundsFor(partial.period);
    next.period_start = b.period_start;
    next.period_end = b.period_end;
  }
  return next;
}

export function formatPeriodLabel(p: ProjectProgress): string {
  if (p.period === "month") return "This month";
  if (p.period === "last_month") return "Last month";
  return `${p.period_start} → ${p.period_end}`;
}

export function relativeUpdated(iso: string | null | undefined): string {
  if (!iso) return "Not published yet";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "Updated recently";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}
