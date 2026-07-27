import { getSupabaseUrl } from "@/utils/supabase/env";

export function publicStorageUrl(bucket: string, path: string): string {
  const base = getSupabaseUrl().replace(/\/$/, "");
  const enc = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${enc}`;
}
