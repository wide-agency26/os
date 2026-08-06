"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  MessageSquare,
  Send,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

export interface AskAiMessage {
  role: "user" | "assistant";
  content: string;
}

interface ClientAskAiDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  organization: string;
  tab: string;
  dateRangeLabel: string;
  reportContext: Record<string, unknown>;
  onNeedAgencyHelp: (payload: {
    question: string;
    thread: AskAiMessage[];
  }) => void;
}

const SUGGESTIONS = [
  "Why did our CPA change in the selected period?",
  "Which channel drove the most high-intent conversions?",
  "Summarize our overall return on ad spend.",
];

export function ClientAskAiDrawer({
  open,
  onClose,
  projectId,
  projectName,
  organization,
  tab,
  dateRangeLabel,
  reportContext,
  onNeedAgencyHelp,
}: ClientAskAiDrawerProps) {
  const [messages, setMessages] = useState<AskAiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages, loading]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setFeedbackFor(null);
    }
  }, [open]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setError(null);
    setFeedbackFor(null);
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/reports/client-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          organization,
          tab,
          dateRange: dateRangeLabel,
          question: q,
          reportContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ask AI failed");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer || "No answer returned." },
      ]);
    } catch (e: any) {
      setError(e.message || "Ask AI failed");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end no-print">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Close Ask AI"
        onClick={onClose}
      />
      <aside className="relative w-full max-w-md h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right">
        <header className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-gray-900">
              <MessageSquare size={16} className="text-indigo-600" />
              <h2 className="text-[15px] font-bold">AI Report Assistant</h2>
            </div>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
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
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-gray-500">
                Suggested questions
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void ask(s)}
                    className="text-left text-[13px] px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40 text-gray-800"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`rounded-xl px-3 py-2.5 text-[13px] leading-relaxed ${
                m.role === "user"
                  ? "bg-indigo-600 text-white ml-6"
                  : "bg-gray-50 border border-gray-200 text-gray-800 mr-2"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 mb-1">
                {m.role === "user" ? "You" : "AI"}
              </p>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "assistant" && feedbackFor !== i && (
                <div className="mt-3 pt-2 border-t border-gray-200 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-gray-500">Was this helpful?</span>
                  <button
                    type="button"
                    onClick={() => setFeedbackFor(i)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100"
                  >
                    <ThumbsUp size={12} /> Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackFor(i);
                      const lastUser = [...messages]
                        .slice(0, i)
                        .reverse()
                        .find((x) => x.role === "user");
                      onNeedAgencyHelp({
                        question: lastUser?.content || m.content,
                        thread: messages.slice(0, i + 1),
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-100"
                  >
                    <ThumbsDown size={12} /> No, I need agency help
                  </button>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-[12px] text-gray-500">
              <Loader2 size={14} className="animate-spin" /> Analyzing report context…
            </div>
          )}
          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <footer className="p-3 border-t border-gray-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this report…"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
            >
              <Send size={15} />
            </button>
          </form>
        </footer>
      </aside>
    </div>
  );
}
