import Link from "next/link";
import { notFound } from "next/navigation";
import type { WideAccess } from "@/lib/wide-os/types";
import { clientPaths } from "@/lib/wide-os/paths";
import { ModuleScaffold } from "@/modules/_shared/ModuleScaffold";
import { createClient } from "@/utils/supabase/server";
import { formatUsd } from "@/lib/finance/aggregations";

export async function ClientProposalView({
  access,
  proposalId,
}: {
  access: WideAccess;
  proposalId: string;
}) {
  const clientId = access.clientId!;
  const supabase = await createClient();

  const { data: proposal, error } = await supabase
    .from("client_proposals")
    .select("id, title, description, estimated_value, status, published_at, recommended_headline")
    .eq("id", proposalId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error || !proposal || proposal.status !== "published") {
    notFound();
  }

  return (
    <ModuleScaffold
      access={access}
      title={proposal.title}
      description="Strategic expansion proposal from your WIDE Client Manager"
    >
      <div className="max-w-2xl space-y-6">
        {proposal.recommended_headline ? (
          <p className="text-sm font-medium text-accent">{proposal.recommended_headline}</p>
        ) : null}

        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Estimated investment
          </p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {formatUsd(Number(proposal.estimated_value))}
          </p>
          {proposal.published_at ? (
            <p className="mt-2 text-xs text-text-muted">
              Published {new Date(proposal.published_at).toLocaleDateString()}
            </p>
          ) : null}
        </div>

        {proposal.description ? (
          <div className="prose prose-sm max-w-none text-text-secondary">
            <p className="whitespace-pre-wrap leading-relaxed">{proposal.description}</p>
          </div>
        ) : null}

        <Link
          href={clientPaths.dashboard(clientId)}
          className="inline-flex text-sm font-medium text-accent hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    </ModuleScaffold>
  );
}
