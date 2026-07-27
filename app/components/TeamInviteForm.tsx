"use client";

import { useActionState } from "react";
import { inviteTeamMember, type TeamInviteState } from "@/app/actions/team-invite";

const initial: TeamInviteState = {};

export function TeamInviteForm() {
  const [state, formAction, pending] = useActionState(inviteTeamMember, initial);

  return (
    <form action={formAction} className="rounded-2xl border border-border bg-surface p-6 space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">Invite your team</h2>
      <p className="text-xs text-text-secondary leading-relaxed">
        Invite marketing, SEO, or finance collaborators to the same workspace (Brand Hub, files, and project
        views). They&apos;ll receive the same Supabase invitation email as new clients.
      </p>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-success">{state.success}</p> : null}
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Email</span>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
          placeholder="teammate@company.com"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Full name</span>
        <input
          name="full_name"
          required
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send invite"}
      </button>
    </form>
  );
}
