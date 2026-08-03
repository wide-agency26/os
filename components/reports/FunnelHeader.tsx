import { BarChart3 } from "lucide-react";

const TIER_BADGES: Record<string, { label: string; color: string }> = {
  mvb: { label: "MVB", color: "bg-gray-100 text-gray-700" },
  launch: { label: "Launch", color: "bg-blue-100 text-blue-700" },
  growth: { label: "Growth", color: "bg-purple-100 text-purple-700" },
  full_partnership: { label: "Full Partnership", color: "bg-amber-100 text-amber-800" },
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
    <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white px-6 py-5 rounded-xl shadow-lg mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* WIDE Logo Mark */}
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-inner">
            <span className="text-gray-900 font-black text-sm tracking-tight">W</span>
          </div>

          <div>
            <h2 className="font-bold text-[16px] tracking-wide flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-400" />
              {clientName}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
                {badge.label}
              </span>
            </h2>
            <p className="text-gray-400 text-[12px] mt-0.5">
              Digital Funnel Performance Report
              {periodLabel && <span className="ml-2 text-gray-500">• {periodLabel}</span>}
            </p>
          </div>
        </div>

        {/* Funnel Stage Legend */}
        <div className="hidden md:flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-gray-400">Awareness</span>
          </div>
          <div className="text-gray-600">→</div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            <span className="text-gray-400">Consideration</span>
          </div>
          <div className="text-gray-600">→</div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="text-gray-400">Conversion</span>
          </div>
        </div>
      </div>
    </div>
  );
}
