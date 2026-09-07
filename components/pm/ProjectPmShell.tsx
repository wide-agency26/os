"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { HardLink } from "@/components/frappe-ui/HardLink";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Timer,
  Palette,
  CalendarDays,
  BarChart3,
  ArrowLeft,
  Inbox,
  Loader2,
  FileText,
  ScrollText,
  Newspaper,
  Check,
  Pencil,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { PM_ICONS } from "@/lib/pm/icons";
import {
  PROJECT_FUNNEL_STAGES,
  normalizeProjectStage,
  stagePillarLabel,
  type ProjectAccountingStage,
} from "@/lib/accounting/types";
import { updateProjectAccountingStage } from "@/app/actions/accounting";
import {
  updateProjectTitle,
  markProjectLost,
  setProjectClientVisible,
} from "@/app/actions/projects-commercial";
import { ClientVisibleToggle } from "@/components/client/ClientVisibleToggle";
import { InviteContactAsMember } from "@/components/crm/InviteContactAsMember";
import { ProjectJourneyStrip } from "@/components/pm/ProjectJourneyStrip";
import { CompanyLogoEditor } from "@/components/crm/CompanyLogo";
import { LoseDealDialog } from "@/components/work/LoseDealDialog";
import { buttonClass } from "@/components/frappe-ui/primitives";
import { EntityNavRail } from "@/components/work/EntityNavRail";
import { CardKindBanner } from "@/components/work/CardKindBanner";
import { workPaths } from "@/lib/work/paths";
import {
  PROJECT_NAV_DEFAULT,
  PROJECT_NAV_IDS,
  PROJECT_NAV_LOCKED,
  loadProjectNav,
  saveProjectNav,
  type ProjectNavId,
} from "@/lib/pm/project-nav";
import { OfferingChips } from "@/components/offerings/OfferingChips";
import type { OfferingChip } from "@/lib/offerings/types";
import { ProjectTeamEditor } from "@/components/pm/ProjectTeamEditor";

const TABS: {
  id: ProjectNavId;
  name: string;
  href: (id: string) => string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  external?: boolean;
}[] = [
  { id: "overview", name: "Overview", href: (id) => `/app/projects/${id}`, icon: LayoutDashboard, exact: true },
  { id: "portal", name: "Portal", href: (id) => `/app/projects/${id}/portal`, icon: Users },
  { id: "sow", name: "SOW", href: (id) => `/app/projects/${id}/sow`, icon: FileText },
  { id: "contract", name: "Contract", href: (id) => `/app/projects/${id}/contract`, icon: ScrollText },
  { id: "tasks", name: "Tasks", href: (id) => `/app/projects/${id}/tasks`, icon: CheckSquare },
  { id: "timesheet", name: "Timesheet", href: (id) => `/app/projects/${id}/timesheet`, icon: Timer },
  { id: "cost", name: "Cost Center", href: (id) => `/app/projects/${id}/cost`, icon: PM_ICONS.costCenter },
  { id: "revenue", name: "Revenue Center", href: (id) => `/app/projects/${id}/revenue`, icon: PM_ICONS.revenueCenter },
  { id: "review", name: "Review", href: (id) => `/app/projects/${id}/review`, icon: Inbox },
  { id: "content", name: "Content", href: (id) => `/app/projects/${id}/content`, icon: CalendarDays },
  { id: "blog", name: "Blog", href: (id) => `/app/projects/${id}/blog`, icon: Newspaper },
  { id: "ci", name: "CI Builder", href: (id) => `/app/projects/${id}/ci-builder`, icon: Palette, external: true },
  { id: "reports", name: "Reports", href: (id) => `/app/tools/reports?project=${id}`, icon: BarChart3, external: true },
];

function funnelValue(
  stage: ProjectAccountingStage
): "prospect" | "lead" | "client" | "completed" {
  if (stage === "prospect") return "prospect";
  if (stage === "lead") return "lead";
  if (stage === "completed") return "completed";
  return "client"; // client | signed
}

