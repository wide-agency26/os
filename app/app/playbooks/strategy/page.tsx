import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { PlaybooksStrategyAdmin } from "@/components/strategy/PlaybooksStrategyAdmin";
import {
  loadCatalogPackages,
  loadCatalogServices,
  loadStrategyTypeModuleDefaults,
  loadStrategyTypeServices,
} from "@/lib/strategy/load";

export const dynamic = "force-dynamic";

export default async function PlaybooksStrategyPage() {
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
        <p className="text-sm text-text-secondary">Founders only.</p>
      </Workspace>
    );
  }

  const [services, packages, typeServices, typeModules] = await Promise.all([
    loadCatalogServices(supabase),
    loadCatalogPackages(supabase),
    loadStrategyTypeServices(supabase),
    loadStrategyTypeModuleDefaults(supabase),
  ]);

  return (
    <PlaybooksStrategyAdmin
      services={services}
      packages={packages}
      typeServices={typeServices}
      typeModules={typeModules}
    />
  );
}
