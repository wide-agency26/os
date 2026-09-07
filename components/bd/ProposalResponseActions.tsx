"use client";

import { ReactNode, useState, useTransition } from "react";
import { Check, Clock, Loader2, X } from "lucide-react";
import { submitProposalDecision } from "@/app/actions/proposal-response";
import { BD_DECLINE_REASONS } from "@/lib/bd/proposal-response";

type Decision = "accept" | "decline" | "hold";

export function ProposalResponseChrome({
  linkedId,
  proposalType,
  disabledReason,
  appearance = "light",
  children,
}: {
  linkedId: string;
  proposalType: "sow" | "slides";
  disabledReason?: string | null;
  /** Footer card surface — sticky icons stay the same on both. */
  appearance?: "light" | "dark";
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "decline" | "done">("idle");
  const [declineReason, setDeclineReason] = useState("");
  const [otherText, setOtherText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function run(
    decision: Decision,
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

  const scrollToFooter = () => {
    document.getElementById("proposal-decision")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const disabled = Boolean(disabledReason) || mode === "done" || pending;

  return (
    <>
      {/* Compact sticky — icon-only, stays out of the way */}
      {!disabledReason && mode !== "done" && (
        <div className="sticky top-3 z-30 flex justify-end px-3 pointer-events-none">
          <div
            className="pointer-events-auto inline-flex items-center gap-0.5 rounded-full border border-black/10 bg-white/90 shadow-lg shadow-black/10 backdrop-blur-md p-1"
            role="toolbar"
            aria-label="Proposal decision"
          >
            <IconBtn
              label="Accept"
              title="Accept"
              disabled={disabled}
              onClick={() => run("accept")}
              className="bg-emerald-500 text-black hover:bg-emerald-400"
            >
              {pending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} strokeWidth={2.5} />
              )}
            </IconBtn>
            <IconBtn
              label="Hold"
              title="Hold"
              disabled={disabled}
              onClick={() => run("hold")}
              className="bg-amber-400 text-black hover:bg-amber-300"
            >
              <Clock size={14} strokeWidth={2.5} />
            </IconBtn>
            <IconBtn
              label="Decline"
              title="Decline — open details"
              disabled={disabled}
              onClick={() => {
                setMode("decline");
                scrollToFooter();
              }}
              className="bg-neutral-900 text-white hover:bg-neutral-800"
            >
              <X size={14} strokeWidth={2.5} />
            </IconBtn>
          </div>
        </div>
      )}

      {children}

      {/* Full actions at end of page */}
      <div id="proposal-decision" className="max-w-3xl mx-auto px-4 pb-16 pt-4">
        {disabledReason ? (
          <div
            className={
              appearance === "dark"
                ? "rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/70"
                : "rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-neutral-600"
            }
          >
            {disabledReason}
          </div>
        ) : mode === "done" ? (
          <div
            className={
              appearance === "dark"
                ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
                : "rounded-xl border border-emerald-500/25 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            }
          >
            {message}
          </div>
        ) : (
          <div
            className={
              appearance === "dark"
                ? "rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5 space-y-4"
                : "rounded-2xl border border-black/10 bg-white shadow-sm px-5 py-5 space-y-4"
            }
          >
            <div>
              <p
                className={
                  appearance === "dark"
                    ? "text-xs font-semibold uppercase tracking-wide text-white/40"
                    : "text-xs font-semibold uppercase tracking-wide text-neutral-400"
                }
              >
                Your decision
              </p>
              <p
                className={
                  appearance === "dark"
                    ? "mt-1 text-sm text-white/60"
                    : "mt-1 text-sm text-neutral-600"
                }
              >
                Accept, put on hold, or decline when you&apos;re ready.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run("accept")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-black px-3.5 py-2 text-xs font-bold disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Accept
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run("hold")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 text-black px-3.5 py-2 text-xs font-bold disabled:opacity-50"
              >
                <Clock size={14} /> Hold
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setMode("decline")}
                className={
                  appearance === "dark"
                    ? "inline-flex items-center gap-1.5 rounded-lg bg-white/10 text-white px-3.5 py-2 text-xs font-bold border border-white/20 disabled:opacity-50"
                    : "inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 text-neutral-800 px-3.5 py-2 text-xs font-bold border border-black/10 disabled:opacity-50"
                }
              >
                <X size={14} /> Decline
              </button>
            </div>

            {mode === "decline" && (
              <div
                className={
                  appearance === "dark"
                    ? "space-y-2 pt-1 border-t border-white/10"
                    : "space-y-2 pt-1 border-t border-black/5"
                }
              >
                <p
                  className={
                    appearance === "dark"
                      ? "text-xs text-white/50 pt-3"
                      : "text-xs text-neutral-500 pt-3"
                  }
                >
                  Why are you declining?
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {BD_DECLINE_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDeclineReason(r)}
                      className={
                        declineReason === r
                          ? appearance === "dark"
                            ? "text-left rounded-lg border border-white bg-white text-black px-3 py-2 text-xs"
                            : "text-left rounded-lg border border-neutral-900 bg-neutral-900 text-white px-3 py-2 text-xs"
                          : appearance === "dark"
                            ? "text-left rounded-lg border border-white/20 text-white/80 px-3 py-2 text-xs hover:bg-white/5"
                            : "text-left rounded-lg border border-black/10 text-neutral-700 px-3 py-2 text-xs hover:bg-neutral-50"
                      }
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {declineReason === "Other" && (
                  <textarea
                    className={
                      appearance === "dark"
                        ? "w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white min-h-[72px]"
                        : "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 min-h-[72px]"
                    }
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
                  className={
                    appearance === "dark"
                      ? "rounded-lg bg-white text-black px-3 py-2 text-xs font-bold disabled:opacity-50"
                      : "rounded-lg bg-neutral-900 text-white px-3 py-2 text-xs font-bold disabled:opacity-50"
                  }
                >
                  Submit decline
                </button>
              </div>
            )}

            {message && (
              <p
                className={
                  appearance === "dark"
                    ? "text-xs text-amber-200/90"
                    : "text-xs text-amber-700"
                }
              >
                {message}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/** @deprecated Prefer ProposalResponseChrome — kept for any legacy imports */
export function ProposalResponseActions(
  props: {
    linkedId: string;
    proposalType: "sow" | "slides";
    disabledReason?: string | null;
  }
) {
  return <ProposalResponseChrome {...props}>{null}</ProposalResponseChrome>;
}

function IconBtn({
  children,
  label,
  title,
  disabled,
  onClick,
  className,
}: {
  children: ReactNode;
  label: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-40 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
