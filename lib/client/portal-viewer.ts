import { isFounder } from "@/lib/rbac";
import { readViewAsCompanyId, readViewAsContactId } from "@/lib/client/view-as.server";
import {
  parseAllowedNavTabs,
  parsePortalAccess,
  type PortalAccessLevel,
} from "@/lib/client/permissions";
import type { ClientNavKey } from "@/lib/client/nav";

type Sb = {
  from: (table: string) => any;
};

export type PortalViewer = {
  staff: boolean;
  preview: boolean;
  companyIds: string[];
  companyName: string | null;
  contactId: string | null;
  contactName: string | null;
  isMember: boolean;
  portalAccess: PortalAccessLevel;
  allowedNavTabs: ClientNavKey[] | null;
};

function emptyViewer(staff: boolean): PortalViewer {
  return {
    staff,
    preview: false,
    companyIds: [],
    companyName: null,
    contactId: null,
    contactName: null,
    isMember: false,
    portalAccess: "full",
    allowedNavTabs: null,
  };
}

async function loadCompanyLabel(supabase: Sb, companyId: string): Promise<string | null> {
  const { data } = await supabase
    .from("crm_customers")
    .select("company, name")
    .eq("id", companyId)
    .maybeSingle();
  if (!data) return null;
  return String(data.company || data.name || "").trim() || null;
}

async function memberAccessForCompany(
  supabase: Sb,
  companyId: string,
  contactId: string | null
): Promise<{
  isMember: boolean;
  portalAccess: PortalAccessLevel;
  allowedNavTabs: ClientNavKey[] | null;
}> {
  if (!contactId) {
    return { isMember: false, portalAccess: "full", allowedNavTabs: null };
  }
  const { data } = await supabase
    .from("company_members")
    .select("id, portal_access, allowed_nav_tabs")
    .eq("company_id", companyId)
    .eq("contact_id", contactId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return { isMember: false, portalAccess: "full", allowedNavTabs: null };
  return {
    isMember: true,
    portalAccess: parsePortalAccess(data.portal_access),
    allowedNavTabs: parseAllowedNavTabs(data.allowed_nav_tabs as string[] | null),
  };
}

/**
 * Who is looking at the client portal — a real client member, or a founder
 * previewing a company / contact. Client pages and nav should all use this.
 */
export async function resolvePortalViewer(
  supabase: Sb,
  opts: { userId: string; role: string | null }
): Promise<PortalViewer> {
  const staff = isFounder(opts.role);

  if (staff) {
    const companyId = await readViewAsCompanyId();
    const contactId = await readViewAsContactId();
    if (!companyId) return emptyViewer(true);

    const viewer: PortalViewer = {
      staff: true,
      preview: true,
      companyIds: [companyId],
      companyName: await loadCompanyLabel(supabase, companyId),
      contactId: null,
      contactName: null,
      isMember: false,
      portalAccess: "full",
      allowedNavTabs: null,
    };

    if (contactId) {
      const { data: contact } = await supabase
        .from("crm_customers")
        .select("id, name, record_kind, parent_company_id")
        .eq("id", contactId)
        .maybeSingle();
      const parentId = contact?.parent_company_id as string | null;
      if (contact && contact.record_kind !== "company" && parentId === companyId) {
        viewer.contactId = contact.id;
        viewer.contactName = String(contact.name || "").trim() || "Contact";
        const access = await memberAccessForCompany(supabase, companyId, contact.id);
        viewer.isMember = access.isMember;
        viewer.portalAccess = access.portalAccess;
        viewer.allowedNavTabs = access.allowedNavTabs;
      }
    }

    return viewer;
  }

  const { data: members } = await supabase
    .from("company_members")
    .select("company_id, contact_id, portal_access, allowed_nav_tabs, crm_customers!company_id(company, name)")
    .eq("user_id", opts.userId)
    .eq("status", "active");

  const rows = (members ?? []) as Array<{
    company_id: string;
    contact_id: string | null;
    portal_access: string | null;
    allowed_nav_tabs: string[] | null;
    crm_customers?: { company?: string | null; name?: string | null } | { company?: string | null; name?: string | null }[] | null;
  }>;

  const companyIds = rows.map((m) => m.company_id).filter(Boolean);
  const first = rows[0];
  const custRaw = first?.crm_customers;
  const cust = Array.isArray(custRaw) ? custRaw[0] : custRaw;

  let portalAccess: PortalAccessLevel = "full";
  let allowedNavTabs: ClientNavKey[] | null = null;
  if (rows.length && rows.every((m) => parsePortalAccess(m.portal_access) === "restricted")) {
    portalAccess = "restricted";
    const allow = new Set<ClientNavKey>();
    for (const m of rows) {
      for (const key of parseAllowedNavTabs(m.allowed_nav_tabs) || []) allow.add(key);
    }
    allowedNavTabs = [...allow];
  }

  return {
    staff: false,
    preview: false,
    companyIds,
    companyName: (cust?.company || cust?.name || "").trim() || null,
    contactId: first?.contact_id || null,
    contactName: null,
    isMember: companyIds.length > 0,
    portalAccess,
    allowedNavTabs,
  };
}
