import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { ToolProjectPicker } from "@/components/tools/ToolProjectPicker";
import { loadToolProjects, type ToolProject } from "@/lib/projects/tool-scope";
import { loadLastEditedByProject, stampLastEdited } from "@/lib/tools/last-edited";
import { ts } from "@/lib/tools/recent-projects";

export const dynamic = "force-dynamic";

export default async function CiToolsHub() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) redirect("/app/home");

  let all: ToolProject[] = [];
  try {
    const loaded = await loadToolProjects(supabase, ["SEO"], "ci");
    all = loaded.all;
  } catch (err) {
    console.error("CI picker loadToolProjects failed:", err);
  }

  if (all.length === 0) {
    const { data: rows } = await supabase
      .from("projects")
      .select(
        "id, title, status, contract_confirmed_at, updated_at, crm_customers:client_id ( id, record_kind, company, name, logo_url, website, parent:parent_company_id ( id, company, name, logo_url, website ) )"
      )
      .order("updated_at", { ascending: false });
    all = stampLastEdited(
      (rows || []).map((p: any) => {
        const client = Array.isArray(p.crm_customers) ? p.crm_customers[0] : p.crm_customers;
        const parent = Array.isArray(client?.parent) ? client.parent[0] : client?.parent;
        const companyRow = client?.record_kind === "contact" && parent ? parent : client;
        return {
          id: p.id,
          title: p.title || "Untitled",
          companyId: String(companyRow?.id || client?.id || ""),
          company:
            companyRow?.company ||
            companyRow?.name ||
            client?.company ||
            client?.name ||
            "No company",
          logoUrl: companyRow?.logo_url || client?.logo_url || null,
          website: companyRow?.website || client?.website || null,
          live: p.status === "running" && Boolean(p.contract_confirmed_at),
          services: [],
          lastEditedAt: ts(p.updated_at),
        };
      }),
      await loadLastEditedByProject(supabase, "ci")
    );
  }

  const featured = all.filter((p) => p.live);

  return (
    <Workspace>
      <ToolProjectPicker
        eyebrow="Brand"
        title="CI Builder"
        subtitle="Open a project to edit its guideline. The URL stays on that project so Figma import and saves land in the right place."
        featuredLabel="Live projects"
        featured={featured}
        all={all}
        hrefTemplate="/app/projects/{id}/ci-builder"
        emptyFeatured="No live projects yet. Use All projects to open a draft."
        tool="ci"
      />
    </Workspace>
  );
}
