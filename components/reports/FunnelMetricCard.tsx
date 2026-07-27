/**
 * FunnelMetricCard — individual funnel stage metric display.
 */

import type { FunnelStage } from "@/lib/reports/report-types";

const STAGE_COLORS: Record<FunnelStage, string> = {
  awareness: "from-blue-500/20 to-blue-600/5 border-blue-500/25",
  consideration: "from-violet-500/20 to-violet-600/5 border-violet-500/25",
  conversion: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/25",
  loyalty: "from-amber-500/20 to-amber-600/5 border-amber-500/25",
};

const STAGE_ACCENTS: Record<FunnelStage, string> = {
  awareness: "text-blue-400",
  consideration: "text-violet-400",
  conversion: "text-emerald-400",
  loyalty: "text-amber-400",
};

type Props = {
  stage: FunnelStage;
  label: string;
  primaryMetric: { label: string; value: string };
  secondaryMetric?: { label: string; value: string };
  delta?: string;
};

export function FunnelMetricCard({
  stage,
  label,
  primaryMetric,
  secondaryMetric,
  delta,
}: Props) {
  const colorClass = STAGE_COLORS[stage];
  const accentClass = STAGE_ACCENTS[stage];

  return (
    <div
      className={`rounded-xl border bg-gradient-to-br p-5 ${colorClass}`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-widest ${accentClass}`}
      >
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-text-primary">
        {primaryMetric.value}
      </p>
      <p className="text-[11px] text-text-muted">{primaryMetric.label}</p>
      {secondaryMetric ? (
        <p className="mt-2 text-sm text-text-secondary">
          {secondaryMetric.value}{" "}
          <span className="text-text-muted">{secondaryMetric.label}</span>
        </p>
      ) : null}
      {delta ? (
        <p
          className={`mt-1 text-xs font-semibold ${
            delta.startsWith("+") ? "text-success" : delta.startsWith("-") ? "text-danger" : "text-text-muted"
          }`}
        >
          {delta}
        </p>
      ) : null}
    </div>
  );
}
