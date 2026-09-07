"use client";

import type { ElementType } from "react";
import { Lock } from "lucide-react";

export interface ReportSubTab {
  id: string;
  label: string;
  hint: string;
  icon: ElementType;
  enabled: boolean;
}

interface ReportSubTabsProps {
  tabs: ReportSubTab[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  activeClassName?: string;
}

export function ReportSubTabs({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  activeClassName = "bg-accent text-white",
}: ReportSubTabsProps) {
  const cols =
    tabs.length <= 4
      ? "grid-cols-2 lg:grid-cols-4"
      : tabs.length === 5
        ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        : "grid-cols-2 lg:grid-cols-3";

  return (
    <div className="bg-surface border border-border rounded-lg p-2">
      <div className={`grid ${cols} gap-1.5`} role="tablist" aria-label={ariaLabel}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={!t.enabled}
              disabled={!t.enabled}
              title={t.enabled ? t.hint : "Coming soon"}
              onClick={() => t.enabled && onChange(t.id)}
              className={`relative flex items-start gap-2.5 rounded-md px-3 py-3 text-left transition-colors ${
                !t.enabled
                  ? "opacity-45 cursor-not-allowed bg-surface-raised text-text-muted"
                  : active
                    ? activeClassName
                    : "text-text-secondary hover:bg-surface-raised"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                  !t.enabled
                    ? "bg-surface-raised text-text-muted"
                    : active
                      ? "bg-white/20 text-white"
                      : "bg-surface-raised text-text-secondary"
                }`}
              >
                <Icon size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold truncate">{t.label}</span>
                  {!t.enabled && <Lock size={11} className="shrink-0 opacity-70" />}
                </div>
                <p
                  className={`text-[10px] mt-0.5 truncate ${
                    active && t.enabled ? "text-white/75" : "text-text-muted"
                  }`}
                >
                  {t.enabled ? t.hint : "Coming soon"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
