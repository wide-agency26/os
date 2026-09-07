"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { postProposeAction } from "@/lib/propose/client-action";
import { ConnectionNotice } from "@/components/strategy/ConnectionNotice";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { Button, EmptyState, PageHeader, Panel } from "@/components/frappe-ui/primitives";
import { workPaths } from "@/lib/work/paths";
import type { PositioningGate } from "@/lib/positioning/types";
import type { StrategyPositioning } from "@/lib/positioning/types";

function positioningAction(action: string, input: object) {
  return postProposeAction("positioning", action, input);
}

export function PositioningApp({
  project,
  scopeId,
  strategyId,
  strategyLabel,
  gate,
  positioning,
  aiConfigured,
}: {
  project: { id: string; title: string; company: string };
  scopeId: string;
  strategyId: string;
  strategyLabel: string;
  gate: PositioningGate;
  positioning: StrategyPositioning | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [statement, setStatement] = useState(positioning?.statement ?? "");
  const [rationale, setRationale] = useState(positioning?.rationale ?? "");

  useEffect(() => {
    setStatement(positioning?.statement ?? "");
    setRationale(positioning?.rationale ?? "");
  }, [positioning]);

  async function generate() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/positioning/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          scopeId,
          strategyId,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMsg(json.error || "Generation failed");
        return;
      }
      setMsg(
        json.inputs?.length
          ? `Drafted from ${json.inputs.join(", ")}`
          : "Drafted"
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Workspace>
      <PageHeader
        title="Synthesis & positioning"
        subtitle={`${project.company} · ${strategyLabel}. One statement for this strategy — not shared with others on the project.`}
        actions={
          <Link
            href={workPaths.proposeBuilder(project.id, scopeId, strategyId)}
            className="text-[13px] text-text-muted hover:text-text-primary"
          >
            Back to builder
          </Link>
        }
      />
      <ConnectionNotice
        aiConfigured={aiConfigured}
        docsCount={0}
        docsRequired={false}
        generateNeeds="Generate reads finalized Audience (required). Competition and Market deepen the draft when they are attached and finalized."
      />
      {msg ? <p className="text-[13px] text-text-secondary mb-4">{msg}</p> : null}

      <Panel className="p-4 mb-5 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Inputs for this draft
        </p>
        <ul className="space-y-2">
          {gate.chips.map((chip) => (
            <li key={chip.moduleKey} className="text-[13px]">
              <span className="font-medium text-text-primary">{chip.label}</span>
              <span className="text-text-muted">
                {chip.optional ? " · optional" : " · required"}
                {chip.finalized ? " · ready" : " · not finalized"}
              </span>
              <p className="text-[12px] text-text-secondary mt-0.5">{chip.note}</p>
            </li>
          ))}
        </ul>
        {!gate.canGenerate && gate.reason ? (
          <p className="text-[13px] text-text-secondary border border-dashed border-border rounded-md px-3 py-2">
            {gate.reason}
          </p>
        ) : null}
        <Button disabled={!gate.canGenerate || pending || busy || !aiConfigured} onClick={() => start(generate)}>
          {busy
            ? "Generating…"
            : positioning
              ? "Regenerate"
              : "Generate"}
        </Button>
      </Panel>

      {!positioning ? (
        <EmptyState>
          Finalize Audience Analysis, then generate a positioning statement for this
          strategy. Competition and Market, once finalized, will deepen the next draft.
        </EmptyState>
      ) : (
        <Panel className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {positioning.status === "finalized" ? "Finalized" : "Draft"}
              {positioning.aiGenerated ? " · AI" : " · edited"}
            </p>
            <Button
              variant={positioning.status === "finalized" ? "primary" : "secondary"}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await positioningAction("finalizePositioning", {
                    projectId: project.id,
                    scopeId,
                    strategyId,
                    finalized: positioning.status !== "finalized",
                  });
                  setMsg(
                    res.ok
                      ? positioning.status === "finalized"
                        ? "Reopened"
                        : "Finalized"
                      : res.error || "Failed"
                  );
                  router.refresh();
                })
              }
            >
              {positioning.status === "finalized" ? "Un-finalize" : "Finalize"}
            </Button>
          </div>

          <label className="block text-[12px] text-text-secondary">
            Positioning statement
            <textarea
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
              rows={3}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
            />
          </label>
          <label className="block text-[12px] text-text-secondary">
            Rationale
            <textarea
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
              rows={8}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
          </label>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await positioningAction("updatePositioning", {
                  projectId: project.id,
                  scopeId,
                  strategyId,
                  statement,
                  rationale,
                });
                setMsg(res.ok ? "Saved" : res.error || "Failed");
                router.refresh();
              })
            }
          >
            Save edits
          </Button>
        </Panel>
      )}
    </Workspace>
  );
}
