"use client";

import { useState, type ReactNode } from "react";
import { downloadPdf } from "@/lib/pdf/download-client";
import type { PdfRequest } from "@/lib/pdf/types";

export function DownloadPdfButton({
  body,
  className,
  disabled,
  children,
  busyLabel = "Preparing PDF…",
  title,
}: {
  body: PdfRequest;
  className?: string;
  disabled?: boolean;
  children: ReactNode;
  busyLabel?: string;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printUrl, setPrintUrl] = useState<string | null>(null);

  return (
    <span className="contents">
      <button
        type="button"
        disabled={disabled || busy}
        title={title}
        className={className}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await downloadPdf(body);
          setBusy(false);
          if (!result.ok) {
            setError(result.error);
            setPrintUrl(result.printUrl ?? null);
            return;
          }
          setPrintUrl(null);
        }}
      >
        {busy ? busyLabel : children}
      </button>
      {error ? (
        <span className="text-[11px] text-red-700 max-w-[240px] leading-snug">
          {error}
          {printUrl ? (
            <>
              {" "}
              <a
                href={printUrl}
                target="_blank"
                rel="noreferrer"
                className="underline font-medium"
              >
                Open print view
              </a>
            </>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
