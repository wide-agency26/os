import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { loadSowDocument } from "@/lib/sow/load-sow";
import { SowBuilder } from "@/components/sow/SowBuilder";
import type { PmService } from "@/lib/sow/types";
import { Workspace } from "@/components/frappe-ui/Workspace";

export default async function SowBuilderPage({
  params,
}: {
  params: Promise<{ sow_id: string }>;
}) {
  const { sow_id } = await params;
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
  if (!profile || !isFounder(profile.role)) {
    return (
      <Workspace>
        <p className="text-red-600 font-medium">Access denied.</p>
      </Workspace>
    );
  }

  const { data: sow, error } = await loadSowDocument(sow_id);
  if (error || !sow) notFound();

  const { data: services } = await supabase
    .from("pm_services")
    .select("id, name, category, sort_order, description, short_description")
    .order("sort_order");

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <SowBuilder
        initial={sow}
        services={(services ?? []) as PmService[]}
      />
    </div>
  );
}
