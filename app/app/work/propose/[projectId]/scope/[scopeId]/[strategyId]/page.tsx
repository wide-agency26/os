import { redirect } from "next/navigation";
import { workPaths } from "@/lib/work/paths";

export default async function StrategyIndexRedirect({
  params,
}: {
  params: Promise<{ projectId: string; scopeId: string; strategyId: string }>;
}) {
  const { projectId, scopeId, strategyId } = await params;
  redirect(workPaths.proposeBuilder(projectId, scopeId, strategyId));
}
