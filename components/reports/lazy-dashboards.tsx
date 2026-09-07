"use client";

import dynamic from "next/dynamic";

function ReportChunkFallback() {
  return (
    <p className="text-[13px] text-text-muted px-2 py-8">Loading report…</p>
  );
}

export const AdsReportShell = dynamic(
  () => import("./AdsReportShell").then((m) => m.AdsReportShell),
  { loading: ReportChunkFallback }
);

export const SocialReportShell = dynamic(
  () => import("./SocialReportShell").then((m) => m.SocialReportShell),
  { loading: ReportChunkFallback }
);

export const WebsiteReportDashboard = dynamic(
  () => import("./WebsiteReportDashboard").then((m) => m.WebsiteReportDashboard),
  { loading: ReportChunkFallback }
);

export const SeoReportView = dynamic(
  () => import("./SeoReportView").then((m) => m.SeoReportView),
  { loading: ReportChunkFallback }
);
