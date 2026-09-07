"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postProposeAction } from "@/lib/propose/client-action";
import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  Button,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/frappe-ui/primitives";
import { workPaths } from "@/lib/work/paths";
import {
  STRATEGY_TYPES,
  STRATEGY_TYPE_LABELS,
  type StrategyType,
} from "@/lib/strategy/modules";
import type {
  CatalogServiceRow,
  ScopeRow,
  StrategyRow,
} from "@/lib/strategy/types";

function strategyAction(action: string, input: object) {
  return postProposeAction("strategy", action, input);
}

export function StrategyList({
  project,
  scope,
  strategies,
  typeServices,
  services,
}: {
  project: { id: string; title: string; company: string };
  scope: ScopeRow;
  strategies: StrategyRow[];
  typeServices: Record<string, string[]>;
  services: CatalogServiceRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<StrategyType>("brand");
  const [msg, setMsg] = useState<string | null>(null);
  const names = new Map(services.map((s) => [s.id, s.name]));
  const mapped = (typeServices[type] ?? [])
    .map((id) => names.get(id))
    .filter(Boolean);

  return (
    <Workspace>
      <PageHeader
        title="Strategies"
        subtitle={`${project.company} · ${scope.packageName || "À la carte"} engagement scope`}
        actions={
          <Button
            variant="ghost"
            onClick={() => router.push(workPaths.proposeProject(project.id))}
          >
            Back to scope
          </Button>
        }
      />
      {msg ? <p className="text-[13px] text-text-secondary mb-4">{msg}</p> : null}

      {strategies.length === 0 ? (
        <EmptyState>No strategies yet. Pick a type below — Create opens Builder.</EmptyState>
      ) : (
        <div className="space-y-2 mb-8">
          {strategies.map((s) => (
            <Panel
              key={s.id}
              className="px-4 py-3 flex items-center justify-between gap-3"
            >
              <button
                type="button"
                className="text-left min-w-0"
                onClick={() =>
                  router.push(
                    workPaths.proposeBuilder(project.id, scope.id, s.id)
                  )
                }
              >
                <p className="text-[14px] font-medium text-text-primary">
                  {STRATEGY_TYPE_LABELS[s.strategyType]}
                </p>
                <p className="text-[12px] text-text-muted">
                  {s.status.replace("_", " ")} · {s.modules.length} modules
                </p>
              </button>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await strategyAction("deleteStrategy", {
                      projectId: project.id,
                      scopeId: scope.id,
                      strategyId: s.id,
                    });
                    setMsg(res.ok ? "Removed" : res.error || "Failed");
                    router.refresh();
                  })
                }
              >
                Remove
              </Button>
            </Panel>
          ))}
        </div>
      )}

      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
        New strategy
      </h3>
      <Panel className="p-4 space-y-4">
        <label className="block text-[12px] text-text-secondary">
          Type
          <select
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
            value={type}
            onChange={(e) => setType(e.target.value as StrategyType)}
          >
            {STRATEGY_TYPES.map((t) => (
              <option key={t} value={t}>
                {STRATEGY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[12px] text-text-muted">
          Composes playbooks: {mapped.join(", ") || "none mapped yet"}
        </p>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await strategyAction("createStrategy", {
                projectId: project.id,
                scopeId: scope.id,
                strategyType: type,
              });
              if (!res.ok || !res.strategyId) {
                setMsg(res.error || "Could not create");
                return;
              }
              router.push(
                workPaths.proposeBuilder(project.id, scope.id, res.strategyId)
              );
            })
          }
        >
          Create and open builder
        </Button>
      </Panel>
    </Workspace>
  );
}
