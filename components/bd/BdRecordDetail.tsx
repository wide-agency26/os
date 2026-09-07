"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  Check,
  FileText,
  IdCard,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Palette,
  RotateCcw,
  Save,
  ScrollText,
  Search,
  X,
} from "lucide-react";
import {
  archiveBdRecord,
  moveBdRecordStage,
  restoreBdRecord,
  updateBdRecord,
} from "@/app/actions/bd";
import {
  BD_LEGITIMACY_LABELS,
  BD_MAIN_STAGES,
  BD_SIDE_LANES,
  BD_SOURCE_LABELS,
  BD_STAGE_LABELS,
  daysInStage,
} from "@/lib/bd/constants";
import { guessWebsiteFromCompany } from "@/lib/bd/qualification";
import { BdDiscoveryPanel } from "@/components/bd/BdDiscoveryPanel";
import { FrequencyToggle } from "@/components/pm/ProjectFinanceLinesPanel";
import { workPaths } from "@/lib/work/paths";
import { isDoneProject } from "@/lib/work/stages";
import { CompanyLogoEditor } from "@/components/crm/CompanyLogo";
import { InviteContactAsMember } from "@/components/crm/InviteContactAsMember";
import { projectOwnsBdEstimate } from "@/lib/bd/estimate";
import { LoseDealDialog } from "@/components/work/LoseDealDialog";
import { EntityNavRail } from "@/components/work/EntityNavRail";
import { CardKindBanner } from "@/components/work/CardKindBanner";
import { formatEuro } from "@/lib/accounting/types";
import { CompanyProjectsPanel } from "@/components/work/CompanyProjectsPanel";
import type { CompanyProjectSummary } from "@/components/work/CompanyProjectsPanel";
import { OfferingChips } from "@/components/offerings/OfferingChips";
import { offeringsEstimateLabel } from "@/lib/offerings/normalize";
import type {
  BdRecord,
  BdStage,
  BdStaffOption,
  BdTimelineEntry,
} from "@/lib/bd/types";

