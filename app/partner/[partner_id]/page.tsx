import { createClient } from "@/utils/supabase/server";
import { ContextExplainer } from "@/components/wide-os/ContextExplainer";

export const dynamic = "force-dynamic";

export default async function PartnerPortalPage({
  params,
}: {
  params: Promise<{ partner_id: string }>;
}) {
  const { partner_id } = await params;
  const supabase = await createClient();
  const { data: ws } = await supabase
    .from("workspaces")
    .select("company_name, lifecycle_status, estimated_value")
    .eq("id", partner_id)
    .eq("lifecycle_status", "Partner")
    .maybeSingle();

  return (
    <div className="min-h-screen bg-zinc-950 px-5 py-10 text-zinc-50">
      <div className="mx-auto max-w-2xl">
        <ContextExplainer
          storageKey={`partner-${partner_id}`}
          title="Partner co-sell portal"
          description="Shared materials, toolkits, and revenue-sharing metrics for partner-tier workspaces. RLS limits this view to partner members on the workspace."
        />
        <h1 className="text-2xl font-semibold">{ws?.company_name ?? "Partner portal"}</h1>
        <p className="mt-2 text-sm text-zinc-400">Co-selling workspace · toolkit and revenue share.</p>
        {ws ? (
          <p className="mt-6 text-lg tabular-nums text-[#00FF00]">
            Forecast €{Number(ws.estimated_value).toLocaleString()}
          </p>
        ) : (
          <p className="mt-6 text-sm text-zinc-500">Partner workspace not found or not yet at Partner tier.</p>
        )}
      </div>
    </div>
  );
}
