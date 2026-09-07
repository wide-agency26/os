export type ToolRecentKey = "reports" | "ci" | "blog" | "content";

const STORAGE_KEY = "wide.tools.recentProjects.v1";
const LIMIT = 8;

type Store = Partial<Record<ToolRecentKey, string[]>>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(next: Store) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

export function readRecentProjectIds(
  tool: ToolRecentKey,
  limit = LIMIT
): string[] {
  const ids = readStore()[tool] || [];
  return ids.filter((id) => typeof id === "string" && id.length > 0).slice(0, limit);
}

export function touchRecentProject(tool: ToolRecentKey, projectId: string) {
  if (!projectId) return;
  const store = readStore();
  const prev = store[tool] || [];
  store[tool] = [projectId, ...prev.filter((id) => id !== projectId)].slice(0, LIMIT);
  writeStore(store);
}

export function partitionByRecents<T>(
  items: T[],
  getId: (item: T) => string,
  recentIds: string[]
): { recent: T[]; rest: T[] } {
  const byId = new Map(items.map((item) => [getId(item), item]));
  const recent: T[] = [];
  const seen = new Set<string>();
  for (const id of recentIds) {
    const hit = byId.get(id);
    if (!hit || seen.has(id)) continue;
    recent.push(hit);
    seen.add(id);
  }
  const rest = items.filter((item) => !seen.has(getId(item)));
  return { recent, rest };
}

export function pickInitialProjectId(
  ids: string[],
  fromUrl: string | null | undefined,
  tool: ToolRecentKey
): string {
  if (fromUrl && ids.includes(fromUrl)) return fromUrl;
  const recent = readRecentProjectIds(tool);
  const hit = recent.find((id) => ids.includes(id));
  return hit || ids[0] || "";
}

export function ts(value?: string | number | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : 0;
}
