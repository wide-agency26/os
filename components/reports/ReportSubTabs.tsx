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
  activeClassName = "bg-blue-600 text-white shadow-sm",
}: ReportSubTabsProps) {
  const cols =
    tabs.length <= 4
      ? "grid-cols-2 lg:grid-cols-4"
      : tabs.length === 5
        ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        : "grid-cols-2 lg:grid-cols-3";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-2 shadow-sm">
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
              className={`relative flex items-start gap-2.5 rounded-xl px-3 py-3 text-left transition-all ${
                !t.enabled
                  ? "opacity-45 cursor-not-allowed bg-gray-50 text-gray-400"
                  : active
                    ? activeClassName
                    : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  !t.enabled
                    ? "bg-gray-200/80 text-gray-400"
                    : active
                      ? "bg-white/20 text-white"
                      : "bg-blue-50 text-blue-600"
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
                    active && t.enabled ? "text-white/75" : "text-gray-400"
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
