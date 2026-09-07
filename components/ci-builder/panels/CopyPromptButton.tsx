"use client";

import { getSubModule } from "@/lib/ci-builder/modules-catalog";
import { toPromptText } from "@/lib/ci-builder/prompts";
import type { CISection } from "@/lib/ci-builder/types";
import { CI_PROMPT_CHIP_CLASS } from "@/lib/ci-builder/theme-css";
import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * Catalog-wide copy prompt. AI System Prompt copies raw `data.prompt`;
 * other sub-modules use interpolated `promptTemplate`.
 */
export function CopyPromptButton({
  section,
  brandName,
  className,
  label = "Copy prompt",
}: {
  section: Partial<CISection>;
  brandName?: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const resolveText = () => {
    if (section.section_type === "ai_system_prompt") {
      return String((section.data as { prompt?: string })?.prompt || "").trim();
    }
    const def = getSubModule(section.section_type || "");
    if (!def?.promptTemplate) return "";
    return toPromptText(section, { "Brand Name": brandName || "Brand" });
  };

  const onCopy = async () => {
    const text = resolveText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const text = resolveText();
  if (!text) return null;

  return (
    <button
      type="button"
      onClick={onCopy}
      className={className || CI_PROMPT_CHIP_CLASS}
      title={label}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}
