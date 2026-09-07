"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { postProposeAction } from "@/lib/propose/client-action";
import { ContextDocsPanel } from "@/components/content/ContextDocsPanel";
import { ConnectionNotice } from "@/components/strategy/ConnectionNotice";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { Button, EmptyState, PageHeader, Panel } from "@/components/frappe-ui/primitives";
import { workPaths } from "@/lib/work/paths";
import {
  COMPETITOR_FIELDS,
  COMPETITOR_FIELD_LABELS,
  type CompetitionSynthesis,
  type Competitor,
  type CompetitorField,
} from "@/lib/competition/types";
import type { ContextDoc } from "@/lib/content/types";

function competitionAction(action: string, input: object) {
  return postProposeAction("competition", action, input);
}

export function CompetitionAnalysisApp({
  project,
  docs,
  competitors,
  synthesis,
  aiConfigured,
}: {
  project: { id: string; title: string; company: string };
  docs: ContextDoc[];
  competitors: Competitor[];
  synthesis: CompetitionSynthesis | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [openId, setOpenId] = useState<string | null>(competitors[0]?.id ?? null);
  const [gaps, setGaps] = useState(synthesis?.gapsAndOpportunities ?? "");
  const acceptedCount = competitors.filter((c) => c.accepted).length;

  useEffect(() => {
    setGaps(synthesis?.gapsAndOpportunities ?? "");
  }, [synthesis?.gapsAndOpportunities]);

  async function generate(body: Record<string, unknown>) {
    setMsg(null);
    const res = await fetch("/api/competition/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, ...body }),
    });
    const json = await res.json();
    if (!json.ok) {
      setMsg(json.error || "Generation failed");
      return json;
    }
    if (json.fetchError) setMsg(`Drafted. Site fetch: ${json.fetchError}`);
    else setMsg("Drafted");
    router.refresh();
    return json;
  }

  return (
    <Workspace>
      <PageHeader
        title="Competition analysis"
        subtitle={`${project.company} · ${project.title}. Shortlist competitors, enrich from their sites, then write the gap we can occupy.`}
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
        docsCount={docs.filter((d) => d.active).length}
        docsRequired={false}
        generateNeeds="AI enriches a competitor site. Research docs are optional. Accept at least one competitor, then generate the gaps note."
      />
      {msg ? <p className="text-[13px] text-text-secondary mb-4">{msg}</p> : null}

      <Panel className="p-4 mb-6">
        <ContextDocsPanel projectId={project.id} docs={docs} />
      </Panel>

      <Panel className="p-4 mb-6 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Add a competitor
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[12px] text-text-secondary">
            Name
            <input
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-[12px] text-text-secondary">
            Website (optional)
            <input
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
            />
          </label>
        </div>
        <label className="block text-[12px] text-text-secondary">
          Notes (optional)
          <input
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <Button
          disabled={pending || !name.trim()}
          onClick={() =>
            start(async () => {
              const res = await competitionAction("addCompetitor", {
                projectId: project.id,
                name,
                url,
                notes,
              });
              setMsg(res.ok ? "Added" : res.error || "Failed");
              if (res.ok) {
                setName("");
                setUrl("");
                setNotes("");
              }
              router.refresh();
            })
          }
        >
          Add to shortlist
        </Button>
      </Panel>

      {competitors.length === 0 ? (
        <EmptyState>Add a name (and URL if you have it), then enrich.</EmptyState>
      ) : (
        <div className="space-y-2 mb-6">
          {competitors.map((c) => {
            const open = openId === c.id;
            return (
              <Panel key={c.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="text-left min-w-0"
                    onClick={() => setOpenId(open ? null : c.id)}
                  >
                    <p className="text-[14px] font-medium text-text-primary">{c.name}</p>
                    <p className="text-[12px] text-text-muted">
                      {c.accepted ? "Accepted" : "Shortlist"}
                      {c.url ? ` · ${c.url}` : ""}
                      {c.fetchError ? ` · fetch: ${c.fetchError}` : ""}
                    </p>
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant={c.accepted ? "primary" : "ghost"}
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          await competitionAction("setCompetitorAccepted", {
                            projectId: project.id,
                            competitorId: c.id,
                            accepted: !c.accepted,
                          });
                          router.refresh();
                        })
                      }
                    >
                      {c.accepted ? "Accepted" : "Accept"}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={pending || Boolean(busy) || !aiConfigured}
                      onClick={() =>
                        start(async () => {
                          setBusy(c.id);
                          await generate({ step: "enrich", competitorId: c.id });
                          setBusy(null);
                          setOpenId(c.id);
                        })
                      }
                    >
                      {busy === c.id ? "Enriching…" : "Enrich"}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          await competitionAction("deleteCompetitor", {
                            projectId: project.id,
                            competitorId: c.id,
                          });
                          router.refresh();
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                {open ? (
                  <div className="mt-3 space-y-3">
                    {COMPETITOR_FIELDS.map((field) => (
                      <CompetitorFieldEditor
                        key={`${c.id}-${field}`}
                        projectId={project.id}
                        competitor={c}
                        field={field}
                        pending={pending}
                        onSaved={(text) => setMsg(text)}
                      />
                    ))}
                  </div>
                ) : c.positioningSummary ? (
                  <p className="text-[13px] text-text-secondary mt-2">{c.positioningSummary}</p>
                ) : null}
              </Panel>
            );
          })}
        </div>
      )}

      <Panel className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Gaps we can occupy
            {synthesis?.status === "finalized" ? " · Finalized" : " · Draft"}
          </p>
          <Button
            variant={synthesis?.status === "finalized" ? "primary" : "secondary"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await competitionAction("finalizeCompetition", {
                  projectId: project.id,
                  finalized: synthesis?.status !== "finalized",
                });
                setMsg(res.ok ? (synthesis?.status === "finalized" ? "Reopened" : "Finalized") : res.error || "Failed");
                router.refresh();
              })
            }
          >
            {synthesis?.status === "finalized" ? "Un-finalize" : "Finalize"}
          </Button>
        </div>
        <p className="text-[12px] text-text-muted">
          {acceptedCount} accepted competitor{acceptedCount === 1 ? "" : "s"}. Accept the set, then generate.
        </p>
        <textarea
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
          rows={8}
          value={gaps}
          onChange={(e) => setGaps(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending || Boolean(busy) || acceptedCount === 0 || !aiConfigured}
            onClick={() =>
              start(async () => {
                setBusy("synthesis");
                await generate({ step: "synthesis" });
                setBusy(null);
              })
            }
          >
            {busy === "synthesis" ? "Generating…" : "Generate gaps note"}
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await competitionAction("updateCompetitionSynthesis", {
                  projectId: project.id,
                  text: gaps,
                });
                setMsg(res.ok ? "Saved" : res.error || "Failed");
                router.refresh();
              })
            }
          >
            Save edits
          </Button>
        </div>
      </Panel>
    </Workspace>
  );
}

