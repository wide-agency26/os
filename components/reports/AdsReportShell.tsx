"use client";

import { useMemo, useState } from "react";
import { LayoutDashboard, Megaphone, Search, BriefcaseBusiness } from "lucide-react";
import { MetaAdsReportDashboard } from "@/components/reports/MetaAdsReportDashboard";
import { GoogleAdsReportDashboard } from "@/components/reports/GoogleAdsReportDashboard";
import { LinkedInAdsReportDashboard } from "@/components/reports/LinkedInAdsReportDashboard";
import { AdsOverallDashboard } from "@/components/reports/AdsOverallDashboard";
import { ReportSubTabs, type ReportSubTab } from "@/components/reports/ReportSubTabs";
import {
  DateRangeControls,
  useDateRangeFilter,
  mergeMonthOptions,
} from "@/components/reports/DateRangeControls";
import {
  type LoadedDataset,
  computeAdsOverall,
} from "@/lib/reports/aggregation";
import {
  detectSubcategory,
  isMetaAdsSub,
  isGoogleAdsSub,
  isLinkedInAdsSub,
} from "@/lib/data-hub/subcategory";
import {
  isMetaAdsDataset,
  looksLikeGoogleAdsRows,
  availableMonths as metaAvailableMonths,
  normalizeMetaRows,
} from "@/lib/reports/meta-ads";
import {
  isGoogleAdsDataset,
  availableGoogleMonths,
  normalizeGoogleRows,
} from "@/lib/reports/google-ads";
import {
  isLinkedInAdsDataset,
  looksLikeLinkedInAdsRows,
  availableLinkedInAdsMonths,
  normalizeLinkedInAdsRows,
} from "@/lib/reports/linkedin-ads";
import type { DatasetMeta } from "@/lib/reports/meta-ads";

type AdsTab = "overall" | "meta" | "google" | "linkedin";

interface AdsReportShellProps {
  datasets: LoadedDataset[];
}

function NoticeBanner({ text }: { text: string }) {
  return (
    <div className="text-[12px] font-medium px-3 py-2 rounded-xl bg-sky-50 text-sky-800 border border-sky-100">
      {text}
    </div>
  );
}

function isGoogleDataset(d: LoadedDataset): boolean {
  const sub = d.subcategory || detectSubcategory(d.name, d.columns);
  return (
    isGoogleAdsSub(sub) ||
    isGoogleAdsDataset(d.columns, d.rows) ||
    looksLikeGoogleAdsRows(d.rows)
  );
}

function isLinkedInAdsDs(d: LoadedDataset): boolean {
  const sub = d.subcategory || detectSubcategory(d.name, d.columns);
  return (
    isLinkedInAdsSub(sub) ||
    isLinkedInAdsDataset(d.columns, d.rows) ||
    looksLikeLinkedInAdsRows(d.rows)
  );
}

function isMetaDataset(d: LoadedDataset): boolean {
  if (isGoogleDataset(d) || isLinkedInAdsDs(d)) return false;
  const sub = d.subcategory || detectSubcategory(d.name, d.columns);
  if (isMetaAdsSub(sub)) return true;
  return isMetaAdsDataset(d.columns, d.rows);
}

