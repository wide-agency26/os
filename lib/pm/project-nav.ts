export const PROJECT_NAV_IDS = [
  "overview",
  "portal",
  "tasks",
  "sow",
  "contract",
  "content",
  "blog",
  "reports",
  "ci",
  "timesheet",
  "cost",
  "revenue",
  "review",
] as const;

export type ProjectNavId = (typeof PROJECT_NAV_IDS)[number];

export const PROJECT_NAV_LOCKED: ProjectNavId[] = ["overview", "tasks"];

/** Lean default — extra finance / CI / review tabs are opt-in per project. */
export const PROJECT_NAV_DEFAULT: ProjectNavId[] = [
  "overview",
  "portal",
  "tasks",
  "sow",
  "contract",
  "content",
  "blog",
  "reports",
];

const STORAGE_KEY = "wide.pm.projectTabs.v1";

function isNavId(value: string): value is ProjectNavId {
  return (PROJECT_NAV_IDS as readonly string[]).includes(value);
}

function normalize(ids: ProjectNavId[]): ProjectNavId[] {
  const set = new Set<ProjectNavId>([...PROJECT_NAV_LOCKED, ...ids]);
  return PROJECT_NAV_IDS.filter((id) => set.has(id));
}

export function loadProjectNav(projectId: string): ProjectNavId[] {
  if (typeof window === "undefined") return PROJECT_NAV_DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return PROJECT_NAV_DEFAULT;
    const all = JSON.parse(raw) as Record<string, unknown>;
    const list = all[projectId];
    if (!Array.isArray(list)) return PROJECT_NAV_DEFAULT;
    const ids = list.filter((x): x is ProjectNavId => typeof x === "string" && isNavId(x));
    return normalize(ids.length ? ids : PROJECT_NAV_DEFAULT);
  } catch {
    return PROJECT_NAV_DEFAULT;
  }
}

export function saveProjectNav(projectId: string, ids: ProjectNavId[]) {
  if (typeof window === "undefined") return;
  const next = normalize(ids);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    all[projectId] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota / private mode */
  }
}
