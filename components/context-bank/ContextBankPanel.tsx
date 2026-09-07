"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  addContextNote,
  runContextDigest,
  setContextEntryStatus,
  updateContextEntry,
} from "@/app/actions/context-bank";
import type { ContextDigest, ContextEntry } from "@/lib/context-bank/types";
import { CONTEXT_TYPE_LABELS } from "@/lib/context-bank/types";

type ProjectOption = { id: string; title: string };

function typeLabel(type: string) {
  return CONTEXT_TYPE_LABELS[type] || type;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContextBankPanel({
  companyId,
  projectId,
  projects = [],
}: {
  companyId: string;
  projectId?: string | null;
  projects?: ProjectOption[];
}) {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [digest, setDigest] = useState<ContextDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [entryType, setEntryType] = useState("");
  const [filterProject, setFilterProject] = useState(projectId || "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const [noteType, setNoteType] = useState("note");
  const [noteProject, setNoteProject] = useState(projectId || "");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>(projects);

  const lockedProject = Boolean(projectId);

  useEffect(() => {
    setProjectOptions(projects);
  }, [projects]);

  useEffect(() => {
    if (lockedProject || projects.length) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("id, title")
        .eq("client_id", companyId)
        .order("title");
      if (!cancelled) {
        setProjectOptions((data || []) as ProjectOption[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, lockedProject, projects.length]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ companyId });
    if (lockedProject && projectId) params.set("projectId", projectId);
    else if (filterProject) params.set("projectId", filterProject);
    if (entryType) params.set("entryType", entryType);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
    if (includeInactive) params.set("includeInactive", "1");
    try {
      const res = await fetch(`/api/context/load?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await res.json()) as {
        list?: { ok: boolean; entries?: ContextEntry[]; error?: string };
        digest?: { ok: boolean; digest?: ContextDigest | null };
      };
      if (payload.list?.ok) setEntries(payload.list.entries || []);
      else setMsg(payload.list?.error || "Could not load context");
      if (payload.digest?.ok) setDigest(payload.digest.digest ?? null);
    } catch {
      setMsg("Could not load context");
    }
    setLoading(false);
  }, [companyId, projectId, lockedProject, filterProject, entryType, from, to, includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const typesInUse = useMemo(() => {
    const set = new Set(entries.map((e) => e.entry_type));
    ["note", "comment", "module_finalized", "document_ref"].forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [entries]);

  function flash(next: string) {
    setMsg(next);
  }

  function onAdd() {
    if (!noteContent.trim()) {
      flash("Write a note first.");
      return;
    }
    startTransition(async () => {
      const res = await addContextNote({
        companyId,
        projectId: lockedProject ? projectId : noteProject || null,
        entryType: noteType,
        title: noteTitle,
        content: noteContent,
      });
      if (!res.ok) {
        flash(res.error || "Could not save note");
        return;
      }
      setNoteTitle("");
      setNoteContent("");
      flash("Note saved.");
      await load();
    });
  }

  function onStatus(id: string, status: "archived" | "superseded" | "active") {
    startTransition(async () => {
      const res = await setContextEntryStatus({ id, status });
      if (!res.ok) {
        flash(res.error || "Could not update");
        return;
      }
      flash(status === "active" ? "Restored." : status === "archived" ? "Archived." : "Marked superseded.");
      await load();
    });
  }

  function onSaveEdit(id: string) {
    startTransition(async () => {
      const res = await updateContextEntry({ id, title: editTitle, content: editContent });
      if (!res.ok) {
        flash(res.error || "Could not update");
        return;
      }
      setEditingId(null);
      flash("Updated.");
      await load();
    });
  }

  function onDigest() {
    startTransition(async () => {
      const res = await runContextDigest({
        companyId,
        projectId: lockedProject ? projectId : filterProject || null,
      });
      if (!res.ok) {
        flash(res.error || "Digest failed");
        return;
      }
      flash(res.skipped ? res.reason || "Nothing new to summarize." : "Digest updated.");
      await load();
    });
  }

  return (
    <section className="border border-border rounded-lg bg-surface p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Context</h2>
          <p className="text-[12px] text-text-muted mt-0.5">
            Staff notes and module events for this {lockedProject ? "project" : "company"}.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={onDigest}
          className="text-[12px] font-semibold px-3 py-1.5 rounded-md border border-border hover:bg-surface-raised disabled:opacity-60"
        >
          {pending ? "Working…" : "Refresh digest"}
        </button>
      </div>

      {digest ? (
        <div className="rounded-md bg-surface-raised px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-text-muted font-semibold mb-1">
            Digest · {formatWhen(digest.generated_at)}
          </p>
          <p className="text-[13px] text-text-secondary whitespace-pre-wrap leading-relaxed">
            {digest.digest}
          </p>
        </div>
      ) : null}

      <form
        className="grid gap-2 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd();
        }}
      >
        <input
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
          placeholder="Title (optional)"
          className="sm:col-span-2 w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-surface outline-none focus:ring-1 focus:ring-accent"
        />
        <textarea
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Add a note or comment…"
          rows={3}
          className="sm:col-span-2 w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-surface outline-none focus:ring-1 focus:ring-accent resize-y min-h-[72px]"
        />
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-surface outline-none"
        >
          <option value="note">Note</option>
          <option value="comment">Comment</option>
        </select>
        {lockedProject ? (
          <div className="flex items-center text-[12px] text-text-muted px-1">Tied to this project</div>
        ) : (
          <select
            value={noteProject}
            onChange={(e) => setNoteProject(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-surface outline-none"
          >
            <option value="">Company-wide</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="px-3 py-2 rounded-md bg-accent text-white text-[13px] font-semibold disabled:opacity-60"
          >
            Add to context
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-[11px] text-text-muted">
          Type
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value)}
            className="mt-1 block border border-border rounded-md px-2 py-1.5 text-[12px] bg-surface min-w-[140px]"
          >
            <option value="">All types</option>
            {typesInUse.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        {!lockedProject ? (
          <label className="text-[11px] text-text-muted">
            Project
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="mt-1 block border border-border rounded-md px-2 py-1.5 text-[12px] bg-surface min-w-[160px]"
            >
              <option value="">All projects</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="text-[11px] text-text-muted">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block border border-border rounded-md px-2 py-1.5 text-[12px] bg-surface"
          />
        </label>
        <label className="text-[11px] text-text-muted">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block border border-border rounded-md px-2 py-1.5 text-[12px] bg-surface"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-text-secondary pb-1.5">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {msg ? (
        <p className="text-[12px] text-text-secondary">{msg}</p>
      ) : null}

      {loading ? (
        <p className="text-[13px] text-text-muted">Loading context…</p>
      ) : entries.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nothing in the bank yet.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className={`rounded-lg border border-border px-3 py-2.5 ${
                e.status !== "active" ? "opacity-60" : "bg-surface"
              }`}
            >
              {editingId === e.id ? (
                <div className="space-y-2">
                  <input
                    value={editTitle}
                    onChange={(ev) => setEditTitle(ev.target.value)}
                    className="w-full border border-border rounded-md px-2 py-1.5 text-[13px]"
                  />
                  <textarea
                    value={editContent}
                    onChange={(ev) => setEditContent(ev.target.value)}
                    rows={3}
                    className="w-full border border-border rounded-md px-2 py-1.5 text-[13px]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onSaveEdit(e.id)}
                      className="text-[12px] font-semibold text-text-primary"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-[12px] text-text-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      {typeLabel(e.entry_type)}
                    </span>
                    {e.project_title ? (
                      <span className="text-[11px] text-text-secondary">{e.project_title}</span>
                    ) : (
                      <span className="text-[11px] text-text-muted">Company</span>
                    )}
                    <span className="text-[11px] text-text-muted ml-auto">{formatWhen(e.created_at)}</span>
                  </div>
                  {e.title ? (
                    <p className="text-[13px] font-medium text-text-primary mt-1">{e.title}</p>
                  ) : null}
                  <p className="text-[13px] text-text-secondary mt-0.5 whitespace-pre-wrap">
                    {e.content}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(e.id);
                        setEditTitle(e.title || "");
                        setEditContent(e.content);
                      }}
                      className="font-semibold text-text-primary hover:underline"
                    >
                      Edit
                    </button>
                    {e.status === "active" ? (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onStatus(e.id, "archived")}
                          className="text-text-secondary hover:underline"
                        >
                          Archive
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onStatus(e.id, "superseded")}
                          className="text-text-secondary hover:underline"
                        >
                          Supersede
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onStatus(e.id, "active")}
                        className="text-text-secondary hover:underline"
                      >
                        Restore
                      </button>
                    )}
                    {!e.is_system_generated ? (
                      <span className="text-text-muted">Manual</span>
                    ) : (
                      <span className="text-text-muted">System</span>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
