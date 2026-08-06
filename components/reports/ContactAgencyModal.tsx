"use client";

import { useEffect, useState } from "react";
import { Loader2, Rocket, X } from "lucide-react";
import type { AskAiMessage } from "@/components/reports/ClientAskAiDrawer";

interface ContactAgencyModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  organization: string;
  tab: string;
  dateRangeLabel: string;
  initialQuestion: string;
  thread: AskAiMessage[];
  reportSnapshot: Record<string, unknown>;
}

export function ContactAgencyModal({
  open,
  onClose,
  projectId,
  projectName,
  organization,
  tab,
  dateRangeLabel,
  initialQuestion,
  thread,
  reportSnapshot,
}: ContactAgencyModalProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      setQuestion(initialQuestion);
      setError(null);
      setSent(false);
      setSending(false);
    }
  }, [open, initialQuestion]);

  if (!open) return null;

  const send = async () => {
    const q = question.trim();
    if (!q) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          organization,
          tab,
          dateRange: dateRangeLabel,
          question: q,
          threadSnapshot: thread,
          reportSnapshot,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setSent(true);
    } catch (e: any) {
      setError(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 no-print">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-[16px] font-bold text-gray-900">Contact agency strategist</h3>
            <p className="text-[12px] text-gray-500 mt-1">
              {projectName} · {tab} · {dateRangeLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        {sent ? (
          <div className="space-y-4">
            <p className="text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
              Message sent. Your account strategist will follow up with context from this report
              snapshot attached.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-[13px] font-semibold"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Question / inquiry
              </span>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={5}
                className="mt-1.5 w-full border border-gray-300 rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <p className="text-[12px] text-gray-500">
              Attaching active report snapshot…{" "}
              <span className="text-emerald-700 font-semibold">Included</span>
            </p>
            {error && (
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-[13px] rounded-lg border border-gray-300 text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sending || !question.trim()}
                onClick={() => void send()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-lg bg-indigo-600 text-white disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Rocket size={14} />
                )}
                Send to account strategist
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
