import { generateUUID } from "@/lib/ci-builder/types";

export function isBlankId(id: unknown): boolean {
  return typeof id !== "string" || !id.trim();
}

type EnsureOpts = {
  /** Copy these source keys onto dest keys when dest is empty (e.g. label → title). */
  aliases?: Record<string, string>;
};

export type KeyedItem = { id: string } & Record<string, unknown>;

/**
 * Coerce a list (strings, objects, missing/duplicate ids) into unique keyed rows.
 * Editing by `id` is unsafe until this runs — blank ids all compare equal.
 */
export function ensureKeyedList(
  raw: unknown,
  textKey: string,
  opts?: EnsureOpts
): { items: KeyedItem[]; changed: boolean } {
  if (!Array.isArray(raw)) return { items: [], changed: false };
  const seen = new Set<string>();
  let changed = false;
  const items = raw.map((item, index) => {
    let obj: Record<string, unknown>;
    if (typeof item === "string") {
      obj = { [textKey]: item };
      changed = true;
    } else if (item && typeof item === "object") {
      obj = { ...(item as Record<string, unknown>) };
      for (const [from, to] of Object.entries(opts?.aliases || {})) {
        if (obj[to] == null && obj[from] != null) {
          obj[to] = obj[from];
          changed = true;
        }
      }
    } else {
      obj = { [textKey]: "" };
      changed = true;
    }

    let id = typeof obj.id === "string" ? obj.id.trim() : "";
    if (!id || seen.has(id)) {
      const fallback = `k:${index}`;
      id = !seen.has(fallback) ? fallback : generateUUID();
      changed = true;
    }
    seen.add(id);
    obj.id = id;
    if (obj[textKey] == null) obj[textKey] = "";
    return obj as KeyedItem;
  });
  return { items, changed };
}

/** Build a patch of list fields that needed ids / shape fixes. */
export function sanitizeListFields(
  data: Record<string, unknown>,
  fields: Array<{ field: string; textKey: string; aliases?: Record<string, string> }>
): Record<string, KeyedItem[]> | null {
  const patch: Record<string, KeyedItem[]> = {};
  for (const spec of fields) {
    const { items, changed } = ensureKeyedList(data[spec.field], spec.textKey, {
      aliases: spec.aliases,
    });
    if (changed) patch[spec.field] = items;
  }
  return Object.keys(patch).length ? patch : null;
}
