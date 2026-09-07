"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import { ClientVisibleToggle } from "@/components/client/ClientVisibleToggle";
import { InviteContactAsMember } from "@/components/crm/InviteContactAsMember";
import { ProjectProgressEditor } from "@/components/pm/ProjectProgressEditor";
import {
  loadProjectClientNav,
  setProjectClientNav,
} from "@/app/actions/client-nav";
import { loadProjectProgress } from "@/app/actions/project-progress";
import {
  loadProjectPortalMembers,
  setProjectMemberAccess,
  type ProjectPortalMemberRow,
} from "@/app/actions/project-members";
import {
  CLIENT_NAV_KEYS,
  CLIENT_NAV_LABELS,
  type ClientNavKey,
} from "@/lib/client/nav";
import type { ProjectProgress } from "@/lib/client/progress";

/** Sidebar tab toggles — progress uses its own "Show on client portal" control. */
const TOGGLE_KEYS = CLIENT_NAV_KEYS.filter((k) => k !== "files" && k !== "progress");

export function ProjectPortalClient({
  projectId,
  title,
  clientLabel,
  companyId,
}: {
  projectId: string;
  title: string;
  clientLabel?: string;
  companyId?: string | null;
}) {
  const [clientVisible, setClientVisible] = useState(true);
  const [tabs, setTabs] = useState<ClientNavKey[]>(TOGGLE_KEYS);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<ProjectPortalMemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [progressPublisher, setProgressPublisher] = useState<string | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);

  useEffect(() => {
    void loadProjectClientNav(projectId).then((res) => {
      if (res.error) setMsg(res.error);
      setClientVisible(res.clientVisible);
      if (res.tabs.length) setTabs(res.tabs.filter((k) => k !== "progress"));
      setLoading(false);
    });
  }, [projectId]);

  useEffect(() => {
    setProgressLoading(true);
    void loadProjectProgress(projectId).then((res) => {
      if (res.error) setMsg(res.error);
      setProgress(res.progress);
      setProgressPublisher(res.publisherName);
      setProgressLoading(false);
    });
  }, [projectId]);

  useEffect(() => {
    if (!companyId) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    void loadProjectPortalMembers(projectId).then((res) => {
      if (res.error) setMsg(res.error);
      setMembers(res.members);
      setMembersLoading(false);
    });
  }, [projectId, companyId]);

  function save(nextVisible: boolean, nextTabs: ClientNavKey[]) {
    setMsg(null);
    startTransition(async () => {
      const res = await setProjectClientNav(projectId, {
        clientVisible: nextVisible,
        tabs: nextTabs,
      });
      if (!res.ok) {
        setMsg(res.error || "Could not save portal settings");
        return;
      }
      setMsg("Portal settings saved.");
    });
  }

  return (
    <ProjectPmShell projectId={projectId} title={title} clientLabel={clientLabel}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Client portal</h2>
          <p className="text-[13px] text-text-secondary mt-1">
            What this company’s viewers see in their sidebar. Switched-off tabs
            are hidden — the URL does not work either.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-text-muted py-8">
            <Loader2 size={14} className="animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-text-primary">
                    Show this project
                  </p>
                  <p className="text-[12px] text-text-muted mt-0.5">
                    Off = none of this project’s work appears in the client portal.
                  </p>
                </div>
                <ClientVisibleToggle
                  visible={clientVisible}
                  disabled={pending}
                  onChange={(next) => {
                    setClientVisible(next);
                    save(next, tabs);
                  }}
                />
              </div>
            </section>

            {progressLoading ? (
              <div className="flex items-center gap-2 text-[13px] text-text-muted py-4">
                <Loader2 size={14} className="animate-spin" />
                Loading progress…
              </div>
            ) : (
              <ProjectProgressEditor
                projectId={projectId}
                initial={progress}
                initialPublisherName={progressPublisher}
              />
            )}

            <section className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[13px] font-semibold text-text-primary mb-3">
                Sidebar tabs
              </p>
              <ul className="space-y-2">
                {TOGGLE_KEYS.map((key) => {
                  const on = tabs.includes(key);
                  return (
                    <li key={key}>
                      <label className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-surface-raised">
                        <span className="text-[13px] text-text-primary">
                          {CLIENT_NAV_LABELS[key]}
                        </span>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={on}
                          disabled={pending || !clientVisible}
                          onChange={() => {
                            const next = on
                              ? tabs.filter((k) => k !== key)
                              : [...tabs, key];
                            setTabs(next);
                            save(clientVisible, next);
                          }}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>

            {companyId ? (
              <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
                <div>
                  <p className="text-[13px] font-semibold text-text-primary">
                    Who can open this project
                  </p>
                  <p className="text-[12px] text-text-muted mt-0.5">
                    People must be portal members of {clientLabel || "this company"}.
                    Only granted members see this project in the client hub.
                  </p>
                </div>
                {membersLoading ? (
                  <div className="flex items-center gap-2 text-[12px] text-text-muted py-2">
                    <Loader2 size={14} className="animate-spin" />
                    Loading members…
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-[12px] text-text-muted">
                    No active portal members on this company yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {members.map((m) => (
                      <li
                        key={m.companyMemberId}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-surface-raised"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-text-primary truncate">
                            {m.name}
                          </p>
                          {m.email ? (
                            <p className="text-[11px] text-text-muted truncate">
                              {m.email}
                            </p>
                          ) : null}
                        </div>
                        <label className="inline-flex items-center gap-2 shrink-0 text-[12px] text-text-secondary">
                          <span>{m.hasAccess ? "Access" : "No access"}</span>
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={m.hasAccess}
                            disabled={pending}
                            onChange={() => {
                              const next = !m.hasAccess;
                              setMembers((prev) =>
                                prev.map((row) =>
                                  row.companyMemberId === m.companyMemberId
                                    ? { ...row, hasAccess: next }
                                    : row
                                )
                              );
                              startTransition(async () => {
                                const res = await setProjectMemberAccess(
                                  projectId,
                                  m.companyMemberId,
                                  next
                                );
                                if (!res.ok) {
                                  setMembers((prev) =>
                                    prev.map((row) =>
                                      row.companyMemberId === m.companyMemberId
                                        ? { ...row, hasAccess: !next }
                                        : row
                                    )
                                  );
                                  setMsg(res.error || "Could not update access");
                                } else {
                                  setMsg(
                                    next
                                      ? `${m.name} can open this project.`
                                      : `${m.name} no longer sees this project.`
                                  );
                                }
                              });
                            }}
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <InviteContactAsMember companyId={companyId} />
              </section>
            ) : (
              <p className="text-[12px] text-text-muted">
                Link a CRM company on this project to create portal members here.
              </p>
            )}
          </>
        )}

        {msg ? (
          <p className="text-[12px] text-text-muted">{msg}</p>
        ) : null}
      </div>
    </ProjectPmShell>
  );
}
