"use client";

import { useState, useTransition } from "react";
import { updateSeoSite } from "@/app/actions/seo-run";

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[2px] h-3.5 w-3.5 shrink-0 rounded border-gray-300 accent-gray-900"
      />
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-gray-700">{label}</span>
        <span className="block text-[10px] leading-snug text-gray-400">{hint}</span>
      </span>
    </label>
  );
}

export function SiteToggles({
  siteId,
  isClientVisible,
  monthlyRerun,
}: {
  siteId: string;
  isClientVisible: boolean;
  monthlyRerun: boolean;
}) {
  const [visible, setVisible] = useState(isClientVisible);
  const [monthly, setMonthly] = useState(monthlyRerun);
  const [pending, startTransition] = useTransition();

  const save = (patch: { isClientVisible?: boolean; monthlyRerun?: boolean }) => {
    startTransition(async () => {
      const res = await updateSeoSite({ siteId, ...patch });
      if (!res.ok) {
        // Roll back so the switch never shows a state the database does not have.
        setVisible(isClientVisible);
        setMonthly(monthlyRerun);
      }
    });
  };

  return (
    <div className="space-y-1.5 border-t border-gray-100 pt-2">
      <Toggle
        label="Visible to client"
        hint="Shows the latest finished audit in their portal"
        checked={visible}
        disabled={pending}
        onChange={(next) => {
          setVisible(next);
          save({ isClientVisible: next });
        }}
      />
      <Toggle
        label="Re-audit monthly"
        hint="Automatic re-run every 30 days for trend comparison"
        checked={monthly}
        disabled={pending}
        onChange={(next) => {
          setMonthly(next);
          save({ monthlyRerun: next });
        }}
      />
    </div>
  );
}
