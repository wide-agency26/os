import { createClient } from "@/utils/supabase/server";
import { resolveFounderLayoutAccess } from "@/lib/founders/resolve-founder-layout-access";
import { ContextExplainer } from "@/components/wide-os/ContextExplainer";
import { AddPersonForm, DeletePersonButton, AddResourceForm, DeleteResourceButton } from "./ResourceForms";

export default async function FounderResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) {
    return <div className="p-8 text-zinc-500">Access Denied</div>;
  }

  const { tab = "people" } = await searchParams;
  const supabase = await createClient();

  let people: any[] = [];
  let tools: any[] = [];
  let otherResources: any[] = [];

  if (tab === "people") {
    const { data } = await supabase.from("people").select("*").order("full_name");
    people = data || [];
  } else if (tab === "tools") {
    const { data } = await supabase.from("resources").select("*").eq("resource_type", "Tool").order("resource_name");
    tools = data || [];
  } else if (tab === "other") {
    const { data } = await supabase.from("resources").select("*").eq("resource_type", "Other_Resource").order("resource_name");
    otherResources = data || [];
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8 px-4">
      <ContextExplainer
        title="RESOURCES RADAR"
        description="WIDE's asset inventory board. Manage human talent allocation, internal tool environments, and pass-through costs configured across live project tracks."
        storageKey="admin-resources-deck"
      />

      <div className="flex space-x-1 rounded-xl bg-zinc-900/50 p-1">
        <a
          href="/admin/resources?tab=people"
          className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
            tab === "people" ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          People
        </a>
        <a
          href="/admin/resources?tab=tools"
          className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
            tab === "tools" ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Tools
        </a>
        <a
          href="/admin/resources?tab=other"
          className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
            tab === "other" ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Other Resources
        </a>
      </div>

      <div className="space-y-6">
        {tab === "people" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-50">Team Members</h2>
              <AddPersonForm />
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="bg-zinc-900/50 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Role Type</th>
                      <th className="px-6 py-4">Capacity</th>
                      <th className="px-6 py-4">Hourly Cost</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {people.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-zinc-900/50">
                        <td className="px-6 py-4 font-medium text-zinc-200">{p.full_name}</td>
                        <td className="px-6 py-4">{p.person_type}</td>
                        <td className="px-6 py-4">{p.capacity_score}%</td>
                        <td className="px-6 py-4">${p.hourly_rate_cost?.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <DeletePersonButton id={p.id} />
                        </td>
                      </tr>
                    ))}
                    {people.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                          No team members found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "tools" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-50">Internal Tools</h2>
              <AddResourceForm type="Tool" />
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="bg-zinc-900/50 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-6 py-4">Tool Name</th>
                      <th className="px-6 py-4">Billing Type</th>
                      <th className="px-6 py-4">Cost Amount</th>
                      <th className="px-6 py-4">Access Link</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {tools.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-zinc-900/50">
                        <td className="px-6 py-4 font-medium text-zinc-200">{r.resource_name}</td>
                        <td className="px-6 py-4">{r.billing_type.replace(/_/g, " ")}</td>
                        <td className="px-6 py-4">${r.cost_amount?.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          {r.access_link ? (
                            <a href={r.access_link} target="_blank" rel="noreferrer" className="text-[#00FF00] hover:underline">
                              Link &nearr;
                            </a>
                          ) : (
                            <span className="text-zinc-600">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <DeleteResourceButton id={r.id} />
                        </td>
                      </tr>
                    ))}
                    {tools.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                          No tools found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "other" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-50">Other Resources</h2>
              <AddResourceForm type="Other_Resource" />
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="bg-zinc-900/50 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-6 py-4">Resource Name</th>
                      <th className="px-6 py-4">Billing Type</th>
                      <th className="px-6 py-4">Cost Amount</th>
                      <th className="px-6 py-4">Access Link</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {otherResources.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-zinc-900/50">
                        <td className="px-6 py-4 font-medium text-zinc-200">{r.resource_name}</td>
                        <td className="px-6 py-4">{r.billing_type.replace(/_/g, " ")}</td>
                        <td className="px-6 py-4">${r.cost_amount?.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          {r.access_link ? (
                            <a href={r.access_link} target="_blank" rel="noreferrer" className="text-[#00FF00] hover:underline">
                              Link &nearr;
                            </a>
                          ) : (
                            <span className="text-zinc-600">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <DeleteResourceButton id={r.id} />
                        </td>
                      </tr>
                    ))}
                    {otherResources.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                          No resources found.
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
