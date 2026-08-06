"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import { EmailSourceIcon, GateIcon } from "@/components/pm/PmBadges";
import { PM_ICONS } from "@/lib/pm/icons";
import {
  approveAllPending,
  approveReviewItem,
  discardReviewItem,
  ingestNoteForReview,
  mergeReviewIntoTask,
} from "@/app/actions/pm-review";

type Props = { projectId: string };

function parseSource(ref: string | null): any {
  if (!ref) return {};
  try {
    return JSON.parse(ref);
  } catch {
    return { raw: ref };
  }
}

export function ProjectReviewQueueClient({ projectId }: Props) {
  const [project, setProject] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [openTasks, setOpenTasks] = useState<any[]>([]);
  const [paste, setPaste] = useState({ subject: "", body: "" });
  const [edits, setEdits] = useState<Record<string, { title: string; description: string }>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: proj } = await (supabase as any)
      .from("projects")
      .select(`id, title, pm_inbound_email, client:client_id ( company, name )`)
      .eq("id", projectId)
      .single();
    setProject(proj);

    const { data: queue } = await (supabase as any)
      .from("task_review_queue")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setItems(queue || []);

    const map: Record<string, { title: string; description: string }> = {};
    for (const q of queue || []) {
      map[q.id] = {
        title: q.proposed_title,
        description: q.proposed_description || "",
      };
    }
    setEdits(map);

    const { data: tasks } = await (supabase as any)
      .from("pm_tasks")
      .select("id, title, status")
      .eq("project_id", projectId)
      .in("status", ["todo", "in_progress", "blocked"])
      .order("title");
    setOpenTasks(tasks || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const highVolumeBatches = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const src = parseSource(item.source_ref);
      if (src.highVolume && src.batchId) set.add(src.batchId);
    }
    return set;
  }, [items]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; created?: number }>) => {
    setMessage("");
    startTransition(async () => {
      const res = await fn();
      setMessage(
        res.ok
          ? res.created != null
            ? `Done (${res.created}).`
            : "Done."
          : res.error || "Failed"
      );
      await load();
    });
  };

  if (loading) {
    return <div className="text-sm text-gray-500 p-6">Loading review queue…</div>;
  }

  const Inbox = PM_ICONS.pendingReview;

  return (
    <ProjectPmShell
      projectId={projectId}
      title={project?.title || "Project"}
      clientLabel={project?.client?.company || project?.client?.name}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Review queue
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Consent gate for email / notes → tasks. Nothing appears on the board
            until you approve.
          </p>
          {project?.pm_inbound_email ? (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <EmailSourceIcon />
              {project.pm_inbound_email}
              <Link
                href="/app/settings/integrations"
                className="underline ml-1"
              >
                manage
              </Link>
            </p>
          ) : (
            <p className="text-xs text-amber-800 mt-1">
              No inbound alias yet —{" "}
              <Link href="/app/settings/integrations" className="underline">
                set one in Integrations
              </Link>
              , or paste below.
            </p>
          )}
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveAllPending(projectId))}
            className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 disabled:opacity-50"
          >
            Approve all ({items.length})
          </button>
        ) : null}
      </div>

      {message ? <p className="text-sm text-gray-600 mb-3">{message}</p> : null}

      {highVolumeBatches.size > 0 ? (
        <div className="mb-4 border border-amber-200 bg-amber-50 text-amber-950 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
          <GateIcon />
          <span>
            High-volume batch flagged (&gt;5 proposals from one source). Likely a
            status dump — scrutinize before approving.
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg px-4 py-8 text-center">
              Queue empty. Forward mail to the project alias or paste a note.
            </p>
          ) : (
            items.map((item) => {
              const src = parseSource(item.source_ref);
              const edit = edits[item.id] || {
                title: item.proposed_title,
                description: item.proposed_description || "",
              };
              return (
                <article
                  key={item.id}
                  className={`border rounded-lg p-3 ${
                    src.highVolume
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <EmailSourceIcon />
                    {src.type || "source"}
                    {src.subject ? ` · ${src.subject}` : ""}
                    {src.from ? ` · from ${src.from}` : ""}
                  </div>
                  <input
                    className="w-full text-sm font-medium border-b border-transparent focus:border-gray-300 outline-none bg-transparent mb-1"
                    value={edit.title}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [item.id]: { ...edit, title: e.target.value },
                      }))
                    }
                  />
                  <textarea
                    className="w-full text-sm text-gray-600 border border-gray-100 rounded p-2 min-h-[4rem]"
                    value={edit.description}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [item.id]: { ...edit, description: e.target.value },
                      }))
                    }
                  />
                  {item.suggested_match_task_id ? (
                    <p className="text-xs text-amber-900 mt-2">
                      Possible duplicate of an open task — prefer Merge.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs bg-gray-900 text-white rounded px-2 py-1"
                      onClick={() =>
                        run(() =>
                          approveReviewItem(item.id, {
                            title: edit.title,
                            description: edit.description,
                          })
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs border border-gray-300 rounded px-2 py-1"
                      onClick={() => run(() => discardReviewItem(item.id))}
                    >
                      Discard
                    </button>
                    <select
                      className="text-xs border border-gray-200 rounded px-1 py-1 max-w-[14rem]"
                      defaultValue=""
                      disabled={pending}
                      onChange={(e) => {
                        const tid = e.target.value;
                        if (!tid) return;
                        run(() => mergeReviewIntoTask(item.id, tid));
                      }}
                    >
                      <option value="">Merge into…</option>
                      {openTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  {src.bodyPreview ? (
                    <details className="mt-2 text-xs text-gray-500">
                      <summary className="cursor-pointer">Source preview</summary>
                      <pre className="mt-1 whitespace-pre-wrap bg-gray-50 rounded p-2 max-h-40 overflow-auto">
                        {src.bodyPreview}
                      </pre>
                    </details>
                  ) : null}
                </article>
              );
            })
          )}
        </section>

        <aside className="lg:col-span-2 border border-gray-200 rounded-lg p-4 h-fit">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Paste email / notes</h3>
          <p className="text-xs text-gray-500 mb-3">
            Same path as webhook ingest — proposals only, never auto-created tasks.
          </p>
          <input
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mb-2"
            placeholder="Subject (optional)"
            value={paste.subject}
            onChange={(e) => setPaste((p) => ({ ...p, subject: e.target.value }))}
          />
          <textarea
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm min-h-[10rem] mb-2"
            placeholder="Paste the email body or meeting notes…"
            value={paste.body}
            onChange={(e) => setPaste((p) => ({ ...p, body: e.target.value }))}
          />
          <button
            type="button"
            disabled={pending || !paste.body.trim()}
            className="w-full text-sm bg-gray-900 text-white rounded px-3 py-1.5 disabled:opacity-50"
            onClick={() =>
              run(async () => {
                const res = await ingestNoteForReview(projectId, paste);
                if (res.ok) setPaste({ subject: "", body: "" });
                return res;
              })
            }
          >
            Parse into review queue
          </button>
        </aside>
      </div>
    </ProjectPmShell>
  );
}
