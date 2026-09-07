import Link from "next/link";
import { redirect } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { StrategyNav } from "@/components/strategy/StrategyNav";
import { EmptyState, Panel } from "@/components/frappe-ui/primitives";
import { loadProjectForPropose, loadScope, loadStrategy } from "@/lib/strategy/load";
import { loadCiBrandText } from "@/lib/content/ci-context";
import { workPaths } from "@/lib/work/paths";
import type { StrategyType } from "@/lib/strategy/modules";
import { requireStaffPage } from "@/lib/auth/staff-session";

export default async function StrategyThemePage({
  params,
}: {
  params: Promise<{ projectId: string; scopeId: string; strategyId: string }>;
}) {
  const { projectId, scopeId, strategyId } = await params;
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;
  const { supabase } = session;

  const [project, scope, strategy, ci] = await Promise.all([
    loadProjectForPropose(supabase, projectId),
    loadScope(supabase, scopeId),
    loadStrategy(supabase, strategyId),
    loadCiBrandText(supabase, projectId),
  ]);
  if (!project || !scope || !strategy || strategy.scopeId !== scopeId) {
    redirect(workPaths.proposeProject(projectId));
  }

  const published = ci?.status === "published" && ci.slug;

  return (
    <Workspace>
      <StrategyNav
        projectId={projectId}
        scopeId={scopeId}
        strategyId={strategyId}
        strategyType={strategy.strategyType as StrategyType}
        active="theme"
        company={project.company}
      />
      {!ci ? (
        <EmptyState>
          No CI guideline on this project yet. Theme copy will pull in once a
          guideline exists.
        </EmptyState>
      ) : (
        <Panel className="p-5 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-text-primary">{ci.label}</p>
              <p className="text-[12px] text-text-muted">
                Status: {ci.status || "draft"}
                {ci.slug ? ` · /g/${ci.slug}` : ""}
              </p>
            </div>
            {published ? (
              <Link href={`/g/${ci.slug}`} className="text-[13px] font-medium text-blue-700">
                Open published guideline
              </Link>
            ) : (
              <Link
                href={workPaths.projectCi(projectId)}
                className="text-[13px] font-medium text-blue-700"
              >
                Open CI Builder
              </Link>
            )}
          </div>
          {ci.text ? (
            <pre className="whitespace-pre-wrap text-[13px] text-text-secondary max-h-[480px] overflow-y-auto">
              {ci.text}
            </pre>
          ) : (
            <p className="text-[13px] text-text-muted">Guideline exists but has no copy yet.</p>
          )}
        </Panel>
      )}
    </Workspace>
  );
}
