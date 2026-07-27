import Link from "next/link";
import {
  parseMilestonesJson,
  milestonesFromDateRange,
  parseDeliverablesJson,
  projectProgressPercent,
  daysElapsedInRange,
  type MilestoneRow,
} from "@/lib/project-helpers";
import { clientPaths } from "@/lib/wide-os/paths";
import { createClient } from "@/utils/supabase/server";

import { SubmitRequestModal } from "@/components/dashboard/SubmitRequestModal";
import { ClientRequestsHistory } from "@/components/dashboard/ClientRequestsHistory";
import type { ClientRequestRow } from "@/app/actions/client-requests";
import { loadAssignedManagerContact } from "@/lib/cm/load-assigned-manager";

type Props = {
  workspaceClientId: string;
  greetingName?: string | null;
};

export async function ClientDashboardContent({
  workspaceClientId,
  greetingName,
}: Props) {
  const supabase = await createClient();

  const [
    { data: projectRows },
    { data: proposals },
    { data: activities },
    { data: clientRequests },
    managerContact,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("client_id", workspaceClientId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("client_proposals")
      .select("id, title, recommended_headline, show_on_dashboard, status, published_at")
      .eq("client_id", workspaceClientId)
      .in("status", ["published", "draft"])
      .order("created_at", { ascending: false }),
    supabase
      .from("portal_activity")
      .select("id, title, event_type, meta, created_at")
      .eq("client_id", workspaceClientId)
      .eq("event_type", "proposal_published")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("client_requests")
      .select(
        "id, client_id, subject, body, status, service, form_answers, preferred_response_date, response_note, responded_at, created_at, updated_at"
      )
      .eq("client_id", workspaceClientId)
      .order("created_at", { ascending: false })
      .limit(20),
    loadAssignedManagerContact(workspaceClientId),
  ]);

  const requests = (clientRequests ?? []) as ClientRequestRow[];

  const meetingUrl = managerContact?.googleCalendarMeetingUrl ?? null;
  const managerName = managerContact?.fullName ?? null;

  const currentPhase = "phase-1-discovery";
  const hero = {
    heroObjective: "Discovery & Strategy",
    tagline: "Laying the foundation",
    shortName: "Discovery"
  };

  const running = projectRows?.find((p) => p.status === "running");
  const project = running ?? projectRows?.[0] ?? null;

  const milestonesRaw = project
    ? parseMilestonesJson(project.milestones)
    : null;
  const milestones: MilestoneRow[] =
    milestonesRaw && milestonesRaw.length > 0
      ? milestonesRaw
      : project
        ? milestonesFromDateRange(project.start_date, project.end_date)
        : [];

  const pendingApprovals = false;
  const approvalHref = clientPaths.services(workspaceClientId);

  const deliverables = project ? parseDeliverablesJson(project.deliverables) : [];
  const doneCount = deliverables.filter((d) => d.done).length;
  const totalDel = deliverables.length;
  const progress = project
    ? projectProgressPercent(project.start_date, project.end_date)
    : 0;
  const { elapsed, total } = project
    ? daysElapsedInRange(project.start_date, project.end_date)
    : { elapsed: 0, total: 0 };

  const nextPhase =
    milestones.find((m) => m.status === "active") ??
    milestones.find((m) => m.status === "awaiting_client") ??
    milestones.find((m) => m.status === "upcoming");

  const statusLabel =
    project?.status === "running"
      ? "Active"
      : project?.status === "completed"
        ? "Completed"
        : project?.status === "expired"
          ? "Expired"
          : project?.status ?? "—";

  const pipelineTeasers = (proposals ?? []).filter(
    (p) => p.show_on_dashboard && (p.recommended_headline || p.title)
  );
  const publishedProposals = (proposals ?? []).filter((p) => p.status === "published");

  const greeting = greetingName?.trim()
    ? `Welcome back, ${greetingName.trim()}`
    : "Welcome back";

  return (
    <div className="page-enter max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{greeting}</h1>
        <p className="mt-1 text-sm text-text-secondary">Your digital command center</p>
      </header>

      {(activities ?? []).length > 0 ? (
        <div className="mb-6 space-y-2">
          {(activities ?? []).map((a) => {
            const proposalId =
              a.meta && typeof a.meta === "object" && "proposal_id" in a.meta
                ? String((a.meta as { proposal_id: string }).proposal_id)
                : null;
            if (!proposalId) return null;
            return (
              <Link
                key={a.id}
                href={clientPaths.services(workspaceClientId)}
                className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm transition-colors hover:bg-accent/10"
              >
                <span className="font-medium text-text-primary">New Strategic Proposal Available</span>
                <span className="text-accent">Review →</span>
              </Link>
            );
          })}
        </div>
      ) : null}

      <section className="mb-8 rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/10 via-surface to-surface p-8">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">The Hero · Current Focus</p>
        <h2 className="mt-2 text-2xl font-semibold text-text-primary">{hero.heroObjective}</h2>
        <p className="mt-2 text-sm text-text-secondary">{hero.tagline}</p>
        <Link
          href={clientPaths.services(workspaceClientId)}
          className="mt-5 inline-flex text-sm font-medium text-accent hover:underline"
        >
          Open kickoff journey →
        </Link>
      </section>

      {project ? (
        <section className="mb-8 rounded-2xl border border-border bg-surface p-6 lg:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-success">
                {statusLabel}
              </span>
              <h3 className="mt-2 text-lg font-semibold text-text-primary">{project.title}</h3>
            </div>
            <p className="text-xs text-text-muted">
              {project.start_date ?? "—"} → {project.end_date ?? "—"}
            </p>
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-text-secondary">Overall progress</p>
              <p className="text-sm font-semibold text-text-primary">{progress}%</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: "Days along",
                value: total > 0 ? String(elapsed) : "—",
                sub: total > 0 ? `of ${total} days` : "Timeline not set",
              },
              {
                label: "Deliverables",
                value: totalDel > 0 ? `${doneCount}/${totalDel}` : "—",
                sub: totalDel > 0 ? "completed" : "None listed",
              },
              {
                label: "Kickoff phase",
                value: hero.shortName,
                sub: hero.tagline,
              },
              {
                label: "Milestone",
                value: nextPhase ? nextPhase.phase.split(" ")[0] + "…" : "—",
                sub: nextPhase ? nextPhase.status.replace("_", " ") : "—",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border-subtle bg-surface-raised p-4"
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  {stat.label}
                </p>
                <p className="mt-1 text-xl font-semibold text-text-primary">{stat.value}</p>
                <p className="text-[11px] text-text-muted">{stat.sub}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {managerContact ? (
        <section className="mb-8 rounded-xl border border-border bg-surface p-4 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Your Client Manager
          </p>
          <p className="mt-1 font-semibold text-text-primary">
            {managerContact.fullName}
            {managerContact.jobTitle ? ` · ${managerContact.jobTitle}` : ""}
          </p>
          {managerContact.bio ? (
            <p className="mt-2 text-text-secondary">{managerContact.bio}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            {managerContact.publicEmail ? (
              <a href={`mailto:${managerContact.publicEmail}`} className="text-accent hover:underline">
                {managerContact.publicEmail}
              </a>
            ) : null}
            {managerContact.phone ? (
              <span className="text-text-secondary">{managerContact.phone}</span>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <h3 className="mb-4 text-sm font-medium text-text-primary">Action Center</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <SubmitRequestModal clientId={workspaceClientId} />

          {meetingUrl ? (
            <a
              href={meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-start rounded-xl border border-border bg-surface-raised p-4 transition-colors hover:border-accent/40 hover:bg-accent/5"
            >
              <span className="text-sm font-semibold text-text-primary">Book Strategy Call</span>
              <span className="mt-1 text-xs text-text-muted">
                {managerName ? `With ${managerName}` : "Google Calendar"}
              </span>
            </a>
          ) : (
            <div className="flex flex-col rounded-xl border border-dashed border-border p-4 opacity-80">
              <span className="text-sm font-semibold text-text-primary">Book Strategy Call</span>
              <span className="mt-1 text-xs text-text-muted">
                Your CM can add a Google Calendar link in My profile
              </span>
            </div>
          )}

          <Link
            href={approvalHref}
            className={`flex flex-col items-start rounded-xl border p-4 transition-colors ${
              pendingApprovals
                ? "border-warning/40 bg-warning/5 hover:bg-warning/10"
                : "border-border bg-surface-raised hover:border-accent/40"
            }`}
          >
            <span className="text-sm font-semibold text-text-primary">Review Pending Approvals</span>
            <span className="mt-1 text-xs text-text-muted">
              {pendingApprovals
                ? "Pending approvals require your attention"
                : "You are all caught up"}
            </span>
          </Link>
        </div>
      </section>

      <ClientRequestsHistory requests={requests} />

      <section className="mb-8">
        <h3 className="mb-4 text-sm font-medium text-text-primary">Asset Vault</h3>
        
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
          <p>
            <span className="font-semibold">⚠️ Database Storage Constraint:</span> Assets are currently housed on free-tier space. It is highly recommended to provide an external Google Drive URL with Link Sharing set to public.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={clientPaths.brandbook(workspaceClientId)}
            className="rounded-xl border border-border bg-surface p-5 hover:border-accent/40"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Brand</p>
            <p className="mt-2 font-semibold text-text-primary">Digital Brandbook</p>
            <p className="mt-1 text-xs text-text-secondary">Interactive guidelines & assets</p>
          </Link>
          <Link
            href={clientPaths.library(workspaceClientId)}
            className="rounded-xl border border-border bg-surface p-5 hover:border-accent/40"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Files</p>
            <p className="mt-2 font-semibold text-text-primary">File Library</p>
            <p className="mt-1 text-xs text-text-secondary">Consolidated project assets</p>
          </Link>
        </div>
      </section>

      {milestones.length > 0 ? (
        <section className="mb-8 rounded-2xl border border-border bg-surface p-6">
          <h3 className="mb-5 text-sm font-medium text-text-primary">Journey tracker</h3>
          <div className="relative pl-2">
            <div className="absolute bottom-2 left-[11px] top-2 w-px bg-border-subtle" aria-hidden />
            <div className="space-y-0">
              {milestones.map((item, i) => {
                const isAwaiting = item.status === "awaiting_client";
                const isActive = item.status === "active";
                const isDone = item.status === "completed";
                return (
                  <div key={`${item.phase}-${i}`} className="relative flex items-start gap-4">
                    <div
                      className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        isDone
                          ? "border-success bg-success"
                          : isAwaiting
                            ? "border-warning bg-warning/20"
                            : isActive
                              ? "border-accent bg-accent"
                              : "border-border bg-surface"
                      }`}
                    >
                      {isDone ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2 6L5 9L10 3"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </div>
                    <div className="pb-5 pt-0.5">
                      <p
                        className={`text-sm font-medium ${
                          isDone
                            ? "text-text-secondary"
                            : isActive || isAwaiting
                              ? "text-text-primary"
                              : "text-text-muted"
                        }`}
                      >
                        {item.phase}
                        {isAwaiting ? (
                          <span className="ml-2 text-[10px] font-semibold uppercase text-warning">
                            Needs you
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">{item.dates}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-4 text-sm font-medium text-text-primary">Future Pipeline</h3>
        <div className="rounded-2xl border border-border bg-surface p-6">
          {pipelineTeasers.length === 0 && publishedProposals.length === 0 ? (
            <p className="text-sm text-text-secondary">
              Your Client Manager will recommend strategic next steps here as your engagement evolves.
            </p>
          ) : (
            <ul className="space-y-3">
              {pipelineTeasers.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-text-primary">
                    {p.recommended_headline || p.title}
                  </span>
                  {p.status === "published" ? (
                    <Link
                      href={clientPaths.services(workspaceClientId)}
                      className="shrink-0 font-medium text-accent hover:underline"
                    >
                      View proposal
                    </Link>
                  ) : (
                    <span className="shrink-0 text-xs text-text-muted">Coming soon</span>
                  )}
                </li>
              ))}
              {publishedProposals
                .filter((p) => !pipelineTeasers.some((t) => t.id === p.id))
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">{p.title}</span>
                    <Link
                      href={clientPaths.services(workspaceClientId)}
                      className="font-medium text-accent hover:underline"
                    >
                      Review
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>

    </div>
  );
}
