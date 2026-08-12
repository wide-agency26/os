"use client";

import { useEffect } from "react";
import type { SowDocument } from "@/lib/sow/types";
import { SowDocumentView } from "@/components/sow/SowDocumentView";

export function SowPrintClient({ sow }: { sow: SowDocument }) {
  useEffect(() => {
    // no auto-print
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 bg-black/90 text-white px-4 py-3 border-b border-white/10">
        <p className="text-sm font-medium truncate">{sow.title} · PDF export</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="shrink-0 rounded-lg bg-white text-black text-xs font-semibold px-3 py-2 hover:bg-gray-100"
        >
          Print / Save as PDF
        </button>
      </div>
      <div className="print-sheet">
        <SowDocumentView sow={sow} mode="print" />
      </div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #0A0A0A !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
