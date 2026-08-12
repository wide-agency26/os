"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Loader2, X } from "lucide-react";
import { submitProposalDecision } from "@/app/actions/proposal-response";
import { BD_DECLINE_REASONS } from "@/lib/bd/proposal-response";

export function ProposalResponseActions({
  linkedId,
  proposalType,
  disabledReason,
}: {
  linkedId: string;
  proposalType: "sow" | "slides";
  disabledReason?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "decline" | "done">("idle");
  const [declineReason, setDeclineReason] = useState("");
  const [otherText, setOtherText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function run(
    decision: "accept" | "decline" | "hold",
    extra?: { declineReason?: string; declineOtherText?: string }
  ) {
    setMessage(null);
    startTransition(async () => {
      const res = await submitProposalDecision({
        linkedId,
        proposalType,
        decision,
        declineReason: extra?.declineReason,
        declineOtherText: extra?.declineOtherText,
      });
      if (!res.ok) {
        setMessage(res.error || "Something went wrong");
        return;
      }
      setMode("done");
      setMessage(
        decision === "accept"
          ? "Thanks — we've marked this accepted and notified the WIDE team."
          : decision === "hold"
            ? "Got it — we'll follow up when the timing is better."
            : "Thanks for the feedback. We've notified the WIDE team."
      );
    });
  }

  if (disabledReason) {
    return (
      <div className="rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white/70">
        {disabledReason}
      </div>
    );
  }

  if (mode === "done") {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        {message}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/15 bg-black/50 backdrop-blur px-4 py-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
        Your decision
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("accept")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-black px-3 py-2 text-xs font-bold disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Accept
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("hold")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 text-black px-3 py-2 text-xs font-bold disabled:opacity-50"
        >
          <Clock size={14} /> Hold
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setMode("decline")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 text-white px-3 py-2 text-xs font-bold border border-white/20 disabled:opacity-50"
        >
          <X size={14} /> Decline
        </button>
      </div>

      {mode === "decline" && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-white/60">Why are you declining?</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {BD_DECLINE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDeclineReason(r)}
                className={`text-left rounded-lg border px-3 py-2 text-xs ${
                  declineReason === r
                    ? "border-white bg-white text-black"
                    : "border-white/20 text-white/80"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {declineReason === "Other" && (
            <textarea
              className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white min-h-[72px]"
              placeholder="Tell us more…"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
            />
          )}
          <button
            type="button"
            disabled={pending || !declineReason}
            onClick={() =>
              run("decline", {
                declineReason,
                declineOtherText: otherText,
              })
            }
            className="rounded-lg bg-white text-black px-3 py-2 text-xs font-bold disabled:opacity-50"
          >
            Submit decline
          </button>
        </div>
      )}

      {message && (
        <p className="text-xs text-amber-200/90">{message}</p>
      )}
    </div>
  );
}
