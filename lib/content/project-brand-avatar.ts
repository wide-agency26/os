import { brandMarkUrl } from "@/lib/ci-builder/brand-mark";
import { faviconUrlForHost, hostnameFromWebsite } from "@/lib/crm/logo";
import type { CIAsset, CISection } from "@/lib/ci-builder/types";

type Sb = any;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] as Record<string, unknown>) : (value as Record<string, unknown>);
}

/**
 * Brand avatar for content calendar previews: CI favicon/mark → CRM logo → website favicon.
 */
export async function loadProjectBrandAvatar(
  supabase: Sb,
  projectId: string
): Promise<{ avatarUrl: string | null; brandName: string | null }> {
  const { data: project } = await supabase
    .from("projects")
    .select(
      "title, client_id, crm_customers:client_id ( company, name, logo_url, website, record_kind, parent:parent_company_id ( company, name, logo_url, website ) )"
    )
    .eq("id", projectId)
    .maybeSingle();

  const client = asRecord(project?.crm_customers);
  const parent = asRecord(client?.parent);
  const companyRow =
    client?.record_kind === "contact" && parent ? parent : client;

  const brandName =
    String(companyRow?.company || companyRow?.name || client?.company || client?.name || project?.title || "").trim() ||
    null;

  const { data: guideline } = await supabase
    .from("ci_guidelines")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (guideline?.id) {
    const [{ data: sections }, { data: assets }] = await Promise.all([
      supabase
        .from("ci_sections")
        .select("id, section_type, data, is_visible")
        .eq("guideline_id", guideline.id),
      supabase
        .from("ci_assets")
        .select("id, section_id, kind, label, public_url, storage_path")
        .eq("guideline_id", guideline.id),
    ]);
    const mark = brandMarkUrl(
      (sections || []) as Partial<CISection>[],
      (assets || []) as Partial<CIAsset>[]
    );
    if (mark) return { avatarUrl: mark, brandName };
  }

  const logoUrl = String(companyRow?.logo_url || client?.logo_url || "").trim();
  if (logoUrl) return { avatarUrl: logoUrl, brandName };

  const website = String(companyRow?.website || client?.website || "").trim();
  const host = hostnameFromWebsite(website);
  if (host) return { avatarUrl: faviconUrlForHost(host), brandName };

  return { avatarUrl: null, brandName };
}
