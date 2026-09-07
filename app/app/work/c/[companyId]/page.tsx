import { redirect, notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { workPaths } from "@/lib/work/paths";
import { ensureCompanyPipelineCard } from "@/app/actions/bd";

export default async function WorkCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
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
  if (!profile || !isFounder(profile.role)) {
    return (
      <Workspace>
        <p className="text-sm text-gray-600">Founders only.</p>
      </Workspace>
    );
  }

  const { data: company } = await supabase
    .from("crm_customers")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) notFound();

  const { data: existing } = await supabase
    .from("bd_records")
    .select("id, stage")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(20);
  const open = (existing || []).find(
    (r) => r.stage !== "archived" && r.stage !== "declined"
  );
  const picked = open || existing?.[0];
  if (picked?.id) redirect(workPaths.pipelineId(picked.id));

  const card = await ensureCompanyPipelineCard(companyId);
  if (card.ok && card.id) redirect(workPaths.pipelineId(card.id));

  return (
    <Workspace>
      <p className="text-sm text-red-600">
        {card.error || "Could not open a pipeline card for this company."}
      </p>
    </Workspace>
  );
}
