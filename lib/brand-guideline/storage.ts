export const BRAND_GUIDELINES_BUCKET = "brand-guidelines";

export function sanitizeStorageFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "");
  return (base || "file").slice(0, 180);
}
