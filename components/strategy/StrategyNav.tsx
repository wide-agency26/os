"use client";

import Link from "next/link";
import { workPaths } from "@/lib/work/paths";
import { STRATEGY_TYPE_LABELS, type StrategyType } from "@/lib/strategy/modules";

const TABS = [
  { id: "builder", label: "Builder" },
  { id: "context", label: "Context" },
  { id: "theme", label: "Theme" },
  { id: "share", label: "Share" },
] as const;

export function StrategyNav({
  projectId,
  scopeId,
  strategyId,
  strategyType,
  active,
  company,
}: {
  projectId: string;
  scopeId: string;
  strategyId: string;
  strategyType: StrategyType;
  active: (typeof TABS)[number]["id"];
  company: string;
}) {
  const href = {
    builder: workPaths.proposeBuilder(projectId, scopeId, strategyId),
    context: workPaths.proposeContext(projectId, scopeId, strategyId),
    theme: workPaths.proposeTheme(projectId, scopeId, strategyId),
    share: workPaths.proposeShare(projectId, scopeId, strategyId),
  };

  return (
    <div className="mb-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {company}
      </p>
      <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight mt-1">
        {STRATEGY_TYPE_LABELS[strategyType]}
      </h2>
      <div className="flex flex-wrap gap-1 mt-4 border-b border-border">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={href[tab.id]}
            className={`px-3 py-2 text-[13px] font-medium -mb-px border-b-2 ${
              active === tab.id
                ? "border-text-primary text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <p className="mt-3">
        <Link
          href={workPaths.proposeScope(projectId, scopeId)}
          className="text-[12px] text-text-muted hover:text-text-primary"
        >
          ← All strategies on this scope
        </Link>
      </p>
    </div>
  );
}
