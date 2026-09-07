"use client";

import { Eye, EyeOff } from "lucide-react";

export function ClientVisibleToggle({
  visible,
  disabled,
  onChange,
}: {
  visible: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      data-row-control
      data-card-control
      disabled={disabled}
      title={
        visible
          ? "Visible to client — click to hide"
          : "Hidden from client — click to show"
      }
      aria-label={visible ? "Hide from client" : "Show to client"}
      aria-pressed={visible}
      className={`inline-flex items-center justify-center w-8 h-8 min-h-8 rounded-md shrink-0 ${
        visible
          ? "text-text-primary hover:bg-surface-raised"
          : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onChange(!visible);
      }}
    >
      {visible ? <Eye size={14} strokeWidth={1.75} /> : <EyeOff size={14} strokeWidth={1.75} />}
    </button>
  );
}
