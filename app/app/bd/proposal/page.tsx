import { ProposalHubLanding } from "@/components/bd/ProposalHubLanding";

export default async function ProposalHubPage({
  searchParams,
}: {
  searchParams: Promise<{ bd?: string }>;
}) {
  const sp = await searchParams;
  return <ProposalHubLanding bdRecordId={sp.bd || null} />;
}
