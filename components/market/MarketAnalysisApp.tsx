"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { postProposeAction } from "@/lib/propose/client-action";
import { ContextDocsPanel } from "@/components/content/ContextDocsPanel";
import { ConnectionNotice } from "@/components/strategy/ConnectionNotice";
import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  Button,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/frappe-ui/primitives";
import { workPaths } from "@/lib/work/paths";
import {
  MARKET_FIELDS,
  MARKET_FIELD_LABELS,
  type MarketAnalysis,
  type MarketField,
} from "@/lib/market/types";
import type { ContextDoc } from "@/lib/content/types";

function marketAction(action: string, input: object) {
  return postProposeAction("market", action, input);
}

export function MarketAnalysisApp({
  project,
  docs,
  analysis,
  aiConfigured,
}: {
  project: { id: string; title: string; company: string; industry: string | null };
  docs: ContextDoc[];
  analysis: MarketAnalysis | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [category, setCategory] = useState(
    analysis?.category || project.industry || ""
  );
  const [drafts, setDrafts] = useState<Record<MarketField, string>>({
    size_notes: analysis?.sizeNotes ?? "",
    trend_notes: analysis?.trendNotes ?? "",
    timing_notes: analysis?.timingNotes ?? "",
    risk_notes: analysis?.riskNotes ?? "",
  });
  const activeDocs = docs.filter((d) => d.active);
  const crmIndustry = (project.industry || "").trim();
  const fromCrm = Boolean(crmIndustry) && category.trim() === crmIndustry;

  useEffect(() => {
    setDrafts({
      size_notes: analysis?.sizeNotes ?? "",
      trend_notes: analysis?.trendNotes ?? "",
      timing_notes: analysis?.timingNotes ?? "",
      risk_notes: analysis?.riskNotes ?? "",
    });
    if (analysis?.category) setCategory(analysis.category);
  }, [analysis]);

  async function generate(body: Record<string, unknown>) {
    setMsg(null);
    const res = await fetch("/api/market/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        category,
        allowUnverified: unverified,
        ...body,
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      setMsg(json.error || "Generation failed");
      return json;
    }
    setMsg(json.unverified ? "Drafted as unverified inference" : "Drafted");
    router.refresh();
    return json;
  }

  return (
    <Workspace>
      <PageHeader
        title="Market analysis"
        subtitle={`${project.company} · ${project.title}. One picture per project — category size, trends, timing, and risk.`}
        actions={
          <Link
            href={workPaths.proposeProject(project.id)}
            className="text-[13px] text-text-muted hover:text-text-primary"
          >
            Back to scope
          </Link>
        }
      />
      <ConnectionNotice
        aiConfigured={aiConfigured}
        docsCount={activeDocs.length}
        docsRequired={!unverified}
        generateNeeds="Confirm the category, then generate. Tick unverified only if you have no documents."
      />
      {msg ? <p className="text-[13px] text-text-secondary mb-4">{msg}</p> : null}

      <Panel className="p-4 mb-6">
        <ContextDocsPanel projectId={project.id} docs={docs} />
      </Panel>

      <Panel className="p-4 mb-5 space-y-3">
        <label className="block text-[12px] text-text-secondary">
          Category / industry
          <input
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Accounting, DACH tax advisory"
          />
        </label>
        <p className="text-[12px] text-text-muted">
          {fromCrm
            ? `Pre-filled from the CRM company record (${crmIndustry}).`
            : crmIndustry
              ? `CRM industry is “${crmIndustry}” — edit freely, then save.`
              : "No industry on the CRM company. Set one here, or add it on the company record."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            disabled={pending || !category.trim()}
            onClick={() =>
              start(async () => {
                const res = await marketAction("upsertMarketCategory", {
                  projectId: project.id,
                  category,
                });
                setMsg(res.ok ? "Category saved" : res.error || "Failed");
                router.refresh();
              })
            }
          >
            Save category
          </Button>
          <Button
            disabled={
              pending ||
              Boolean(busy) ||
              !category.trim() ||
              !aiConfigured ||
              (activeDocs.length === 0 && !unverified)
            }
            onClick={() =>
              start(async () => {
                setBusy("draft");
                await generate({ step: "draft" });
                setBusy(null);
              })
            }
          >
            {busy === "draft"
              ? "Generating…"
              : analysis
                ? "Regenerate all sections"
                : "Generate"}
          </Button>
          <label className="text-[12px] text-text-secondary inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={unverified}
              onChange={(e) => setUnverified(e.target.checked)}
            />
            Allow unverified (no docs)
          </label>
          {activeDocs.length === 0 ? (
            <span className="text-[12px] text-text-muted">
              Upload research first, or tick unverified to proceed anyway.
            </span>
          ) : (
            <span className="text-[12px] text-text-muted">
              {activeDocs.length} active source{activeDocs.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </Panel>

      {!analysis ? (
        <EmptyState>
          Confirm the category, then generate size, trends, timing, and risk from
          the research.
        </EmptyState>
      ) : (
        <Panel className="p-4 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {analysis.status === "finalized" ? "Finalized" : "Draft"}
              {analysis.aiGenerated ? " · AI" : " · edited"}
            </p>
            <Button
              variant={analysis.status === "finalized" ? "primary" : "secondary"}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await marketAction("finalizeMarket", {
                    projectId: project.id,
                    finalized: analysis.status !== "finalized",
                  });
                  setMsg(
                    res.ok
                      ? analysis.status === "finalized"
                        ? "Reopened"
                        : "Finalized"
                      : res.error || "Failed"
                  );
                  router.refresh();
                })
              }
            >
              {analysis.status === "finalized" ? "Un-finalize" : "Finalize"}
            </Button>
          </div>

          {MARKET_FIELDS.map((field) => {
            const origin = analysis.fieldMeta[field]?.origin ?? "inferred";
            return (
              <div key={field}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[12px] text-text-secondary">
                    {MARKET_FIELD_LABELS[field]}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {origin === "sourced" ? "Sourced" : "Inferred"}
                  </span>
                </div>
                <textarea
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
                  rows={4}
                  value={drafts[field]}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [field]: e.target.value }))
                  }
                />
                <div className="flex gap-2 mt-1">
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await marketAction("updateMarketField", {
                          projectId: project.id,
                          field,
                          value: drafts[field],
                        });
                        setMsg(res.ok ? "Saved" : res.error || "Failed");
                        router.refresh();
                      })
                    }
                  >
                    Save section
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={
                      pending ||
                      Boolean(busy) ||
                      !aiConfigured ||
                      (activeDocs.length === 0 && !unverified)
                    }
                    onClick={() =>
                      start(async () => {
                        setBusy(`field-${field}`);
                        await generate({ step: "field", field });
                        setBusy(null);
                      })
                    }
                  >
                    {busy === `field-${field}` ? "…" : "Regenerate section"}
                  </Button>
                </div>
              </div>
            );
          })}
        </Panel>
      )}
    </Workspace>
  );
}
