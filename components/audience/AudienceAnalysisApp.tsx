"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { postProposeAction } from "@/lib/propose/client-action";
import { ContextDocsPanel } from "@/components/content/ContextDocsPanel";
import { AudienceMixChart } from "@/components/audience/AudienceMixChart";
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
  PROFILE_FIELDS,
  PROFILE_FIELD_LABELS,
  pairIsFinalized,
  type AudienceSegment,
  type AudienceSource,
  type ProfileField,
} from "@/lib/audience/types";
import type { ContextDoc } from "@/lib/content/types";

function audienceAction(action: string, input: object) {
  return postProposeAction("audience", action, input);
}

export function AudienceAnalysisApp({
  project,
  docs,
  segments,
  sources,
  aiConfigured,
}: {
  project: { id: string; title: string; company: string };
  docs: ContextDoc[];
  segments: AudienceSegment[];
  sources: AudienceSource[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [openId, setOpenId] = useState<string | null>(segments[0]?.id ?? null);
  const [mergeKeep, setMergeKeep] = useState("");
  const [mergeDrop, setMergeDrop] = useState("");
  const activeDocs = docs.filter((d) => d.active);

  const sourcesBySeg = useMemo(() => {
    const map = new Map<string, AudienceSource[]>();
    for (const s of sources) {
      if (!s.segmentId) continue;
      const list = map.get(s.segmentId) ?? [];
      list.push(s);
      map.set(s.segmentId, list);
    }
    return map;
  }, [sources]);

  function flash(text: string) {
    setMsg(text);
  }

  async function generate(body: Record<string, unknown>) {
    setMsg(null);
    const res = await fetch("/api/audience/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, ...body }),
    });
    const json = await res.json();
    if (!json.ok) {
      if (json.code === "NO_DOCS") {
        flash(json.error);
      } else {
        flash(json.error || "Generation failed");
      }
      return json;
    }
    flash(json.unverified ? "Drafted as unverified inference" : "Drafted");
    router.refresh();
    return json;
  }

  return (
    <Workspace>
      <PageHeader
        title="Audience analysis"
        subtitle={`${project.company} · ${project.title}. Segments live on the project and feed every strategy that includes this module.`}
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
        generateNeeds="Generate segments from the research below. Tick unverified only if you have no documents."
      />
      {msg ? <p className="text-[13px] text-text-secondary mb-4">{msg}</p> : null}

      <Panel className="p-4 mb-6">
        <ContextDocsPanel projectId={project.id} docs={docs} />
      </Panel>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Button
          disabled={
            pending ||
            Boolean(busy) ||
            !aiConfigured ||
            (activeDocs.length === 0 && !unverified)
          }
          onClick={() =>
            start(async () => {
              setBusy("segments");
              await generate({ step: "segments", allowUnverified: unverified });
              setBusy(null);
            })
          }
        >
          {busy === "segments" ? "Generating…" : "Generate segments"}
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

      <AudienceMixChart segments={segments} />

      {segments.length === 0 ? (
        <EmptyState>No segments yet. Generate from the research above.</EmptyState>
      ) : (
        <div className="space-y-2">
          {segments.map((seg, idx) => {
            const open = openId === seg.id;
            const done = pairIsFinalized(seg);
            return (
              <Panel key={seg.id}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                  onClick={() => setOpenId(open ? null : seg.id)}
                >
                  <span className="text-[14px] font-semibold text-text-primary">
                    {seg.name}
                  </span>
                  <span className="text-[12px] text-text-muted">
                    {done
                      ? "Finalized"
                      : seg.accepted
                        ? "Accepted"
                        : "Draft"}
                    {seg.profile ? " · profile" : ""}
                  </span>
                </button>
                {open ? (
                  <SegmentEditor
                    projectId={project.id}
                    segment={seg}
                    sources={sourcesBySeg.get(seg.id) ?? []}
                    canMoveUp={idx > 0}
                    pending={pending || Boolean(busy)}
                    busy={busy}
                    allowUnverified={unverified}
                    aiConfigured={aiConfigured}
                    docsReady={activeDocs.length > 0 || unverified}
                    onBusy={setBusy}
                    onGenerate={generate}
                    onRefresh={() => router.refresh()}
                    orderedIds={segments.map((s) => s.id)}
                    start={start}
                    flash={flash}
                  />
                ) : null}
              </Panel>
            );
          })}
        </div>
      )}

      {segments.some(pairIsFinalized) ? (
        <div className="mt-10">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
            Finalized (client-visible)
          </h3>
          <div className="space-y-2">
            {segments.filter(pairIsFinalized).map((s) => (
              <Panel key={`fin-${s.id}`} className="px-4 py-3">
                <p className="text-[14px] font-semibold text-text-primary">{s.name}</p>
                <p className="text-[13px] text-text-secondary mt-1">
                  {s.demographicSummary || s.rationale}
                </p>
              </Panel>
            ))}
          </div>
        </div>
      ) : null}

      {segments.length >= 2 ? (
        <Panel className="mt-6 p-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Merge
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-[13px]"
              value={mergeKeep}
              onChange={(e) => setMergeKeep(e.target.value)}
            >
              <option value="">Keep…</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-[13px]"
              value={mergeDrop}
              onChange={(e) => setMergeDrop(e.target.value)}
            >
              <option value="">Fold in…</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={pending || !mergeKeep || !mergeDrop}
              onClick={() =>
                start(async () => {
                  const res = await audienceAction("mergeSegments", {
                    projectId: project.id,
                    keepId: mergeKeep,
                    dropId: mergeDrop,
                  });
                  flash(res.ok ? "Merged" : res.error || "Failed");
                  router.refresh();
                })
              }
            >
              Merge
            </Button>
          </div>
        </Panel>
      ) : null}
    </Workspace>
  );
}

function SegmentEditor({
  projectId,
  segment,
  sources,
  canMoveUp,
  pending,
  busy,
  allowUnverified,
  aiConfigured,
  docsReady,
  onBusy,
  onGenerate,
  onRefresh,
  orderedIds,
  start,
  flash,
}: {
  projectId: string;
  segment: AudienceSegment;
  sources: AudienceSource[];
  canMoveUp: boolean;
  pending: boolean;
  busy: string | null;
  allowUnverified: boolean;
  aiConfigured: boolean;
  docsReady: boolean;
  onBusy: (v: string | null) => void;
  onGenerate: (body: Record<string, unknown>) => Promise<any>;
  onRefresh: () => void;
  orderedIds: string[];
  start: (fn: () => Promise<void>) => void;
  flash: (t: string) => void;
}) {
  const [name, setName] = useState(segment.name);
  const [demo, setDemo] = useState(segment.demographicSummary);
  const [size, setSize] = useState(segment.sizeOrValue);
  const [rationale, setRationale] = useState(segment.rationale);
  const [splitName, setSplitName] = useState("");
  const [drafts, setDrafts] = useState<Record<ProfileField, string>>(() => ({
    pains: segment.profile?.pains ?? "",
    motivations: segment.profile?.motivations ?? "",
    channel_habits: segment.profile?.channelHabits ?? "",
    language_cues: segment.profile?.languageCues ?? "",
    objections: segment.profile?.objections ?? "",
    triggers: segment.profile?.triggers ?? "",
  }));

  const filenames = [...new Set(sources.map((s) => s.filename).filter(Boolean))];

  return (
    <div className="border-t border-border px-4 py-4 space-y-4">
      <label className="block text-[12px] text-text-secondary">
        Name
        <input
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block text-[12px] text-text-secondary">
        Who they are
        <textarea
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
          rows={2}
          value={demo}
          onChange={(e) => setDemo(e.target.value)}
        />
      </label>
      <label className="block text-[12px] text-text-secondary">
        Size or value
        <input
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />
      </label>
      <label className="block text-[12px] text-text-secondary">
        Why this cut
        <textarea
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
          rows={3}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
        />
      </label>
      {filenames.length ? (
        <p className="text-[12px] text-text-muted">
          Grounded in {filenames.join(", ")}
        </p>
      ) : (
        <p className="text-[12px] text-text-muted">No source docs linked.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await audienceAction("updateSegment", {
                projectId,
                segmentId: segment.id,
                patch: {
                  name,
                  demographicSummary: demo,
                  sizeOrValue: size,
                  rationale,
                },
              });
              flash(res.ok ? "Saved" : res.error || "Failed");
              onRefresh();
            })
          }
        >
          Save edits
        </Button>
        <Button
          variant={segment.accepted ? "primary" : "secondary"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await audienceAction("updateSegment", {
                projectId,
                segmentId: segment.id,
                patch: { accepted: !segment.accepted },
              });
              onRefresh();
            })
          }
        >
          {segment.accepted ? "Accepted" : "Accept"}
        </Button>
        <Button
          disabled={pending || Boolean(busy) || !segment.accepted || !aiConfigured || !docsReady}
          onClick={() =>
            start(async () => {
              onBusy(`profile-${segment.id}`);
              await onGenerate({ step: "profile", segmentId: segment.id, allowUnverified });
              onBusy(null);
            })
          }
        >
          {busy === `profile-${segment.id}`
            ? "Drafting profile…"
            : segment.profile
              ? "Regenerate profile"
              : "Generate profile"}
        </Button>
        <Button
          variant={pairIsFinalized(segment) ? "primary" : "secondary"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await audienceAction("finalizePair", {
                projectId,
                segmentId: segment.id,
                finalized: !pairIsFinalized(segment),
              });
              flash(res.ok ? (pairIsFinalized(segment) ? "Reopened" : "Finalized") : res.error || "Failed");
              onRefresh();
            })
          }
        >
          {pairIsFinalized(segment) ? "Un-finalize" : "Finalize pair"}
        </Button>
        {canMoveUp ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const ids = [...orderedIds];
                const i = ids.indexOf(segment.id);
                const swap = ids[i - 1];
                ids[i - 1] = ids[i];
                ids[i] = swap;
                await audienceAction("reorderSegments", { projectId, orderedIds: ids });
                onRefresh();
              })
            }
          >
            Move up
          </Button>
        ) : null}
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await audienceAction("deleteSegment", { projectId, segmentId: segment.id });
              onRefresh();
            })
          }
        >
          Delete
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="rounded-md border border-border bg-surface px-3 py-2 text-[13px]"
          placeholder="Split into…"
          value={splitName}
          onChange={(e) => setSplitName(e.target.value)}
        />
        <Button
          variant="ghost"
          disabled={pending || !splitName.trim()}
          onClick={() =>
            start(async () => {
              const res = await audienceAction("splitSegment", {
                projectId,
                segmentId: segment.id,
                newName: splitName,
              });
              flash(res.ok ? "Split" : res.error || "Failed");
              onRefresh();
            })
          }
        >
          Split
        </Button>
      </div>

      {segment.profile ? (
        <div className="space-y-3 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Insight profile
          </p>
          {PROFILE_FIELDS.map((field) => {
            const origin = segment.profile?.fieldMeta[field]?.origin ?? "inferred";
            return (
              <div key={field}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[12px] text-text-secondary">
                    {PROFILE_FIELD_LABELS[field]}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {origin === "sourced" ? "Sourced" : "Inferred"}
                  </span>
                </div>
                <textarea
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
                  rows={3}
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
                        await audienceAction("updateProfileField", {
                          projectId,
                          profileId: segment.profile!.id,
                          field,
                          value: drafts[field],
                        });
                        onRefresh();
                      })
                    }
                  >
                    Save field
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={pending || Boolean(busy) || !aiConfigured || !docsReady}
                    onClick={() =>
                      start(async () => {
                        onBusy(`field-${segment.id}-${field}`);
                        await onGenerate({
                          step: "field",
                          segmentId: segment.id,
                          field,
                          allowUnverified,
                        });
                        onBusy(null);
                      })
                    }
                  >
                    {busy === `field-${segment.id}-${field}` ? "…" : "Regenerate field"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[12px] text-text-muted">
          Accept this segment, then generate its insight profile.
        </p>
      )}
    </div>
  );
}
