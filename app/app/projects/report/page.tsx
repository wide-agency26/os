"use client";

import { useState, useEffect, useMemo, Suspense, type ElementType } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  AdsReportShell,
  SeoReportView,
  SocialReportShell,
  WebsiteReportDashboard,
} from "@/components/reports/lazy-dashboards";
import {
  GeneralReportView,
  GENERAL_CHANNEL_ICONS,
} from "@/components/reports/GeneralReportView";
import { DatasetSourceBadge } from "@/components/reports/DatasetSourceBadge";
import { DataFreshnessBar } from "@/components/reports/DataFreshnessBar";
import {
  ReportsHubShell,
  type ReportsProjectOption,
} from "@/components/reports/ReportsHubShell";
import { pickInitialProjectId, ts } from "@/lib/tools/recent-projects";
import {
  BarChart3,
  FileSpreadsheet,
  Loader2,
  Globe2,
  Share2,
  Megaphone,
  LayoutGrid,
  Search,
  Eye,
  EyeOff,
  Save,
  Filter,
  Sparkles,
  Download,
} from "lucide-react";
import Link from "next/link";
import { type ColumnSchema } from "@/lib/data-hub/column-detector";
import { isFounder } from "@/lib/rbac";
import { isWebsiteDataset, pickPrimaryWebsiteDataset } from "@/lib/reports/ga4-website";
import { isMetaAdsDataset } from "@/lib/reports/meta-ads";
import { isGoogleAdsDataset } from "@/lib/reports/google-ads";
import {
  type ReportCategory,
  datasetCategoriesForReport,
} from "@/lib/reports/categories";
import { type LoadedDataset } from "@/lib/reports/aggregation";
import { detectSubcategory } from "@/lib/data-hub/subcategory";
import {
  publishConfigVersion,
  type ReportPublishStatus,
} from "@/lib/reports/publish";
import type { FreshnessConnection, FreshnessStream } from "@/lib/reports/freshness";
import { DownloadPdfButton } from "@/components/pdf/DownloadPdfButton";
import { ReportSharePanel } from "@/components/reports/ReportSharePanel";

const CATEGORIES: {
  id: ReportCategory;
  label: string;
  hint: string;
  icon: ElementType;
}[] = [
  { id: "General", label: "General", hint: "Cross-channel executive view", icon: LayoutGrid },
  { id: "Social", label: "Social", hint: "Organic profiles & engagement", icon: Share2 },
  { id: "Ads", label: "Ads", hint: "Paid media & performance", icon: Megaphone },
  { id: "Website", label: "Website", hint: "GA4 traffic & engagement", icon: Globe2 },
  { id: "SEO", label: "SEO", hint: "Search Console performance", icon: Search },
];

const fieldClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none";

interface DatasetInfo {
  id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  columns: ColumnSchema[];
  row_count: number;
  created_at?: string | null;
  is_current?: boolean | null;
  supersedes_id?: string | null;
  source_type?: string | null;
  synced_at?: string | null;
  external_account_label?: string | null;
}

interface ProjectOption {
  id: string;
  title: string;
  company?: string;
  lastEditedAt?: number;
}

function projectLabel(p: ProjectOption) {
  return p.company ? `${p.company} — ${p.title}` : p.title;
}

// ProjectOption kept for local helpers; hub shell uses ReportsProjectOption

export default function CentralReportHubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24 text-gray-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      }
    >
      <CentralReportHub />
    </Suspense>
  );
}