export function ProjectPmShell({
  projectId,
  title,
  clientLabel,
  children,
}: {
  projectId: string;
  title: string;
  clientLabel?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [stage, setStage] = useState<ProjectAccountingStage>("prospect");
  const [status, setStatus] = useState<string>("running");
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientLogo, setClientLogo] = useState<string | null>(null);
  const [clientWebsite, setClientWebsite] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>("");
  const [bdRecordId, setBdRecordId] = useState<string | null>(null);
  const [bdStage, setBdStage] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState<string | null>(null);
  const [loseOpen, setLoseOpen] = useState(false);
  const [name, setName] = useState(title);
  const [draft, setDraft] = useState(title);
  const [editingName, setEditingName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const editingNameRef = useRef(false);
  const [shellBusy, setShellBusy] = useState(false);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [contractConfirmed, setContractConfirmed] = useState(false);
  const [clientBypassOpen, setClientBypassOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [visibleTabs, setVisibleTabs] = useState<ProjectNavId[]>(PROJECT_NAV_DEFAULT);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const customizeBtnRef = useRef<HTMLButtonElement>(null);
  const customizePanelRef = useRef<HTMLDivElement>(null);
  const [customizePos, setCustomizePos] = useState<{ top: number; left: number } | null>(null);
  const [offerings, setOfferings] = useState<OfferingChip[]>([]);
  const [clientVisible, setClientVisible] = useState(true);
  editingNameRef.current = editingName;

  useEffect(() => {
    setName(title);
    if (!editingNameRef.current) setDraft(title);
  }, [title]);

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  useEffect(() => {
    setVisibleTabs(loadProjectNav(projectId));
  }, [projectId]);

  useLayoutEffect(() => {
    if (!customizeOpen) {
      setCustomizePos(null);
      return;
    }
    const place = () => {
      const btn = customizeBtnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      setCustomizePos({
        top: r.bottom + 8,
        left: Math.min(r.left, Math.max(8, window.innerWidth - 280)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [customizeOpen]);

  useEffect(() => {
    if (!customizeOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (customizeBtnRef.current?.contains(t)) return;
      if (customizePanelRef.current?.contains(t)) return;
      setCustomizeOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCustomizeOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [customizeOpen]);

  const toggleTab = (id: ProjectNavId) => {
    if (PROJECT_NAV_LOCKED.includes(id)) return;
    setVisibleTabs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const ordered = PROJECT_NAV_IDS.filter((x) => next.includes(x) || PROJECT_NAV_LOCKED.includes(x));
      saveProjectNav(projectId, ordered);
      return ordered;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await (supabase as any)
        .from("projects")
        .select(
          "title, stage, status, client_visible, client_id, bd_record_id, contract_confirmed_at, client:client_id ( company, name, logo_url, website )"
        )
        .eq("id", projectId)
        .maybeSingle();
      if (cancelled || !data) return;
      if (data.title && !editingNameRef.current) {
        setName(data.title);
        setDraft(data.title);
      }
      if (data.stage) setStage(normalizeProjectStage(data.stage));
      if (data.status) setStatus(data.status);
      setContractConfirmed(Boolean(data.contract_confirmed_at));
      setClientVisible(data.client_visible !== false);
      setClientId(data.client_id || null);
      setBdRecordId(data.bd_record_id || null);
      const client = Array.isArray(data.client) ? data.client[0] : data.client;
      setClientLogo(client?.logo_url || null);
      setClientWebsite(client?.website || null);
      setClientName(client?.company || client?.name || "");
      if (data.bd_record_id) {
        const { data: card } = await (supabase as any)
          .from("bd_records")
          .select("stage, archived_reason")
          .eq("id", data.bd_record_id)
          .maybeSingle();
        if (cancelled) return;
        setBdStage(card?.stage || null);
        setLostReason(card?.archived_reason || null);
      } else {
        setBdStage(null);
        setLostReason(null);
      }
      const offs = await fetch(
        `/api/projects/offerings?projectId=${encodeURIComponent(projectId)}${
          data.bd_record_id
            ? `&bdRecordId=${encodeURIComponent(data.bd_record_id)}`
            : ""
        }`,
        { cache: "no-store" }
      ).then((r) => r.json()) as { ok?: boolean; chips?: typeof offerings };
      if (!cancelled && offs.ok) setOfferings(offs.chips || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const navTabs = useMemo(() => {
    const activeTab = TABS.find((tab) => {
      const href = tab.href(projectId);
      if (tab.external) return false;
      return tab.exact
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`);
    });
    const ids = new Set(visibleTabs);
    if (activeTab) ids.add(activeTab.id);
    return TABS.filter((tab) => ids.has(tab.id));
  }, [visibleTabs, pathname, projectId]);

  const currentFunnel = funnelValue(stage);
  const cardLost = bdStage === "declined" || bdStage === "archived";
  const lost = status === "expired";
  const pillarLabel = stagePillarLabel(stage);

  const accountingHref =
    pillarLabel === "Identified"
      ? "/app/accounting/identified"
      : pillarLabel === "Unidentified"
        ? "/app/accounting/unidentified"
        : "/app/accounting/actual";

  const onStageChange = async (
    next: "prospect" | "lead" | "client" | "completed",
    opts?: { skipContractCheck?: boolean }
  ) => {
    if (next === currentFunnel || pipelineBusy) return;
    if (next === "completed" && currentFunnel !== "client") {
      setMsg("Move to Client (live work) before marking this done.");
      return;
    }
    if (
      next === "client" &&
      !contractConfirmed &&
      !opts?.skipContractCheck
    ) {
      setClientBypassOpen(true);
      return;
    }
    setMsg(null);
    const prev = stage;
    const prevStatus = status;
    setStage(next);
    if (next === "completed") setStatus("completed");
    else if (next === "client") setStatus("running");
    else setStatus("pipeline");

    setPipelineBusy(true);
    try {
      const res = await updateProjectAccountingStage(projectId, next, opts);
      if (!res.ok) {
        setStage(prev);
        setStatus(prevStatus);
        setMsg(res.error || "Could not update stage");
        return;
      }
      if ("syncWarning" in res && res.syncWarning) {
        setMsg(
          `Moved to ${PROJECT_FUNNEL_STAGES.find((s) => s.value === next)?.label || next}, but ledger sync is still catching up.`
        );
        return;
      }
      if (next === "completed") {
        setMsg("Marked done — off Live. Historical euros stay on Actual.");
        return;
      }
      const label =
        PROJECT_FUNNEL_STAGES.find((s) => s.value === next)?.label || next;
      setMsg(
        `Moved to ${label} — costs & revenue now on ${stagePillarLabel(next)}.`
      );
    } catch {
      setStage(prev);
      setStatus(prevStatus);
      setMsg("Could not update stage");
    } finally {
      setPipelineBusy(false);
    }
  };

  function commitName() {
    const next = draft.trim();
    setEditingName(false);
    if (!next || next === name) {
      setDraft(name);
      return;
    }
    const prev = name;
    setName(next);
    setShellBusy(true);
    void (async () => {
      try {
        const res = await updateProjectTitle(projectId, next);
        if (!res.ok) {
          setName(prev);
          setDraft(prev);
          setMsg(res.error || "Could not rename project");
          return;
        }
        setDraft(res.title || next);
        setMsg("Project name updated.");
      } catch {
        setName(prev);
        setDraft(prev);
        setMsg("Could not rename project");
      } finally {
        setShellBusy(false);
      }
    })();
  }

  function confirmLost(reason: string) {
    setLoseOpen(false);
    setMsg(null);
    setPipelineBusy(true);
    void (async () => {
      try {
        const res = await markProjectLost(projectId, reason);
        if (!res.ok) {
          setMsg(res.error || "Could not move to Lose");
          return;
        }
        setStatus("expired");
        if (res.bdRecordId) setBdRecordId(res.bdRecordId);
        setBdStage("declined");
        setLostReason(reason);
        setMsg("Moved to Lose. Pipeline card and project stay linked.");
      } catch {
        setMsg("Could not move to Lose");
      } finally {
        setPipelineBusy(false);
      }
    })();
  }

  return (
    <div className="flex items-start gap-3">
      <EntityNavRail
        items={navTabs.map((tab) => ({
          id: tab.id,
          name: tab.name,
          href: tab.href(projectId),
          icon: tab.icon,
          exact: tab.exact,
          external: tab.external,
        }))}
        footer={(collapsed) => (
          <>
            <button
              ref={customizeBtnRef}
              type="button"
              onClick={() => setCustomizeOpen((o) => !o)}
              title="Choose project items"
              className={`inline-flex items-center min-h-9 rounded-md text-text-muted hover:bg-surface-raised hover:text-text-primary ${
                collapsed ? "justify-center w-full" : "gap-2 px-2.5 w-full"
              } ${customizeOpen ? "text-text-primary" : ""}`}
              aria-expanded={customizeOpen}
              aria-haspopup="dialog"
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              {!collapsed ? <span className="text-[12px] font-semibold">Items</span> : null}
            </button>
            {customizeOpen && customizePos
              ? createPortal(
                  <div
                    ref={customizePanelRef}
                    role="dialog"
                    aria-label="Choose project items"
                    className="fixed z-[200] w-64 rounded-lg border border-border bg-surface shadow-lg p-3"
                    style={{ top: customizePos.top, left: customizePos.left }}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                      Show on this project
                    </p>
                    <ul className="space-y-1">
                      {TABS.map((tab) => {
                        const locked = PROJECT_NAV_LOCKED.includes(tab.id);
                        const on = visibleTabs.includes(tab.id) || locked;
                        return (
                          <li key={tab.id}>
                            <label
                              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ${
                                locked
                                  ? "text-text-muted"
                                  : "text-text-primary hover:bg-surface-raised cursor-pointer"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="rounded border-border"
                                checked={on}
                                disabled={locked}
                                onChange={() => toggleTab(tab.id)}
                              />
                              <span className="flex-1">{tab.name}</span>
                              {locked ? (
                                <span className="text-[10px] uppercase tracking-wide text-text-muted">
                                  always
                                </span>
                              ) : null}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-[11px] text-text-muted mt-2 px-2">
                      Hidden items stay available from Overview. Saved for this project on this browser.
                    </p>
                  </div>,
                  document.body
                )
              : null}
          </>
        )}
      />
      <div className="flex-1 min-w-0">
      <div className="mb-3 space-y-3">
        <CardKindBanner
          kind="project"
          siblingHref={bdRecordId ? workPaths.pipelineId(bdRecordId) : null}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <HardLink
            href={workPaths.clients}
            className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Clients
          </HardLink>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {editingName ? (
              <input
                ref={nameRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitName();
                  }
                  if (e.key === "Escape") {
                    setDraft(name);
                    setEditingName(false);
                  }
                }}
                className="text-2xl font-semibold text-text-primary w-full max-w-2xl bg-transparent border-b border-border outline-none py-0.5"
                aria-label="Project name"
              />
            ) : (
              <div className="flex items-start gap-1 max-w-2xl">
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="group flex items-start gap-2 text-left min-w-0"
                  title="Rename project"
                >
                  <h1 className="text-2xl font-semibold text-text-primary">
                    {name}
                  </h1>
                  <Pencil
                    size={14}
                    strokeWidth={1.75}
                    className="mt-2 shrink-0 text-text-muted group-hover:text-text-secondary"
                  />
                </button>
                <div className="mt-0.5 shrink-0">
                  <ClientVisibleToggle
                    visible={clientVisible}
                    disabled={shellBusy}
                    onChange={(next) => {
                      setClientVisible(next);
                      setShellBusy(true);
                      void (async () => {
                        try {
                          const res = await setProjectClientVisible(projectId, next);
                          if (!res.ok) {
                            setClientVisible(!next);
                            setMsg(res.error || "Could not update client visibility");
                            return;
                          }
                          setMsg(
                            next
                              ? "Shown on the client portal."
                              : "Hidden from the client portal."
                          );
                        } catch {
                          setClientVisible(!next);
                          setMsg("Could not update client visibility");
                        } finally {
                          setShellBusy(false);
                        }
                      })();
                    }}
                  />
                </div>
              </div>
            )}
            {clientLabel ? (
              <p className="text-sm text-text-secondary mt-1">{clientLabel}</p>
            ) : null}
            <p className="text-[11px] text-text-muted mt-0.5">
              {clientVisible
                ? "Visible on the client portal"
                : "Hidden from the client portal"}
            </p>
            <div className="mt-2">
              <OfferingChips
                value={offerings}
                projectId={projectId}
                bdRecordId={bdRecordId}
                onChanged={setOfferings}
              />
            </div>
            <ProjectTeamEditor projectId={projectId} />
          </div>

          <div className="shrink-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                Pipeline
              </span>
              {pipelineBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
              ) : null}
            </div>
            {lost || cardLost ? (
              <div className="max-w-sm text-right">
                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 text-danger px-2.5 py-1.5 text-xs font-semibold">
                  <X className="w-3.5 h-3.5" />
                  Lost
                </span>
                {lostReason ? (
                  <p className="text-[12px] text-text-secondary mt-1.5">{lostReason}</p>
                ) : null}
                <div className="mt-1.5 flex items-center justify-end gap-3">
                  {bdRecordId ? (
                    <Link
                      href={workPaths.pipelineId(bdRecordId)}
                      className="text-[12px] font-semibold text-text-primary hover:underline"
                    >
                      Open pipeline card
                    </Link>
                  ) : null}
                  {!lost ? (
                    <button
                      type="button"
                      disabled={pipelineBusy}
                      onClick={() => {
                        if (lostReason) confirmLost(lostReason);
                        else setLoseOpen(true);
                      }}
                      className="text-[12px] font-semibold text-danger hover:underline disabled:opacity-60"
                    >
                      Move to Lose
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <div className="inline-flex flex-wrap rounded-md border border-border bg-surface p-0.5">
                    {PROJECT_FUNNEL_STAGES.map((s) => {
                      const active = currentFunnel === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          disabled={pipelineBusy}
                          title={
                            s.value === "client" &&
                            !contractConfirmed &&
                            currentFunnel !== "client" &&
                            currentFunnel !== "completed"
                              ? "Confirm the contract first, or move to Client anyway."
                              : `${s.label} → ${s.hint}`
                          }
                          onClick={() => onStageChange(s.value)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors disabled:opacity-60 ${
                            active
                              ? "bg-accent text-white"
                              : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={pipelineBusy || currentFunnel === "completed"}
                    title={
                      currentFunnel === "completed"
                        ? "This project is done. Click Client to reopen."
                        : currentFunnel === "client"
                          ? "Close the file. Stays on Actual; drops off Live."
                          : "Move to Client first, then mark done."
                    }
                    onClick={() => onStageChange("completed")}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors disabled:opacity-60 ${
                      currentFunnel === "completed"
                        ? "bg-success text-white border-success"
                        : "bg-surface text-text-secondary border-border hover:border-text-muted hover:bg-surface-raised"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {currentFunnel === "completed" ? "Done" : "Mark done"}
                  </button>
                  <button
                    type="button"
                    disabled={pipelineBusy}
                    title="Deal didn’t go through — move the card and this project to Lose."
                    onClick={() => setLoseOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md border border-red-200 bg-red-50 text-danger hover:bg-red-100 disabled:opacity-60"
                  >
                    <X className="w-3.5 h-3.5" />
                    Mark lost
                  </button>
                </div>
                <p className="text-[11px] text-text-secondary text-right">
                  Posts to{" "}
                  <Link href={accountingHref} className="text-text-primary hover:underline">
                    {pillarLabel}
                  </Link>
                  {currentFunnel === "completed" ? (
                    <span className="block text-[10px] text-text-muted mt-0.5">
                      Closed. Click Client to reopen.
                    </span>
                  ) : currentFunnel !== "client" ? (
                    !contractConfirmed ? (
                      <span className="block text-[10px] text-text-muted mt-0.5">
                        No contract yet —{" "}
                        <Link
                          href={`/app/projects/${projectId}/contract`}
                          className="text-text-primary hover:underline"
                        >
                          confirm on Contract
                        </Link>
                        , or move to Client anyway.
                      </span>
                    ) : null
                  ) : !contractConfirmed ? (
                    <span className="block text-[10px] text-amber-800 mt-0.5">
                      Contract not confirmed —{" "}
                      <Link
                        href={`/app/projects/${projectId}/contract`}
                        className="text-amber-900 hover:underline font-medium"
                      >
                        upload on Contract tab
                      </Link>
                      .
                    </span>
                  ) : null}
                </p>
              </>
            )}
          </div>
        </div>
        <ProjectJourneyStrip key={`${stage}-${status}-${bdStage}`} projectId={projectId} />
        {clientId && (currentFunnel === "client" || currentFunnel === "completed") && !lost ? (
          <div className="mt-3 max-w-xl">
            <CompanyLogoEditor
              companyId={clientId}
              label={clientName || clientLabel || name}
              logoUrl={clientLogo}
              website={clientWebsite}
              compact
            />
          </div>
        ) : null}
        {clientId ? (
          <div className="mt-3 max-w-xl rounded-lg border border-gray-200 bg-white p-3">
            <InviteContactAsMember companyId={clientId} compact />
          </div>
        ) : null}
        {msg ? (
          <p className="mt-2 text-[12px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-1.5">
            {msg}
          </p>
        ) : null}
      </div>

      <LoseDealDialog
        open={loseOpen}
        pending={pipelineBusy}
        defaultReason={lostReason || ""}
        onClose={() => setLoseOpen(false)}
        onConfirm={confirmLost}
      />

      {clientBypassOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4"
          onClick={() => !pipelineBusy && setClientBypassOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="client-bypass-title"
            className="w-full max-w-md rounded-lg border border-border bg-surface shadow-lg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="client-bypass-title"
              className="text-base font-semibold text-text-primary"
            >
              No contract confirmed
            </h2>
            <p className="text-[13px] text-text-secondary mt-1">
              Usually you confirm the contract before starting client work. You
              can upload and confirm later from the{" "}
              <Link
                href={`/app/projects/${projectId}/contract`}
                className="text-text-primary hover:underline font-medium"
                onClick={() => setClientBypassOpen(false)}
              >
                Contract tab
              </Link>
              .
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className={buttonClass("ghost")}
                onClick={() => setClientBypassOpen(false)}
                disabled={pipelineBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={buttonClass("primary")}
                disabled={pipelineBusy}
                onClick={() => {
                  setClientBypassOpen(false);
                  void onStageChange("client", { skipContractCheck: true });
                }}
              >
                Move to Client anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {children}
      </div>
    </div>
  );
}
