import { createAdminClient } from "@/utils/supabase/admin";
import { notifyBdStakeholders } from "@/lib/bd/notify";
import { mergeQuotation } from "@/lib/bd/quotation";
import {
  ensureBdCrmCompanyAndContact,
  promoteBdCrmToClient,
} from "@/lib/bd/crm-link";
import type { Json } from "@/types/supabase";

/**
 * On Lexware quotation acceptance (or manual confirm), promote CRM company +
 * contact to Client and open a Project — BD history stays on the record.
 */
export async function runBdClientHandoff(input: {
  bdRecordId: string;
  actorId?: string | null;
}): Promise<{
  ok: boolean;
  error?: string;
  companyId?: string;
  contactId?: string;
  projectId?: string;
}> {
  const admin = createAdminClient();
  const { data: rec } = await admin
    .from("bd_records")
    .select("*")
    .eq("id", input.bdRecordId)
    .maybeSingle();
  if (!rec) return { ok: false, error: "BD record not found" };

  const quotation = mergeQuotation(
    (rec.quotation as Record<string, unknown>) || {}
  );
  if (quotation.handoff?.project_id && quotation.handoff?.company_id) {
    return {
      ok: true,
      companyId: quotation.handoff.company_id,
      projectId: quotation.handoff.project_id,
    };
  }

  const linked = await ensureBdCrmCompanyAndContact(admin, {
    companyName: rec.company_name,
    contactName: rec.name,
    email: rec.email,
    linkedinUrl: rec.linkedin_url,
    position: rec.position,
    stage: "client_won",
    existingCompanyId: rec.company_id,
    existingContactId: (rec as { contact_id?: string | null }).contact_id,
    bdRecordId: rec.id,
    sourceHint: "BD handoff",
  });
  if (!linked.ok) return { ok: false, error: linked.error };

  const companyId = linked.link.companyId;
  const contactId = linked.link.contactId;

  await promoteBdCrmToClient(admin, { companyId, contactId });

  await admin
    .from("bd_records")
    .update({ company_id: companyId, contact_id: contactId })
    .eq("id", rec.id);

  const discovery = (rec.discovery_call as Record<string, unknown>) || {};
  const timelineHint =
    typeof discovery.timeline === "string" ? discovery.timeline : null;
  const needs =
    typeof discovery.needs === "string" ? discovery.needs : null;

  const historyNote = [
    `BD handoff from record ${rec.id}`,
    `Prospect: ${rec.name} · ${rec.company_name}`,
    `CRM company: ${companyId}`,
    `CRM contact: ${contactId}`,
    `Source: ${rec.source}${rec.discovery_method ? ` (${rec.discovery_method})` : ""}`,
    needs ? `Needs: ${needs}` : null,
    timelineHint ? `Timeline signal: ${timelineHint}` : null,
    `Open full BD history: /app/bd/${rec.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  const { data: project, error: projErr } = await admin
    .from("projects")
    .insert({
      title: `${rec.company_name} — Engagement`,
      client_id: companyId,
      company: rec.company_name,
      status: "running",
      stage: "client",
      priority: "Medium",
      notes: historyNote,
      scope: needs,
      expected_start_date: null,
    })
    .select("id")
    .single();

  if (projErr || !project) {
    return { ok: false, error: projErr?.message || "Failed to create project" };
  }

  const nextQuotation = {
    ...quotation,
    status: "accepted" as const,
    accepted_at: quotation.accepted_at || new Date().toISOString(),
    handoff: {
      company_id: companyId,
      project_id: project.id,
      completed_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };

  await admin
    .from("bd_records")
    .update({
      stage: "client_won",
      stage_entered_at: new Date().toISOString(),
      company_id: companyId,
      contact_id: contactId,
      quotation: nextQuotation as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rec.id);

  await admin.from("bd_timeline_entries").insert({
    bd_record_id: rec.id,
    actor_type: input.actorId ? "user" : "system",
    actor_id: input.actorId ?? null,
    action: "client_project_handoff",
    note: `Created/promoted CRM Client + Project. Company ${companyId}, contact ${contactId}, project ${project.id}.`,
    meta: {
      company_id: companyId,
      contact_id: contactId,
      project_id: project.id,
    },
  });

  await notifyBdStakeholders({
    ownerId: rec.owner_id,
    observerIds: (rec.observer_ids as string[]) || [],
    title: `New client — needs project setup · ${rec.company_name}`,
    message: `${rec.company_name} won via BD. Project created at /app/projects/project/${project.id}. Review scope and kickoff.${timelineHint ? ` Timeline signal: ${timelineHint}` : ""}`,
    link: `/app/projects/project/${project.id}`,
    severity: "Success",
    meta: {
      bd_record_id: rec.id,
      project_id: project.id,
      company_id: companyId,
      contact_id: contactId,
    },
  });

  return {
    ok: true,
    companyId,
    contactId,
    projectId: project.id,
  };
}
