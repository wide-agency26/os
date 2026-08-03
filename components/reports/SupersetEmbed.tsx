"use client";

import { useEffect, useRef, useState } from "react";
import { embedDashboard } from "@superset-ui/embedded-sdk";

interface SupersetEmbedProps {
  dashboardUuid: string;
  fetchGuestToken: () => Promise<string>;
  className?: string;
}

/**
 * SupersetEmbed — Client component that renders an Apache Superset dashboard
 * using the @superset-ui/embedded-sdk. Handles token lifecycle and responsive sizing.
 */
export default function SupersetEmbed({
  dashboardUuid,
  fetchGuestToken,
  className = "",
}: SupersetEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !dashboardUuid) return;

    const supersetUrl = process.env.NEXT_PUBLIC_SUPERSET_URL;
    if (!supersetUrl) {
      setError("Superset URL not configured. Set NEXT_PUBLIC_SUPERSET_URL.");
      setLoading(false);
      return;
    }

    let mounted = true;

    async function mount() {
      try {
        await embedDashboard({
          id: dashboardUuid,
          supersetDomain: supersetUrl!,
          mountPoint: containerRef.current!,
          fetchGuestToken: async () => {
            const token = await fetchGuestToken();
            return token;
          },
          dashboardUiConfig: {
            hideTitle: true,
            hideChartControls: true,
            hideTab: false,
            filters: {
              visible: false,
              expanded: false,
            },
          },
        });

        if (mounted) {
          setLoading(false);

          // Style the embedded iframe to be fully responsive
          const iframe = containerRef.current?.querySelector("iframe");
          if (iframe) {
            iframe.style.width = "100%";
            iframe.style.minHeight = "800px";
            iframe.style.height = "100%";
            iframe.style.border = "none";
            iframe.style.borderRadius = "8px";
          }
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || "Failed to embed dashboard");
          setLoading(false);
        }
      }
    }

    mount();

    return () => {
      mounted = false;
    };
  }, [dashboardUuid, fetchGuestToken]);

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-8 text-center ${className}`}>
        <div className="text-red-600 font-semibold text-sm mb-2">Dashboard Error</div>
        <p className="text-red-500 text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-[13px] text-gray-500 font-medium">
              Loading dashboard…
            </span>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full min-h-[800px] rounded-lg overflow-hidden"
      />
    </div>
  );
}
