"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { createSow } from "@/app/actions/sow";
import {
  applyProjectDealValue,
  loadSowPricedLines,
  resolveProjectDealValue,
  type DealFinanceSnapshot,
} from "@/lib/accounting/deal-value";
import { syncCrmUnidentifiedLedger } from "@/lib/accounting/sync-crm";
import { syncProjectLedger } from "@/lib/accounting/sync";
import { contractTotal, mergeContract } from "@/lib/bd/contract";
import { revalidateWork } from "@/lib/work/revalidate";
import {
  createLeadProject,
  ensureBdRecordForDeal,
  findOpenLeadProject,
  setProjectDealContacts,
} from "@/lib/projects/commercial";
import { promoteBdCrmToClient } from "@/lib/bd/crm-link";
import { instantiatePlaybookForPackage } from "@/lib/pm/instantiate";
import { writeProjectOfferings } from "@/lib/offerings/sync";
import type { Json } from "@/types/supabase";

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
    return { supabase, user: null, error: "Only admins can do this" };
  }
  return { supabase, user, error: null as string | null };
}

function revalidateDeal(projectId: string, opts?: { companyId?: string | null; bdId?: string | null }) {
  revalidatePath("/app/accounting");
  revalidatePath("/app/accounting/identified");
  revalidatePath("/app/accounting/actual");
  revalidatePath("/app/accounting/unidentified");
  revalidatePath("/app/projects");
  revalidatePath("/app/home");
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/sow`);
  revalidatePath(`/app/projects/${projectId}/contract`);
  revalidatePath(`/app/projects/${projectId}/tasks`);
  revalidatePath(`/app/projects/${projectId}/cost`);
  revalidatePath(`/app/projects/${projectId}/revenue`);
  revalidatePath(`/app/projects/${projectId}/timesheet`);
  revalidatePath(`/app/projects/${projectId}/review`);
  revalidateWork({
    companyId: opts?.companyId || undefined,
    bdId: opts?.bdId || undefined,
  });
}

export async function updateProjectTitle(
  projectId: string,
  title: string
): Promise<{ ok: boolean; error?: string; title?: string }> {
  const gate = await requireAgencyStaff();
  if (!gate.ok) return { ok: false, error: "Staff only." };
  const supabase = gate.supabase;
  const next = title.trim();
  if (!next) return { ok: false, error: "Name can’t be empty" };
  if (next.length > 200) return { ok: false, error: "Name is too long" };

  const { data: project, error: fetchErr } = await supabase
    .from("projects")
    .select("id, client_id, bd_record_id, title")
    .eq("id", projectId)
    .maybeSingle();
  if (fetchErr || !project) return { ok: false, error: fetchErr?.message || "Project not found" };
  if (project.title === next) return { ok: true, title: next };

  const { error: upErr } = await supabase
    .from("projects")
    .update({ title: next, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (upErr) return { ok: false, error: upErr.message };

  const sync = await syncProjectLedger(projectId);
  if (!sync.ok) return { ok: false, error: sync.error || "Ledger sync failed" };

  revalidateDeal(projectId, {
    companyId: project.client_id,
    bdId: project.bd_record_id,
  });
  return { ok: true, title: next };
}

export async function setProjectClientVisible(
  projectId: string,
  visible: boolean
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error ?? "Unauthorized" };

  const { data: project, error: fetchErr } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (fetchErr || !project) return { ok: false, error: fetchErr?.message || "Project not found" };

  const { error: upErr } = await supabase
    .from("projects")
    .update({ client_visible: visible, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (upErr) return { ok: false, error: upErr.message };

  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/client-reports");
  revalidatePath("/app/client-content");
  revalidatePath("/app/client-blog");
  revalidatePath("/app/client-tasks");
  revalidatePath("/app/client-guidelines");
  return { ok: true };
}

export async function markProjectLost(
  projectId: string,
  reason: string
): Promise<{ ok: boolean; error?: string; bdRecordId?: string | null }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error ?? "Unauthorized" };

  const why = reason.trim();
  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id, bd_record_id, status, stage")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found" };

  let bdRecordId = project.bd_record_id as string | null;
  if (bdRecordId) {
    const { data: card } = await supabase
      .from("bd_records")
      .select("id, stage, archived_reason")
      .eq("id", bdRecordId)
      .maybeSingle();
    const existingReason = card?.archived_reason?.trim() || "";
    const note = why || existingReason;
    if (!note) {
      return { ok: false, error: "A reason is required to mark this lost." };
    }
    const { moveBdRecordStage } = await import("@/app/actions/bd");
    const moved = await moveBdRecordStage({
      id: bdRecordId,
      stage: "declined",
      note,
      archived_reason: note,
    });
    if (!moved.ok) return { ok: false, error: moved.error || "Could not update pipeline card" };
  } else {
    if (!why) return { ok: false, error: "A reason is required to mark this lost." };
    const { expireProjectsForLostDeal } = await import("@/lib/projects/commercial");
    await expireProjectsForLostDeal(supabase, { projectId });
    const sync = await syncProjectLedger(projectId);
    if (!sync.ok) return { ok: false, error: sync.error || "Ledger sync failed" };
  }

  revalidateDeal(projectId, {
    companyId: project.client_id,
    bdId: bdRecordId,
  });
  return { ok: true, bdRecordId };
}

export async function lookupOpenLeadProject(companyId: string) {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false as const, error };
  const open = await findOpenLeadProject(supabase, companyId);
  return { ok: true as const, project: open };
}

export async function ensureProjectBdRecord(projectId: string): Promise<{
  ok: boolean;
  bdRecordId?: string;
  error?: string;
}> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error ?? "Unauthorized" };
  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id, company, bd_record_id, title")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found" };
  if (project.bd_record_id) return { ok: true, bdRecordId: project.bd_record_id };
  const { data: company } = await supabase
    .from("crm_customers")
    .select("name, company")
    .eq("id", project.client_id)
    .maybeSingle();
  const companyName = company?.company || company?.name || project.company || "Company";
  const { data: people } = await supabase
    .from("project_deal_contacts")
    .select("crm_customers:contact_id ( name, email )")
    .eq("project_id", projectId)
    .limit(1);
  const personRaw = people?.[0]?.crm_customers as
    | { name?: string; email?: string | null }
    | { name?: string; email?: string | null }[]
    | undefined;
  const person = Array.isArray(personRaw) ? personRaw[0] : personRaw;
  const bdId = await ensureBdRecordForDeal(supabase, {
    projectId,
    companyId: project.client_id,
    companyName,
    contactName: person?.name || companyName,
    email: person?.email || null,
    ownerId: user.id,
    sowTitle: project.title,
  });
  if (!bdId) return { ok: false, error: "Could not create BD record" };
  return { ok: true, bdRecordId: bdId };
}

export async function createCommercialProject(input: {
  kind: "lead" | "client";
  companyId: string;
  title: string;
  contactIds?: string[];
  packageId?: string | null;
  serviceIds?: string[];
  versionOfId?: string | null;
  separateDeal?: boolean;
  contextText?: string | null;
  dealValue?: number | null;
  expectedStartDate?: string | null;
  expectedEndDate?: string | null;
  templateId?: string | null;
  projectTypeId?: string | null;
  priority?: string | null;
  department?: string | null;
  scope?: string | null;
}): Promise<{
  ok: boolean;
  error?: string;
  projectId?: string;
  sowId?: string;
  redirectTo?: string;
}> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error ?? "Unauthorized" };

  const { data: company } = await supabase
    .from("crm_customers")
    .select("id, name, company, record_kind")
    .eq("id", input.companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: "Company not found" };
  if (company.record_kind && company.record_kind !== "company") {
    return { ok: false, error: "Pick a company, not a contact" };
  }
  const companyName = company.company || company.name || "Company";
  const title = input.title.trim() || `${companyName} — Engagement`;

  if (input.kind === "client") {
    const { data: project, error: insErr } = await supabase
      .from("projects")
      .insert({
        title,
        client_id: input.companyId,
        company: companyName,
        status: "running",
        stage: "client",
        priority: input.priority || "Medium",
        department: input.department || null,
        project_type_id: input.projectTypeId || null,
        scope: input.scope || null,
        deal_value: input.dealValue ?? null,
        expected_start_date: input.expectedStartDate || null,
        expected_end_date: input.expectedEndDate || null,
        start_date: input.expectedStartDate || new Date().toISOString().slice(0, 10),
        contract_confirmed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insErr || !project) return { ok: false, error: insErr?.message || "Create failed" };
    if (input.contactIds?.length) {
      await setProjectDealContacts(supabase, project.id, input.contactIds);
    }
    if (input.templateId) {
      const { data: templateTasks } = await supabase
        .from("project_template_tasks")
        .select("*")
        .eq("template_id", input.templateId);
      if (templateTasks?.length) {
        await (supabase as any).from("erp_tasks").insert(
          templateTasks.map((tt: any) => ({
            project_id: project.id,
            title: tt.title,
            description: tt.description,
            priority: tt.priority,
            weight: tt.weight,
            expected_time: tt.expected_time,
            status: "Open",
            progress: 0,
          }))
        );
      }
    }
    if (input.packageId) {
      await instantiatePlaybookForPackage(supabase as any, project.id, input.packageId);
    }
    const offeringItems = [
      ...(input.packageId
        ? [{ kind: "package" as const, catalogId: input.packageId }]
        : []),
      ...(input.serviceIds ?? []).map((catalogId) => ({
        kind: "service" as const,
        catalogId,
      })),
    ];
    if (offeringItems.length) {
      await writeProjectOfferings(supabase, project.id, offeringItems);
    }
    await syncProjectLedger(project.id);
    revalidateDeal(project.id);
    return {
      ok: true,
      projectId: project.id,
      redirectTo: `/app/projects/${project.id}/tasks`,
    };
  }

  let projectId: string | null = null;
  if (!input.separateDeal && !input.versionOfId) {
    const open = await findOpenLeadProject(supabase, input.companyId);
    if (open) projectId = open.id;
  }

  if (!projectId) {
    const made = await createLeadProject(supabase, {
      companyId: input.companyId,
      companyName,
      title,
      scope: input.scope,
      contactIds: input.contactIds,
      projectTypeId: input.projectTypeId,
      priority: input.priority,
      department: input.department,
    });
    if (!made.ok) return { ok: false, error: made.error };
    projectId = made.projectId;
  } else if (input.contactIds?.length) {
    await setProjectDealContacts(supabase, projectId, input.contactIds);
  }

  const sow = await createSow({
    companyId: input.companyId,
    title,
    packageId: input.packageId,
    serviceIds: input.serviceIds,
    versionOfId: input.versionOfId,
    contextText: input.contextText,
    projectId,
    contactIds: input.contactIds,
  });
  if (!sow.ok) return { ok: false, error: sow.error || "Failed to create SOW" };

  const { data: contacts } = await supabase
    .from("crm_customers")
    .select("name, email")
    .in("id", input.contactIds?.length ? input.contactIds : ["00000000-0000-0000-0000-000000000000"]);
  const first = contacts?.[0];
  await ensureBdRecordForDeal(supabase, {
    projectId,
    companyId: input.companyId,
    companyName,
    contactName: first?.name || companyName,
    email: first?.email || null,
    ownerId: user.id,
    sowId: sow.sowId,
    sowTitle: title,
  });

  const offeringItems = [
    ...(input.packageId
      ? [{ kind: "package" as const, catalogId: input.packageId }]
      : []),
    ...(input.serviceIds ?? []).map((catalogId) => ({
      kind: "service" as const,
      catalogId,
    })),
  ];
  if (offeringItems.length) {
    await writeProjectOfferings(supabase, projectId, offeringItems);
  }

  await applyProjectDealValue(projectId);
  revalidateDeal(projectId);
  return {
    ok: true,
    projectId,
    sowId: sow.sowId,
    redirectTo: `/app/projects/${projectId}/sow`,
  };
}

export async function loadProjectDealSnapshot(
  projectId: string
): Promise<{ ok: boolean; snapshot?: DealFinanceSnapshot; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const snapshot = await resolveProjectDealValue(supabase, projectId);
  if (!snapshot) return { ok: false, error: "Project not found" };
  return { ok: true, snapshot };
}

export async function refreshContractFromSow(input: {
  projectId: string;
}): Promise<{ ok: boolean; error?: string; contract?: Record<string, unknown> }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  const { data: project } = await supabase
    .from("projects")
    .select("id, bd_record_id, sow_family_id, client_id, company, contract_confirmed_at")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project?.bd_record_id) return { ok: false, error: "No contract record yet" };
  if (project.contract_confirmed_at) {
    return { ok: false, error: "Contract is already confirmed" };
  }

  const { data: sows } = await supabase
    .from("sows")
    .select("id, title, status, version_number")
    .eq("project_id", input.projectId)
    .order("version_number", { ascending: false });
  const active =
    (sows || []).find((s: { status: string }) => s.status === "accepted") ||
    (sows || []).find((s: { status: string }) => s.status === "published") ||
    (sows || [])[0];
  if (!active) return { ok: false, error: "No SOW on this project" };

  const priced = await loadSowPricedLines(supabase, active.id);
  const { generateBdContract } = await import("@/app/actions/bd");
  const res = await generateBdContract({
    bdRecordId: project.bd_record_id,
    pricedLines: priced,
    proposalTitle: active.title,
  });
  if (!res.ok) return res;
  await applyProjectDealValue(input.projectId);
  revalidateDeal(input.projectId);
  return res;
}

export async function confirmProjectContract(input: {
  projectId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error ?? "Unauthorized" };

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, client_id, bd_record_id, company, contract_confirmed_at, title, deal_value"
    )
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found" };

  const { data: sows } = await supabase
    .from("sows")
    .select("id, status")
    .eq("project_id", input.projectId);
  const sowConfirmed = (sows || []).some(
    (s: { status: string }) => s.status === "accepted"
  );
  if (!sowConfirmed) {
    return { ok: false, error: "Confirm the SOW before starting the project" };
  }

  let dealValue: number | null = null;
  if (project.bd_record_id) {
    const { data: rec } = await supabase
      .from("bd_records")
      .select("contract")
      .eq("id", project.bd_record_id)
      .maybeSingle();
    const contract = mergeContract(
      (rec?.contract as Record<string, unknown>) || {}
    );
    dealValue = contractTotal(contract.line_items) || null;
    await supabase
      .from("bd_records")
      .update({
        contract: {
          ...contract,
          status: "signed",
          finalized_at: contract.finalized_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as Json,
        stage: "client_won",
        stage_entered_at: new Date().toISOString(),
      })
      .eq("id", project.bd_record_id);
  }

  if (dealValue == null) {
    const snap = await resolveProjectDealValue(supabase, input.projectId);
    dealValue = snap?.amount ?? null;
  }
  if (dealValue == null && Number(project.deal_value || 0) > 0) {
    dealValue = Number(project.deal_value);
  }

  const today = new Date().toISOString().slice(0, 10);
  const { error: updErr } = await supabase
    .from("projects")
    .update({
      stage: "client",
      status: "running",
      start_date: today,
      expected_start_date: today,
      contract_confirmed_at: new Date().toISOString(),
      deal_value: dealValue,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.projectId);
  if (updErr) return { ok: false, error: updErr.message };

  if (project.client_id) {
    await promoteBdCrmToClient(supabase, {
      companyId: project.client_id,
      contactId: null,
    });
  }

  const { data: sowForPkg } = await supabase
    .from("sows")
    .select("package_id")
    .eq("project_id", input.projectId)
    .not("package_id", "is", null)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const packageId = (sowForPkg as { package_id?: string | null } | null)?.package_id;
  if (packageId) {
    await instantiatePlaybookForPackage(supabase as any, input.projectId, packageId);
  }

  await syncProjectLedger(input.projectId);
  revalidateDeal(input.projectId);
  return { ok: true };
}

export async function runCrmUnidentifiedSync() {
  const result = await syncCrmUnidentifiedLedger();
  if (result.ok) {
    revalidatePath("/app/accounting");
    revalidatePath("/app/accounting/unidentified");
  }
  return result;
}

const BD_STAGES_NEED_PROJECT = [
  "qualified_lead",
  "outreach",
  "discovery_call",
  "proposal_sent",
  "contract",
  "quotation",
  "client_won",
] as const;

export async function ensureSowHasProject(sowId: string): Promise<{
  ok: boolean;
  projectId?: string | null;
  created?: boolean;
  error?: string;
}> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error ?? "Unauthorized" };

  const { data: sow } = await supabase
    .from("sows")
    .select("id, title, company_id, project_id, version_root_id")
    .eq("id", sowId)
    .maybeSingle();
  if (!sow) return { ok: false, error: "SOW not found" };
  if (sow.project_id) return { ok: true, projectId: sow.project_id, created: false };
  if (!sow.company_id) {
    return { ok: false, error: "This SOW has no company, so a project cannot be created." };
  }

  const { data: company } = await supabase
    .from("crm_customers")
    .select("id, name, company")
    .eq("id", sow.company_id)
    .maybeSingle();
  const companyName = company?.company || company?.name || "Company";
  const { ensureSowLeadProject } = await import("@/lib/projects/commercial");
  const res = await ensureSowLeadProject(supabase, {
    sowId: sow.id,
    companyId: sow.company_id,
    companyName,
    title: sow.title,
    ownerId: user.id,
    versionOfId: sow.version_root_id,
  });
  if (!res.projectId) {
    return { ok: false, error: res.error || "Could not create project" };
  }
  await applyProjectDealValue(res.projectId);
  await syncCrmUnidentifiedLedger();
  revalidateDeal(res.projectId);
  revalidateWork({ sowId });
  return { ok: true, projectId: res.projectId, created: res.created };
}

export async function backfillSowLeadProjects(): Promise<{
  ok: boolean;
  error?: string;
  created?: number;
  linked?: number;
}> {
  const { supabase, user, error } = await requireFounder();
  if (error || !user) return { ok: false, error: error ?? "Unauthorized" };

  const { FROZEN_SOW_SLUGS } = await import("@/lib/sow/frozen");
  const { data: frozen } = await supabase
    .from("sows")
    .select("id, company_id, public_slug, version_root_id, created_at")
    .in("public_slug", [...FROZEN_SOW_SLUGS])
    .order("created_at", { ascending: true });
  if ((frozen || []).length >= 2) {
    const root = frozen![0];
    for (let i = 1; i < frozen!.length; i += 1) {
      const child = frozen![i];
      if (child.company_id !== root.company_id) continue;
      if (child.version_root_id === root.id) continue;
      await supabase
        .from("sows")
        .update({
          version_root_id: root.id,
          version_number: i + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", child.id);
    }
  }

  const { data: sows } = await supabase
    .from("sows")
    .select("id, title, company_id, project_id, version_root_id, version_number, status")
    .is("project_id", null)
    .not("status", "eq", "archived")
    .order("created_at", { ascending: true });

  let created = 0;
  let linked = 0;
  const { ensureSowLeadProject } = await import("@/lib/projects/commercial");

  const families = new Map<string, NonNullable<typeof sows>>();
  for (const s of sows || []) {
    const key = s.version_root_id || s.id;
    const list = families.get(key) ?? [];
    list.push(s);
    families.set(key, list);
  }

  for (const members of families.values()) {
    if (!members.length) continue;
    const first = members[0];
    if (!first?.company_id) continue;
    const { data: company } = await supabase
      .from("crm_customers")
      .select("id, name, company")
      .eq("id", first.company_id)
      .maybeSingle();
    const companyName = company?.company || company?.name || "Company";
    const res = await ensureSowLeadProject(supabase, {
      sowId: first.id,
      companyId: first.company_id,
      companyName,
      title: first.title,
      ownerId: user.id,
      versionOfId: first.version_root_id,
    });
    if (!res.projectId) continue;
    if (res.created) created += 1;
    else linked += 1;
    for (const extra of members.slice(1)) {
      await supabase
        .from("sows")
        .update({ project_id: res.projectId, updated_at: new Date().toISOString() })
        .eq("id", extra.id);
    }
    await applyProjectDealValue(res.projectId);
  }

  const { data: bdRows } = await supabase
    .from("bd_records")
    .select("id, name, company_name, company_id, email, stage, owner_id")
    .in("stage", [...BD_STAGES_NEED_PROJECT]);
  for (const rec of bdRows || []) {
    const { data: alreadyLinked } = await supabase
      .from("projects")
      .select("id")
      .eq("bd_record_id", rec.id)
      .limit(1)
      .maybeSingle();
    if (alreadyLinked?.id) continue;
    if (!rec.company_id) continue;
    const { data: companyProj } = await supabase
      .from("projects")
      .select("id, stage, status, bd_record_id")
      .eq("client_id", rec.company_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (companyProj?.id) {
      if (!companyProj.bd_record_id) {
        await supabase
          .from("projects")
          .update({
            bd_record_id: rec.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", companyProj.id);
        linked += 1;
      }
      continue;
    }
    const { data: company } = await supabase
      .from("crm_customers")
      .select("name, company")
      .eq("id", rec.company_id)
      .maybeSingle();
    const companyName =
      company?.company || company?.name || rec.company_name || "Company";
    const made = await createLeadProject(supabase, {
      companyId: rec.company_id,
      companyName,
      title: rec.company_name || rec.name,
      bdRecordId: rec.id,
    });
    if (!made.ok) continue;
    created += 1;
    await applyProjectDealValue(made.projectId);
  }

  const { data: crmLeads } = await supabase
    .from("crm_customers")
    .select("id, name, company")
    .eq("record_kind", "company")
    .eq("status", "Lead");
  const leadIds = (crmLeads || []).map((c: { id: string }) => c.id);
  const claimedCompanies = new Set<string>();
  if (leadIds.length) {
    const { data: existing } = await supabase
      .from("projects")
      .select("client_id")
      .in("client_id", leadIds);
    for (const p of existing || []) {
      if (p.client_id) claimedCompanies.add(p.client_id);
    }
  }
  for (const company of crmLeads || []) {
    if (claimedCompanies.has(company.id)) continue;
    const companyName = company.company || company.name || "Company";
    const made = await createLeadProject(supabase, {
      companyId: company.id,
      companyName,
      title: `${companyName} — Lead`,
    });
    if (!made.ok) continue;
    created += 1;
    claimedCompanies.add(company.id);
  }

  await syncCrmUnidentifiedLedger();
  revalidatePath("/app/accounting");
  revalidatePath("/app/accounting/identified");
  revalidatePath("/app/accounting/unidentified");
  revalidateWork();
  revalidatePath("/app/projects");
  revalidatePath("/app/projects/project");
  return { ok: true, created, linked };
}
