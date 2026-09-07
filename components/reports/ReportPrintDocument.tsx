"use client";

import { PdfReadyMark } from "@/components/pdf/PdfReadyMark";
import { AdsReportShell } from "@/components/reports/AdsReportShell";
import {
  GeneralReportView,
  GENERAL_CHANNEL_ICONS,
} from "@/components/reports/GeneralReportView";
import { SeoReportView } from "@/components/reports/SeoReportView";
import { SocialReportShell } from "@/components/reports/SocialReportShell";
import { WebsiteReportDashboard } from "@/components/reports/WebsiteReportDashboard";
import { isWebsiteDataset, pickPrimaryWebsiteDataset } from "@/lib/reports/ga4-website";
import type { ReportCategory } from "@/lib/reports/categories";
import type { LoadedDataset } from "@/lib/reports/aggregation";
import type { ColumnSchema } from "@/lib/data-hub/column-detector";

export function ReportPrintDocument({
  organization,
  projectTitle,
  category,
  projectId,
  datasets,
  channelPresence,
}: {
  organization: string;
  projectTitle: string;
  category: ReportCategory;
  projectId: string;
  datasets: LoadedDataset[];
  channelPresence: {
    Social: boolean;
    Ads: boolean;
    Website: boolean;
    SEO: boolean;
  };
}) {
  const first =
    category === "Website"
      ? pickPrimaryWebsiteDataset(datasets) || datasets[0]
      : datasets[0];
  const columns = (first?.columns || []) as ColumnSchema[];
  const rows = first?.rows || [];
  const datasetMeta = first
    ? {
        name: first.name,
        createdAt: first.createdAt,
        rowCount: first.rowCount ?? first.rows.length,
        sourceType: first.sourceType,
        syncedAt: first.syncedAt,
        externalAccountLabel: first.externalAccountLabel,
      }
    : undefined;

  return (
    <div
      className="pdf-print-root client-report-viewer report-print-surface bg-white min-h-screen px-8 py-8 max-w-[1400px] mx-auto"
    >
      <PdfReadyMark delayMs={1400} />
      <header className="mb-6 border-b border-gray-200 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {category} report
        </p>
        <h1 className="text-2xl font-semibold text-gray-900 mt-1">{organization}</h1>
        <p className="text-[13px] text-gray-600 mt-0.5">{projectTitle}</p>
      </header>
      {category === "General" ? (
        <GeneralReportView
          clientMode
          datasets={datasets}
          projectId={projectId}
          channels={[
            {
              id: "Social",
              label: "Social",
              hint: "Organic reach & engagement",
              icon: GENERAL_CHANNEL_ICONS.Social,
              hasData: channelPresence.Social,
              metricHint: channelPresence.Social ? "Connected" : "No data",
            },
            {
              id: "Ads",
              label: "Ads",
              hint: "Paid spend, CPA, ROAS",
              icon: GENERAL_CHANNEL_ICONS.Ads,
              hasData: channelPresence.Ads,
              metricHint: channelPresence.Ads ? "Connected" : "No data",
            },
            {
              id: "Website",
              label: "Website",
              hint: "GA4 traffic & engagement",
              icon: GENERAL_CHANNEL_ICONS.Website,
              hasData: channelPresence.Website,
              metricHint: channelPresence.Website ? "Connected" : "No data",
            },
            {
              id: "SEO",
              label: "SEO",
              hint: "Search Console performance",
              icon: GENERAL_CHANNEL_ICONS.SEO,
              hasData: channelPresence.SEO,
              metricHint: channelPresence.SEO ? "Connected" : "No data",
            },
          ]}
        />
      ) : null}
      {category === "Ads" ? <AdsReportShell datasets={datasets} /> : null}
      {category === "Social" ? <SocialReportShell datasets={datasets} /> : null}
      {category === "Website" ? (
        isWebsiteDataset(columns, rows) || columns.length > 0 ? (
          <WebsiteReportDashboard
            rows={rows}
            datasetName={first?.name}
            datasetMeta={datasetMeta}
          />
        ) : (
          <p className="text-[13px] text-gray-500">No website data for this project.</p>
        )
      ) : null}
      {category === "SEO" ? (
        <SeoReportView datasets={datasets} datasetMeta={datasetMeta} isAdmin={false} />
      ) : null}
    </div>
  );
}
