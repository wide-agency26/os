import { createAdminClient } from "@/utils/supabase/admin";
import { detectSubcategory } from "@/lib/data-hub/subcategory";
import { isGoogleAdsDataset } from "@/lib/reports/google-ads";
import { isMetaAdsDataset } from "@/lib/reports/meta-ads";
import {
  type ReportCategory,
  datasetCategoriesForReport,
} from "@/lib/reports/categories";
import type { LoadedDataset } from "@/lib/reports/aggregation";
import {
  hydrateLoadedDatasets,
  type DatasetMeta,
} from "@/lib/reports/load-datasets";
import { isWebsiteDataset } from "@/lib/reports/ga4-website";

export type ReportPrintPayload = {
  projectId: string;
  projectTitle: string;
  organization: string;
  category: ReportCategory;
  datasets: LoadedDataset[];
  channelPresence: {
    Social: boolean;
    Ads: boolean;
    Website: boolean;
    SEO: boolean;
  };
};

function presenceFrom(list: DatasetMeta[]) {
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
  return presence;
}

export async function loadReportPrintData(
  projectId: string,
  category: ReportCategory
): Promise<ReportPrintPayload | null> {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, title, client_id, client:client_id ( company, name )")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const client = Array.isArray(project.client) ? project.client[0] : project.client;
  const organization = client?.company || client?.name || project.title || "Report";

  const { data: allDs } = await admin
    .from("datasets")
    .select(
      "id, name, category, subcategory, columns, row_count, created_at, is_current, supersedes_id, source_type, synced_at, external_account_label"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const current = ((allDs || []) as DatasetMeta[]).filter((d) => d.is_current !== false);
  const channelPresence = presenceFrom(current);

  let list = current;
  if (category !== "General") {
    const cats = datasetCategoriesForReport(category);
    list = current.filter((d) => cats.includes(d.category));
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
  }

  const datasets = await hydrateLoadedDatasets(admin, list);
  if (category === "Website") {
    const idx = datasets.findIndex((d) => isWebsiteDataset(d.columns, d.rows));
    if (idx > 0) {
      const [hit] = datasets.splice(idx, 1);
      datasets.unshift(hit);
    }
  }
  return {
    projectId,
    projectTitle: project.title,
    organization,
    category,
    datasets,
    channelPresence,
  };
}

export function subcategoryOf(d: LoadedDataset) {
  return d.subcategory || detectSubcategory(d.name, d.columns);
}
