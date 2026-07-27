"use client";

import { useActionState } from "react";
import { updateProjectEngagement, type ProjectAdminState } from "@/app/actions/project-admin";

type LeadOption = { id: string; label: string };

const initial: ProjectAdminState = {};

export function AdminProjectEngagementForm({
  projectId,
  leadOptions,
  initialContractRenewsAt,
  initialLaunchDate,
  initialLeadAdminId,
  initialNextActionLabel,
  initialNextActionCta,
  initialNextActionHref,
  initialMilestonesJson,
}: {
  projectId: string;
  leadOptions: LeadOption[];
  initialContractRenewsAt: string;
  initialLaunchDate: string;
  initialLeadAdminId: string;
  initialNextActionLabel: string;
  initialNextActionCta: string;
  initialNextActionHref: string;
  initialMilestonesJson: string;
}) {
  const [state, formAction, pending] = useActionState(updateProjectEngagement, initial);

  return (
    <form action={formAction} className="rounded-2xl border border-border bg-surface p-6 space-y-5">
      <input type="hidden" name="project_id" value={projectId} />
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Engagement & client dashboard</h2>
        <p className="text-xs text-text-secondary mt-1">
          Renewal dates power the admin pulse. Next action shows on the client dashboard. Milestones JSON
          can use <code className="text-[10px]">awaiting_client</code> for the attention matrix.
        </p>
      </div>

      {state.error ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          {state.success}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block mb-1">
            Contract renews (upsell pulse)
          </span>
          <input
            name="contract_renews_at"
            type="date"
            defaultValue={initialContractRenewsAt}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block mb-1">
            Launch / go-live (countdown)
          </span>
          <input
            name="launch_date"
            type="date"
            defaultValue={initialLaunchDate}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block mb-1">
          Lead (filters “My clients” on dashboard)
        </span>
        <select
          name="lead_admin_id"
          defaultValue={initialLeadAdminId}
          className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
        >
          <option value="">— Unassigned —</option>
          {leadOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="border-t border-border-subtle pt-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Client “next action” widget
        </p>
        <label className="block">
          <span className="text-[10px] text-text-muted block mb-1">Headline</span>
          <input
            name="next_action_label"
            defaultValue={initialNextActionLabel}
            placeholder="Approve website copy"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] text-text-muted block mb-1">Button label</span>
            <input
              name="next_action_cta_label"
              defaultValue={initialNextActionCta}
              placeholder="Review now"
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-text-muted block mb-1">Link (path)</span>
            <input
              name="next_action_href"
              defaultValue={initialNextActionHref}
              placeholder="/files"
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block mb-1">
          Milestones JSON
        </span>
        <textarea
          name="milestones_json"
          rows={14}
          defaultValue={initialMilestonesJson}
          className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs font-mono"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save engagement"}
      </button>
    </form>
  );
}
