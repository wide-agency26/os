import type { SupabaseClient } from "@supabase/supabase-js";
import type { ColumnSchema } from "@/lib/data-hub/column-detector";
import { detectSubcategory } from "@/lib/data-hub/subcategory";
import type { LoadedDataset } from "@/lib/reports/aggregation";

export interface DatasetMeta {
  id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  columns: ColumnSchema[];
  row_count: number;
  created_at?: string | null;
}

export async function fetchRowsForDataset(
  supabase: SupabaseClient,
  datasetId: string,
  columns: ColumnSchema[]
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  let from = 0;
  const rawRows: Record<string, any>[] = [];

  while (true) {
    const { data: rows, error } = await (supabase as any)
      .from("dataset_rows")
      .select("row_data")
      .eq("dataset_id", datasetId)
      .order("row_index")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!rows?.length) break;
    rawRows.push(...rows.map((r: any) => r.row_data));
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return rawRows.map((row: Record<string, any>) => {
    const coerced: Record<string, any> = {};
    for (const col of columns) {
      const val = row[col.key];
      if (val === null || val === undefined || val === "") {
        coerced[col.key] = null;
        continue;
      }
      if (["number", "percentage", "currency"].includes(col.type)) {
        const cleaned = String(val).replace(/[$€£¥₹,%\s]/g, "");
        const num = parseFloat(cleaned);
        coerced[col.key] = isNaN(num) ? val : num;
      } else {
        coerced[col.key] = val;
      }
    }
    for (const [k, v] of Object.entries(row)) {
      if (!(k in coerced)) coerced[k] = v;
    }
    return coerced;
  });
}

export async function hydrateLoadedDatasets(
  supabase: SupabaseClient,
  list: DatasetMeta[]
): Promise<LoadedDataset[]> {
  const out: LoadedDataset[] = [];
  for (const d of list) {
    const rows = await fetchRowsForDataset(supabase, d.id, d.columns || []);
    out.push({
      id: d.id,
      name: d.name,
      category: d.category,
      subcategory: d.subcategory || detectSubcategory(d.name, d.columns) || null,
      createdAt: d.created_at,
      rowCount: d.row_count,
      columns: d.columns || [],
      rows,
    });
  }
  return out;
}
