"use client";

import { recordVaultDownload } from "@/app/actions/portal-activity";

export function VaultDownloadButton({
  fileId,
  href,
  children,
}: {
  fileId: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        void recordVaultDownload(fileId);
      }}
      className="px-3 py-1.5 text-[11px] font-medium text-accent bg-accent/5 border border-accent/20 rounded-md hover:bg-accent/10 transition-all"
    >
      {children}
    </a>
  );
}
