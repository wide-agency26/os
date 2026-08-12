import type { BdStage } from "@/lib/bd/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Sb = SupabaseClient<Database>;

export type CrmProspectLink = {
  companyId: string;
  contactId: string;
  companyCreated: boolean;
  contactCreated: boolean;
};

/** Map BD pipeline stage → CRM company/contact status. */
export function crmStatusFromBdStage(
  stage: BdStage | string | null | undefined
): "Prospect" | "Lead" | "Client" {
  switch (stage) {
    case "client_won":
      return "Client";
    case "qualified_lead":
    case "outreach":
    case "discovery_call":
    case "proposal_sent":
    case "contract":
    case "quotation":
      return "Lead";
    default:
      return "Prospect";
  }
}

export function crmLeadStatusFromBdStage(
  stage: BdStage | string | null | undefined
): "Won" | "Lost" | "On-hold" | "Reached out" | "Proposal Sent" | null {
  switch (stage) {
    case "client_won":
      return "Won";
    case "declined":
    case "archived":
      return "Lost";
    case "on_hold":
      return "On-hold";
    case "proposal_sent":
    case "contract":
    case "quotation":
      return "Proposal Sent";
    case "outreach":
    case "discovery_call":
    case "qualifying":
    case "qualified_lead":
      return "Reached out";
    default:
      return null;
  }
}

/**
 * Ensure a CRM company + contact exist for a BD prospect and return their IDs.
 * Dedupes by company name (company rows) and name+parent (contacts).
 * Never deletes CRM rows.
 */
