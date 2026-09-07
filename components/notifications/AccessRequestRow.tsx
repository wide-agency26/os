"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  reviewCompanyMember,
  type CompanyMemberRow,
} from "@/app/actions/company-members";

export function AccessRequestRow({
  member,
  onReviewed,
}: {
  member: CompanyMemberRow;
  onReviewed?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"active" | "rejected" | null>(null);

  async function decide(decision: "active" | "rejected") {
    setBusy(decision);
    const res = await reviewCompanyMember(member.id, decision);
    setBusy(null);
    if (res.error) {
      alert(res.error);
      return;
    }
    onReviewed?.();
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-text-primary truncate">
            {member.user_name}
          </span>
          <span className="text-[12px] text-text-muted truncate">
            {member.user_email}
          </span>
        </div>
        <p className="text-[12px] text-text-secondary flex flex-wrap items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span className="font-medium text-text-primary">{member.company_name}</span>
          <span className="text-text-muted">·</span>
          <span className="capitalize">via {(member.source || "unknown").replaceAll("_", " ")}</span>
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => void decide("active")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 px-2 py-1.5 min-h-9 rounded-md text-[12px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          {busy === "active" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          Approve
        </button>
        <button
          type="button"
          onClick={() => void decide("rejected")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 px-2 py-1.5 min-h-9 rounded-md text-[12px] font-medium text-danger hover:bg-red-50 disabled:opacity-50"
        >
          {busy === "rejected" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          Reject
        </button>
      </div>
    </div>
  );
}
