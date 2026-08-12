import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { loadSowDocument } from "@/lib/sow/load-sow";
import { SowPrintClient } from "@/components/sow/SowPrintClient";

export default async function ClientSowPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: sow } = await loadSowDocument(id);
  if (!sow) notFound();

  const staff = profile && isFounder(profile.role);
  if (!staff && sow.status !== "published") notFound();

  return <SowPrintClient sow={sow} />;
}
