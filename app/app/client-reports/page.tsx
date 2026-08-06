"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { ClientAccessFlowGate } from "@/components/client/ClientAccessFlowGate";
import {
  GeneralReportView,
  GENERAL_CHANNEL_ICONS,
} from "@/components/reports/GeneralReportView";
import { AdsReportShell } from "@/components/reports/AdsReportShell";
import { SocialReportShell } from "@/components/reports/SocialReportShell";
import { WebsiteReportDashboard } from "@/components/reports/WebsiteReportDashboard";
import { SeoReportView } from "@/components/reports/SeoReportView";
import {
  ClientAskAiDrawer,
  type AskAiMessage,
} from "@/components/reports/ClientAskAiDrawer";
import { ContactAgencyModal } from "@/components/reports/ContactAgencyModal";
import { isFounder } from "@/lib/rbac";
import { isWebsiteDataset } from "@/lib/reports/ga4-website";
import { isMetaAdsDataset } from "@/lib/reports/meta-ads";
import { isGoogleAdsDataset } from "@/lib/reports/google-ads";
import {
  type ReportCategory,
  datasetCategoriesForReport,
} from "@/lib/reports/categories";
import { type LoadedDataset, computeGeneralFunnel } from "@/lib/reports/aggregation";
import { detectSubcategory } from "@/lib/data-hub/subcategory";
import {
  hydrateLoadedDatasets,
  type DatasetMeta,
} from "@/lib/reports/load-datasets";
import type { ColumnSchema } from "@/lib/data-hub/column-detector";
import {
  Building2,
  Download,
  FileSpreadsheet,
  Globe2,
  LayoutGrid,
  Loader2,
  Megaphone,
  MessageSquare,
  Search,
  Share2,
} from "lucide-react";

const CATEGORIES: {
  id: ReportCategory;
  label: string;
  icon: ElementType;
}[] = [
  { id: "General", label: "General", icon: LayoutGrid },
  { id: "Social", label: "Social", icon: Share2 },
  { id: "Ads", label: "Ads", icon: Megaphone },
  { id: "Website", label: "Website", icon: Globe2 },
  { id: "SEO", label: "SEO", icon: Search },
];

interface ProjectOption {
  id: string;
  title: string;
  company?: string;
  companyId?: string;
}

function ClientReportsInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [organization, setOrganization] = useState("Your organization");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState<ReportCategory>("General");
  const [loading, setLoading] = useState(true);
  const [loadedDatasets, setLoadedDatasets] = useState<LoadedDataset[]>([]);
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [datasetRows, setDatasetRows] = useState<Record<string, unknown>[]>([]);
  const [datasetColumns, setDatasetColumns] = useState<ColumnSchema[]>([]);
  const [channelPresence, setChannelPresence] = useState({
    Social: false,
    Ads: false,
    Website: false,
    SEO: false,
  });

  const [askOpen, setAskOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateQuestion, setEscalateQuestion] = useState("");
  const [escalateThread, setEscalateThread] = useState<AskAiMessage[]>([]);
  const [publishedCategories, setPublishedCategories] = useState<
    Record<string, boolean>
  >({});

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const staff = profile ? isFounder(profile.role) : false;

      const { data: members } = await (supabase as any)
        .from("company_members")
        .select("company_id, status, crm_customers(company, name)")
        .eq("user_id", user.id)
        .eq("status", "active");

      const activeMembers = (members || []) as any[];
      const companyIds = activeMembers.map((m) => m.company_id as string);

      if (activeMembers[0]) {
        const cust = Array.isArray(activeMembers[0].crm_customers)
          ? activeMembers[0].crm_customers[0]
          : activeMembers[0].crm_customers;
        setOrganization(cust?.company || cust?.name || "Your organization");
      }

      let query = (supabase as any)
        .from("projects")
        .select(
          `
          id,
          title,
          client_id,
          crm_customers!client_id (
            id,
            company,
            name
          )
        `
        )
        .order("title");

      if (!staff) {
        if (!companyIds.length) {
          setProjects([]);
          setLoading(false);
          return;
        }
        query = query.in("client_id", companyIds);
      }

      const { data: projData } = await query;
      const mapped: ProjectOption[] = (projData || []).map((p: any) => {
        const cust = Array.isArray(p.crm_customers) ? p.crm_customers[0] : p.crm_customers;
        return {
          id: p.id,
          title: p.title,
          company: cust?.company || cust?.name,
          companyId: p.client_id,
        };
      });

      setProjects(mapped);
      if (mapped[0]?.company) {
        setOrganization(mapped[0].company);
      }

      const fromUrl =
        searchParams.get("project_id") || searchParams.get("project") || "";
      const initial =
        fromUrl && mapped.some((p) => p.id === fromUrl) ? fromUrl : mapped[0]?.id || "";
      setProjectId(initial);
      if (!mapped.length) setLoading(false);
    })();
  }, [supabase, searchParams]);

  const refreshPresence = useCallback(
    async (pid: string) => {
      const { data } = await (supabase as any)
        .from("datasets")
        .select("id, category, subcategory, columns")
        .eq("project_id", pid);

      const list = (data || []) as DatasetMeta[];
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

      // RLS only returns published rows for clients
      const { data: pubs } = await (supabase as any)
        .from("published_reports")
        .select("category, status")
        .eq("project_id", pid)
        .eq("status", "published");

      const map: Record<string, boolean> = {};
      for (const row of pubs || []) {
        map[row.category] = true;
      }
      setPublishedCategories(map);
    },
    [supabase]
  );

  const loadProjectData = useCallback(
    async (pid: string, cat: ReportCategory) => {
      setLoading(true);
      setLoadedDatasets([]);
      setDatasets([]);
      setSelectedDatasetId("");
      setDatasetRows([]);
      setDatasetColumns([]);

      await refreshPresence(pid);

      try {
        if (cat === "General") {
          const { data: allDs } = await (supabase as any)
            .from("datasets")
            .select("id, name, category, subcategory, columns, row_count, created_at")
            .eq("project_id", pid)
            .order("created_at", { ascending: false });
          const list = (allDs || []) as DatasetMeta[];
          setLoadedDatasets(await hydrateLoadedDatasets(supabase, list));
          setLoading(false);
          return;
        }

        const cats = datasetCategoriesForReport(cat);
        const { data: ds } = await (supabase as any)
          .from("datasets")
          .select("id, name, category, subcategory, columns, row_count, created_at")
          .eq("project_id", pid)
          .in("category", cats)
          .order("created_at", { ascending: false });

        let list = (ds || []) as DatasetMeta[];
        if (cat === "Ads") {
          list = list.filter(
            (d) =>
              d.category === "Ads" ||
              d.category === "Digital" ||
              isMetaAdsDataset(d.columns, undefined) ||
              isGoogleAdsDataset(d.columns)
          );
        }
        if (cat === "Social") {
          list = list.filter(
            (d) =>
              !isMetaAdsDataset(d.columns, undefined) && !isGoogleAdsDataset(d.columns)
          );
        }

        if (list.length) {
          setDatasets(list);
          setSelectedDatasetId(list[0].id);
          const loaded = await hydrateLoadedDatasets(supabase, list);
          setLoadedDatasets(loaded);
          setDatasetColumns(loaded[0].columns as ColumnSchema[]);
          setDatasetRows(loaded[0].rows);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [supabase, refreshPresence]
  );

  useEffect(() => {
    if (!projectId) return;
    void loadProjectData(projectId, category);
  }, [projectId, category, loadProjectData]);

  useEffect(() => {
    if (!projectId) return;
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("project_id", projectId);
    router.replace(`/app/client-reports?${sp.toString()}`);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasData =
    datasetRows.length > 0 || loadedDatasets.some((d) => d.rows.length > 0);
  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);
  const datasetMeta = {
    name: selectedDataset?.name,
    createdAt: selectedDataset?.created_at,
    rowCount: selectedDataset?.row_count ?? datasetRows.length,
  };

  const reportContext = useMemo(() => {
    if (category !== "General" || !loadedDatasets.length) {
      return {
        tab: category,
        dataset_count: loadedDatasets.length,
        channels: channelPresence,
      };
    }
    const funnel = computeGeneralFunnel(loadedDatasets, {
      mode: "all",
      months: [],
      customStart: "",
      customEnd: "",
    });
    return {
      tab: "General",
      funnel_metrics: funnel
        ? {
            awareness: funnel.stages.awareness,
            consideration: funnel.stages.consideration,
            conversion: funnel.stages.conversion,
            awareness_to_consideration_rate: funnel.rates.awarenessToConsideration,
            consideration_to_conversion_rate: funnel.rates.considerationToConversion,
            total_funnel_efficiency: funnel.rates.totalFunnelEfficiency,
          }
        : {},
      spend_and_cpa: funnel
        ? {
            ad_spend: funnel.conversions.adSpend,
            cpa: funnel.conversions.cpa,
          }
        : {},
      attribution: funnel?.attribution || [],
      channels: channelPresence,
    };
  }, [category, loadedDatasets, channelPresence]);

  const dateRangeLabel = "Selected period in report";

  const onProjectChange = (id: string) => {
    setProjectId(id);
    const p = projects.find((x) => x.id === id);
    if (p?.company) setOrganization(p.company);
  };

  const isCategoryPublished = publishedCategories[category] === true;

  useEffect(() => {
    // If current tab isn't published, jump to first published tab
    if (!projectId || loading) return;
    if (isCategoryPublished) return;
    const first = CATEGORIES.find((c) => publishedCategories[c.id]);
    if (first && first.id !== category) setCategory(first.id);
  }, [projectId, publishedCategories, category, isCategoryPublished, loading]);

  const renderDashboard = () => {
    if (!isCategoryPublished) return null;
    if (category === "General") {
      return (
        <GeneralReportView
          clientMode
          datasets={loadedDatasets}
          projectId={projectId}
          onSelectCategory={(id) => setCategory(id as ReportCategory)}
          channels={[
            {
              id: "Social",
              label: "Social",
              hint: "Organic reach & engagement",
              icon: GENERAL_CHANNEL_ICONS.Social,
              hasData: channelPresence.Social,
              metricHint: channelPresence.Social
                ? "Organic source connected"
                : "Awaiting agency data",
            },
            {
              id: "Ads",
              label: "Ads",
              hint: "Paid spend, CPA, ROAS",
              icon: GENERAL_CHANNEL_ICONS.Ads,
              hasData: channelPresence.Ads,
              metricHint: channelPresence.Ads
                ? "Paid media source connected"
                : "Awaiting agency data",
            },
            {
              id: "Website",
              label: "Website",
              hint: "GA4 traffic & engagement",
              icon: GENERAL_CHANNEL_ICONS.Website,
              hasData: channelPresence.Website,
              metricHint: channelPresence.Website
                ? "Website analytics connected"
                : "Awaiting agency data",
            },
            {
              id: "SEO",
              label: "SEO",
              hint: "Search Console performance",
              icon: GENERAL_CHANNEL_ICONS.SEO,
              hasData: channelPresence.SEO,
              metricHint: channelPresence.SEO
                ? "Search Console connected"
                : "Awaiting agency data",
            },
          ]}
        />
      );
    }
    if (category === "Ads") {
      if (!loadedDatasets.length && !hasData) return null;
      return <AdsReportShell datasets={loadedDatasets} />;
    }
    if (category === "Social") {
      return <SocialReportShell datasets={loadedDatasets} />;
    }
    if (category === "Website") {
      if (!hasData) return null;
      if (isWebsiteDataset(datasetColumns, datasetRows) || datasetColumns.length > 0) {
        return (
          <WebsiteReportDashboard
            rows={datasetRows}
            datasetName={selectedDataset?.name}
            datasetMeta={datasetMeta}
          />
        );
      }
    }
    if (category === "SEO") {
      return (
        <SeoReportView
          datasets={loadedDatasets}
          datasetMeta={hasData ? datasetMeta : undefined}
          isAdmin={false}
        />
      );
    }
    return null;
  };

  const hasAnyPublished = Object.values(publishedCategories).some(Boolean);

  const showEmpty =
    isCategoryPublished &&
    category !== "General" &&
    category !== "Social" &&
    category !== "SEO" &&
    !hasData &&
    loadedDatasets.length === 0;

  return (
    <Workspace wide>
      <div className="client-report-viewer space-y-4 pb-10">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm print:shadow-none print:border-0">
          <div className="flex flex-wrap items-end gap-3 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center shrink-0">
                <Building2 size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Organization
                </p>
                <h1 className="text-[17px] font-bold text-gray-900 truncate">
                  {organization}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px]">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Project
                </label>
                <select
                  value={projectId}
                  onChange={(e) => onProjectChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-2 focus:ring-indigo-500 no-print"
                >
                  {projects.length === 0 && (
                    <option value="">No projects available</option>
                  )}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <p className="hidden print:block text-[13px] font-semibold text-gray-900 mt-1">
                  {project?.title}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAskOpen(true)}
                disabled={!projectId || !isCategoryPublished}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 text-[13px] font-semibold hover:bg-indigo-100 disabled:opacity-50 no-print"
              >
                <MessageSquare size={14} /> Ask AI
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!projectId || !isCategoryPublished}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-[13px] font-semibold hover:bg-black disabled:opacity-50 no-print"
              >
                <Download size={14} /> Download PDF
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3 no-print">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = category === c.id;
              const live = publishedCategories[c.id] === true;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!live}
                  title={live ? undefined : "Not published yet"}
                  onClick={() => live && setCategory(c.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                    !live
                      ? "bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed opacity-70"
                      : active
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  <Icon size={13} />
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="hidden print:block mt-3 text-[11px] text-gray-500 border-t border-gray-100 pt-2">
            Exported on{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            for {organization} · {project?.title} · {category}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-gray-400">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : !projectId ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <FileSpreadsheet className="mx-auto text-gray-300 mb-3" size={28} />
            <p className="text-[14px] font-semibold text-gray-800">No projects yet</p>
            <p className="text-[13px] text-gray-500 mt-1 max-w-md mx-auto">
              Once your agency links an active project to your organization, executive reports
              will appear here.
            </p>
          </div>
        ) : !hasAnyPublished ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
            <p className="text-[14px] font-semibold text-gray-800">
              Reports not published yet
            </p>
            <p className="text-[13px] text-gray-500 mt-1 max-w-md mx-auto">
              Your agency is still preparing this project&apos;s executive dashboards. Published
              tabs will appear here automatically.
            </p>
          </div>
        ) : !isCategoryPublished ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
            <p className="text-[14px] font-semibold text-gray-800">
              {category} report not published yet
            </p>
            <p className="text-[13px] text-gray-500 mt-1">
              Choose another published tab above, or check back soon.
            </p>
          </div>
        ) : showEmpty ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
            <p className="text-[14px] font-semibold text-gray-800">
              {category} report not available yet
            </p>
            <p className="text-[13px] text-gray-500 mt-1">
              Your agency is still preparing this channel. Check back soon.
            </p>
          </div>
        ) : (
          <div id="client-report-print-root" className="report-print-surface">
            {renderDashboard()}
          </div>
        )}
      </div>

      <ClientAskAiDrawer
        open={askOpen}
        onClose={() => setAskOpen(false)}
        projectId={projectId}
        projectName={project?.title || "Project"}
        organization={organization}
        tab={category}
        dateRangeLabel={dateRangeLabel}
        reportContext={reportContext}
        onNeedAgencyHelp={({ question, thread }) => {
          setEscalateQuestion(question);
          setEscalateThread(thread);
          setEscalateOpen(true);
        }}
      />

      <ContactAgencyModal
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        projectId={projectId}
        projectName={project?.title || "Project"}
        organization={organization}
        tab={category}
        dateRangeLabel={dateRangeLabel}
        initialQuestion={escalateQuestion}
        thread={escalateThread}
        reportSnapshot={reportContext}
      />
    </Workspace>
  );
}

export default function ClientReportsPage() {
  return (
    <ClientAccessFlowGate>
      <Suspense
        fallback={
          <Workspace wide>
            <div className="flex justify-center py-24 text-gray-400">
              <Loader2 className="animate-spin" size={22} />
            </div>
          </Workspace>
        }
      >
        <ClientReportsInner />
      </Suspense>
    </ClientAccessFlowGate>
  );
}
