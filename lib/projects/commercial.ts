import { sowFamilyKey } from "@/lib/sow/version";
import type { Json } from "@/types/supabase";
import { copyBdOfferingsToProject } from "@/lib/offerings/sync";

type Sb = any;

export async function findOpenLeadProject(
  supabase: Sb,
  companyId: string
): Promise<{ id: string; title: string } | null> {
  const { data } = await supabase
    .from("projects")
    .select("id, title")
    .eq("client_id", companyId)
    .eq("stage", "lead")
    .eq("status", "pipeline")
    .is("contract_confirmed_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function setProjectDealContacts(
  supabase: Sb,
  projectId: string,
  contactIds: string[]
): Promise<void> {
  await supabase.from("project_deal_contacts").delete().eq("project_id", projectId);
  const unique = [...new Set(contactIds.filter(Boolean))];
  if (unique.length === 0) return;
  await supabase.from("project_deal_contacts").insert(
    unique.map((contact_id) => ({ project_id: projectId, contact_id }))
  );
}

export async function ensureBdRecordForDeal(
  supabase: Sb,
  input: {
    projectId: string;
    companyId: string;
    companyName: string;
    contactName: string;
    email?: string | null;
    existingBdRecordId?: string | null;
    ownerId: string;
    sowId?: string | null;
    sowTitle?: string | null;
  }
): Promise<string | null> {
  if (input.existingBdRecordId) return input.existingBdRecordId;

  const { data: project } = await supabase
    .from("projects")
    .select("bd_record_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (project?.bd_record_id) return project.bd_record_id as string;

  const { data: created, error } = await supabase
    .from("bd_records")
    .insert({
      name: input.contactName,
      company_name: input.companyName,
      email: input.email || null,
      owner_id: input.ownerId,
      created_by: input.ownerId,
      source: "manual",
      stage: "proposal_sent",
      stage_entered_at: new Date().toISOString(),
      company_id: input.companyId,
    })
    .select("id")
    .single();
  if (error || !created) return null;
  const bdId = created.id as string;

  await supabase
    .from("projects")
    .update({
      bd_record_id: bdId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.projectId);

  if (input.sowId) {
    const proposal = {
      type: "sow",
      linked_id: input.sowId,
      status: "draft",
      title: input.sowTitle || null,
      updated_at: new Date().toISOString(),
    };
    await supabase
      .from("bd_records")
      .update({ proposal: proposal as unknown as Json })
      .eq("id", bdId);
  }

  if (bdId) {
    await copyBdOfferingsToProject(supabase, bdId, input.projectId);
  }

  return bdId ?? null;
}

export async function createLeadProject(
  supabase: Sb,
  input: {
    companyId: string;
    companyName: string;
    title: string;
    scope?: string | null;
    sowFamilyId?: string | null;
    bdRecordId?: string | null;
    contactIds?: string[];
    projectTypeId?: string | null;
    priority?: string | null;
    department?: string | null;
  }
): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      title: input.title,
      client_id: input.companyId,
      company: input.companyName,
      status: "pipeline",
      stage: "lead",
      priority: input.priority || "Medium",
      department: input.department || null,
      project_type_id: input.projectTypeId || null,
      scope: input.scope || null,
      sow_family_id: input.sowFamilyId || null,
      bd_record_id: input.bdRecordId || null,
      deal_value: null,
    })
    .select("id")
    .single();
  if (error || !project) {
    return { ok: false, error: error?.message || "Failed to create project" };
  }
  if (input.contactIds?.length) {
    await setProjectDealContacts(supabase, project.id, input.contactIds);
  }
  if (input.bdRecordId) {
    await copyBdOfferingsToProject(supabase, input.bdRecordId, project.id);
  }
  return { ok: true, projectId: project.id };
}

