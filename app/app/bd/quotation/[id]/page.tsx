import { notFound, redirect } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { QuotationPanel } from "@/components/bd/QuotationPanel";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { hasLexwareCredentials } from "@/lib/bd/lexware";

export default async function QuotationDetailPage({
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
    .select("id, company_name, quotation")
    .eq("id", id)
    .maybeSingle();
  if (!rec) notFound();

  return (
    <Workspace wide>
      <QuotationPanel
        bdRecordId={rec.id}
        companyName={rec.company_name}
        initial={(rec.quotation as Record<string, unknown>) || {}}
        lexwareConfigured={hasLexwareCredentials()}
      />
    </Workspace>
  );
}
