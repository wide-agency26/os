"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { revalidateWork } from "@/lib/work/revalidate";
import {
  loadCatalogOfferings,
  loadOfferingsByBdIds,
  loadOfferingsByProjectIds,
  pickDealOfferings,
} from "@/lib/offerings/load";
import {
  writeBdRecordOfferings,
  writeProjectOfferings,
} from "@/lib/offerings/sync";
import type { CatalogOfferings, OfferingChip, OfferingInput } from "@/lib/offerings/types";

async function requireFounder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not authenticated" as string };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return { supabase, user: null, error: "Only founders can manage offerings" };
  }
  return { supabase, user, error: null as string | null };
}

function revalidateOfferings(opts: { projectId?: string | null; bdId?: string | null }) {
  revalidateWork({ bdId: opts.bdId || undefined });
  revalidatePath("/app/home");
  revalidatePath("/app/projects");
  revalidatePath("/app/bd");
  if (opts.projectId) {
    revalidatePath(`/app/projects/${opts.projectId}`);
    revalidatePath(`/app/projects/project/${opts.projectId}`);
  }
}

export async function listCatalogOfferings(): Promise<{
  ok: boolean;
  error?: string;
  catalog: CatalogOfferings;
}> {
  const { supabase, error } = await requireFounder();
  if (error) {
    return { ok: false, error, catalog: { packages: [], services: [] } };
  }
  const catalog = await loadCatalogOfferings(supabase);
  return { ok: true, catalog };
}

export async function getDealOfferings(input: {
  projectId?: string | null;
  bdRecordId?: string | null;
}): Promise<{ ok: boolean; error?: string; chips: OfferingChip[] }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error, chips: [] };
  const catalog = await loadCatalogOfferings(supabase);
  let projectId = input.projectId || null;
  if (!projectId && input.bdRecordId) {
    const { data: linked } = await supabase
      .from("projects")
      .select("id")
      .eq("bd_record_id", input.bdRecordId)
      .limit(1)
      .maybeSingle();
    projectId = linked?.id ?? null;
  }
  const [byProject, byBd] = await Promise.all([
    loadOfferingsByProjectIds(supabase, projectId ? [projectId] : [], catalog),
    loadOfferingsByBdIds(
      supabase,
      input.bdRecordId ? [input.bdRecordId] : [],
      catalog
    ),
  ]);
  return {
    ok: true,
    chips: pickDealOfferings(projectId, input.bdRecordId, byProject, byBd),
  };
}

export async function setProjectOfferings(input: {
  projectId: string;
  items: OfferingInput[];
}): Promise<{ ok: boolean; error?: string; chips?: OfferingChip[] }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const res = await writeProjectOfferings(supabase, input.projectId, input.items);
  if (!res.ok) return { ok: false, error: res.error };
  const { data: project } = await supabase
    .from("projects")
    .select("bd_record_id")
    .eq("id", input.projectId)
    .maybeSingle();
  const { syncCrmUnidentifiedLedger } = await import("@/lib/accounting/sync-crm");
  await syncCrmUnidentifiedLedger();
  revalidateOfferings({
    projectId: input.projectId,
    bdId: project?.bd_record_id ?? null,
  });
  revalidatePath("/app/accounting");
  revalidatePath("/app/accounting/unidentified");
  return { ok: true, chips: res.chips };
}

export async function setBdRecordOfferings(input: {
  bdRecordId: string;
  items: OfferingInput[];
}): Promise<{
  ok: boolean;
  error?: string;
  chips?: OfferingChip[];
  projectId?: string | null;
}> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const res = await writeBdRecordOfferings(supabase, input.bdRecordId, input.items);
  if (!res.ok) return { ok: false, error: res.error };
  const { syncCrmUnidentifiedLedger } = await import("@/lib/accounting/sync-crm");
  await syncCrmUnidentifiedLedger();
  revalidateOfferings({
    projectId: res.projectId,
    bdId: input.bdRecordId,
  });
  revalidatePath("/app/accounting");
  revalidatePath("/app/accounting/unidentified");
  return { ok: true, chips: res.chips, projectId: res.projectId };
}

export async function setDealOfferings(input: {
  projectId?: string | null;
  bdRecordId?: string | null;
  items: OfferingInput[];
}): Promise<{ ok: boolean; error?: string; chips?: OfferingChip[] }> {
  if (input.projectId) {
    return setProjectOfferings({ projectId: input.projectId, items: input.items });
  }
  if (input.bdRecordId) {
    return setBdRecordOfferings({
      bdRecordId: input.bdRecordId,
      items: input.items,
    });
  }
  return { ok: false, error: "Missing project or pipeline card" };
}
