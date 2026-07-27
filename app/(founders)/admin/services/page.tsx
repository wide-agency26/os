import { createClient } from "@/utils/supabase/server";
import { resolveFounderLayoutAccess } from "@/lib/founders/resolve-founder-layout-access";
import { ContextExplainer } from "@/components/wide-os/ContextExplainer";
import { 
  CreateServiceForm, 
  DeleteServiceButton, 
  CreatePackageForm, 
  DeletePackageButton 
} from "./ServiceForms";

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) {
    return <div className="p-8 text-zinc-500">Access Denied</div>;
  }

  const { tab = "services" } = await searchParams;
  const supabase = await createClient();

  let services: any[] = [];
  let packages: any[] = [];

  if (tab === "services") {
    const { data } = await supabase.from("process_services").select("*").order("sort_order");
    services = data || [];
  } else if (tab === "packages") {
    const { data } = await supabase.from("process_templates").select("*").eq("template_kind", "package").order("created_at", { ascending: false });
    packages = data || [];
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8 px-4">
      <ContextExplainer
        title="SERVICES & PACKAGES"
        description="Define the core offerings, base costs, and pricing structures for WIDE OS without complex process nodes."
        storageKey="admin-services-deck"
      />

      <div className="flex space-x-1 rounded-xl bg-zinc-900/50 p-1">
        <a
          href="/admin/services?tab=services"
          className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
            tab === "services" ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Core Services
        </a>
        <a
          href="/admin/services?tab=packages"
          className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
            tab === "packages" ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Pre-built Packages
        </a>
      </div>

      <div className="space-y-6">
        {tab === "services" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-50">Studio Services</h2>
              <CreateServiceForm />
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="bg-zinc-900/50 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-6 py-4">Service</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Base Cost</th>
                      <th className="px-6 py-4">Base Value</th>
                      <th className="px-6 py-4">Days</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {services.map((s) => (
                      <tr key={s.id} className="transition-colors hover:bg-zinc-900/50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-200">{s.name}</p>
                          <p className="mt-1 text-xs text-zinc-500 line-clamp-1">{s.description}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                            {s.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">${s.base_cost?.toLocaleString() ?? "0"}</td>
                        <td className="px-6 py-4 text-[#00FF00]">${s.base_value?.toLocaleString() ?? "0"}</td>
                        <td className="px-6 py-4">{s.estimated_days ?? "0"}d</td>
                        <td className="px-6 py-4 text-right">
                          <DeleteServiceButton id={s.id} />
                        </td>
                      </tr>
                    ))}
                    {services.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                          No services found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "packages" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-50">Sales Packages</h2>
              <CreatePackageForm />
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="bg-zinc-900/50 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-6 py-4">Package</th>
                      <th className="px-6 py-4">Tier</th>
                      <th className="px-6 py-4">Base Price</th>
                      <th className="px-6 py-4">Days</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {packages.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-zinc-900/50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-200">{p.label}</p>
                          <p className="mt-1 text-xs text-zinc-500 line-clamp-1">{p.description}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                            {p.package_tier}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[#00FF00]">${p.base_price?.toLocaleString() ?? "0"}</td>
                        <td className="px-6 py-4">{p.estimated_days ?? "0"}d</td>
                        <td className="px-6 py-4 text-right">
                          <DeletePackageButton id={p.id} />
                        </td>
                      </tr>
                    ))}
                    {packages.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                          No packages found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
