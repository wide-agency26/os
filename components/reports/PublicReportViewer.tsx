"use client";

import { useEffect, useState, type ElementType } from "react";
import {
  Download,
  Globe2,
  LayoutGrid,
  Loader2,
  Megaphone,
  Search,
  Share2,
} from "lucide-react";
import { AdsReportShell } from "@/components/reports/lazy-dashboards";
import {
  GeneralReportView,
  GENERAL_CHANNEL_ICONS,
} from "@/components/reports/GeneralReportView";
import { SeoReportView } from "@/components/reports/lazy-dashboards";
import { SocialReportShell } from "@/components/reports/lazy-dashboards";
import { WebsiteReportDashboard } from "@/components/reports/lazy-dashboards";
import { DownloadPdfButton } from "@/components/pdf/DownloadPdfButton";
import { isWebsiteDataset, pickPrimaryWebsiteDataset } from "@/lib/reports/ga4-website";
import { loadUnlockedSharedReport } from "@/app/actions/report-share";
import type { ReportCategory } from "@/lib/reports/categories";
import type { ReportPrintPayload } from "@/lib/reports/load-print-data";
import type { ColumnSchema } from "@/lib/data-hub/column-detector";

const TABS: { id: ReportCategory; label: string; icon: ElementType }[] = [
  { id: "General", label: "General", icon: LayoutGrid },
  { id: "Social", label: "Social", icon: Share2 },
  { id: "Ads", label: "Ads", icon: Megaphone },
  { id: "Website", label: "Website", icon: Globe2 },
  { id: "SEO", label: "SEO", icon: Search },
];

export function PublicReportViewer({
  slug,
  initial,
}: {
  slug: string;
  initial: {
    projectId: string;
    published: ReportCategory[];
    data: ReportPrintPayload;
  };
}) {
  const [category, setCategory] = useState<ReportCategory>(initial.data.category);
  const [payload, setPayload] = useState(initial.data);
  const [published] = useState(initial.published);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (category === payload.category) return;
    let cancelled = false;
    setLoading(true);
    void loadUnlockedSharedReport(slug, category).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) setPayload(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [category, payload.category, slug]);

  const first =
    category === "Website"
      ? pickPrimaryWebsiteDataset(payload.datasets) || payload.datasets[0]
      : payload.datasets[0];
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
    <div className="min-h-screen bg-background text-text-primary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Report
            </p>
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
              {payload.organization}
            </h1>
            <p className="text-[13px] text-text-secondary mt-0.5">{payload.projectTitle}</p>
          </div>
          <DownloadPdfButton
            body={{
              kind: "report",
              projectId: payload.projectId,
              category,
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover disabled:opacity-50"
          >
            <Download size={14} /> Download PDF
          </DownloadPdfButton>
        </header>

        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => {
            const live = published.includes(tab.id);
            const active = category === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={!live}
                onClick={() => live && setCategory(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold ${
                  !live
                    ? "bg-surface-raised text-text-muted border border-border opacity-60 cursor-not-allowed"
                    : active
                      ? "bg-accent text-white"
                      : "bg-surface text-text-secondary border border-border hover:text-text-primary"
                }`}
              >
                <Icon size={14} strokeWidth={1.75} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-text-muted">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : (
          <div className="client-report-viewer">
            {category === "General" ? (
              <GeneralReportView
                clientMode
                datasets={payload.datasets}
                projectId={payload.projectId}
                channels={[
                  {
                    id: "Social",
                    label: "Social",
                    hint: "Organic reach & engagement",
                    icon: GENERAL_CHANNEL_ICONS.Social,
                    hasData: payload.channelPresence.Social,
                    metricHint: payload.channelPresence.Social ? "Connected" : "No data",
                  },
                  {
                    id: "Ads",
                    label: "Ads",
                    hint: "Paid spend, CPA, ROAS",
                    icon: GENERAL_CHANNEL_ICONS.Ads,
                    hasData: payload.channelPresence.Ads,
                    metricHint: payload.channelPresence.Ads ? "Connected" : "No data",
                  },
                  {
                    id: "Website",
                    label: "Website",
                    hint: "GA4 traffic & engagement",
                    icon: GENERAL_CHANNEL_ICONS.Website,
                    hasData: payload.channelPresence.Website,
                    metricHint: payload.channelPresence.Website ? "Connected" : "No data",
                  },
                  {
                    id: "SEO",
                    label: "SEO",
                    hint: "Search Console performance",
                    icon: GENERAL_CHANNEL_ICONS.SEO,
                    hasData: payload.channelPresence.SEO,
                    metricHint: payload.channelPresence.SEO ? "Connected" : "No data",
                  },
                ]}
              />
            ) : null}
            {category === "Ads" ? <AdsReportShell datasets={payload.datasets} /> : null}
            {category === "Social" ? <SocialReportShell datasets={payload.datasets} /> : null}
            {category === "Website" ? (
              isWebsiteDataset(columns, rows) || columns.length > 0 ? (
                <WebsiteReportDashboard
                  rows={rows}
                  datasetName={first?.name}
                  datasetMeta={datasetMeta}
                />
              ) : (
                <p className="text-[13px] text-text-muted">No website data for this project.</p>
              )
            ) : null}
            {category === "SEO" ? (
              <SeoReportView
                datasets={payload.datasets}
                datasetMeta={datasetMeta}
                isAdmin={false}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
