import { redirect, notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { BdRecordDetail } from "@/components/bd/BdRecordDetail";
import { getBdRecord } from "@/app/actions/bd";

export default async function BdRecordPage({
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

  if (!profile || !isFounder(profile.role)) {
    return (
      <Workspace wide>
        <p className="text-sm text-gray-600">Founders only.</p>
      </Workspace>
    );
  }

  const result = await getBdRecord(id);
  if (!result.ok || !result.record) {
    if (result.error === "Record not found") notFound();
    return (
      <Workspace wide>
        <p className="text-sm text-red-600">{result.error}</p>
      </Workspace>
    );
  }

  return (
    <Workspace wide>
      <BdRecordDetail
        initial={result.record}
        timeline={result.timeline ?? []}
        staff={result.staff ?? []}
      />
    </Workspace>
  );
}