function AdsOverallView({
  datasets,
}: {
  datasets: LoadedDataset[];
}) {
  const dateState = useDateRangeFilter();

  const months = useMemo(() => {
    const metaMs = datasets
      .filter(isMetaDataset)
      .flatMap((d) => metaAvailableMonths(normalizeMetaRows(d.rows)));
    const gMs = datasets
      .filter(isGoogleDataset)
      .flatMap((d) => availableGoogleMonths(normalizeGoogleRows(d.rows)));
    const liMs = datasets
      .filter(isLinkedInAdsDs)
      .flatMap((d) => availableLinkedInAdsMonths(normalizeLinkedInAdsRows(d.rows)));
    return mergeMonthOptions(metaMs, gMs, liMs);
  }, [datasets]);

  const result = useMemo(
    () => computeAdsOverall(datasets, dateState.periodOpts),
    [datasets, dateState.periodOpts]
  );

  if (result.mode === "empty" || !result.totals) {
    return (
      <div className="space-y-4">
        <DateRangeControls months={months} state={dateState} accent="#4f46e5" />
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center space-y-3">
          <h3 className="text-[16px] font-bold text-gray-900">Ads Overall</h3>
          <p className="text-[13px] text-gray-500 max-w-lg mx-auto">{result.notice}</p>
        </div>
      </div>
    );
  }

  if (result.mode === "single") {
    if (result.singleChannelId === "google") {
      const gDs = datasets.find(isGoogleDataset);
      return (
        <div className="space-y-4">
          <NoticeBanner text={result.notice} />
          <GoogleAdsReportDashboard
            rows={gDs?.rows || []}
            datasetMeta={{
              name: result.channels[0]?.datasetName || gDs?.name,
              createdAt: gDs?.createdAt,
              rowCount: gDs?.rowCount,
            }}
          />
        </div>
      );
    }
    if (result.singleChannelId === "linkedin") {
      const liDs = datasets.find(isLinkedInAdsDs);
      return (
        <div className="space-y-4">
          <NoticeBanner text={result.notice} />
          <LinkedInAdsReportDashboard
            rows={liDs?.rows || []}
            datasetMeta={{
              name: result.channels[0]?.datasetName || liDs?.name,
              createdAt: liDs?.createdAt,
              rowCount: liDs?.rowCount,
            }}
          />
        </div>
      );
    }
    const metaDs = datasets.find(isMetaDataset);
    return (
      <div className="space-y-4">
        <NoticeBanner text={result.notice} />
        <MetaAdsReportDashboard
          rows={metaDs?.rows || []}
          datasetMeta={{
            name: result.channels[0]?.datasetName || metaDs?.name,
            createdAt: metaDs?.createdAt,
            rowCount: metaDs?.rowCount,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DateRangeControls
        months={months}
        state={dateState}
        accent="#4f46e5"
        rowCountHint={`${result.networks.length} networks · blended`}
      />
      <AdsOverallDashboard result={result} />
    </div>
  );
}

export function AdsReportShell({ datasets }: AdsReportShellProps) {
  const metaDatasets = useMemo(() => datasets.filter(isMetaDataset), [datasets]);
  const googleDatasets = useMemo(() => datasets.filter(isGoogleDataset), [datasets]);
  const linkedInDatasets = useMemo(() => datasets.filter(isLinkedInAdsDs), [datasets]);

  const metaDataset = metaDatasets[0];
  const googleDataset = googleDatasets[0];
  const linkedInDataset = linkedInDatasets[0];

  const metaRows = useMemo(
    () => metaDatasets.flatMap((d) => d.rows),
    [metaDatasets]
  );
  const googleRows = useMemo(
    () => googleDatasets.flatMap((d) => d.rows),
    [googleDatasets]
  );
  const linkedInRows = useMemo(
    () => linkedInDatasets.flatMap((d) => d.rows),
    [linkedInDatasets]
  );

  const metaMeta: DatasetMeta | undefined = metaDataset
    ? {
        name:
          metaDatasets.length > 1
            ? `Meta Ads (${metaDatasets.length} files)`
            : metaDataset.name,
        createdAt: metaDataset.createdAt,
        rowCount: metaDatasets.reduce((s, d) => s + d.rowCount, 0),
      }
    : undefined;

  const googleMeta: DatasetMeta | undefined = googleDataset
    ? {
        name:
          googleDatasets.length > 1
            ? `Google Ads (${googleDatasets.length} files)`
            : googleDataset.name,
        createdAt: googleDataset.createdAt,
        rowCount: googleDatasets.reduce((s, d) => s + d.rowCount, 0),
      }
    : undefined;

  const linkedInMeta: DatasetMeta | undefined = linkedInDataset
    ? {
        name:
          linkedInDatasets.length > 1
            ? `LinkedIn Ads (${linkedInDatasets.length} files)`
            : linkedInDataset.name,
        createdAt: linkedInDataset.createdAt,
        rowCount: linkedInDatasets.reduce((s, d) => s + d.rowCount, 0),
      }
    : undefined;

  const networkCount =
    (metaDatasets.length ? 1 : 0) +
    (googleDatasets.length ? 1 : 0) +
    (linkedInDatasets.length ? 1 : 0);

  const defaultTab: AdsTab =
    networkCount > 1
      ? "overall"
      : linkedInDatasets.length && !metaDatasets.length && !googleDatasets.length
        ? "linkedin"
        : googleDatasets.length && !metaDatasets.length
          ? "google"
          : metaDatasets.length
            ? "meta"
            : "overall";

  const [tab, setTab] = useState<AdsTab>(defaultTab);

  const tabs: ReportSubTab[] = [
    {
      id: "overall",
      label: "Overall",
      hint: "Blended paid spend & CPA",
      icon: LayoutDashboard,
      enabled: true,
    },
    {
      id: "meta",
      label: "Meta Ads",
      hint: "Facebook & Instagram paid",
      icon: Megaphone,
      enabled: true,
    },
    {
      id: "google",
      label: "Google Ads",
      hint: "Search & display paid",
      icon: Search,
      enabled: true,
    },
    {
      id: "linkedin",
      label: "LinkedIn Ads",
      hint: "Campaign Manager paid",
      icon: BriefcaseBusiness,
      enabled: true,
    },
  ];

  return (
    <div className="space-y-5">
      <ReportSubTabs
        tabs={tabs}
        activeId={tab}
        onChange={(id) => setTab(id as AdsTab)}
        ariaLabel="Ads report sections"
        activeClassName="bg-[#1877f2] text-white shadow-sm"
      />

      {tab === "overall" && <AdsOverallView datasets={datasets} />}
      {tab === "meta" && (
        <MetaAdsReportDashboard rows={metaRows} datasetMeta={metaMeta} />
      )}
      {tab === "google" && (
        <GoogleAdsReportDashboard rows={googleRows} datasetMeta={googleMeta} />
      )}
      {tab === "linkedin" && (
        <LinkedInAdsReportDashboard rows={linkedInRows} datasetMeta={linkedInMeta} />
      )}
    </div>
  );
}
