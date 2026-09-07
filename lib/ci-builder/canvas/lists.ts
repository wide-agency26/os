import { generateUUID } from "@/lib/ci-builder/types";

export type TextItem = { id: string; text: string };

export function asTextItems(raw: unknown): TextItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim();
        return text ? { id: generateUUID(), text } : null;
      }
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const text = String(rec.text || rec.title || rec.word || rec.quote || "").trim();
      if (!text) return null;
      return { id: String(rec.id || generateUUID()), text };
    })
    .filter(Boolean) as TextItem[];
}

export function asStringList(raw: unknown): string[] {
  return asTextItems(raw).map((i) => i.text);
}

export function linesToItems(text: string): TextItem[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((t) => ({ id: generateUUID(), text: t }));
}

export function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const TYPE_ROLE_OPTIONS = [
  { value: "", label: "— none —" },
  { value: "heading-primary", label: "heading-primary" },
  { value: "heading-secondary", label: "heading-secondary" },
  { value: "heading-tertiary", label: "heading-tertiary" },
  { value: "copy-body", label: "copy-body" },
  { value: "copy-caption", label: "copy-caption" },
  { value: "surface-neutral", label: "surface-neutral" },
];

export const COLOR_ROLE_OPTIONS = [
  { value: "", label: "— none —" },
  { value: "surface-neutral", label: "surface-neutral (View canvas bg)" },
  { value: "accent-primary", label: "accent-primary" },
  { value: "text-primary", label: "text-primary" },
];

export const PROTOTYPE_FONTS = [
  "Switzer Variable",
  "IBM Plex Mono",
  "Inter",
  "Georgia",
  "Times New Roman",
  "system-ui",
];