export function BdRecordDetail({
  initial,
  timeline: initialTimeline,
  staff,
  companyProjects = [],
}: {
  initial: BdRecord;
  timeline: BdTimelineEntry[];
  staff: BdStaffOption[];
  companyProjects?: CompanyProjectSummary[];
}) {
  const router = useRouter();
  const [record, setRecord] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [loseOpen, setLoseOpen] = useState(false);
  const done = isDoneProject({
    stage: record.project_stage,
    status: record.project_status,
  });

  const pipelineNav = useMemo(() => {
    const website = guessWebsiteFromCompany(record.company_name);
    const items = [
      {
        id: "card",
        name: "Card",
        href: workPaths.pipelineId(record.id),
        icon: IdCard,
        exact: true,
      },
      {
        id: "qualify",
        name: "Qualify",
        href: `${workPaths.qualifyId(record.id)}?run=1`,
        icon: BadgeCheck,
      },
      {
        id: "propose",
        name: "Propose",
        href: `${workPaths.propose}?bd=${record.id}`,
        icon: Palette,
      },
      {
        id: "contract",
        name: "Contract",
        href: workPaths.contractId(record.id),
        icon: ScrollText,
      },
      {
        id: "quote",
        name: "Quote",
        href: workPaths.quoteId(record.id),
        icon: FileText,
      },
    ];
    if (record.project_id && companyProjects.length <= 1) {
      items.push({
        id: "project",
        name: "Project",
        href: workPaths.project(record.project_id),
        icon: LayoutDashboard,
      });
    }
    items.push(
      {
        id: "seo",
        name: "SEO",
        href: `${workPaths.seo}?url=${encodeURIComponent(website)}&bd=${record.id}`,
        icon: Search,
      },
      {
        id: "sentiment",
        name: "Sentiment",
        href: `/app/sentiment?brand=${encodeURIComponent(record.company_name)}&url=${encodeURIComponent(website)}&bd=${record.id}`,
        icon: MessageSquare,
      }
    );
    return items;
  }, [record.id, record.project_id, record.company_name, companyProjects.length]);

  const observerOptions = useMemo(
    () => staff.filter((s) => s.id !== record.owner_id),
    [staff, record.owner_id]
  );

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setMessage(res.error || "Something went wrong");
      else {
        setMessage(label);
        router.refresh();
      }
    });
  }

  function toggleObserver(id: string) {
    setRecord((r) => ({
      ...r,
      observer_ids: r.observer_ids.includes(id)
        ? r.observer_ids.filter((x) => x !== id)
        : [...r.observer_ids, id],
    }));
  }

  function saveCore() {
    run("Saved", () =>
      updateBdRecord({
        id: record.id,
        name: record.name,
        company_name: record.company_name,
        position: record.position,
        email: record.email,
        phone: record.phone,
        linkedin_url: record.linkedin_url,
        owner_id: record.owner_id,
        observer_ids: record.observer_ids,
        next_action_due: record.next_action_due,
        next_action_label: record.next_action_label,
        estimate_service: record.estimate_service ?? null,
        estimate_amount: record.estimate_amount ?? null,
        estimate_frequency: record.estimate_frequency ?? "one_off",
        estimate_start_date: record.estimate_start_date ?? null,
        estimate_end_date: record.estimate_end_date ?? null,
      })
    );
  }

  function changeStage(stage: BdStage) {
    if (stage === record.stage) return;
    let reason: string | null = null;
    if (stage === "archived" || stage === "declined") {
      reason = window.prompt(
        `Reason for ${BD_STAGE_LABELS[stage]} (required):`
      );
      if (!reason?.trim()) {
        setMessage("Stage change cancelled — reason required.");
        return;
      }
    }
    run(`Moved to ${BD_STAGE_LABELS[stage]}`, async () => {
      const res = await moveBdRecordStage({
        id: record.id,
        stage,
        note: reason,
        archived_reason: reason,
      });
      if (res.ok) {
        setRecord((r) => ({
          ...r,
          stage,
          stage_entered_at: new Date().toISOString(),
          archived_reason:
            stage === "archived" || stage === "declined"
              ? reason
              : r.archived_reason,
        }));
      }
      return res;
    });
  }

  return (
    <div className="flex items-start gap-3">
      <EntityNavRail items={pipelineNav} />
      <div className="flex-1 min-w-0 space-y-4">
      <CardKindBanner
        kind="pipeline"
        siblingHref={
          companyProjects.length <= 1 && record.project_id
            ? workPaths.project(record.project_id)
            : null
        }
      />
      {companyProjects.length > 0 ? (
        <CompanyProjectsPanel projects={companyProjects} />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <Link
            href={done ? `${workPaths.hub}?filter=done` : workPaths.hub}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={14} /> {done ? "Work · Done" : "Work"}
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {done ? "Done" : BD_STAGE_LABELS[record.stage]}
            </p>
            <h1 className="text-xl font-semibold text-gray-900 truncate">
              {record.company_name}
            </h1>
            {record.project_title ? (
              <p className="text-sm text-gray-800 truncate mt-0.5">
                {record.project_id ? (
                  <Link
                    href={workPaths.project(record.project_id)}
                    className="font-medium hover:text-blue-800"
                  >
                    {record.project_title}
                  </Link>
                ) : (
                  record.project_title
                )}
              </p>
            ) : null}
            <p className="text-sm text-gray-500 truncate">
              {record.name}
              {record.position ? ` · ${record.position}` : ""}
              {" · "}
              {daysInStage(record.stage_entered_at)}d in stage
            </p>
            {(record.project_id || (record.deal_value && record.deal_value > 0)) && (
              <p className="text-[12px] text-gray-600 mt-0.5">
                {record.deal_value && record.deal_value > 0
                  ? `${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(record.deal_value)} net`
                  : null}
                {record.project_stage
                  ? ` · ${record.project_stage === "lead" ? "Identified" : record.project_stage === "prospect" ? "Unidentified" : "Actual"}`
                  : ""}
            {record.project_id ? (
                  <>
                    {" · "}
                    <Link
                      href={workPaths.project(record.project_id)}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      Open project
                    </Link>
                  </>
                ) : null}
              </p>
            )}
          </div>
          {record.company_id ? (
            <CompanyLogoEditor
              companyId={record.company_id}
              label={record.company_name}
              logoUrl={record.logo_url ?? null}
              website={record.website ?? null}
              placeholderWebsite={guessWebsiteFromCompany(record.company_name)}
            />
          ) : (
            <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Save this card to link a CRM company — then you can set a 128×128
              logo here, including Prospects.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {done ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 text-white px-3 py-2 text-xs font-semibold">
                <Check size={14} /> Done
              </span>
              {record.project_id ? (
                <Link
                  href={workPaths.project(record.project_id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                >
                  Open project
                </Link>
              ) : null}
            </>
          ) : (
            <>
          <Link
            href={`${workPaths.qualifyId(record.id)}?run=1`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-900 px-3 py-2 text-xs font-semibold hover:bg-violet-100"
          >
            Run Qualification
          </Link>
          <Link
            href={`${workPaths.seo}?url=${encodeURIComponent(guessWebsiteFromCompany(record.company_name))}&bd=${record.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 px-3 py-2 text-xs font-semibold hover:bg-sky-100"
          >
            <Search size={14} /> Run SEO Audit
          </Link>
          <Link
            href={`/app/sentiment?brand=${encodeURIComponent(record.company_name)}&url=${encodeURIComponent(guessWebsiteFromCompany(record.company_name))}&bd=${record.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-900 px-3 py-2 text-xs font-semibold hover:bg-teal-100"
          >
            Sentiment
          </Link>
          {["archived", "declined", "on_hold"].includes(record.stage) ? (
            <button
              type="button"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
              onClick={() =>
                run("Restored to Prospect", async () => {
                  const res = await restoreBdRecord({
                    id: record.id,
                    stage: "prospect",
                  });
                  if (res.ok) {
                    setRecord((r) => ({
                      ...r,
                      stage: "prospect",
                      stage_entered_at: new Date().toISOString(),
                    }));
                  }
                  return res;
                })
              }
            >
              <RotateCcw size={14} /> Restore to Prospect
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 text-red-800 bg-red-50 px-3 py-2 text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
                onClick={() => setLoseOpen(true)}
              >
                <X size={14} /> Mark lost
              </button>
              <button
                type="button"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 text-amber-800 bg-amber-50 px-3 py-2 text-xs font-medium hover:bg-amber-100 disabled:opacity-50"
                onClick={() => {
                  const reason = window.prompt("Archive reason (required):");
                  if (!reason?.trim()) {
                    setMessage("Archive cancelled — reason required.");
                    return;
                  }
                  run("Archived", async () => {
                    const res = await archiveBdRecord({
                      id: record.id,
                      reason: reason.trim(),
                    });
                    if (res.ok) {
                      setRecord((r) => ({
                        ...r,
                        stage: "archived",
                        archived_reason: reason.trim(),
                        stage_entered_at: new Date().toISOString(),
                      }));
                    }
                    return res;
                  });
                }}
              >
                <Archive size={14} /> Archive…
              </button>
            </>
          )}
            </>
          )}
          <button
            type="button"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-2 text-xs font-semibold hover:bg-black disabled:opacity-50"
            onClick={saveCore}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>

      {done ? (
        <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          This work is done. It sits under Work → Done, not the active pipeline.
          Historical euros stay on Actual. Reopen from the project if you need it live again.
        </p>
      ) : null}

      {message && (
        <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <LoseDealDialog
        open={loseOpen}
        pending={pending}
        defaultReason={record.archived_reason || ""}
        onClose={() => setLoseOpen(false)}
        onConfirm={(reason) => {
          setLoseOpen(false);
          run("Moved to Lose", async () => {
            const res = await moveBdRecordStage({
              id: record.id,
              stage: "declined",
              note: reason,
              archived_reason: reason,
            });
            if (res.ok) {
              setRecord((r) => ({
                ...r,
                stage: "declined",
                archived_reason: reason,
                stage_entered_at: new Date().toISOString(),
              }));
            }
            return res;
          });
        }}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Contact
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block space-y-1 text-xs font-medium text-gray-700">
                Name *
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={record.name}
                  onChange={(e) =>
                    setRecord({ ...record, name: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-xs font-medium text-gray-700">
                Company *
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={record.company_name}
                  onChange={(e) =>
                    setRecord({ ...record, company_name: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-xs font-medium text-gray-700">
                Position
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={record.position || ""}
                  onChange={(e) =>
                    setRecord({ ...record, position: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-xs font-medium text-gray-700">
                Email
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={record.email || ""}
                  onChange={(e) =>
                    setRecord({ ...record, email: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-xs font-medium text-gray-700">
                Phone
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={record.phone || ""}
                  onChange={(e) =>
                    setRecord({ ...record, phone: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-xs font-medium text-gray-700">
                LinkedIn
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={record.linkedin_url || ""}
                  onChange={(e) =>
                    setRecord({ ...record, linkedin_url: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-700 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                CRM (source of truth)
              </p>
              {record.company_id ? (
                <p>
                  Company:{" "}
                  <Link
                    href={`/app/crm/${record.company_id}`}
                    className="text-blue-700 font-medium"
                  >
                    {record.company_name}
                  </Link>
                </p>
              ) : (
                <p className="text-amber-700">Company not linked yet — save to sync.</p>
              )}
              {record.contact_id ? (
                <p>
                  Contact:{" "}
                  <Link
                    href={`/app/crm/${record.contact_id}`}
                    className="text-blue-700 font-medium"
                  >
                    {record.name}
                  </Link>
                </p>
              ) : (
                <p className="text-amber-700">Contact not linked yet — save to sync.</p>
              )}
            </div>
            {record.company_id ? (
              <InviteContactAsMember
                companyId={record.company_id}
                contactId={record.contact_id}
                contactName={record.name}
                contactEmail={record.email}
                compact
              />
            ) : null}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Estimate · Unidentified
                </h2>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Rough service and euros before a SOW exists. Posts to Unidentified.
                  Live financials come from the project / SOW after that.
                </p>
              </div>
              {record.estimate_amount && record.estimate_amount > 0 ? (
                <span className="text-[12px] font-semibold text-gray-900 tabular-nums shrink-0">
                  {formatEuro(record.estimate_amount)}
                  {record.estimate_frequency === "monthly" ? " / mo" : ""}
                </span>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700">Service / package</p>
              <OfferingChips
                value={record.offerings ?? []}
                projectId={record.project_id}
                bdRecordId={record.id}
                onChanged={(next) =>
                  setRecord({
                    ...record,
                    offerings: next,
                    estimate_service: offeringsEstimateLabel(next),
                  })
                }
              />
            </div>
            {projectOwnsBdEstimate(record.project_stage) ? (
              <p className="text-[12px] text-gray-600 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                A lead/live project owns this number now
                {record.project_id ? (
                  <>
                    {" — "}
                    <Link
                      href={workPaths.project(record.project_id)}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      open project
                    </Link>
                  </>
                ) : null}
                . Change value there, not here.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs font-medium text-gray-700">
                  Amount (€)
                  <input
                    type="number"
                    min="0"
                    step="100"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="0"
                    value={record.estimate_amount ?? ""}
                    onChange={(e) =>
                      setRecord({
                        ...record,
                        estimate_amount: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </label>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-700">Cadence</p>
                  <FrequencyToggle
                    value={record.estimate_frequency || "one_off"}
                    onChange={(next) =>
                      setRecord({ ...record, estimate_frequency: next })
                    }
                  />
                </div>
                <label className="block space-y-1 text-xs font-medium text-gray-700">
                  {record.estimate_frequency === "monthly"
                    ? "Starts"
                    : "When"}
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={record.estimate_start_date || ""}
                    onChange={(e) =>
                      setRecord({
                        ...record,
                        estimate_start_date: e.target.value || null,
                      })
                    }
                  />
                </label>
                {record.estimate_frequency === "monthly" ? (
                  <label className="block space-y-1 text-xs font-medium text-gray-700">
                    Ends (optional)
                    <input
                      type="date"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={record.estimate_end_date || ""}
                      onChange={(e) =>
                        setRecord({
                          ...record,
                          estimate_end_date: e.target.value || null,
                        })
                      }
                    />
                  </label>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Ownership & next action
            </h2>
            <label className="block space-y-1 text-xs font-medium text-gray-700">
              Owner *
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                value={record.owner_id}
                onChange={(e) => {
                  const owner_id = e.target.value;
                  setRecord({
                    ...record,
                    owner_id,
                    observer_ids: record.observer_ids.filter((id) => id !== owner_id),
                  });
                }}
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-700">Observers</p>
              <div className="rounded-lg border border-gray-200 p-2 max-h-36 overflow-y-auto space-y-1">
                {observerOptions.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 text-xs text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={record.observer_ids.includes(s.id)}
                      onChange={() => toggleObserver(s.id)}
                    />
                    {s.full_name || s.id.slice(0, 8)}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block space-y-1 text-xs font-medium text-gray-700">
                Next action label
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={record.next_action_label || ""}
                  onChange={(e) =>
                    setRecord({ ...record, next_action_label: e.target.value })
                  }
                  placeholder="e.g. Send intro email"
                />
              </label>
              <label className="block space-y-1 text-xs font-medium text-gray-700">
                Due date
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={record.next_action_due?.slice(0, 10) || ""}
                  onChange={(e) =>
                    setRecord({ ...record, next_action_due: e.target.value })
                  }
                />
              </label>
            </div>
          </section>

          <BdDiscoveryPanel
            recordId={record.id}
            companyName={record.company_name}
            initial={record.discovery_call}
          />

          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Proposal
            </h2>
            {record.proposal &&
            typeof record.proposal === "object" &&
            (record.proposal as { linked_id?: string }).linked_id ? (
              <div className="text-sm text-gray-800 space-y-1">
                <p>
                  Type:{" "}
                  <span className="font-medium">
                    {String((record.proposal as { type?: string }).type || "—")}
                  </span>
                  {" · "}
                  Status:{" "}
                  <span className="font-medium">
                    {String(
                      (record.proposal as { status?: string }).status || "—"
                    )}
                  </span>
                </p>
                <p className="text-xs text-gray-600">
                  {(record.proposal as { title?: string }).title ||
                    "Linked proposal"}
                </p>
                <Link
                  href={
                    (record.proposal as { type?: string }).type === "slides"
                      ? `${workPaths.propose}?bd=${record.id}`
                      : workPaths.sowId((record.proposal as { linked_id: string }).linked_id)
                  }
                  className="text-xs font-semibold text-blue-700"
                >
                  Open proposal →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                No proposal linked yet.{" "}
                <Link
                  href={`${workPaths.propose}?bd=${record.id}`}
                  className="text-blue-700 font-medium"
                >
                  Open Proposal Builder
                </Link>
              </p>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Contract & quotation
            </h2>
            <div className="flex flex-wrap gap-3 text-xs">
              <Link
                href={workPaths.contractId(record.id)}
                className="font-semibold text-blue-700"
              >
                Contract Builder →
              </Link>
              <Link
                href={workPaths.quoteId(record.id)}
                className="font-semibold text-blue-700"
              >
                Quotation / Lexware →
              </Link>
            </div>
            {record.quotation &&
              typeof record.quotation === "object" &&
              (record.quotation as { status?: string }).status && (
                <p className="text-xs text-gray-600">
                  Quotation status:{" "}
                  {(record.quotation as { status?: string }).status}
                  {(record.quotation as { placeholder?: boolean })
                    .placeholder
                    ? " (coming soon)"
                    : ""}
                </p>
              )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Audit links
            </h2>
            {Array.isArray(record.audit_links) && record.audit_links.length > 0 ? (
              <ul className="space-y-2">
                {record.audit_links.map((raw, idx) => {
                  const link = raw as {
                    type?: string;
                    path?: string;
                    slug?: string;
                    score?: number;
                    url?: string;
                  };
                  const href =
                    link.path ||
                    (link.slug
                      ? link.type === "sentiment"
                        ? `/n/${link.slug}`
                        : `/a/${link.slug}`
                      : null);
                  return (
                    <li
                      key={idx}
                      className="text-xs text-gray-700 flex items-center justify-between gap-2"
                    >
                      <span>
                        {(link.type || "audit").replaceAll("_", " ")}
                        {link.score != null ? ` · ${link.score}/100` : ""}
                      </span>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 font-medium"
                        >
                          Open
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">
                No audits linked yet. Run SEO Audit from the actions above.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Stage
            </h2>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
              value={record.stage}
              onChange={(e) => changeStage(e.target.value as BdStage)}
            >
              <optgroup label="Pipeline">
                {BD_MAIN_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Side lanes">
                {BD_SIDE_LANES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            </select>
            {record.archived_reason && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Reason on file: {record.archived_reason}
              </p>
            )}
            <p className="text-[11px] text-gray-500">
              Source: {BD_SOURCE_LABELS[record.source]}
              {record.legitimacy_status
                ? ` · Legitimacy: ${BD_LEGITIMACY_LABELS[record.legitimacy_status]}`
                : " · Legitimacy: not set (Phase 2)"}
            </p>
            <p className="text-[11px] text-gray-400">
              There is no delete action. Archive moves the record to the Archived
              lane with a permanent reason.
            </p>
          </section>
        </div>

        <aside className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 lg:sticky lg:top-4 self-start max-h-[calc(100vh-120px)] overflow-y-auto">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Timeline
          </h2>
          {initialTimeline.length === 0 ? (
            <p className="text-xs text-gray-400">No events yet.</p>
          ) : (
            <ol className="space-y-3">
              {initialTimeline.map((entry) => (
                <li
                  key={entry.id}
                  className="border-l-2 border-gray-200 pl-3 py-0.5"
                >
                  <p className="text-xs font-semibold text-gray-800">
                    {entry.action.replaceAll("_", " ")}
                  </p>
                  {entry.note && (
                    <p className="text-[11px] text-gray-600 mt-0.5">{entry.note}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {entry.actor?.full_name ||
                      (entry.actor_type === "system" ? "System" : "User")}{" "}
                    · {new Date(entry.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
      </div>
    </div>
  );
}
