"use client";

import { useEffect, useState } from "react";

/** Flips data-pdf-ready after fonts + a short paint delay so Chromium captures charts. */
export function PdfReadyMark({ delayMs = 1200 }: { delayMs?: number }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, delayMs));
      if (!cancelled) setReady(true);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [delayMs]);

  return <span hidden data-pdf-ready={ready ? "true" : "false"} />;
}
