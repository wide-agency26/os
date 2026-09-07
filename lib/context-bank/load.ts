/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ContextDigest,
  ContextEntry,
  ContextEntryFilters,
  ContextEntryStatus,
} from "@/lib/context-bank/types";

type Sb = { from: (table: string) => any };

export async function loadContextEntries(
  supabase: Sb,
  filters: ContextEntryFilters
): Promise<ContextEntry[]> {
  let query = supabase
    .from("context_entries")
    .select(
      "id, company_id, project_id, entry_type, source_type, source_table, source_id, title, content, status, is_system_generated, created_by, created_at, updated_at, projects:project_id ( title )"
    )
    .eq("company_id", filters.companyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.entryType) query = query.eq("entry_type", filters.entryType);
  if (!filters.includeInactive) query = query.eq("status", "active");
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as any[]).map((row) => {
    const proj = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    return {
      id: row.id,
      company_id: row.company_id,
      project_id: row.project_id,
      entry_type: row.entry_type,
      source_type: row.source_type,
      source_table: row.source_table,
      source_id: row.source_id,
      title: row.title,
      content: row.content,
      status: row.status as ContextEntryStatus,
      is_system_generated: row.is_system_generated,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      project_title: proj?.title ?? null,
    } satisfies ContextEntry;
  });
}

export async function loadLatestDigest(
  supabase: Sb,
  companyId: string,
  projectId?: string | null
): Promise<ContextDigest | null> {
  let query = supabase
    .from("context_digests")
    .select("id, company_id, project_id, digest, entries_covered_through, generated_at")
    .eq("company_id", companyId)
    .order("generated_at", { ascending: false })
    .limit(1);
  query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ContextDigest | null) ?? null;
}
