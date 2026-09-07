import type { CatalogOfferings, OfferingChip, OfferingInput } from "./types";
import { offeringsEstimateLabel, normalizeOfferingInputs, resolveOfferingChips } from "./normalize";
import { loadCatalogOfferings } from "./load";

type Sb = any;

async function replaceRows(
  supabase: Sb,
  table: "project_offerings" | "bd_record_offerings",
  fk: "project_id" | "bd_record_id",
  parentId: string,
  items: OfferingInput[]
): Promise<{ error: string | null }> {
  const { error: delErr } = await supabase.from(table).delete().eq(fk, parentId);
  if (delErr) return { error: delErr.message };
  if (items.length === 0) return { error: null };
  const { error: insErr } = await supabase.from(table).insert(
    items.map((item) => ({
      [fk]: parentId,
      kind: item.kind,
      catalog_id: item.catalogId,
    }))
  );
  return { error: insErr?.message ?? null };
}

async function updateBdEstimateLabel(
  supabase: Sb,
  bdRecordId: string,
  chips: OfferingChip[]
): Promise<void> {
  await supabase
    .from("bd_records")
    .update({ estimate_service: offeringsEstimateLabel(chips) })
    .eq("id", bdRecordId);
}

export async function writeProjectOfferings(
  supabase: Sb,
  projectId: string,
  items: OfferingInput[],
  catalog?: CatalogOfferings
): Promise<{ ok: true; chips: OfferingChip[] } | { ok: false; error: string }> {
  const cat = catalog ?? (await loadCatalogOfferings(supabase));
  const normalized = normalizeOfferingInputs(items, cat);
  const chips = resolveOfferingChips(normalized, cat);
  const written = await replaceRows(
    supabase,
    "project_offerings",
    "project_id",
    projectId,
    normalized
  );
  if (written.error) return { ok: false, error: written.error };

  const { data: project } = await supabase
    .from("projects")
    .select("bd_record_id")
    .eq("id", projectId)
    .maybeSingle();
  const bdId = (project?.bd_record_id as string | null) || null;
  if (bdId) {
    const bdWrite = await replaceRows(
      supabase,
      "bd_record_offerings",
      "bd_record_id",
      bdId,
      normalized
    );
    if (bdWrite.error) return { ok: false, error: bdWrite.error };
    await updateBdEstimateLabel(supabase, bdId, chips);
  }
  return { ok: true, chips };
}

export async function writeBdRecordOfferings(
  supabase: Sb,
  bdRecordId: string,
  items: OfferingInput[],
  catalog?: CatalogOfferings
): Promise<{ ok: true; chips: OfferingChip[]; projectId: string | null } | { ok: false; error: string }> {
  const cat = catalog ?? (await loadCatalogOfferings(supabase));
  const normalized = normalizeOfferingInputs(items, cat);
  const chips = resolveOfferingChips(normalized, cat);

  const { data: linked } = await supabase
    .from("projects")
    .select("id")
    .eq("bd_record_id", bdRecordId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const projectId = (linked?.id as string | undefined) || null;

  if (projectId) {
    const res = await writeProjectOfferings(supabase, projectId, normalized, cat);
    if (!res.ok) return res;
    return { ok: true, chips: res.chips, projectId };
  }

  const written = await replaceRows(
    supabase,
    "bd_record_offerings",
    "bd_record_id",
    bdRecordId,
    normalized
  );
  if (written.error) return { ok: false, error: written.error };
  await updateBdEstimateLabel(supabase, bdRecordId, chips);
  return { ok: true, chips, projectId: null };
}

/** Copy BD offerings onto a newly linked project without duplicating. */
export async function copyBdOfferingsToProject(
  supabase: Sb,
  bdRecordId: string,
  projectId: string
): Promise<void> {
  const catalog = await loadCatalogOfferings(supabase);
  const [{ data: bdRows }, { data: projectRows }] = await Promise.all([
    supabase
      .from("bd_record_offerings")
      .select("kind, catalog_id")
      .eq("bd_record_id", bdRecordId),
    supabase
      .from("project_offerings")
      .select("kind, catalog_id")
      .eq("project_id", projectId),
  ]);
  const existing = new Set(
    (projectRows ?? []).map((r: { kind: string; catalog_id: string }) => `${r.kind}:${r.catalog_id}`)
  );
  const incoming = (bdRows ?? []).filter(
    (r: { kind: string; catalog_id: string }) =>
      (r.kind === "package" || r.kind === "service") &&
      !existing.has(`${r.kind}:${r.catalog_id}`)
  );
  if (incoming.length === 0) {
    // Still mirror project → BD so both tables match after link.
    if ((projectRows ?? []).length) {
      await replaceRows(
        supabase,
        "bd_record_offerings",
        "bd_record_id",
        bdRecordId,
        (projectRows ?? []).map((r: { kind: string; catalog_id: string }) => ({
          kind: r.kind as "package" | "service",
          catalogId: r.catalog_id,
        }))
      );
    }
    return;
  }
  const merged: OfferingInput[] = [
    ...(projectRows ?? []).map((r: { kind: string; catalog_id: string }) => ({
      kind: r.kind as "package" | "service",
      catalogId: r.catalog_id,
    })),
    ...incoming.map((r: { kind: string; catalog_id: string }) => ({
      kind: r.kind as "package" | "service",
      catalogId: r.catalog_id,
    })),
  ];
  await writeProjectOfferings(supabase, projectId, merged, catalog);
}