/** Won BD cards must have a delivery project. Link an existing one, or open Client. */
export async function ensureWonProjectForBd(
  supabase: Sb,
  input: {
    bdRecordId: string;
    companyId: string;
    companyName: string;
    title?: string | null;
    contactId?: string | null;
  }
): Promise<{ projectId: string | null; created: boolean }> {
  const { data: linked } = await supabase
    .from("projects")
    .select("id")
    .eq("bd_record_id", input.bdRecordId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (linked?.id) {
    await copyBdOfferingsToProject(supabase, input.bdRecordId, linked.id);
    return { projectId: linked.id, created: false };
  }

  const { data: companyProjects } = await supabase
    .from("projects")
    .select("id, stage, status, bd_record_id")
    .eq("client_id", input.companyId)
    .order("updated_at", { ascending: false })
    .limit(20);
  const usable = (companyProjects || []).find(
    (p: { stage: string | null; status: string | null }) =>
      p.status !== "expired" && p.stage !== "completed" && p.status !== "completed"
  );
  if (usable?.id) {
    if (!usable.bd_record_id) {
      await supabase
        .from("projects")
        .update({
          bd_record_id: input.bdRecordId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", usable.id);
    }
    await copyBdOfferingsToProject(supabase, input.bdRecordId, usable.id);
    return { projectId: usable.id, created: false };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      title: input.title?.trim() || `${input.companyName} — Engagement`,
      client_id: input.companyId,
      company: input.companyName,
      status: "running",
      stage: "client",
      start_date: today,
      expected_start_date: today,
      bd_record_id: input.bdRecordId,
    })
    .select("id")
    .single();
  if (error || !project) return { projectId: null, created: false };
  if (input.contactId) {
    await setProjectDealContacts(supabase, project.id, [input.contactId]);
  }
  await copyBdOfferingsToProject(supabase, input.bdRecordId, project.id);
  return { projectId: project.id, created: true };
}

export async function attachSowToProject(
  supabase: Sb,
  sowId: string,
  projectId: string
): Promise<void> {
  const { data: sow } = await supabase
    .from("sows")
    .select("id, version_root_id, title")
    .eq("id", sowId)
    .maybeSingle();
  if (!sow) return;
  const familyId = sowFamilyKey(sow);
  await supabase
    .from("sows")
    .update({ project_id: projectId, updated_at: new Date().toISOString() })
    .eq("id", sowId);
  await supabase
    .from("projects")
    .update({
      sow_family_id: familyId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .is("sow_family_id", null);
}

export async function ensureSowLeadProject(
  supabase: Sb,
  input: {
    sowId: string;
    companyId: string;
    companyName: string;
    title: string;
    ownerId: string;
    versionOfId?: string | null;
    projectId?: string | null;
    separateDeal?: boolean;
    contactIds?: string[];
    bdRecordId?: string | null;
    contactName?: string | null;
    email?: string | null;
  }
): Promise<{ projectId: string | null; created: boolean; error?: string }> {
  let projectId = input.projectId || null;
  let created = false;

  if (!projectId && input.versionOfId) {
    const { data: source } = await supabase
      .from("sows")
      .select("project_id")
      .eq("id", input.versionOfId)
      .maybeSingle();
    projectId = source?.project_id ?? null;
  }

  if (!projectId && !input.separateDeal) {
    const open = await findOpenLeadProject(supabase, input.companyId);
    if (open) projectId = open.id;
  }

  if (!projectId) {
    const made = await createLeadProject(supabase, {
      companyId: input.companyId,
      companyName: input.companyName,
      title: input.title,
      contactIds: input.contactIds,
      bdRecordId: input.bdRecordId,
    });
    if (!made.ok) return { projectId: null, created: false, error: made.error };
    projectId = made.projectId;
    created = true;
  } else if (input.contactIds?.length) {
    await setProjectDealContacts(supabase, projectId, input.contactIds);
  }

  await attachSowToProject(supabase, input.sowId, projectId);

  const contactName =
    input.contactName ||
    input.companyName;
  await ensureBdRecordForDeal(supabase, {
    projectId,
    companyId: input.companyId,
    companyName: input.companyName,
    contactName,
    email: input.email,
    existingBdRecordId: input.bdRecordId,
    ownerId: input.ownerId,
    sowId: input.sowId,
    sowTitle: input.title,
  });

  return { projectId, created };
}

/** Close delivery rows when a deal is lost so they leave Live / Identified. */
export async function expireProjectsForLostDeal(
  supabase: Sb,
  input: { bdRecordId?: string | null; projectId?: string | null }
): Promise<{ ids: string[]; companyId: string | null }> {
  if (!input.bdRecordId && !input.projectId) {
    return { ids: [], companyId: null };
  }
  let q = supabase
    .from("projects")
    .select("id, status, stage, client_id")
    .neq("status", "completed")
    .neq("stage", "completed");
  if (input.projectId) q = q.eq("id", input.projectId);
  else q = q.eq("bd_record_id", input.bdRecordId);
  const { data: rows } = await q;
  const ids: string[] = [];
  let companyId: string | null = null;
  const now = new Date().toISOString();
  for (const p of rows || []) {
    companyId = p.client_id || companyId;
    if (p.status === "expired") {
      ids.push(p.id);
      continue;
    }
    const { error } = await supabase
      .from("projects")
      .update({ status: "expired", updated_at: now })
      .eq("id", p.id);
    if (!error) ids.push(p.id);
  }
  return { ids, companyId };
}

/** Re-open expired lead rows when a lost card is restored to the pipeline. */
export async function reopenExpiredProjectsForBd(
  supabase: Sb,
  bdRecordId: string
): Promise<{ ids: string[] }> {
  const { data: rows } = await supabase
    .from("projects")
    .select("id, stage")
    .eq("bd_record_id", bdRecordId)
    .eq("status", "expired");
  const ids: string[] = [];
  const now = new Date().toISOString();
  for (const p of rows || []) {
    const stage =
      p.stage === "client" || p.stage === "signed" || p.stage === "completed"
        ? "lead"
        : p.stage || "lead";
    const { error } = await supabase
      .from("projects")
      .update({
        status: "pipeline",
        stage,
        updated_at: now,
      })
      .eq("id", p.id);
    if (!error) ids.push(p.id);
  }
  return { ids };
}
