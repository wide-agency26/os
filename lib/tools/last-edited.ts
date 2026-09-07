import type { ToolRecentKey } from "@/lib/tools/recent-projects";
import { ts } from "@/lib/tools/recent-projects";

function bump(map: Map<string, number>, id?: string | null, iso?: string | null) {
  if (!id) return;
  const t = ts(iso);
  if (!t) return;
  const prev = map.get(id) || 0;
  if (t > prev) map.set(id, t);
}

/** Latest edit time per project for a tool, used to float active work to the top. */
export async function loadLastEditedByProject(
  supabase: any,
  tool: ToolRecentKey
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    if (tool === "ci") {
      const { data } = await supabase
        .from("ci_guidelines")
        .select("project_id, updated_at");
      for (const row of data || []) bump(map, row.project_id, row.updated_at);
    } else if (tool === "reports") {
      const { data: datasets } = await supabase
        .from("datasets")
        .select("project_id, updated_at, synced_at, created_at");
      for (const row of datasets || []) {
        bump(
          map,
          row.project_id,
          row.updated_at || row.synced_at || row.created_at
        );
      }
    } else if (tool === "blog") {
      const [{ data: articles }, { data: settings }] = await Promise.all([
        supabase.from("blog_articles").select("project_id, updated_at"),
        supabase.from("blog_settings").select("project_id, updated_at"),
      ]);
      for (const row of articles || []) bump(map, row.project_id, row.updated_at);
      for (const row of settings || []) bump(map, row.project_id, row.updated_at);
    } else if (tool === "content") {
      const [{ data: calendars }, { data: posts }, { data: settings }] =
        await Promise.all([
          supabase.from("content_calendars").select("project_id, updated_at"),
          supabase.from("content_posts").select("project_id, updated_at"),
          supabase.from("content_settings").select("project_id, updated_at"),
        ]);
      for (const row of calendars || []) bump(map, row.project_id, row.updated_at);
      for (const row of posts || []) bump(map, row.project_id, row.updated_at);
      for (const row of settings || []) bump(map, row.project_id, row.updated_at);
    }
  } catch (err) {
    console.error("loadLastEditedByProject", tool, err);
  }
  return map;
}

export function stampLastEdited<T extends { id: string; lastEditedAt?: number }>(
  items: T[],
  edited: Map<string, number>
): T[] {
  return items.map((item) => ({
    ...item,
    lastEditedAt: Math.max(item.lastEditedAt || 0, edited.get(item.id) || 0),
  }));
}

export function sortByLastEdited<T extends { lastEditedAt?: number }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => (b.lastEditedAt || 0) - (a.lastEditedAt || 0));
}
