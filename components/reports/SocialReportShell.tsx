"use client";

import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  Images,
  Users,
  BriefcaseBusiness,
  Clapperboard,
} from "lucide-react";
import { ReportSubTabs, type ReportSubTab } from "@/components/reports/ReportSubTabs";
import { LinkedInOrganicDashboard } from "@/components/reports/LinkedInOrganicDashboard";
import { YouTubeOrganicDashboard } from "@/components/reports/YouTubeOrganicDashboard";
import { InstagramOrganicDashboard } from "@/components/reports/InstagramOrganicDashboard";
import {
  DateRangeControls,
  useDateRangeFilter,
  mergeMonthOptions,
} from "@/components/reports/DateRangeControls";
import {
  type LoadedDataset,
  computeSocialOverall,
  buildFilteredLinkedInBundle,
  buildFilteredYouTubeBundle,
  buildFilteredInstagramBundle,
  pickLinkedInPayloads,
  pickYouTubePayloads,
  pickInstagramPayloads,
} from "@/lib/reports/aggregation";
import {
  availableLiMonths,
  buildLinkedInBundle,
} from "@/lib/reports/linkedin-organic";
import { availableYtMonths, buildYouTubeBundle } from "@/lib/reports/youtube-organic";
import {
  availableIgMonths,
  buildInstagramBundle,
  hasInstagramData,
} from "@/lib/reports/instagram-organic";
import {
  isLinkedInOrganicSub,
  isYouTubeOrganicSub,
  isInstagramOrganicSub,
  detectSubcategory,
} from "@/lib/data-hub/subcategory";
import { SocialOverallDashboard } from "@/components/reports/SocialOverallDashboard";

type SocialTab = "overall" | "instagram" | "facebook" | "linkedin" | "youtube";

interface SocialReportShellProps {
  datasets: LoadedDataset[];
  /** Prior uploads superseded by the current ones — used for static snapshot compare. */
  previousDatasets?: LoadedDataset[];
}

function NoticeBanner({ text }: { text: string }) {
  return (
    <div className="text-[12px] font-medium px-3 py-2 rounded-xl bg-sky-50 text-sky-800 border border-sky-100">
      {text}
    </div>
  );
}

function EmptyOverall({ notice }: { notice: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center space-y-3">
      <h3 className="text-[16px] font-bold text-gray-900">Social Overall</h3>
      <p className="text-[13px] text-gray-500 max-w-lg mx-auto leading-relaxed">{notice}</p>
    </div>
  );
}

function SocialOverallBlended({ datasets }: { datasets: LoadedDataset[] }) {
  const dateState = useDateRangeFilter();

  const months = useMemo(() => {
    const li = availableLiMonths(buildLinkedInBundle(pickLinkedInPayloads(datasets)));
    const yt = availableYtMonths(buildYouTubeBundle(pickYouTubePayloads(datasets)));
    const ig = availableIgMonths(buildInstagramBundle(pickInstagramPayloads(datasets)));
    return mergeMonthOptions(li, yt, ig);
  }, [datasets]);

  const result = useMemo(
    () => computeSocialOverall(datasets, dateState.periodOpts),
    [datasets, dateState.periodOpts]
  );

  if (result.mode === "empty") {
    return (
      <div className="space-y-4">
        <DateRangeControls months={months} state={dateState} accent="#4f46e5" />
        <EmptyOverall notice={result.notice} />
      </div>
    );
  }

  // Single-source fallback — channel dashboards keep their own date controls
  if (result.mode === "single") {
    if (result.channels[0]?.id === "youtube" && result.youTubeBundle) {
      return (
        <div className="space-y-4">
          <NoticeBanner text={result.notice} />
          <YouTubeOrganicDashboard
            bundle={result.youTubeBundle}
            datasetMeta={{
              name: result.channels[0]?.datasetName,
              rowCount: result.youTubeBundle.sources.reduce((s, x) => s + x.rowCount, 0),
            }}
            notice="Showing the single active organic channel as Social Overall."
          />
        </div>
      );
    }
    if (result.channels[0]?.id === "instagram" && result.instagramBundle) {
      return (
        <div className="space-y-4">
          <NoticeBanner text={result.notice} />
          <InstagramOrganicDashboard
            bundle={result.instagramBundle}
            datasetMeta={{
              name: result.channels[0]?.datasetName,
              rowCount: result.instagramBundle.sources.reduce((s, x) => s + x.rowCount, 0),
            }}
            notice="Showing the single active organic channel as Social Overall."
          />
        </div>
      );
    }
    if (result.linkedInBundle) {
      return (
        <div className="space-y-4">
          <NoticeBanner text={result.notice} />
          <LinkedInOrganicDashboard
            bundle={result.linkedInBundle}
            datasetMeta={{
              name: result.channels[0]?.datasetName,
              rowCount: result.linkedInBundle.sources.reduce((s, x) => s + x.rowCount, 0),
            }}
            notice="Showing the single active organic channel as Social Overall."
          />
        </div>
      );
    }
  }

  return (
    <div className="space-y-4">
      <DateRangeControls months={months} state={dateState} accent="#4f46e5" />
      <NoticeBanner text={result.notice} />
      <SocialOverallDashboard result={result} />
    </div>
  );
}

