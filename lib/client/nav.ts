export type ClientNavKey =
  | "progress"
  | "guidelines"
  | "reports"
  | "seo"
  | "content"
  | "blog"
  | "tasks"
  | "sow"
  | "files";

export type ClientNavAvailability = Record<ClientNavKey, boolean>;

export type ClientNavState = {
  enabled: ClientNavAvailability;
  ready: ClientNavAvailability;
};

/** Progress is first so published snapshots become the client home screen. */
export const CLIENT_NAV_KEYS: ClientNavKey[] = [
  "progress",
  "guidelines",
  "reports",
  "seo",
  "content",
  "blog",
  "tasks",
  "sow",
  "files",
];

export const CLIENT_NAV_LABELS: Record<ClientNavKey, string> = {
  progress: "Progress",
  guidelines: "Brand Guidelines",
  reports: "Reports",
  seo: "SEO Audit",
  content: "Content",
  blog: "Blog",
  tasks: "Tasks",
  sow: "Scope of Work",
  files: "Files",
};

export const CLIENT_NAV_HREF: Record<ClientNavKey, string> = {
  progress: "/app/client-progress",
  guidelines: "/app/client-guidelines",
  reports: "/app/client-reports",
  seo: "/app/client-seo",
  content: "/app/client-content",
  blog: "/app/client-blog",
  tasks: "/app/client-tasks",
  sow: "/app/client-sow",
  files: "/app/client-files",
};

/** Default portal tabs when a project has never been configured. Files stay off. Progress is driven by show_on_client. */
export const DEFAULT_CLIENT_NAV_TABS: ClientNavKey[] = [
  "guidelines",
  "reports",
  "seo",
  "content",
  "blog",
  "tasks",
  "sow",
];

export function isClientNavKey(value: string): value is ClientNavKey {
  return (CLIENT_NAV_KEYS as string[]).includes(value);
}

export function parseClientNavTabs(raw: string[] | null | undefined): ClientNavKey[] {
  if (raw == null) return [...DEFAULT_CLIENT_NAV_TABS];
  const next = raw.filter(isClientNavKey);
  return next;
}

export function unionClientNavTabs(
  rows: Array<{ client_nav_tabs?: string[] | null }>
): Set<ClientNavKey> {
  const enabled = new Set<ClientNavKey>();
  for (const row of rows) {
    for (const key of parseClientNavTabs(row.client_nav_tabs)) {
      enabled.add(key);
    }
  }
  return enabled;
}

export function clientNavKeyFromPath(pathname: string): ClientNavKey | null {
  const entries = Object.entries(CLIENT_NAV_HREF) as [ClientNavKey, string][];
  const hit = entries.find(
    ([, href]) => pathname === href || pathname.startsWith(`${href}/`)
  );
  return hit?.[0] ?? null;
}

export function firstEnabledClientHref(enabled: Partial<Record<ClientNavKey, boolean>>): string {
  const key = CLIENT_NAV_KEYS.find((k) => k !== "files" && enabled[k]);
  return key ? CLIENT_NAV_HREF[key] : "/app/client-guidelines";
}

/** Prefer a tab that already has something to show; fall back to the first enabled tab. */
export function firstClientPortalHref(state: ClientNavState): string {
  const readyKey = CLIENT_NAV_KEYS.find((k) => k !== "files" && state.ready[k]);
  if (readyKey) return CLIENT_NAV_HREF[readyKey];
  return firstEnabledClientHref(state.enabled);
}

export function emptyClientNavFlags(value: boolean): Record<ClientNavKey, boolean> {
  return {
    progress: value,
    guidelines: value,
    reports: value,
    seo: value,
    content: value,
    blog: value,
    tasks: value,
    sow: value,
    files: false,
  };
}
