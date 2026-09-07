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
import { SCOPE_STATUSES, type ScopeStatus } from "@/lib/strategy/modules";
import type {
  CatalogPackageRow,
  CatalogServiceRow,
  ScopeRow,
} from "@/lib/strategy/types";

function strategyAction(action: string, input: object) {
  return postProposeAction("strategy", action, input);
}

const STATUS_LABEL: Record<ScopeStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  hold: "Hold",
  active: "Active",
};

export function ScopeBuilder({
  project,
  scopes,
  packages,
  services,
  prefill,
}: {
  project: {
    id: string;
    title: string;
    company: string;
    stage: string | null;
  };
  scopes: ScopeRow[];
  packages: CatalogPackageRow[];
  services: CatalogServiceRow[];
  prefill: { packageId: string | null; serviceIds: string[] };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"package" | "alacarte">("package");
  const [pkgId, setPkgId] = useState(prefill.packageId || packages[0]?.id || "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(prefill.serviceIds)
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [openScope, setOpenScope] = useState<string | null>(scopes[0]?.id ?? null);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  }

  const reusable = scopes.filter(
    (s) => s.status === "draft" || s.status === "accepted" || s.status === "active"
  );

  return (
    <Workspace>
      <PageHeader
        title="Engagement scope"
        subtitle={`${project.company} · ${project.title}. Confirm what this engagement includes before writing strategies.`}
        actions={
          <Button variant="ghost" onClick={() => router.push(workPaths.propose)}>
            All projects
          </Button>
        }
      />
      {msg ? <p className="text-[13px] text-text-secondary mb-4">{msg}</p> : null}

      {reusable.length > 0 ? (
        <div className="mb-8">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
            Reuse an existing scope
          </h3>
          <div className="space-y-2">
            {reusable.map((s) => (
              <Panel key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-medium text-text-primary">
                    {s.packageName || "À la carte"} · {STATUS_LABEL[s.status]}
                  </p>
                  <p className="text-[12px] text-text-muted">
                    {s.items.map((i) => i.serviceName || i.customName).filter(Boolean).join(", ") ||
                      "No items yet"}
                  </p>
                </div>
                <Button
                  onClick={() =>
                    router.push(workPaths.proposeScope(project.id, s.id))
                  }
                >
                  Continue
                </Button>
              </Panel>
            ))}
          </div>
        </div>
      ) : null}

      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
        New engagement scope
      </h3>
      <div className="flex gap-2 mb-4">
        <Button
          variant={mode === "package" ? "primary" : "secondary"}
          onClick={() => setMode("package")}
        >
          From package
        </Button>
        <Button
          variant={mode === "alacarte" ? "primary" : "secondary"}
          onClick={() => setMode("alacarte")}
        >
          À la carte
        </Button>
      </div>

      {mode === "package" ? (
        <Panel className="p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {packages.map((p) => (
              <label
                key={p.id}
                className={`rounded-md border px-3 py-3 cursor-pointer ${
                  pkgId === p.id ? "border-text-primary" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={pkgId === p.id}
                  onChange={() => setPkgId(p.id)}
                />
                <p className="text-[14px] font-semibold text-text-primary">{p.name}</p>
                <p className="text-[12px] text-text-secondary mt-1">
                  {p.description || p.timelineDescription || `${p.serviceIds.length} services`}
                </p>
              </label>
            ))}
          </div>
          {prefill.packageId ? (
            <p className="text-[12px] text-text-muted">
              This project already has a package on the deal — preselected.
            </p>
          ) : null}
          <Button
            disabled={pending || !pkgId}
            onClick={() =>
              start(async () => {
                const res = await strategyAction("createScopeFromPackage", {
                  projectId: project.id,
                  packageId: pkgId,
                });
                if (!res.ok || !res.scopeId) {
                  flash(res.error || "Could not create");
                  return;
                }
                router.push(workPaths.proposeScope(project.id, res.scopeId));
              })
            }
          >
            Create from package
          </Button>
        </Panel>
      ) : (
        <Panel className="p-4 space-y-4">
          {prefill.serviceIds.length ? (
            <p className="text-[12px] text-text-muted">
              Deal offerings are pre-checked. Creating a scope does not spawn playbook tasks.
            </p>
          ) : null}
          <div className="grid sm:grid-cols-2 gap-1.5">
            {services.map((s) => {
              const checked = selected.has(s.id);
              return (
                <label key={s.id} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (checked) next.delete(s.id);
                        else next.add(s.id);
                        return next;
                      });
                    }}
                  />
                  {s.name}
                </label>
              );
            })}
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await strategyAction("createScopeALaCarte", {
                  projectId: project.id,
                  serviceIds: [...selected],
                });
                if (!res.ok || !res.scopeId) {
                  flash(res.error || "Could not create");
                  return;
                }
                router.push(workPaths.proposeScope(project.id, res.scopeId));
              })
            }
          >
            Create à la carte
          </Button>
        </Panel>
      )}

      {scopes.length > 0 ? (
        <div className="mt-10">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
            All scopes on this project
          </h3>
          <div className="space-y-2">
            {scopes.map((s) => {
              const open = openScope === s.id;
              return (
                <Panel key={s.id}>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => setOpenScope(open ? null : s.id)}
                  >
                    <span className="text-[13px] font-semibold text-text-primary">
                      {s.packageName || "À la carte"}
                    </span>
                    <span className="text-[12px] text-text-muted">
                      {STATUS_LABEL[s.status]} · {s.items.length} items
                    </span>
                  </button>
                  {open ? (
                    <div className="border-t border-border px-4 py-3 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {SCOPE_STATUSES.map((st) => (
                          <Button
                            key={st}
                            variant={s.status === st ? "primary" : "ghost"}
                            disabled={pending}
                            onClick={() =>
                              start(async () => {
                                const res = await strategyAction("updateScopeStatus", {
                                  scopeId: s.id,
                                  projectId: project.id,
                                  status: st,
                                });
                                flash(res.ok ? "Status updated" : res.error || "Failed");
                                router.refresh();
                              })
                            }
                          >
                            {STATUS_LABEL[st]}
                          </Button>
                        ))}
                      </div>
                      <ol className="space-y-1">
                        {s.items.map((item, idx) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-2 text-[13px]"
                          >
                            <span>
                              {idx + 1}. {item.serviceName || item.customName}
                            </span>
                            <span className="flex gap-1">
                              {idx > 0 ? (
                                <Button
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={() =>
                                    start(async () => {
                                      const ids = s.items.map((i) => i.id);
                                      const swap = ids[idx - 1];
                                      ids[idx - 1] = ids[idx];
                                      ids[idx] = swap;
                                      await strategyAction("reorderScopeItems", {
                                        projectId: project.id,
                                        scopeId: s.id,
                                        orderedIds: ids,
                                      });
                                      router.refresh();
                                    })
                                  }
                                >
                                  Up
                                </Button>
                              ) : null}
                              <Button
                                variant="ghost"
                                disabled={pending}
                                onClick={() =>
                                  start(async () => {
                                    await strategyAction("removeScopeItem", {
                                      projectId: project.id,
                                      scopeId: s.id,
                                      itemId: item.id,
                                    });
                                    router.refresh();
                                  })
                                }
                              >
                                Remove
                              </Button>
                            </span>
                          </li>
                        ))}
                      </ol>
                      {s.steps.length ? (
                        <p className="text-[12px] text-text-muted">
                          Process: {s.steps.map((st) => st.title).join(" → ")}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="rounded-md border border-border bg-surface px-2 py-1.5 text-[13px]"
                          defaultValue=""
                          onChange={(e) => {
                            const serviceId = e.target.value;
                            if (!serviceId) return;
                            start(async () => {
                              await strategyAction("addScopeItem", {
                                projectId: project.id,
                                scopeId: s.id,
                                serviceId,
                              });
                              router.refresh();
                            });
                            e.target.value = "";
                          }}
                        >
                          <option value="">Add service…</option>
                          {services.map((svc) => (
                            <option key={svc.id} value={svc.id}>
                              {svc.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          onClick={() =>
                            router.push(workPaths.proposeScope(project.id, s.id))
                          }
                        >
                          Open strategies
                        </Button>
                        <Button
                          variant="danger"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const res = await strategyAction("deleteScope", {
                                projectId: project.id,
                                scopeId: s.id,
                              });
                              flash(res.ok ? "Scope deleted" : res.error || "Failed");
                              router.refresh();
                            })
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState>No engagement scopes on this project yet.</EmptyState>
        </div>
      )}
    </Workspace>
  );
}
