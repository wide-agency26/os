import { BarChart3 } from "lucide-react";

const TIER_BADGES: Record<string, { label: string; color: string }> = {
  mvb: { label: "MVB", color: "bg-white/15 text-white" },
  launch: { label: "Launch", color: "bg-white/15 text-white" },
  growth: { label: "Growth", color: "bg-white/15 text-white" },
  full_partnership: { label: "Full Partnership", color: "bg-white/15 text-white" },
};

interface FunnelHeaderProps {
  clientName: string;
  packageTier: string;
  periodLabel?: string;
}

/**
 * FunnelHeader — White-labeled branded header for the client report viewer.
 * Shows WIDE branding, client name, package tier badge, and optional period.
 */
export default function FunnelHeader({
  clientName,
  packageTier,
  periodLabel,
}: FunnelHeaderProps) {
  const badge = TIER_BADGES[packageTier] || TIER_BADGES.launch;

  return (
    <div className="bg-accent text-white px-6 py-5 rounded-lg mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <span className="text-text-primary font-black text-sm tracking-tight">W</span>
          </div>

          <div>
            <h2 className="font-semibold text-[16px] tracking-wide flex items-center gap-2">
              <BarChart3 size={18} className="text-white/70" />
              {clientName}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
                {badge.label}
              </span>
            </h2>
            <p className="text-white/60 text-[12px] mt-0.5">
              Digital Funnel Performance Report
              {periodLabel && <span className="ml-2 text-white/45">• {periodLabel}</span>}
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
            <span className="text-white/70">Awareness</span>
          </div>
          <div className="text-white/35">→</div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/60" />
            <span className="text-white/70">Consideration</span>
          </div>
          <div className="text-white/35">→</div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/35" />
            <span className="text-white/70">Conversion</span>
          </div>
        </div>
      </div>
    </div>
  );
}
