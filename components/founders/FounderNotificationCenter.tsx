"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import {
  listFounderNotifications,
  resolveFounderNotification,
  type FounderNotificationRow,
} from "@/app/actions/founder-notifications";

const SEVERITY_STYLES: Record<
  FounderNotificationRow["severity_level"],
  { dot: string; title: string }
> = {
  Critical: { dot: "bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]", title: "text-orange-400" },
  Success: { dot: "bg-emerald-500/80", title: "text-emerald-400" },
  Warning: { dot: "bg-amber-500/80", title: "text-amber-300" },
  Info: { dot: "bg-zinc-500", title: "text-zinc-200" },
};

export function FounderNotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FounderNotificationRow[]>([]);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const res = await listFounderNotifications();
      setItems(res.notifications);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const resolve = (id: string) => {
    startTransition(async () => {
      await resolveFounderNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
        aria-label="Open notification center"
      >
        <Bell className="h-4 w-4" />
        {items.length > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00FF00] px-1 text-[9px] font-bold text-zinc-950">
            {items.length > 9 ? "9+" : items.length}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#00FF00]">Founder alerts</p>
                  <h2 className="text-lg font-semibold text-zinc-50">Notification center</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-zinc-500 hover:text-zinc-200"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {items.length === 0 ? (
                  <p className="py-12 text-center text-sm text-zinc-500">No active alerts.</p>
                ) : (
                  <ul className="space-y-3">
                    {items.map((n) => {
                      const style = SEVERITY_STYLES[n.severity_level];
                      return (
                        <li
                          key={n.id}
                          className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4"
                        >
                          <div className="flex gap-3">
                            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-semibold ${style.title}`}>{n.title}</p>
                              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{n.message}</p>
                              <p className="mt-2 text-[10px] text-zinc-600">
                                {new Date(n.created_at).toLocaleString()}
                              </p>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => resolve(n.id)}
                                className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-[#00FF00]"
                              >
                                Mark as resolved
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
