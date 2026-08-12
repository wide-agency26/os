"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react";
import {
  confirmBdQuotationAccepted,
  refreshBdLexwareQuotationStatus,
  syncBdLexwareQuotation,
} from "@/app/actions/quotation";
import {
  mergeQuotation,
  type BdQuotationPayload,
} from "@/lib/bd/quotation";

export function QuotationPanel({
  bdRecordId,
  companyName,
  initial,
  lexwareConfigured,
}: {
  bdRecordId: string;
  companyName: string;
  initial: Record<string, unknown> | null | undefined;
  lexwareConfigured: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState<BdQuotationPayload>(mergeQuotation(initial));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function sync(finalize: boolean) {
    setMessage(null);
    startTransition(async () => {
      const res = await syncBdLexwareQuotation({ bdRecordId, finalize });
      if (!res.ok) {
        setMessage(res.error || "Sync failed");
        return;
      }
      if (res.quotation) setQ(res.quotation);
      setMessage(
        finalize
          ? "Quotation sync / send attempted."
          : "Contact + draft quotation sync attempted."
      );
      router.refresh();
    });
  }

  function refresh() {
    setMessage(null);
    startTransition(async () => {
      const res = await refreshBdLexwareQuotationStatus({ bdRecordId });
      if (!res.ok) {
        setMessage(res.error || "Refresh failed");
        return;
      }
      if (res.quotation) setQ(res.quotation);
      setMessage("Status refreshed.");
      router.refresh();
    });
  }

  function confirmAccepted() {
    if (
      !window.confirm(
        "Mark quotation accepted and run Client + Project handoff?"
      )
    )
      return;
    setMessage(null);
    startTransition(async () => {
      const res = await confirmBdQuotationAccepted({ bdRecordId });
      if (!res.ok) {
        setMessage(res.error || "Handoff failed");
        return;
      }
      setMessage(
        res.projectId
          ? `Handoff done — project ${res.projectId.slice(0, 8)}…`
          : "Handoff done."
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 py-2 max-w-2xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Quotation · Lexware
        </p>
        <h1 className="text-2xl font-semibold text-gray-950">{companyName}</h1>
        <p className="text-xs text-gray-500 mt-1">
          Status: <span className="font-semibold">{q.status}</span>
          {q.voucher_status ? ` · Lexware: ${q.voucher_status}` : ""}
          {" · "}
          <Link href={`/app/bd/${bdRecordId}`} className="text-blue-700">
            BD record
          </Link>
        </p>
      </div>

      {!lexwareConfigured || q.placeholder || q.status === "coming_soon" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-1">
          <p className="font-semibold">Coming soon — Lexware not connected</p>
          <p className="text-amber-900/80 text-xs">
            Wire <code className="text-[10px]">LEXWARE_API_KEY</code> in Vercel
            env to enable live contact sync, draft quotations, finalize/send,
            webhooks, and deeplinks. Until then you can still confirm acceptance
            manually to run Client/Project handoff (Phase 10).
          </p>
          {q.message && (
            <p className="text-xs text-amber-800/90">{q.message}</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-950">
          Lexware API key detected. Sync will hit api.lexware.io (2 req/s
          throttled).
        </div>
      )}

      <dl className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <dt className="text-[10px] uppercase font-bold text-gray-500">
            Contact ID
          </dt>
          <dd className="font-mono text-xs mt-0.5">
            {q.lexware_contact_id || "—"}
          </dd>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <dt className="text-[10px] uppercase font-bold text-gray-500">
            Quotation ID
          </dt>
          <dd className="font-mono text-xs mt-0.5">
            {q.lexware_quotation_id || "—"}
          </dd>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 sm:col-span-2">
          <dt className="text-[10px] uppercase font-bold text-gray-500">
            Deeplink
          </dt>
          <dd className="text-xs mt-0.5">
            {q.deeplink ? (
              <a
                href={q.deeplink}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 inline-flex items-center gap-1"
              >
                Open in Lexware <ExternalLink size={12} />
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
        {q.handoff?.project_id && (
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 sm:col-span-2">
            <dt className="text-[10px] uppercase font-bold text-gray-500">
              Handoff
            </dt>
            <dd className="text-xs mt-0.5">
              <Link
                href={`/app/projects/project/${q.handoff.project_id}`}
                className="text-blue-700 font-medium"
              >
                Open project →
              </Link>
            </dd>
          </div>
        )}
      </dl>

      {message && (
        <p className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => sync(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Sync draft
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => sync(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <Send size={14} /> Finalize / send
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          Refresh status
        </button>
        <button
          type="button"
          disabled={pending || Boolean(q.handoff?.project_id)}
          onClick={confirmAccepted}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <CheckCircle2 size={14} /> Confirm accepted → handoff
        </button>
      </div>
    </div>
  );
}
