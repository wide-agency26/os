import { redirect, notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { BdQualificationClient } from "@/components/bd/BdQualificationClient";
import { getBdRecord } from "@/app/actions/bd";

export default async function BdQualificationRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
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

  const result = await getBdRecord(id);
  if (!result.ok || !result.record) {
    if (result.error === "Record not found") notFound();
    return (
      <Workspace>
        <p className="text-sm text-red-600">{result.error}</p>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <BdQualificationClient
        initial={result.record}
        autoOpenStub={sp.run === "1"}
      />
    </Workspace>
  );
}
