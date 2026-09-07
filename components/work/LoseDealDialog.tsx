"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/frappe-ui/primitives";

export function LoseDealDialog({
  open,
  pending,
  defaultReason,
  onClose,
  onConfirm,
}: {
  open: boolean;
  pending?: boolean;
  defaultReason?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState(defaultReason || "");

  useEffect(() => {
    if (open) setReason(defaultReason || "");
  }, [open, defaultReason]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="lose-deal-title"
        className="w-full max-w-md rounded-lg border border-border bg-surface shadow-lg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="lose-deal-title" className="text-base font-semibold text-text-primary">
          Move to Lose
        </h2>
        <p className="text-[13px] text-text-secondary mt-1">
          This takes the pipeline card and the project off Live. Identified euros drop off.
        </p>
        <label className="block mt-3 text-[12px] font-medium text-text-secondary">
          Why didn’t this go through?
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary outline-none focus:border-text-muted"
            placeholder="Budget, timing, went with someone else…"
            autoFocus
          />
        </label>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" className={buttonClass("ghost")} onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className={buttonClass("danger")}
            disabled={pending || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending ? "Moving…" : "Move to Lose"}
          </button>
        </div>
      </div>
    </div>
  );
}
