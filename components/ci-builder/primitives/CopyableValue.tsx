"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { triggerToast } from "../Toast";

export interface CopyableValueProps {
  value: string;
  label?: string;
  displayValue?: React.ReactNode;
  className?: string;
  iconClassName?: string;
  showIcon?: boolean;
}

export function CopyableValue({
  value,
  label,
  displayValue,
  className = "",
  iconClassName = "w-3 h-3 text-gray-400 hover:text-blue-600",
  showIcon = true
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

  return (
    <span
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 cursor-pointer group/copy hover:text-blue-600 transition-colors select-none ${className}`}
      title={`Click to copy "${value}"`}
    >
      <span>{displayValue || value}</span>
      {showIcon && (
        <span className="shrink-0 transition-all group-hover/copy:scale-110">
          {copied ? (
            <Check className="w-3 h-3 text-emerald-600" />
          ) : (
            <Copy className={iconClassName} />
          )}
        </span>
      )}
    </span>
  );
}
