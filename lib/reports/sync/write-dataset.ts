import { createAdminClient } from "@/utils/supabase/admin";
import type { ColumnSchema, ColumnType } from "@/lib/data-hub/column-detector";
import {
  mergeDatasetRows,
  shouldMergeSubcategory,
} from "@/lib/reports/sync/merge-dataset-rows";

export interface WriteDatasetInput {
  projectId: string;
  name: string;
  category: string;
  subcategory: string;
  rows: Record<string, unknown>[];
  sourceType: "upload" | "sync";
  connectionId?: string | null;
  syncedAt?: string | null;
  syncWindowStart?: string | null;
  syncWindowEnd?: string | null;
  externalAccountLabel?: string | null;
  createdBy?: string | null;
  /** When true (default for uploads on mergeable streams), carry prior current rows missing from the new file. */
  mergePriorRows?: boolean;
}

function inferType(key: string, values: unknown[]): ColumnType {
  const k = key.toLowerCase();
  if (k.includes("date") || k === "created_at" || k === "createdat") return "date";
  if (k.includes("ctr") || k.includes("rate") || k.includes("pct") || k.includes("percent")) {
    return "percentage";
  }
  if (k.includes("spend") || k.includes("cost") || k.includes("cpc") || k.includes("cpm")) {
    return "currency";
  }
  let numeric = 0;
  let seen = 0;
  for (const v of values.slice(0, 40)) {
    if (v == null || v === "") continue;
    seen += 1;
    if (typeof v === "number" || /^-?\d+(\.\d+)?$/.test(String(v).trim())) numeric += 1;
  }
  if (seen && numeric / seen > 0.8) return "number";
  return "text";
}

export function columnsFromRows(rows: Record<string, unknown>[]): ColumnSchema[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(0, 50)) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys.map((key) => {
    const samples = rows
      .map((r) => r[key])
      .filter((v) => v != null && v !== "")
      .slice(0, 5)
      .map((v) => String(v));
    return {
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      type: inferType(key, rows.map((r) => r[key])),
      sampleValues: samples,
      uniqueCount: new Set(rows.map((r) => String(r[key] ?? ""))).size,
      fillRate: rows.length ? samples.length / Math.min(rows.length, 5) : 0,
      ignored: false,
    };
  });
}

async function fetchDatasetRows(
  supabase: ReturnType<typeof createAdminClient>,
  datasetId: string
): Promise<Record<string, unknown>[]> {
  const { data } = await supabase
    .from("dataset_rows")
    .select("row_data")
    .eq("dataset_id", datasetId)
    .order("row_index");
  return (data || []).map((r) => r.row_data as Record<string, unknown>);
}

/** Union retired currents oldest→newest, then apply incoming rows (incoming wins on key clash). */
async function loadMergedPriorRows(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  name: string,
  subcategory: string
): Promise<Record<string, unknown>[]> {
  const { data: retired } = await supabase
    .from("datasets")
    .select("id, created_at")
    .eq("project_id", projectId)
    .eq("subcategory", subcategory)
    .eq("name", name)
    .eq("is_current", false)
    .order("created_at", { ascending: true });

  let accumulated: Record<string, unknown>[] = [];
  for (const ds of retired || []) {
    const chunk = await fetchDatasetRows(supabase, ds.id);
    if (!chunk.length) continue;
    accumulated = mergeDatasetRows(subcategory, chunk, accumulated).rows;
  }
  return accumulated;
}

/** Insert a new current dataset version and retire the previous current stream. */
export async function writeCurrentDataset(input: WriteDatasetInput): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const mergePrior =
    input.mergePriorRows ??
    (input.sourceType === "upload" && shouldMergeSubcategory(input.subcategory));

  let rows = input.rows;
  if (mergePrior && rows.length > 0) {
    const priorRows = await loadMergedPriorRows(
      supabase,
      input.projectId,
      input.name,
      input.subcategory
    );
    if (priorRows.length) {
      const merged = mergeDatasetRows(input.subcategory, rows, priorRows);
      if (merged.rows.length > rows.length) {
        console.info(
          `[writeCurrentDataset] ${input.subcategory}: merged ${merged.rows.length - rows.length} prior rows (${priorRows.length} retired → ${merged.rows.length} total)`
        );
      }
      rows = merged.rows;
    }
  }

  const columns = columnsFromRows(rows);
  const now = new Date().toISOString();

  const { data: ds, error: dsErr } = await supabase
    .from("datasets")
    .insert({
      project_id: input.projectId,
      name: input.name,
      category: input.category,
      subcategory: input.subcategory,
      columns,
      row_count: rows.length,
      file_size_bytes: 0,
      created_by: input.createdBy ?? null,
      is_current: true,
      supersedes_id: null,
      source_type: input.sourceType,
      connection_id: input.connectionId ?? null,
      synced_at: input.syncedAt ?? (input.sourceType === "sync" ? now : null),
      sync_window_start: input.syncWindowStart ?? null,
      sync_window_end: input.syncWindowEnd ?? null,
      external_account_label: input.externalAccountLabel ?? null,
    })
    .select("id")
    .single();

  if (dsErr || !ds) throw new Error(dsErr?.message || "Failed to create dataset");

  const { data: priors } = await supabase
    .from("datasets")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("subcategory", input.subcategory)
    .eq("name", input.name)
    .eq("is_current", true)
    .neq("id", ds.id);

  const priorIds = (priors ?? []).map((p) => p.id);
  if (priorIds.length) {
    await supabase.from("datasets").update({ is_current: false }).in("id", priorIds);
    await supabase.from("datasets").update({ supersedes_id: priorIds[0] }).eq("id", ds.id);
  }

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((row, idx) => ({
      dataset_id: ds.id,
      row_index: i + idx,
      row_data: row,
    }));
    const { error: rowErr } = await supabase
      .from("dataset_rows")
      .upsert(chunk, { onConflict: "dataset_id, row_index" });
    if (rowErr) throw new Error(rowErr.message);
  }

  return { id: ds.id };
}
