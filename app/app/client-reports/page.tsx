"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { ClientNavGuard } from "@/components/client/ClientNavGuard";
import { ClientAccessFlowGate } from "@/components/client/ClientAccessFlowGate";
import { DataFreshnessBar } from "@/components/reports/DataFreshnessBar";
import {
  GeneralReportView,
  GENERAL_CHANNEL_ICONS,
} from "@/components/reports/GeneralReportView";
import {
  AdsReportShell,
  SeoReportView,
  SocialReportShell,
  WebsiteReportDashboard,
} from "@/components/reports/lazy-dashboards";
import {
  ClientAskAiDrawer,
  type AskAiMessage,
} from "@/components/reports/ClientAskAiDrawer";
import { ContactAgencyModal } from "@/components/reports/ContactAgencyModal";
import { DownloadPdfButton } from "@/components/pdf/DownloadPdfButton";
import { isFounder } from "@/lib/rbac";
import { getViewAsCompany } from "@/app/actions/view-as-client";
import { isWebsiteDataset, pickPrimaryWebsiteDataset } from "@/lib/reports/ga4-website";
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
import type { FreshnessConnection, FreshnessStream } from "@/lib/reports/freshness";
import type { ColumnSchema } from "@/lib/data-hub/column-detector";
import {
  Download,
  FileSpreadsheet,
  Globe2,
  LayoutGrid,
  Loader2,
  Megaphone,
  MessageSquare,
  Search,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { getClientReportShareUrl } from "@/app/actions/report-share";

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
  const [freshnessStreams, setFreshnessStreams] = useState<FreshnessStream[]>([]);
  const [freshnessConnections, setFreshnessConnections] = useState<FreshnessConnection[]>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  useEffect(() => {
    if (!projectId) {
      setShareUrl(null);
      return;
    }
    void getClientReportShareUrl(projectId).then(setShareUrl);
  }, [projectId]);

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
      const viewAs = staff ? await getViewAsCompany() : null;

      const { data: members } = await (supabase as any)
        .from("company_members")
        .select("company_id, status, crm_customers!company_id(company, name)")
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
        .eq("client_visible", true)
        .order("title");

      if (!staff) {
        if (!companyIds.length) {
          setProjects([]);
          setLoading(false);
          return;
        }
        query = query.in("client_id", companyIds);
      } else if (viewAs?.id) {
        query = query.eq("client_id", viewAs.id);
        setOrganization(viewAs.name);
      }

      const { data: projData } = await query;
      let mapped: ProjectOption[] = (projData || []).map((p: any) => {
        const cust = Array.isArray(p.crm_customers) ? p.crm_customers[0] : p.crm_customers;
        return {
          id: p.id,
          title: p.title,
          company: cust?.company || cust?.name,
          companyId: p.client_id,
        };
      });

      if (!staff && companyIds.length) {
        const { data: memRows } = await (supabase as any)
          .from("company_members")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "active");
        const memberIds = ((memRows || []) as { id: string }[]).map((m) => m.id);
        if (memberIds.length) {
          const { data: grants } = await (supabase as any)
            .from("project_members")
            .select("project_id")
            .in("company_member_id", memberIds)
            .eq("status", "active");
          const granted = new Set(
            ((grants || []) as { project_id: string }[]).map((g) => g.project_id)
          );
          if (granted.size > 0) {
            mapped = mapped.filter((p) => granted.has(p.id));
          }
        }
      }

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
        .select(
          "id, name, category, subcategory, columns, is_current, source_type, synced_at, created_at, external_account_label, row_count"
        )
        .eq("project_id", pid);

      const list = ((data || []) as DatasetMeta[]).filter(
        (d: any) => d.is_current !== false
      );
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

      setFreshnessStreams(
        list.map((d) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          subcategory: d.subcategory ?? null,
          sourceType: d.source_type,
          syncedAt: d.synced_at,
          createdAt: d.created_at,
          externalAccountLabel: d.external_account_label,
          rowCount: d.row_count,
        }))
      );
      const { data: conns } = await (supabase as any)
        .from("project_data_connections")
        .select("provider, status, last_error, last_synced_at, external_account_label")
        .eq("project_id", pid)
        .neq("status", "revoked");
      setFreshnessConnections((conns || []) as FreshnessConnection[]);

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
            .select("id, name, category, subcategory, columns, row_count, created_at, is_current, supersedes_id, source_type, synced_at, external_account_label")
            .eq("project_id", pid)
            .order("created_at", { ascending: false });
          const list = ((allDs || []) as DatasetMeta[]).filter(
            (d: any) => d.is_current !== false
          );
          setLoadedDatasets(await hydrateLoadedDatasets(supabase, list));
          setLoading(false);
          return;
        }

        const cats = datasetCategoriesForReport(cat);
        const { data: ds } = await (supabase as any)
          .from("datasets")
          .select("id, name, category, subcategory, columns, row_count, created_at, is_current, supersedes_id, source_type, synced_at, external_account_label")
          .eq("project_id", pid)
          .in("category", cats)
          .order("created_at", { ascending: false });

        let list = ((ds || []) as DatasetMeta[]).filter(
          (d: any) => d.is_current !== false
        );
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
          const loaded = await hydrateLoadedDatasets(supabase, list);
          setLoadedDatasets(loaded);
          const primary =
            cat === "Website"
              ? pickPrimaryWebsiteDataset(loaded) || loaded[0]
              : loaded[0];
          setDatasets(list);
          setSelectedDatasetId(primary.id);
          setDatasetColumns(primary.columns as ColumnSchema[]);
          setDatasetRows(primary.rows);
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
    sourceType: selectedDataset?.source_type,
    syncedAt: selectedDataset?.synced_at,
    externalAccountLabel: selectedDataset?.external_account_label,
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
      const webDs = pickPrimaryWebsiteDataset(loadedDatasets);
      const webRows = webDs?.rows ?? datasetRows;
      const webCols = webDs?.columns ?? datasetColumns;
      if (!webDs && !hasData) return null;
      if (isWebsiteDataset(webCols, webRows) || webCols.length > 0) {
        return (
          <WebsiteReportDashboard
            rows={webRows}
            datasetName={webDs?.name ?? selectedDataset?.name}
            datasetMeta={
              webDs
                ? {
                    name: webDs.name,
                    createdAt: webDs.createdAt,
                    rowCount: webDs.rowCount ?? webDs.rows.length,
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
        <div className="bg-surface border border-border rounded-lg p-4 print:shadow-none print:border-0">
          <div className="flex flex-wrap items-end gap-3 justify-between">
            <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Reports
                </p>
                <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight truncate">
                  {organization}
                </h1>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px]">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Project
                </label>
                <select
                  value={projectId}
                  onChange={(e) => onProjectChange(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2.5 min-h-11 text-[13px] bg-surface outline-none focus:ring-1 focus:ring-accent no-print"
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
                className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-lg border border-border bg-surface text-text-primary text-[13px] font-semibold hover:bg-surface-raised disabled:opacity-50 no-print"
              >
                <MessageSquare size={14} /> Ask AI
              </button>
              <DownloadPdfButton
                body={{ kind: "report", projectId, category }}
                disabled={!projectId || !isCategoryPublished}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover disabled:opacity-50 no-print"
              >
                <Download size={14} /> Download PDF
              </DownloadPdfButton>
              {shareUrl ? (
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(shareUrl);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 1600);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-lg border border-border bg-surface text-text-primary text-[13px] font-semibold hover:bg-surface-raised no-print"
                  title="Copy the password-gated public URL"
                >
                  {shareCopied ? <Check size={14} /> : <Copy size={14} />}
                  {shareCopied ? "Copied link" : "Copy public link"}
                </button>
              ) : null}
            </div>
          </div>

          {projectId ? (
            <div className="mt-4 no-print">
              <DataFreshnessBar
                streams={freshnessStreams}
                connections={freshnessConnections}
                projectId={projectId}
                isStaff={false}
              />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3 no-print">
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
                  className={`inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-lg text-[12px] font-semibold transition-colors ${
                    !live
                      ? "bg-surface-raised text-text-muted border border-border cursor-not-allowed opacity-70"
                      : active
                        ? "bg-accent text-white"
                        : "bg-surface-raised text-text-secondary hover:bg-surface-raised hover:text-text-primary border border-border"
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
          <div className="flex justify-center py-20 text-text-muted">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : !projectId ? (
          <div className="bg-surface border border-dashed border-border rounded-lg p-10 text-center">
            <FileSpreadsheet className="mx-auto text-text-muted mb-3" size={28} />
            <p className="text-[14px] font-semibold text-text-primary">No projects yet</p>
            <p className="text-[13px] text-text-secondary mt-1 max-w-md mx-auto">
              Once your agency links an active project to your organization, executive reports
              will appear here.
            </p>
          </div>
        ) : !hasAnyPublished ? (
          <div className="bg-surface border border-dashed border-border rounded-lg p-10 text-center">
            <p className="text-[14px] font-semibold text-text-primary">
              Reports not published yet
            </p>
            <p className="text-[13px] text-text-secondary mt-1 max-w-md mx-auto">
              Your agency is still preparing this project&apos;s executive dashboards. Published
              tabs will appear here automatically.
            </p>
          </div>
        ) : !isCategoryPublished ? (
          <div className="bg-surface border border-dashed border-border rounded-lg p-10 text-center">
            <p className="text-[14px] font-semibold text-text-primary">
              {category} report not published yet
            </p>
            <p className="text-[13px] text-text-secondary mt-1">
              Choose another published tab above, or check back soon.
            </p>
          </div>
        ) : showEmpty ? (
          <div className="bg-surface border border-dashed border-border rounded-lg p-10 text-center">
            <p className="text-[14px] font-semibold text-text-primary">
              {category} report not available yet
            </p>
            <p className="text-[13px] text-text-secondary mt-1">
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
      <ClientNavGuard navKey="reports" />
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