function CentralReportHub() {
  const searchParams = useSearchParams();
  const [role, setRole] = useState<string>("client");
  const [projects, setProjects] = useState<ReportsProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>("General");

  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [datasetRows, setDatasetRows] = useState<Record<string, unknown>[]>([]);
  const [datasetColumns, setDatasetColumns] = useState<ColumnSchema[]>([]);
  const [loadedDatasets, setLoadedDatasets] = useState<LoadedDataset[]>([]);
  const [previousLoadedDatasets, setPreviousLoadedDatasets] = useState<LoadedDataset[]>([]);
  const [igCalendarLinks, setIgCalendarLinks] = useState<
    {
      scheduled_date: string;
      published_permalink: string;
      visual_asset_url?: string | null;
      hook_angle?: string | null;
    }[]
  >([]);

  const [channelPresence, setChannelPresence] = useState<Record<string, boolean>>({
    Social: false,
    Ads: false,
    Website: false,
    SEO: false,
  });

  const [loading, setLoading] = useState(true);
  const [publishStatus, setPublishStatus] = useState<ReportPublishStatus>("none");
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [freshnessStreams, setFreshnessStreams] = useState<FreshnessStream[]>([]);
  const [freshnessConnections, setFreshnessConnections] = useState<FreshnessConnection[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadInitialData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      let userRole = "client";
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile) {
        userRole = profile.role;
        setRole(profile.role);
      }

      let projectQuery = (supabase as any)
        .from("projects")
        .select(
          `
          id,
          title,
          updated_at,
          crm_customers!client_id (
            company,
            name
          )
        `
        )
        .order("updated_at", { ascending: false });

      if (userRole === "client") {
        projectQuery = projectQuery.eq("client_id", user.id);
      }

      const { data: projData } = await projectQuery;
      if (projData && projData.length > 0) {
        const mapped: ProjectOption[] = projData.map((p: any) => {
          const cust = Array.isArray(p.crm_customers) ? p.crm_customers[0] : p.crm_customers;
          return {
            id: p.id,
            title: p.title,
            company: cust?.company || cust?.name || undefined,
            lastEditedAt: ts(p.updated_at),
          };
        });
        setProjects(mapped);
        const fromUrl = searchParams.get("project");
        const initial = pickInitialProjectId(
          mapped.map((p) => p.id),
          fromUrl,
          "reports"
        );
        setSelectedProjectId(initial);
      } else {
        setLoading(false);
      }
    }
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadProjectData(selectedProjectId, selectedCategory);
  }, [selectedProjectId, selectedCategory]);

  async function refreshChannelPresence(projectId: string) {
    const { data } = await (supabase as any)
      .from("datasets")
      .select("id, category, subcategory, columns, is_current")
      .eq("project_id", projectId);

    const list = ((data || []) as DatasetInfo[]).filter((d) => d.is_current !== false);
    const presence = { Social: false, Ads: false, Website: false, SEO: false };

    for (const ds of list) {
      if (ds.category === "Website") presence.Website = true;
      if (ds.category === "SEO") presence.SEO = true;
      if (ds.category === "Ads" || ds.category === "Digital") presence.Ads = true;
      if (ds.category === "Social" || ds.category === "Content") {
        if (isMetaAdsDataset(ds.columns, undefined) || isGoogleAdsDataset(ds.columns))
          presence.Ads = true;
        else presence.Social = true;
      }
    }
    setChannelPresence(presence);
  }

  async function loadFreshness(projectId: string) {
    const [{ data: ds }, { data: conns }] = await Promise.all([
      (supabase as any)
        .from("datasets")
        .select(
          "id, name, category, subcategory, source_type, synced_at, created_at, external_account_label, row_count, is_current"
        )
        .eq("project_id", projectId),
      (supabase as any)
        .from("project_data_connections")
        .select("provider, status, last_error, last_synced_at, external_account_label")
        .eq("project_id", projectId)
        .neq("status", "revoked"),
    ]);
    const streams: FreshnessStream[] = ((ds || []) as DatasetInfo[])
      .filter((d) => d.is_current !== false)
      .map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        subcategory: d.subcategory ?? null,
        sourceType: d.source_type,
        syncedAt: d.synced_at,
        createdAt: d.created_at,
        externalAccountLabel: d.external_account_label,
        rowCount: d.row_count,
      }));
    setFreshnessStreams(streams);
    setFreshnessConnections((conns || []) as FreshnessConnection[]);
  }

  async function fetchRowsForDataset(
    datasetId: string,
    columns: ColumnSchema[]
  ): Promise<Record<string, unknown>[]> {
    const pageSize = 1000;
    let from = 0;
    const rawRows: Record<string, any>[] = [];

    while (true) {
      const { data: rows, error } = await (supabase as any)
        .from("dataset_rows")
        .select("row_data")
        .eq("dataset_id", datasetId)
        .order("row_index")
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!rows?.length) break;
      rawRows.push(...rows.map((r: any) => r.row_data));
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return rawRows.map((row: Record<string, any>) => {
      const coerced: Record<string, any> = {};
      for (const col of columns) {
        const val = row[col.key];
        if (val === null || val === undefined || val === "") {
          coerced[col.key] = null;
          continue;
        }
        if (["number", "percentage", "currency"].includes(col.type)) {
          const cleaned = String(val).replace(/[$€£¥₹,%\s]/g, "");
          const num = parseFloat(cleaned);
          coerced[col.key] = isNaN(num) ? val : num;
        } else {
          coerced[col.key] = val;
        }
      }
      for (const [k, v] of Object.entries(row)) {
        if (!(k in coerced)) coerced[k] = v;
      }
      return coerced;
    });
  }

  async function hydrateLoadedDatasets(list: DatasetInfo[]): Promise<LoadedDataset[]> {
    const out: LoadedDataset[] = [];
    for (const d of list) {
      const rows = await fetchRowsForDataset(d.id, d.columns || []);
      out.push({
        id: d.id,
        name: d.name,
        category: d.category,
        subcategory:
          d.subcategory || detectSubcategory(d.name, d.columns) || null,
        createdAt: d.created_at,
        sourceType: d.source_type,
        syncedAt: d.synced_at,
        externalAccountLabel: d.external_account_label,
        rowCount: d.row_count,
        columns: d.columns || [],
        rows,
      });
    }
    return out;
  }

  async function loadPublishStatus(projectId: string, category: ReportCategory) {
    const { data: report } = await (supabase as any)
      .from("published_reports")
      .select("id, status")
      .eq("project_id", projectId)
      .eq("category", category)
      .maybeSingle();
    if (!report) {
      setPublishStatus("none");
      return;
    }
    setPublishStatus(report.status === "published" ? "published" : "draft");
  }

  async function loadProjectData(projectId: string, category: ReportCategory) {
    setLoading(true);
    setPublishStatus("none");
    setPublishMessage(null);
    setDatasetRows([]);
    setDatasetColumns([]);
    setSelectedDatasetId("");
    setDatasets([]);
    setLoadedDatasets([]);
    setPreviousLoadedDatasets([]);
    setIgCalendarLinks([]);

    await refreshChannelPresence(projectId);
    await loadFreshness(projectId);

    if (category === "Social" || category === "General") {
      const { data: livePosts } = await (supabase as any)
        .from("content_posts")
        .select("scheduled_date, published_permalink, visual_asset_url, hook_angle")
        .eq("project_id", projectId)
        .eq("status_production", "live")
        .not("published_permalink", "is", null);
      setIgCalendarLinks(
        ((livePosts || []) as any[])
          .filter((p) => typeof p.published_permalink === "string" && p.published_permalink)
          .map((p) => ({
            scheduled_date: String(p.scheduled_date).slice(0, 10),
            published_permalink: String(p.published_permalink),
            visual_asset_url: p.visual_asset_url || null,
            hook_angle: p.hook_angle || null,
          }))
      );
    }

    const selectCols =
      "id, name, category, subcategory, columns, row_count, created_at, is_current, supersedes_id, source_type, synced_at, external_account_label";

    async function finalize(listRaw: DatasetInfo[]) {
      const list = listRaw.filter((d) => d.is_current !== false);
      const priorIds = [
        ...new Set(
          list
            .map((d) => d.supersedes_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        ),
      ];

      if (list.length > 0) {
        setDatasets(list);
        setSelectedDatasetId(list[0].id);
        try {
          const loaded = await hydrateLoadedDatasets(list);
          setLoadedDatasets(loaded);
          const first = loaded[0];
          setDatasetColumns(first.columns as ColumnSchema[]);
          setDatasetRows(first.rows);
        } catch (e: any) {
          console.error(e);
          alert("Failed to load dataset rows: " + (e?.message || "unknown error"));
        }
      }

      if (priorIds.length) {
        const { data: priorMeta } = await (supabase as any)
          .from("datasets")
          .select(selectCols)
          .in("id", priorIds);
        try {
          const priorLoaded = await hydrateLoadedDatasets(
            (priorMeta || []) as DatasetInfo[]
          );
          setPreviousLoadedDatasets(priorLoaded);
        } catch (e) {
          console.error(e);
        }
      }
    }

    if (category === "General") {
      const { data: allDs } = await (supabase as any)
        .from("datasets")
        .select(selectCols)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      try {
        const list = ((allDs || []) as DatasetInfo[]).filter((d) => d.is_current !== false);
        const loaded = await hydrateLoadedDatasets(list);
        setLoadedDatasets(loaded);
        const priorIds = [
          ...new Set(
            list
              .map((d) => d.supersedes_id)
              .filter((id): id is string => typeof id === "string" && id.length > 0)
          ),
        ];
        if (priorIds.length) {
          const { data: priorMeta } = await (supabase as any)
            .from("datasets")
            .select(selectCols)
            .in("id", priorIds);
          setPreviousLoadedDatasets(
            await hydrateLoadedDatasets((priorMeta || []) as DatasetInfo[])
          );
        }
      } catch (e: any) {
        console.error(e);
        alert("Failed to load channel datasets: " + (e?.message || "unknown error"));
      }

      await loadPublishStatus(projectId, "General");
      setLoading(false);
      return;
    }

    const cats = datasetCategoriesForReport(category);
    const { data: ds } = await (supabase as any)
      .from("datasets")
      .select(selectCols)
      .eq("project_id", projectId)
      .in("category", cats)
      .order("created_at", { ascending: false });

    let list = (ds || []) as DatasetInfo[];

    if (category === "Ads") {
      list = list.filter(
        (d) =>
          d.category === "Ads" ||
          d.category === "Digital" ||
          isMetaAdsDataset(d.columns, undefined) ||
          isGoogleAdsDataset(d.columns)
      );
    }

    if (category === "Social") {
      list = list.filter(
        (d) =>
          !isMetaAdsDataset(d.columns, undefined) && !isGoogleAdsDataset(d.columns)
      );
    }

    await finalize(list);
    await loadPublishStatus(projectId, category);
    setLoading(false);
  }

  async function handleReportRefresh(providers?: string[]) {
    if (!selectedProjectId) return;
    setRefreshing(true);
    setPublishMessage(null);
    try {
      const res = await fetch("/api/reports/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          providers: providers?.length ? providers : "all",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      setPublishMessage(json.message || "Synced.");
      await loadProjectData(selectedProjectId, selectedCategory);
    } catch (err) {
      setPublishMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function loadDatasetRows(datasetId: string, columns: ColumnSchema[]) {
    const coercedRows = await fetchRowsForDataset(datasetId, columns);
    setDatasetColumns(columns);
    setDatasetRows(coercedRows);
  }

  const handleDatasetChange = async (dsId: string) => {
    setSelectedDatasetId(dsId);
    const ds = datasets.find((d) => d.id === dsId);
    if (ds) await loadDatasetRows(ds.id, ds.columns);
  };

  const upsertReportStatus = async (status: "draft" | "published") => {
    if (!selectedProjectId) return;
    setPublishBusy(true);
    setPublishMessage(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const payload = {
        project_id: selectedProjectId,
        category: selectedCategory,
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
        updated_by: user?.id || null,
        config: {
          version: publishConfigVersion(selectedCategory),
          dataset_id: selectedDatasetId || null,
          saved_at: new Date().toISOString(),
        },
      };
      const { error } = await (supabase as any)
        .from("published_reports")
        .upsert(payload, { onConflict: "project_id, category" });
      if (error) throw new Error(error.message);
      setPublishStatus(status);
      setPublishMessage(
        status === "published"
          ? `${selectedCategory} is now live for clients.`
          : `${selectedCategory} saved as draft (admin only).`
      );
    } catch (e: any) {
      setPublishMessage(e.message || "Save failed");
    } finally {
      setPublishBusy(false);
    }
  };

  const handleUnpublish = async () => {
    if (!selectedProjectId) return;
    setPublishBusy(true);
    setPublishMessage(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("published_reports")
        .upsert(
          {
            project_id: selectedProjectId,
            category: selectedCategory,
            status: "draft",
            published_at: null,
            updated_by: user?.id || null,
            config: {
              version: publishConfigVersion(selectedCategory),
              dataset_id: selectedDatasetId || null,
              unpublished_at: new Date().toISOString(),
            },
          },
          { onConflict: "project_id, category" }
        );
      if (error) throw new Error(error.message);
      setPublishStatus("draft");
      setPublishMessage(`${selectedCategory} unpublished — clients can no longer see it.`);
    } catch (e: any) {
      setPublishMessage(e.message || "Unpublish failed");
    } finally {
      setPublishBusy(false);
    }
  };

  const isAdmin = isFounder(role);
  const hasData = datasetRows.length > 0 || loadedDatasets.some((d) => d.rows.length > 0);
  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);
  const selectedDatasetName = selectedDataset?.name;

  const datasetMeta = {
    name: selectedDataset?.name,
    createdAt: selectedDataset?.created_at,
    rowCount: selectedDataset?.row_count ?? datasetRows.length,
    sourceType: selectedDataset?.source_type,
    syncedAt: selectedDataset?.synced_at,
    externalAccountLabel: selectedDataset?.external_account_label,
  };

  function emptyCopy(category: ReportCategory) {
    switch (category) {
      case "Ads":
        return "Upload a Meta Ads CSV in Sources under Ads, or connect Meta Ads.";
      case "Social":
        return "Connect Instagram or upload LinkedIn / YouTube files in Sources.";
      case "Website":
        return "Connect Google Analytics on Sources, or upload a GA4 CSV.";
      case "SEO":
        return "Connect Search Console on Sources, or upload a GSC CSV.";
      default:
        return "Connect channel data in Sources to populate this view.";
    }
  }

  function renderDashboard() {
    if (selectedCategory === "General") {
      return (
        <GeneralReportView
          isAdmin={isAdmin}
          datasets={loadedDatasets}
          projectId={selectedProjectId}
          onSelectCategory={(id) => setSelectedCategory(id as ReportCategory)}
          channels={[
            {
              id: "Social",
              label: "Social",
              hint: "Organic reach & engagement",
              icon: GENERAL_CHANNEL_ICONS.Social,
              hasData: channelPresence.Social,
              metricHint: channelPresence.Social
                ? "Organic source connected"
                : "No organic Social CSV yet",
            },
            {
              id: "Ads",
              label: "Ads",
              hint: "Paid spend, CPA, ROAS",
              icon: GENERAL_CHANNEL_ICONS.Ads,
              hasData: channelPresence.Ads,
              metricHint: channelPresence.Ads
                ? "Paid media source connected"
                : "No Ads CSV yet",
            },
            {
              id: "Website",
              label: "Website",
              hint: "GA4 traffic & engagement",
              icon: GENERAL_CHANNEL_ICONS.Website,
              hasData: channelPresence.Website,
              metricHint: channelPresence.Website
                ? "Website analytics connected"
                : "No Website CSV yet",
            },
            {
              id: "SEO",
              label: "SEO",
              hint: "Search Console performance",
              icon: GENERAL_CHANNEL_ICONS.SEO,
              hasData: channelPresence.SEO,
              metricHint: channelPresence.SEO
                ? "Search Console connected"
                : "No SEO CSV yet",
            },
          ]}
        />
      );
    }

    if (selectedCategory === "Ads") {
      if (!loadedDatasets.length && !hasData) return null;
      return <AdsReportShell datasets={loadedDatasets} />;
    }

    if (selectedCategory === "Social") {
      return (
        <SocialReportShell
          datasets={loadedDatasets}
          previousDatasets={previousLoadedDatasets}
          igCalendarLinks={igCalendarLinks}
        />
      );
    }

    if (selectedCategory === "Website") {
      const webDs = pickPrimaryWebsiteDataset(loadedDatasets);
      if (!webDs && !hasData) return null;
      const webRows = webDs?.rows ?? datasetRows;
      const webCols = webDs?.columns ?? datasetColumns;
      if (isWebsiteDataset(webCols, webRows) || webCols.length > 0) {
        return (
          <WebsiteReportDashboard
            rows={webRows}
            datasetName={webDs?.name ?? selectedDatasetName}
            datasetMeta={
              webDs
                ? {
                    name: webDs.name,
                    createdAt: webDs.createdAt,
                    rowCount: webDs.rowCount,
                    sourceType: webDs.sourceType,
                    syncedAt: webDs.syncedAt,
                    externalAccountLabel: webDs.externalAccountLabel,
                  }
                : datasetMeta
            }
          />
        );
      }
    }

    if (selectedCategory === "SEO") {
      return (
        <SeoReportView
          datasets={loadedDatasets}
          datasetMeta={hasData ? datasetMeta : undefined}
          isAdmin={isAdmin}
        />
      );
    }

    return null;
  }

  const showEmpty =
    selectedCategory !== "General" &&
    selectedCategory !== "Social" &&
    selectedCategory !== "SEO" &&
    !hasData &&
    loadedDatasets.length === 0;

  // Social Overall / General can render without data; SEO has its own empty state
  const contentReady =
    selectedCategory === "General" ||
    selectedCategory === "Social" ||
    selectedCategory === "SEO" ||
    hasData ||
    loadedDatasets.length > 0;

  const showDatasetPicker =
    datasets.length > 1 &&
    selectedCategory !== "General" &&
    selectedCategory !== "Social" &&
    selectedCategory !== "Ads" &&
    selectedCategory !== "SEO";

  return (
    <Workspace wide>
      <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Report</h2>
            <p className="text-gray-500 text-[13px]">
              {isAdmin
                ? "Dashboards across General, Social, Ads, Website, and SEO."
                : "View your project reports."}
            </p>
            {isAdmin && selectedProjectId ? (
              <div className="mt-1 flex gap-3 text-[12px]">
                <Link
                  href={`/app/projects/funnel?project=${selectedProjectId}`}
                  className="inline-flex items-center gap-1 text-gray-500 hover:text-slate-900"
                >
                  <Filter size={12} /> Configure funnel
                </Link>
                <Link
                  href={`/app/projects/insights?project=${selectedProjectId}`}
                  className="inline-flex items-center gap-1 text-gray-500 hover:text-slate-900"
                >
                  <Sparkles size={12} /> AI insights
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ReportsHubShell
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        isAdmin={isAdmin}
        trailing={
          <>
            {showDatasetPicker && (
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Dataset
                </label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => void handleDatasetChange(e.target.value)}
                  className={fieldClass}
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.row_count} rows)
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isAdmin && selectedProjectId && (
              <div className="flex flex-wrap items-end gap-2 self-end">
                <DownloadPdfButton
                  body={{
                    kind: "report",
                    projectId: selectedProjectId,
                    category: selectedCategory,
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 bg-white text-gray-800 rounded-lg text-[13px] font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download size={14} /> Download PDF
                </DownloadPdfButton>
                <div className="text-right mr-1 hidden sm:block">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Client visibility
                  </p>
                  <p
                    className={`text-[12px] font-semibold ${
                      publishStatus === "published"
                        ? "text-emerald-700"
                        : publishStatus === "draft"
                          ? "text-amber-700"
                          : "text-gray-500"
                    }`}
                  >
                    {publishStatus === "published"
                      ? "Published"
                      : publishStatus === "draft"
                        ? "Draft (admin only)"
                        : "Not saved"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={publishBusy}
                  onClick={() => void upsertReportStatus("draft")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 bg-white text-gray-800 rounded-lg text-[13px] font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {publishBusy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save draft
                </button>
                {publishStatus === "published" ? (
                  <button
                    type="button"
                    disabled={publishBusy}
                    onClick={() => void handleUnpublish()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg text-[13px] font-medium hover:bg-amber-100 disabled:opacity-50"
                  >
                    <EyeOff size={14} />
                    Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={publishBusy}
                    onClick={() => void upsertReportStatus("published")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-[13px] font-medium hover:from-blue-700 hover:to-indigo-700 shadow-sm disabled:opacity-50"
                  >
                    <Eye size={14} />
                    Publish to client
                  </button>
                )}
              </div>
            )}
          </>
        }
      />

      {isAdmin && selectedProjectId ? (
        <div className="mb-4">
          <ReportSharePanel projectId={selectedProjectId} />
        </div>
      ) : null}

      {publishMessage && isAdmin && (
        <div
          className={`mb-3 text-[12px] px-3 py-2 rounded-lg border ${
            publishMessage.toLowerCase().includes("fail")
              ? "bg-red-50 border-red-100 text-red-700"
              : "bg-emerald-50 border-emerald-100 text-emerald-800"
          }`}
        >
          {publishMessage}
        </div>
      )}

      {(selectedCategory === "Social" ||
        selectedCategory === "Ads" ||
        selectedCategory === "SEO") &&
        loadedDatasets.length > 0 && (
          <div className="text-[12px] text-gray-500 -mt-2 mb-3 px-1">
            {loadedDatasets.length} {selectedCategory} stream
            {loadedDatasets.length === 1 ? "" : "s"} loaded
          </div>
        )}

      {selectedDataset &&
        selectedCategory !== "General" &&
        selectedCategory !== "Social" &&
        selectedCategory !== "Ads" &&
        selectedCategory !== "SEO" && (
          <div className="mb-4">
            <DatasetSourceBadge
              meta={datasetMeta}
              channelLabel={selectedCategory === "Website" ? "Website" : undefined}
              channelClassName="bg-blue-50 text-blue-700"
              projectId={selectedProjectId}
              isStaff={isAdmin}
              onSync={() => void handleReportRefresh(["google_analytics"])}
            />
          </div>
        )}

      {selectedProjectId && (
        <>
          <DataFreshnessBar
            streams={freshnessStreams}
            connections={freshnessConnections}
            projectId={selectedProjectId}
            isStaff={isAdmin}
            refreshing={refreshing}
            onRefresh={() => void handleReportRefresh()}
            onSyncProvider={(provider) => void handleReportRefresh([provider])}
          />
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-0.5">
            Report type
          </p>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2"
            role="tablist"
            aria-label="Report categories"
          >
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`group flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
                    active
                      ? "border-blue-600 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20"
                      : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:shadow-sm"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-gray-50 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600"
                    }`}
                  >
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[13px] font-semibold">{cat.label}</span>
                    <span
                      className={`block text-[10px] mt-0.5 leading-snug ${
                        active ? "text-white/75" : "text-gray-400"
                      }`}
                    >
                      {cat.hint}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        </>
      )}

      {loading ? (
        <div className="p-16 text-center text-[13px] text-gray-500">
          <Loader2 className="animate-spin mx-auto mb-2" size={20} />
          Loading report data...
        </div>
      ) : !selectedProjectId ? (
        <div className="p-16 text-center text-[13px] text-gray-500">
          Please select a project to view reports.
        </div>
      ) : isAdmin ? (
        showEmpty ? (
          <div className="p-16 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50">
            <FileSpreadsheet className="mx-auto mb-3 text-gray-400" size={32} />
            <p className="text-[14px] text-gray-600 font-medium mb-1">
              No data for {selectedCategory}
            </p>
            <p className="text-[12px] text-gray-500 mb-3">{emptyCopy(selectedCategory)}</p>
            <Link
              href={`/app/projects/report-data?project=${selectedProjectId}`}
              className="text-[13px] text-blue-600 hover:underline font-medium"
            >
              Open Sources →
            </Link>
          </div>
        ) : contentReady ? (
          renderDashboard()
        ) : null
      ) : publishStatus !== "published" ? (
        <div className="p-16 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50">
          <p className="text-[14px] text-gray-600 font-medium">
            Your {selectedCategory} report is being prepared.
          </p>
          <p className="text-[12px] text-gray-500 mt-1">Check back soon!</p>
        </div>
      ) : (
        renderDashboard()
      )}
    </Workspace>
  );
}
