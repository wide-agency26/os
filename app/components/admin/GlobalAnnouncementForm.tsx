"use client";

import { useActionState } from "react";
import { createGlobalAnnouncement, type AnnouncementState } from "@/app/actions/announcements";

const initial: AnnouncementState = {};

export function GlobalAnnouncementForm() {
  const [state, formAction, pending] = useActionState(createGlobalAnnouncement, initial);

  return (
    <form action={formAction} className="rounded-2xl border border-border bg-surface p-6 space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">Global client banner</h2>
      <p className="text-xs text-text-secondary">
        Shown at the top of every signed-in client screen until the end date or you turn it off.
      </p>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-success">{state.success}</p> : null}
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Message</span>
        <textarea
          name="body"
          required
          rows={3}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
          placeholder="We'll be out of office Dec 24–Jan 2…"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Hide after (optional)
        </span>
        <input
          name="ends_at"
          type="datetime-local"
          className="mt-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Publishing…" : "Publish banner"}
      </button>
    </form>
  );
}