export function SocialReportShell({
  datasets,
  previousDatasets = [],
}: SocialReportShellProps) {
  const [tab, setTab] = useState<SocialTab>("overall");

  const igHasData = useMemo(() => {
    const bundle = buildInstagramBundle(pickInstagramPayloads(datasets));
    return hasInstagramData(bundle);
  }, [datasets]);

  const tabs: ReportSubTab[] = [
    {
      id: "overall",
      label: "Overall",
      hint: "All organic platforms",
      icon: LayoutDashboard,
      enabled: true,
    },
    {
      id: "instagram",
      label: "Instagram",
      hint: "Organic profile & posts",
      icon: Images,
      enabled: true,
    },
    {
      id: "facebook",
      label: "Facebook",
      hint: "Page reach & engagement",
      icon: Users,
      enabled: false,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      hint: "Organic page analytics",
      icon: BriefcaseBusiness,
      enabled: true,
    },
    {
      id: "youtube",
      label: "YouTube",
      hint: "Views & subscribers",
      icon: Clapperboard,
      enabled: true,
    },
  ];

  const liBundle = useMemo(
    () =>
      buildFilteredLinkedInBundle(datasets, {
        mode: "all",
        months: [],
        customStart: "",
        customEnd: "",
      }),
    [datasets]
  );

  const ytBundle = useMemo(
    () =>
      buildFilteredYouTubeBundle(datasets, {
        mode: "all",
        months: [],
        customStart: "",
        customEnd: "",
      }),
    [datasets]
  );

  const igBundle = useMemo(
    () =>
      buildFilteredInstagramBundle(datasets, {
        mode: "all",
        months: [],
        customStart: "",
        customEnd: "",
      }),
    [datasets]
  );

  const previousLiBundle = useMemo(
    () =>
      previousDatasets.length
        ? buildLinkedInBundle(pickLinkedInPayloads(previousDatasets))
        : null,
    [previousDatasets]
  );

  const liMeta = useMemo(() => {
    const liDs = datasets.filter((d) =>
      isLinkedInOrganicSub(d.subcategory || detectSubcategory(d.name, d.columns))
    );
    const first = liDs[0];
    return first
      ? {
          name:
            liDs.length > 1
              ? `LinkedIn bundle (${liDs.length} streams)`
              : first.name,
          createdAt: first.createdAt,
          rowCount: liDs.reduce((s, d) => s + d.rowCount, 0),
        }
      : undefined;
  }, [datasets]);

  const ytMeta = useMemo(() => {
    const ytDs = datasets.filter((d) =>
      isYouTubeOrganicSub(d.subcategory || detectSubcategory(d.name, d.columns))
    );
    const first = ytDs[0];
    return first
      ? {
          name:
            ytDs.length > 1
              ? ytDs.map((d) => d.name).join(" / ")
              : first.name,
          createdAt: first.createdAt,
          rowCount: ytDs.reduce((s, d) => s + d.rowCount, 0),
        }
      : undefined;
  }, [datasets]);

  const igMeta = useMemo(() => {
    const igDs = datasets.filter((d) =>
      isInstagramOrganicSub(d.subcategory || detectSubcategory(d.name, d.columns))
    );
    const first = igDs[0];
    return first
      ? {
          name:
            igDs.length > 1
              ? `Instagram bundle (${igDs.length} files)`
              : first.name,
          createdAt: first.createdAt,
          rowCount: igDs.reduce((s, d) => s + d.rowCount, 0),
        }
      : undefined;
  }, [datasets]);

  return (
    <div className="space-y-5">
      <ReportSubTabs
        tabs={tabs}
        activeId={tab}
        onChange={(id) => setTab(id as SocialTab)}
        ariaLabel="Social organic report sections"
      />

      {tab === "overall" && <SocialOverallBlended datasets={datasets} />}

      {tab === "instagram" && (
        <InstagramOrganicDashboard
          bundle={igBundle}
          datasetMeta={
            igMeta ||
            (igHasData
              ? undefined
              : { name: "Instagram Organic", rowCount: 0 })
          }
        />
      )}

      {tab === "linkedin" && (
        <LinkedInOrganicDashboard
          bundle={liBundle}
          previousBundle={previousLiBundle || undefined}
          datasetMeta={liMeta}
        />
      )}

      {tab === "youtube" && (
        <YouTubeOrganicDashboard bundle={ytBundle} datasetMeta={ytMeta} />
      )}
    </div>
  );
}