function CompetitorFieldEditor({
  projectId,
  competitor,
  field,
  pending,
  onSaved,
}: {
  projectId: string;
  competitor: Competitor;
  field: CompetitorField;
  pending: boolean;
  onSaved: (msg: string) => void;
}) {
  const router = useRouter();
  const [pendingLocal, start] = useTransition();
  const initial =
    field === "positioning_summary"
      ? competitor.positioningSummary
      : field === "messaging_notes"
        ? competitor.messagingNotes
        : field === "channels_notes"
          ? competitor.channelsNotes
          : field === "strengths"
            ? competitor.strengths
            : competitor.weaknesses;
  const [value, setValue] = useState(initial);
  const origin = competitor.fieldMeta[field]?.origin ?? "inferred";

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[12px] text-text-secondary">{COMPETITOR_FIELD_LABELS[field]}</span>
        <span className="text-[11px] text-text-muted">
          {origin === "sourced" ? "Sourced" : "Inferred"}
        </span>
      </div>
      <textarea
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button
        variant="ghost"
        disabled={pending || pendingLocal}
        onClick={() =>
          start(async () => {
            const res = await competitionAction("updateCompetitorField", {
              projectId,
              competitorId: competitor.id,
              field,
              value,
            });
            onSaved(res.ok ? "Saved" : res.error || "Failed");
            router.refresh();
          })
        }
      >
        Save
      </Button>
    </div>
  );
}
