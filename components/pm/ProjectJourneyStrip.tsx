"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { formatEuro, stagePillarLabel } from "@/lib/accounting/types";
import type { DealFinanceSnapshot } from "@/lib/accounting/deal-value";

export function ProjectJourneyStrip({ projectId }: { projectId: string }) {
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [snap, setSnap] = useState<DealFinanceSnapshot | null>(null);
  const [status, setStatus] = useState<string>("");
  const [stage, setStage] = useState<string>("");
  const [bdRecordId, setBdRecordId] = useState<string | null>(null);
  const [lost, setLost] = useState(false);
  const [lostReason, setLostReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const [{ data: project }, { data: people }, snapRes] = await Promise.all([
        supabase
          .from("projects")
          .select("status, stage, start_date, expected_start_date, contract_confirmed_at, bd_record_id")
          .eq("id", projectId)
          .maybeSingle(),
        supabase
          .from("project_deal_contacts")
          .select("contact_id, crm_customers:contact_id ( id, name )")
          .eq("project_id", projectId),
        fetch(`/api/projects/deal-snapshot?projectId=${encodeURIComponent(projectId)}`, {
          cache: "no-store",
        }).then((r) => r.json()) as Promise<{ ok?: boolean; snapshot?: DealFinanceSnapshot }>,
      ]);
      if (cancelled) return;
      setStatus(project?.status || "");
      setStage(project?.stage || "");
      setBdRecordId(project?.bd_record_id || null);
      setLost(project?.status === "expired");
      if (project?.bd_record_id) {
        const { data: card } = await supabase
          .from("bd_records")
          .select("stage, archived_reason")
          .eq("id", project.bd_record_id)
          .maybeSingle();
        if (cancelled) return;
        if (
          card?.stage === "declined" ||
          card?.stage === "archived"
        ) {
          setLost(true);
          setLostReason(card.archived_reason || null);
        }
      }
      setContacts(
        (people || []).map((row: any) => {
          const c = Array.isArray(row.crm_customers)
            ? row.crm_customers[0]
            : row.crm_customers;
          return { id: c?.id || row.contact_id, name: c?.name || "Contact" };
        })
      );
      if (snapRes.ok && snapRes.snapshot) setSnap(snapRes.snapshot);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const done = status === "completed" || stage === "completed";
  const live =
    !done && !lost && (status === "running" || Boolean(snap?.contractConfirmed));
  const sowLabel = snap?.sowConfirmed
    ? "Confirmed"
    : snap?.versions.some((v) => v.status === "published")
      ? "Sent"
      : snap?.versions.length
        ? "Draft"
        : "—";
  const contractLabel = snap?.contractConfirmed
    ? "Confirmed"
    : snap?.source === "contract_draft"
      ? "Draft"
      : "—";
  const money =
    snap?.amount != null && snap.amount > 0 ? formatEuro(snap.amount) : null;
  const pillar = snap ? stagePillarLabel(
    snap.pillar === "identified" ? "lead" : snap.pillar === "unidentified" ? "prospect" : "client"
  ) : null;
  const accountingHref =
    snap?.pillar === "identified"
      ? "/app/accounting/identified"
      : snap?.pillar === "unidentified"
        ? "/app/accounting/unidentified"
        : "/app/accounting/actual";

  const steps = [
    {
      key: "contacts",
      label: contacts.length
        ? contacts.map((c) => c.name).join(", ")
        : "Contacts",
      href: `/app/projects/${projectId}`,
      active: true,
    },
    {
      key: "sow",
      label: money ? `SOW · ${money} net · ${sowLabel}` : `SOW · ${sowLabel}`,
      href: `/app/projects/${projectId}/sow`,
      active: Boolean(snap?.versions.length),
    },
    {
      key: "contract",
      label: `Contract · ${contractLabel}`,
      href: `/app/projects/${projectId}/contract`,
      active: snap?.source === "contract_draft" || snap?.contractConfirmed,
    },
    {
      key: "live",
      label: live
        ? `Live · ${snap?.startDate || "started"}`
        : "Live",
      href: `/app/projects/${projectId}/tasks`,
      active: live || done,
    },
    lost
      ? {
          key: "lost",
          label: lostReason ? `Lost` : "Lost",
          href: bdRecordId
            ? `/app/work/pipeline/${bdRecordId}`
            : `/app/projects/${projectId}`,
          active: true,
        }
      : {
          key: "done",
          label: "Done",
          href: `/app/projects/${projectId}`,
          active: done,
        },
  ];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-2">
          {i > 0 && <span className="text-gray-300 text-xs">→</span>}
          <a
            href={s.href}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              s.key === "lost" && s.active
                ? "bg-red-50 text-danger"
                : s.key === "done" && s.active
                ? "bg-emerald-700 text-white"
                : s.active
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            {s.label}
          </a>
        </span>
      ))}
      {pillar && !lost && (
        <Link
          href={accountingHref}
          className="ml-1 text-[11px] font-semibold text-blue-700 hover:underline"
        >
          {pillar}
          {snap && snap.versionCount > 1 && snap.source === "sow_family_min"
            ? ` · lower of ${snap.versionCount}`
            : ""}
        </Link>
      )}
    </div>
  );
}