export async function ensureBdCrmCompanyAndContact(
  supabase: Sb,
  input: {
    companyName: string;
    contactName: string;
    email?: string | null;
    linkedinUrl?: string | null;
    position?: string | null;
    stage?: BdStage | string | null;
    existingCompanyId?: string | null;
    existingContactId?: string | null;
    bdRecordId?: string | null;
    sourceHint?: string | null;
  }
): Promise<{ ok: true; link: CrmProspectLink } | { ok: false; error: string }> {
  const companyName = input.companyName.trim();
  const contactName = input.contactName.trim();
  if (!companyName || !contactName) {
    return { ok: false, error: "Company and contact name are required for CRM" };
  }

  const status = crmStatusFromBdStage(input.stage);
  const leadStatus = crmLeadStatusFromBdStage(input.stage);
  const notesTail = input.bdRecordId
    ? `Linked BD record: /app/bd/${input.bdRecordId}`
    : null;

  let companyId = input.existingCompanyId || null;
  let companyCreated = false;

  if (companyId) {
    const { data: co } = await supabase
      .from("crm_customers")
      .select("id, record_kind")
      .eq("id", companyId)
      .maybeSingle();
    if (!co || co.record_kind !== "company") {
      companyId = null;
    }
  }

  if (!companyId) {
    const { data: found } = await supabase
      .from("crm_customers")
      .select("id")
      .eq("record_kind", "company")
      .ilike("company", companyName)
      .limit(1)
      .maybeSingle();
    if (found?.id) {
      companyId = found.id;
    } else {
      const { data: created, error } = await supabase
        .from("crm_customers")
        .insert({
          record_kind: "company",
          name: companyName,
          company: companyName,
          status,
          lead_status: leadStatus,
          role: "Decision Maker",
          source_category: "Activation",
          source: input.sourceHint || "BD",
          email: input.email || null,
          notes: notesTail,
        })
        .select("id")
        .single();
      if (error || !created) {
        return {
          ok: false,
          error: error?.message || "Failed to create CRM company",
        };
      }
      companyId = created.id;
      companyCreated = true;
    }
  }

  // Keep company status/notes in sync. Never rename a linked company (CRM is source of
  // display name for shared companies). Contact email stays on the contact row only.
  {
    const { data: co } = await supabase
      .from("crm_customers")
      .select("status, notes, company, name")
      .eq("id", companyId)
      .maybeSingle();
    const patch: Database["public"]["Tables"]["crm_customers"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (companyCreated) {
      patch.company = companyName;
      patch.name = companyName;
    }
    if (co?.status !== "Client") {
      patch.status = status;
      if (leadStatus) patch.lead_status = leadStatus;
    } else if (status === "Client") {
      patch.lead_status = "Won";
    }
    if (notesTail && !(co?.notes || "").includes(notesTail)) {
      patch.notes = [co?.notes, notesTail].filter(Boolean).join("\n");
    }
    const keys = Object.keys(patch).filter((k) => k !== "updated_at");
    if (keys.length > 0) {
      await supabase.from("crm_customers").update(patch).eq("id", companyId);
    }
  }

  let contactId = input.existingContactId || null;
  let contactCreated = false;

  if (contactId) {
    const { data: ct } = await supabase
      .from("crm_customers")
      .select("id, record_kind, parent_company_id")
      .eq("id", contactId)
      .maybeSingle();
    if (!ct || ct.record_kind !== "contact") {
      contactId = null;
    }
  }

  if (!contactId) {
    let q = supabase
      .from("crm_customers")
      .select("id")
      .eq("record_kind", "contact")
      .eq("parent_company_id", companyId)
      .ilike("name", contactName)
      .limit(1);
    if (input.email) {
      // Prefer email match when present
      const { data: byEmail } = await supabase
        .from("crm_customers")
        .select("id")
        .eq("record_kind", "contact")
        .eq("parent_company_id", companyId)
        .ilike("email", input.email)
        .limit(1)
        .maybeSingle();
      if (byEmail?.id) {
        contactId = byEmail.id;
      }
    }
    if (!contactId) {
      const { data: found } = await q.maybeSingle();
      if (found?.id) contactId = found.id;
    }
  }

  if (!contactId) {
    const { data: created, error } = await supabase
      .from("crm_customers")
      .insert({
        record_kind: "contact",
        name: contactName,
        company: companyName,
        parent_company_id: companyId,
        status,
        lead_status: leadStatus,
        role: "Decision Maker",
        source_category: "Activation",
        source: input.sourceHint || "BD",
        email: input.email || null,
        position: input.position || null,
        linkedin: input.linkedinUrl || null,
        notes: notesTail,
      })
      .select("id")
      .single();
    if (error || !created) {
      return {
        ok: false,
        error: error?.message || "Failed to create CRM contact",
      };
    }
    contactId = created.id;
    contactCreated = true;
  } else {
    const { data: ct } = await supabase
      .from("crm_customers")
      .select("status, notes")
      .eq("id", contactId)
      .maybeSingle();
    const patch: Database["public"]["Tables"]["crm_customers"]["Update"] = {
      name: contactName,
      company: companyName,
      parent_company_id: companyId,
      updated_at: new Date().toISOString(),
    };
    if (ct?.status !== "Client") {
      patch.status = status;
      if (leadStatus) patch.lead_status = leadStatus;
    } else if (status === "Client") {
      patch.lead_status = "Won";
    }
    if (input.email) patch.email = input.email;
    if (input.position !== undefined) {
      patch.position = input.position || null;
    }
    if (input.linkedinUrl) patch.linkedin = input.linkedinUrl;
    if (notesTail && !(ct?.notes || "").includes(notesTail)) {
      patch.notes = [ct?.notes, notesTail].filter(Boolean).join("\n");
    }
    await supabase.from("crm_customers").update(patch).eq("id", contactId);
  }

  return {
    ok: true,
    link: {
      companyId,
      contactId,
      companyCreated,
      contactCreated,
    },
  };
}

/** Promote CRM company + contact to Client (won deal). */
export async function promoteBdCrmToClient(
  supabase: Sb,
  input: { companyId: string; contactId?: string | null }
): Promise<void> {
  await supabase
    .from("crm_customers")
    .update({
      status: "Client",
      lead_status: "Won",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.companyId)
    .eq("record_kind", "company");

  if (input.contactId) {
    await supabase
      .from("crm_customers")
      .update({
        status: "Client",
        lead_status: "Won",
        parent_company_id: input.companyId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.contactId)
      .eq("record_kind", "contact");
  }
}
