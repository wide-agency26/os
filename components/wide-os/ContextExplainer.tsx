"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Dismissible, collapsible context bar shown at the top of dashboard views.
 * Explains exactly what data / filters the current surface is running.
 */
export function ContextExplainer({
  title,
  description,
  storageKey,
}: {
  title: string;
  description: string;
  /** Optional: persist dismissal across reloads for this view. */
  storageKey?: string;
}) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined" || !storageKey) return true;
    return window.localStorage.getItem(`ctx:${storageKey}`) !== "dismissed";
  });

  const dismiss = () => {
    setOpen(false);
    if (storageKey && typeof window !== "undefined") {
      window.localStorage.setItem(`ctx:${storageKey}`, "dismissed");
    }
  };

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="ctx"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 backdrop-blur-md">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#00FF00]/30 bg-[#00FF00]/10">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#00FF00]" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 16v-4" strokeLinecap="round" />
                <path d="M12 8h.01" strokeLinecap="round" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{description}</p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
