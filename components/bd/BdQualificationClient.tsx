"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  confirmBdQualification,
  saveBdQualification,
} from "@/app/actions/bd";
import {
  BD_LEGITIMACY_LABELS,
  BD_STAGE_LABELS,
  initialsFromName,
} from "@/lib/bd/constants";
import {
  DEMAND_SIGNAL_TYPES,
  adviceFromRecord,
  guessWebsiteFromCompany,
  type BdQualificationAdvice,
} from "@/lib/bd/qualification";
import type {
  BdDemandSignal,
  BdLegitimacyStatus,
  BdRecord,
} from "@/lib/bd/types";

function emptySignal(): BdDemandSignal {
  return {
    type: "Hiring",
    description: "",
    source: "",
    date_found: new Date().toISOString().slice(0, 10),
  };
}

export function BdQualificationClient({
  initial,
  autoOpenStub,
}: {
  initial: BdRecord;
  autoOpenStub?: boolean;
}) {
  const router = useRouter();
  const [record, setRecord] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmReason, setConfirmReason] = useState("");
  const [stubRan, setStubRan] = useState(Boolean(autoOpenStub));

  const advice: BdQualificationAdvice = useMemo(
    () =>
      adviceFromRecord({
        ...record,
        demand_signals: record.demand_signals,
      }),
    [record]
  );

  const guessedSite = guessWebsiteFromCompany(record.company_name);

  function runQualificationStub() {
    setStubRan(true);
    setMessage(
      `Qualification shell opened. Suggested research URL (not crawled yet): ${guessedSite}`
    );
    if (!record.legitimacy_reason) {
      setRecord((r) => ({
        ...r,
        legitimacy_reason:
          r.legitimacy_reason ||
          `Manual review started. Candidate site: ${guessedSite}`,
      }));
    }
    if (record.demand_signals.length === 0) {
      setRecord((r) => ({
        ...r,
        demand_signals: [
          {
            type: "Other",
            description: "Pending research — fill after review",
            source: guessedSite,
            date_found: new Date().toISOString().slice(0, 10),
          },
        ],
      }));
    }
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await saveBdQualification({
        id: record.id,
        legitimacy_status: record.legitimacy_status,
        legitimacy_reason: record.legitimacy_reason,
        demand_signals: record.demand_signals,
      });
      if (!res.ok) {
        setMessage(res.error || "Save failed");
        return;
      }
      setMessage(
        `Saved. System recommendation: ${res.recommendation} — confirm below to change stage.`
      );
      router.refresh();
    });
  }

  function openConfirm() {
    setConfirmReason(record.legitimacy_reason || "");
    setConfirmOpen(true);
  }

  function confirm() {
    setMessage(null);
    startTransition(async () => {
      // Persist latest fields first so server recomputes the same advice
      const saved = await saveBdQualification({
        id: record.id,
        legitimacy_status: record.legitimacy_status,
        legitimacy_reason: record.legitimacy_reason,
        demand_signals: record.demand_signals,
      });
      if (!saved.ok || !saved.recommendation) {
        setMessage(saved.error || "Save failed before confirm");
        return;
      }

      const res = await confirmBdQualification({
        id: record.id,
        recommendation: saved.recommendation,
        confirm_reason: confirmReason || record.legitimacy_reason,
      });
      if (!res.ok) {
        setMessage(res.error || "Confirmation failed");
        return;
      }
      setConfirmOpen(false);
      setMessage(
        `Confirmed — stage is now ${res.stage ? BD_STAGE_LABELS[res.stage] : "updated"}.`
      );
      router.refresh();
      router.push(`/app/bd/${record.id}`);
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/app/bd/${record.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={14} /> Record
          </Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
            {initialsFromName(record.name)}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 truncate">
              Qualification — {record.name}
            </h1>
            <p className="text-sm text-gray-500 truncate">
              {record.company_name} · {BD_STAGE_LABELS[record.stage]}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={runQualificationStub}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-900 px-3 py-2 text-xs font-semibold hover:bg-violet-100"
        >
          <Sparkles size={14} /> Run Qualification
        </button>
      </div>

      {message && (
        <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      {stubRan && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-xs text-violet-950 space-y-1">
          <p className="font-semibold">Research stub (no crawl in Phase 2)</p>
          <p>
            Pre-filled hints from company name. Suggested site:{" "}
            <a
              className="underline font-medium"
              href={guessedSite}
              target="_blank"
              rel="noreferrer"
            >
              {guessedSite}
            </a>
          </p>
          <p className="text-violet-800/80">
            Automated crawling lands in later work — fill legitimacy + demand
            signals manually for now.
          </p>
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Legitimacy
        </h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BD_LEGITIMACY_LABELS) as BdLegitimacyStatus[]).map(
            (s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setRecord({ ...record, legitimacy_status: s })
                }
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${
                  record.legitimacy_status === s
                    ? s === "pass"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : s === "fail"
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {BD_LEGITIMACY_LABELS[s]}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() =>
              setRecord({ ...record, legitimacy_status: null })
            }
            className="rounded-full px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-500"
          >
            Clear
          </button>
        </div>
        <label className="block space-y-1 text-xs font-medium text-gray-700">
          Legitimacy reason
          <textarea
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[80px]"
            value={record.legitimacy_reason || ""}
            onChange={(e) =>
              setRecord({ ...record, legitimacy_reason: e.target.value })
            }
            placeholder="Why pass / fail / uncertain?"
          />
        </label>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Demand signals
          </h2>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"
            onClick={() =>
              setRecord({
                ...record,
                demand_signals: [...record.demand_signals, emptySignal()],
              })
            }
          >
            <Plus size={14} /> Add signal
          </button>
        </div>
        {record.demand_signals.length === 0 ? (
          <p className="text-xs text-gray-400">
            No signals yet — add hiring, funding, rebrand, etc.
          </p>
        ) : (
          <div className="space-y-3">
            {record.demand_signals.map((sig, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-gray-200 p-3 space-y-2 bg-gray-50/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <select
                    className="rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white"
                    value={sig.type}
                    onChange={(e) => {
                      const demand_signals = record.demand_signals.map((s, i) =>
                        i === idx ? { ...s, type: e.target.value } : s
                      );
                      setRecord({ ...record, demand_signals });
                    }}
                  >
                    {DEMAND_SIGNAL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                    onClick={() =>
                      setRecord({
                        ...record,
                        demand_signals: record.demand_signals.filter(
                          (_, i) => i !== idx
                        ),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
                  placeholder="Description"
                  value={sig.description}
                  onChange={(e) => {
                    const demand_signals = record.demand_signals.map((s, i) =>
                      i === idx ? { ...s, description: e.target.value } : s
                    );
                    setRecord({ ...record, demand_signals });
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-md border border-gray-200 px-2 py-1.5 text-xs"
                    placeholder="Source URL / note"
                    value={sig.source}
                    onChange={(e) => {
                      const demand_signals = record.demand_signals.map((s, i) =>
                        i === idx ? { ...s, source: e.target.value } : s
                      );
                      setRecord({ ...record, demand_signals });
                    }}
                  />
                  <input
                    type="date"
                    className="rounded-md border border-gray-200 px-2 py-1.5 text-xs"
                    value={sig.date_found?.slice(0, 10) || ""}
                    onChange={(e) => {
                      const demand_signals = record.demand_signals.map((s, i) =>
                        i === idx ? { ...s, date_found: e.target.value } : s
                      );
                      setRecord({ ...record, demand_signals });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-900 bg-gray-900 text-white p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
          System recommendation
        </h2>
        <p className="text-lg font-semibold">{advice.label}</p>
        <ul className="space-y-1.5">
          {advice.reasoning.map((line) => (
            <li key={line} className="text-sm text-white/70 flex gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 opacity-60" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-white/45">
          Recommendations never move the card by themselves — you must confirm.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/15 disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : null}
            Save qualification
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={openConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white text-gray-900 px-3 py-2 text-xs font-semibold hover:bg-gray-100 disabled:opacity-50"
          >
            Confirm → {BD_STAGE_LABELS[advice.targetStage]}
          </button>
        </div>
      </section>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => !pending && setConfirmOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              Confirm recommendation?
            </h3>
            <p className="text-sm text-gray-600">
              This will move the record to{" "}
              <strong>{BD_STAGE_LABELS[advice.targetStage]}</strong>. Nothing is
              deleted.
            </p>
            {(advice.requiresReason ||
              advice.recommendation === "disqualify") && (
              <label className="block space-y-1 text-xs font-medium text-gray-700">
                Reason (required for disqualify)
                <textarea
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[72px]"
                  value={confirmReason}
                  onChange={(e) => setConfirmReason(e.target.value)}
                  placeholder="Why archive / disqualify?"
                />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-gray-900 text-white disabled:opacity-50"
                disabled={
                  pending ||
                  (advice.recommendation === "disqualify" &&
                    !confirmReason.trim() &&
                    !record.legitimacy_reason?.trim())
                }
                onClick={confirm}
              >
                {pending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Confirm move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
