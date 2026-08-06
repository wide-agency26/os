"use client";

import { Lock } from "lucide-react";
import { formatCompact } from "@/lib/reports/ga4-website";

export interface HourglassStage {
  id: string;
  label: string;
  value: number;
  /** Actual data metric shown under the number (e.g. Impressions) */
  metricHint?: string;
  locked?: boolean;
  lockedHint?: string;
}

interface HourglassFunnelProps {
  stages: HourglassStage[];
  className?: string;
}

function rate(from: number, to: number): number | null {
  if (from <= 0) return null;
  return (to / from) * 100;
}

function dropoff(from: number, to: number): number | null {
  if (from <= 0) return null;
  return ((from - to) / from) * 100;
}

/**
 * Custom hourglass funnel — awareness → consideration → conversion waist,
 * then locked loyalty / advocacy blocks. No MUI dependency.
 */
export function HourglassFunnel({ stages, className = "" }: HourglassFunnelProps) {
  const active = stages.filter((s) => !s.locked);
  const locked = stages.filter((s) => s.locked);
  const max = Math.max(...active.map((s) => s.value), 1);

  return (
    <div className={`space-y-0 ${className}`}>
      {active.map((stage, i) => {
        const widthPct = Math.max(28, Math.min(100, (stage.value / max) * 100));
        const next = active[i + 1];
        const conv = next ? rate(stage.value, next.value) : null;
        const drop = next ? dropoff(stage.value, next.value) : null;
        const colors = [
          "from-indigo-500 to-blue-600",
          "from-violet-500 to-indigo-600",
          "from-emerald-500 to-teal-600",
        ];
        const grad = colors[i % colors.length];

        return (
          <div key={stage.id} className="relative">
            <div className="flex justify-center">
              <div
                className={`relative bg-gradient-to-b ${grad} text-white shadow-md transition-all`}
                style={{
                  width: `${widthPct}%`,
                  clipPath:
                    i === 0
                      ? "polygon(0 0, 100% 0, 92% 100%, 8% 100%)"
                      : i === active.length - 1
                        ? "polygon(8% 0, 92% 0, 78% 100%, 22% 100%)"
                        : "polygon(8% 0, 92% 0, 85% 100%, 15% 100%)",
                  borderRadius: i === 0 ? "12px 12px 0 0" : undefined,
                }}
              >
                <div className="px-4 py-5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
                    {i + 1}. {stage.label}
                  </p>
                  <p className="text-[26px] font-bold tabular-nums mt-1 leading-none">
                    {formatCompact(stage.value)}
                  </p>
                  {stage.metricHint && (
                    <p className="text-[11px] text-white/70 mt-1.5 leading-snug px-1">
                      {stage.metricHint}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {next && (
              <div className="flex justify-center py-2">
                <div className="inline-flex flex-col sm:flex-row items-center gap-2 text-[11px] px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600">
                  {drop != null && (
                    <span className="text-amber-700 font-semibold">
                      Drop-off {drop.toFixed(1)}%
                    </span>
                  )}
                  {conv != null && (
                    <span className="text-emerald-700 font-semibold">
                      → {conv.toFixed(2)}% conversion
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {locked.length > 0 && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {locked.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-center"
            >
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                <Lock size={12} /> {s.label}
              </div>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                {s.lockedHint || "Coming soon — connect CRM data"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
