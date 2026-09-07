import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { getObservationSummary } from "@/app/actions/pm-observation";
import { OVERRIDE_TRIGGER_LABELS, type OverrideTrigger } from "@/lib/pm/instrument";

export const dynamic = "force-dynamic";

export default async function ObservationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return (
      <Workspace>
        <p className="text-[13px] text-text-secondary">Founders only.</p>
      </Workspace>
    );
  }

  const summary = await getObservationSummary(14);
  if ("error" in summary) {
    return (
      <Workspace>
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Task log</h1>
        <p className="text-[13px] text-text-secondary">{summary.error}</p>
        <p className="text-[12px] text-text-muted mt-8">
          <Link href="/app/settings" className="hover:underline">
            Back to settings
          </Link>
        </p>
      </Workspace>
    );
  }

  const kinds = Object.entries(summary.tasks.byKind).sort((a, b) => b[1] - a[1]);
  const outcomes = Object.entries(summary.review.byOutcome).filter(([, n]) => n > 0);
  const triggers = Object.entries(summary.review.byTrigger).filter(([, n]) => n > 0);
  const botOutcomes = Object.entries(summary.botOverrides.byOutcome).filter(
    ([, n]) => n > 0
  );
  const botTriggers = Object.entries(summary.botOverrides.byTrigger).filter(
    ([, n]) => n > 0
  );
  const botAgents = Object.entries(summary.botOverrides.byAgent).sort(
    (a, b) => b[1] - a[1]
  );
  const botSurfaces = Object.entries(summary.botOverrides.bySurface).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <Workspace>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        Settings
      </p>
      <h1 className="text-2xl font-semibold text-text-primary mt-1">Task log</h1>
      <p className="text-[13px] text-text-secondary mt-1 mb-6 max-w-2xl">
        Last {summary.windowDays} days. Closures, review-queue decisions, and bot-logged
        overrides. A usage log so you can see writes landing, not a dashboard of effects.
      </p>

      <div className="grid gap-3 sm:grid-cols-4 mb-8">
        <div className="border border-border rounded-lg bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted">Created</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">
            {summary.tasks.created}
          </p>
        </div>
        <div className="border border-border rounded-lg bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted">Closed</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">
            {summary.tasks.completed}
          </p>
          <p className="text-[12px] text-text-secondary mt-1">
            {summary.tasks.reopened} reopened
          </p>
        </div>
        <div className="border border-border rounded-lg bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted">Email reviews</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">
            {summary.review.decided}
          </p>
          <p className="text-[12px] text-text-secondary mt-1">
            {summary.review.pending} still pending
          </p>
        </div>
        <div className="border border-border rounded-lg bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted">Bot overrides</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">
            {summary.botOverrides.numerator}
          </p>
          <p className="text-[12px] text-text-secondary mt-1">
            of {summary.botOverrides.total} logged
          </p>
        </div>
      </div>

      <h2 className="text-[13px] font-semibold text-text-primary mb-2">
        New tasks by kind
      </h2>
      {kinds.length === 0 ? (
        <p className="text-[13px] text-text-secondary mb-8">None in this window.</p>
      ) : (
        <ul className="mb-8 divide-y divide-border border border-border rounded-lg bg-surface">
          {kinds.map(([kind, n]) => (
            <li key={kind} className="flex justify-between px-4 py-2 text-[13px]">
              <span className="text-text-primary">{kind}</span>
              <span className="text-text-secondary">{n}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-[13px] font-semibold text-text-primary mb-2">
        Bot overrides by agent
      </h2>
      {botAgents.length === 0 ? (
        <p className="text-[13px] text-text-secondary mb-8">
          None yet. Bots must call{" "}
          <code className="text-[12px]">log_override</code> for every review,
          including accepts.
        </p>
      ) : (
        <ul className="mb-8 divide-y divide-border border border-border rounded-lg bg-surface">
          {botAgents.map(([agent, n]) => (
            <li key={agent} className="flex justify-between px-4 py-2 text-[13px]">
              <span className="text-text-primary">{agent}</span>
              <span className="text-text-secondary">{n}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-[13px] font-semibold text-text-primary mb-2">
        Bot overrides by surface
      </h2>
      {botSurfaces.length === 0 ? (
        <p className="text-[13px] text-text-secondary mb-8">None yet.</p>
      ) : (
        <ul className="mb-8 divide-y divide-border border border-border rounded-lg bg-surface">
          {botSurfaces.map(([surface, n]) => (
            <li key={surface} className="flex justify-between px-4 py-2 text-[13px]">
              <span className="text-text-primary">{surface}</span>
              <span className="text-text-secondary">{n}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-[13px] font-semibold text-text-primary mb-2">
        Bot override outcomes
      </h2>
      {botOutcomes.length === 0 ? (
        <p className="text-[13px] text-text-secondary mb-8">None yet.</p>
      ) : (
        <ul className="mb-8 divide-y divide-border border border-border rounded-lg bg-surface">
          {botOutcomes.map(([outcome, n]) => (
            <li key={outcome} className="flex justify-between px-4 py-2 text-[13px]">
              <span className="text-text-primary">{outcome}</span>
              <span className="text-text-secondary">{n}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-[13px] font-semibold text-text-primary mb-2">
        Bot override why
      </h2>
      {botTriggers.length === 0 ? (
        <p className="text-[13px] text-text-secondary mb-8">None yet.</p>
      ) : (
        <ul className="mb-8 divide-y divide-border border border-border rounded-lg bg-surface">
          {botTriggers.map(([trigger, n]) => (
            <li key={trigger} className="flex justify-between px-4 py-2 text-[13px]">
              <span className="text-text-primary">
                {OVERRIDE_TRIGGER_LABELS[trigger as OverrideTrigger] || trigger}
              </span>
              <span className="text-text-secondary">{n}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-[13px] font-semibold text-text-primary mb-2">
        Email review outcomes
      </h2>
      {outcomes.length === 0 ? (
        <p className="text-[13px] text-text-secondary mb-8">
          No reviewed email proposals yet.
        </p>
      ) : (
        <ul className="mb-8 divide-y divide-border border border-border rounded-lg bg-surface">
          {outcomes.map(([outcome, n]) => (
            <li key={outcome} className="flex justify-between px-4 py-2 text-[13px]">
              <span className="text-text-primary">{outcome}</span>
              <span className="text-text-secondary">{n}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-[13px] font-semibold text-text-primary mb-2">
        Email review why
      </h2>
      {triggers.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No triggers recorded yet.</p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg bg-surface">
          {triggers.map(([trigger, n]) => (
            <li key={trigger} className="flex justify-between px-4 py-2 text-[13px]">
              <span className="text-text-primary">
                {OVERRIDE_TRIGGER_LABELS[trigger as OverrideTrigger] || trigger}
              </span>
              <span className="text-text-secondary">{n}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[12px] text-text-muted mt-8">
        <Link href="/app/settings/activity" className="hover:underline">
          Portal activity
        </Link>
        {" · "}
        <Link href="/app/settings" className="hover:underline">
          Back to settings
        </Link>
      </p>
    </Workspace>
  );
}
