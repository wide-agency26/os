"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { triggerToast } from "../Toast";

export interface CopyableValueProps {
  value: string;
  label?: string;
  displayValue?: React.ReactNode;
  /** When true, show label (or "Copy") instead of the raw value — use when the value is already on screen. */
  hideValue?: boolean;
  className?: string;
  iconClassName?: string;
  showIcon?: boolean;
}

export function CopyableValue({
  value,
  label,
  displayValue,
  hideValue = false,
  className = "",
  iconClassName = "w-3 h-3 opacity-90",
  showIcon = true,
}: CopyableValueProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    triggerToast(`"${label || value}" copied`);
    setTimeout(() => setCopied(false), 2000);
  };

  const shown =
    displayValue ??
    (hideValue ? (
      <span className="text-xs font-medium text-[var(--ci-prompt-fg,#fff)]">
        {label || "Copy"}
      </span>
    ) : (
      value
    ));

  return (
    <span
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 cursor-pointer group/copy select-none rounded-md px-2 py-0.5 bg-[var(--ci-prompt-bg,#111)] text-[var(--ci-prompt-fg,#fff)] hover:opacity-90 transition-opacity ${className}`}
      title={value ? `Click to copy${label ? ` ${label}` : ""}` : undefined}
    >
      <span>{shown}</span>
      {showIcon && (
        <span className="shrink-0 transition-all group-hover/copy:scale-110">
          {copied ? (
            <Check className="w-3 h-3 opacity-90" />
          ) : (
            <Copy className={iconClassName || "w-3 h-3"} />
          )}
        </span>
      )}
    </span>
  );
}
