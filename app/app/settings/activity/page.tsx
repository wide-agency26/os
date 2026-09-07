import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { getActivitySummary } from "@/app/actions/portal-activity";
import Link from "next/link";

export const dynamic = "force-dynamic";

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default async function ActivityPage() {
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

  const summary = await getActivitySummary(14);
  if ("error" in summary) {
    return (
      <Workspace>
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Activity</h1>
        <p className="text-[13px] text-text-secondary">{summary.error}</p>
      </Workspace>
    );
  }

  const surfaces = Object.entries(summary.client.bySurface).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <Workspace>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        Settings
      </p>
      <h1 className="text-2xl font-semibold text-text-primary mt-1">Portal activity</h1>
      <p className="text-[13px] text-text-secondary mt-1 mb-6 max-w-2xl">
        Last {summary.windowDays} days. Client counts exclude founder “view as”
        previews. This is a usage log, not a thesis metric.
      </p>

      <div className="grid gap-3 sm:grid-cols-3 mb-8">
        <div className="border border-border rounded-lg bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted">
            Client people
          </p>
          <p className="text-2xl font-semibold text-text-primary mt-1">
            {summary.client.uniqueActors}
          </p>
          <p className="text-[12px] text-text-secondary mt-1">
            {summary.client.events} views
          </p>
        </div>
        <div className="border border-border rounded-lg bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted">
            View-as (you)
          </p>
          <p className="text-2xl font-semibold text-text-primary mt-1">
            {summary.viewAs.events}
          </p>
          <p className="text-[12px] text-text-secondary mt-1">
            Not counted as client use
          </p>
        </div>
        <div className="border border-border rounded-lg bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted">
            Staff
          </p>
          <p className="text-2xl font-semibold text-text-primary mt-1">
            {summary.staff.uniqueActors}
          </p>
          <p className="text-[12px] text-text-secondary mt-1">
            {summary.staff.events} in-app views
          </p>
        </div>
      </div>

      <h2 className="text-[13px] font-semibold text-text-primary mb-2">
        Client views by tab
      </h2>
      {surfaces.length === 0 ? (
        <p className="text-[13px] text-text-secondary mb-8">
          No natural client views yet.
        </p>
      ) : (
        <ul className="mb-8 divide-y divide-border border border-border rounded-lg bg-surface">
          {surfaces.map(([surface, n]) => (
            <li
              key={surface}
              className="flex justify-between px-4 py-2 text-[13px]"
            >
              <span className="text-text-primary">{surface}</span>
              <span className="text-text-secondary">{n}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-[13px] font-semibold text-text-primary mb-2">
        Last seen per company
      </h2>
      {summary.companies.length === 0 ? (
        <p className="text-[13px] text-text-secondary">
          No company-scoped client events yet.
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg bg-surface">
          {summary.companies.map((c) => (
            <li key={c.companyId} className="px-4 py-3 text-[13px]">
              <p className="font-medium text-text-primary">{c.companyName}</p>
              <p className="text-text-secondary mt-0.5">
                {c.clientEvents} views · last {fmt(c.lastSeen)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[12px] text-text-muted mt-8">
        <Link href="/app/settings/observation" className="hover:underline">
          Task log
        </Link>
        {" · "}
        <Link href="/app/settings" className="hover:underline">
          Back to settings
        </Link>
      </p>
    </Workspace>
  );
}
