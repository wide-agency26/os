import { notFound, redirect } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { ContractBuilder } from "@/components/bd/ContractBuilder";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
  if (!profile || !isFounder(profile.role)) notFound();

  const { data: rec } = await supabase
    .from("bd_records")
    .select("id, company_name, contract")
    .eq("id", id)
    .maybeSingle();
  if (!rec) notFound();

  return (
    <Workspace wide>
      <ContractBuilder
        bdRecordId={rec.id}
        companyName={rec.company_name}
        initial={(rec.contract as Record<string, unknown>) || {}}
      />
    </Workspace>
  );
}
