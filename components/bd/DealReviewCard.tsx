"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveDiscoveredDeal,
  dismissDiscoveredDeal,
  type DiscoveredDealRow,
} from "@/app/actions/opportunity-finder";
import { Button } from "@/components/frappe-ui/primitives";
import { workPaths } from "@/lib/work/paths";

export function DealReviewCard({
  deal,
  onDone,
}: {
  deal: DiscoveredDealRow;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"approve" | "dismiss" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState(deal.companyName);
  const [contactName, setContactName] = useState(deal.contactName ?? "");
  const [role, setRole] = useState(deal.role ?? "");
  const [website, setWebsite] = useState(deal.website ?? "");
  const [signalSummary, setSignalSummary] = useState(deal.signalSummary);
  const [geography, setGeography] = useState(deal.geography ?? "");
  const [industry, setIndustry] = useState(deal.industry ?? "");

  async function approve() {
    setBusy("approve");
    setMsg(null);
    const res = await approveDiscoveredDeal({
      id: deal.id,
      companyName,
      contactName,
      role,
      website,
      signalSummary,
      geography,
      industry,
    });
    setBusy(null);
    if (!res.ok || !res.recordId) {
      setMsg(res.error || "Could not approve");
      return;
    }
    onDone?.();
    router.push(workPaths.qualifyId(res.recordId));
    router.refresh();
  }

  async function dismiss() {
    setBusy("dismiss");
    setMsg(null);
    const res = await dismissDiscoveredDeal(deal.id);
    setBusy(null);
    if (!res.ok) {
      setMsg(res.error || "Could not dismiss");
      return;
    }
    onDone?.();
    router.refresh();
  }

  return (
    <div className="px-3 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text-primary truncate">
            {companyName || deal.companyName}
          </p>
          <p className="text-[12px] text-text-secondary mt-0.5">
            {(deal.source || "unknown").replaceAll("_", " ")}
            {geography ? ` · ${geography}` : ""}
            {industry ? ` · ${industry}` : ""}
          </p>
          {!editing ? (
            <p className="text-[13px] text-text-secondary mt-1 leading-snug">
              {signalSummary}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Hide" : "Edit"}
          </Button>
          <Button disabled={busy !== null || !companyName.trim()} onClick={() => void approve()}>
            {busy === "approve" ? "Saving…" : "Approve"}
          </Button>
          <Button variant="ghost" disabled={busy !== null} onClick={() => void dismiss()}>
            {busy === "dismiss" ? "…" : "Dismiss"}
          </Button>
        </div>
      </div>
      {editing ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[12px] text-text-secondary">
            Company
            <input
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </label>
          <label className="text-[12px] text-text-secondary">
            Contact
            <input
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Unknown until we qualify"
            />
          </label>
          <label className="text-[12px] text-text-secondary">
            Role
            <input
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </label>
          <label className="text-[12px] text-text-secondary">
            Website
            <input
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
          <label className="text-[12px] text-text-secondary sm:col-span-2">
            Why this is a prospect
            <textarea
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
              rows={3}
              value={signalSummary}
              onChange={(e) => setSignalSummary(e.target.value)}
            />
          </label>
        </div>
      ) : null}
      {deal.signalUrl && !editing ? (
        <a
          href={deal.signalUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[12px] font-medium text-blue-700"
        >
          Open source →
        </a>
      ) : null}
      {msg ? <p className="text-[12px] text-text-secondary">{msg}</p> : null}
    </div>
  );
}
