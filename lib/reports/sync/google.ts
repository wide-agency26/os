import { google } from "googleapis";
import { writeCurrentDataset } from "@/lib/reports/sync/write-dataset";
import { getGoogleAuthClient, isoDaysAgo } from "@/lib/reports/sync/google-auth";
import type { DataProvider } from "@/lib/reports/sync/providers";

export interface ProjectConnection {
  id: string;
  provider: DataProvider;
  status: string;
  external_account_id: string | null;
  external_account_label: string | null;
  metadata: Record<string, unknown> | null;
  access_token?: string | null;
  refresh_token?: string | null;
}

function gscRow(
  keys: string[] | null | undefined,
  dim: string,
  clicks: number,
  impressions: number,
  ctr: number,
  position: number
) {
  const dimVal = keys?.[0] ?? "";
  const ctrPct = impressions > 0 ? (clicks / impressions) * 100 : ctr <= 1 ? ctr * 100 : ctr;
  return {
    [dim]: dimVal,
    clicks,
    impressions,
    ctr: Number(ctrPct.toFixed(4)),
    position: Number(position.toFixed(2)),
  };
}

export async function listGoogleAccounts(): Promise<{
  ga4: { id: string; label: string }[];
  gsc: { id: string; label: string }[];
}> {
  const auth = await getGoogleAuthClient();
  const ga4: { id: string; label: string }[] = [];
  const gsc: { id: string; label: string }[] = [];

  try {
    const admin = google.analyticsadmin({ version: "v1beta", auth });
    const summaries = await admin.accountSummaries.list({ pageSize: 200 });
    for (const account of summaries.data.accountSummaries ?? []) {
      for (const prop of account.propertySummaries ?? []) {
        const id = (prop.property || "").replace("properties/", "");
        if (!id) continue;
        ga4.push({
          id,
          label: `${prop.displayName || id}${account.displayName ? ` · ${account.displayName}` : ""}`,
        });
      }
    }
  } catch (err) {
    console.warn("GA4 property list failed:", err);
  }

  try {
    const webmasters = google.searchconsole({ version: "v1", auth });
    const sites = await webmasters.sites.list();
    for (const site of sites.data.siteEntry ?? []) {
      if (!site.siteUrl) continue;
      gsc.push({ id: site.siteUrl, label: site.siteUrl });
    }
  } catch (err) {
    console.warn("GSC site list failed:", err);
  }

  return { ga4, gsc };
}

export async function syncGoogleAnalytics(
  projectId: string,
  connection: ProjectConnection,
  createdBy?: string | null
): Promise<{ streams: string[]; rows: number }> {
  const propertyId = connection.external_account_id;
  if (!propertyId) throw new Error("Pick a GA4 property before syncing Website.");

  const auth = await getGoogleAuthClient();
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
  const startDate = isoDaysAgo(90);
  const endDate = isoDaysAgo(1);

  const report = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }, { name: "sessionSource" }],
      metrics: [
        { name: "totalUsers" },
        { name: "activeUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "sessionsPerUser" },
        { name: "engagementRate" },
        { name: "bounceRate" },
        { name: "userEngagementDuration" },
      ],
      limit: "100000",
    },
  });

  const rows: Record<string, unknown>[] = (report.data.rows ?? []).map((r) => {
    const date = r.dimensionValues?.[0]?.value ?? "";
    const sessionSource = r.dimensionValues?.[1]?.value ?? "(direct)";
    const m = r.metricValues ?? [];
    return {
      date,
      sessionSource,
      totalUsers: Number(m[0]?.value ?? 0),
      activeUsers: Number(m[1]?.value ?? 0),
      newUsers: Number(m[2]?.value ?? 0),
      sessions: Number(m[3]?.value ?? 0),
      sessionsPerUser: Number(m[4]?.value ?? 0),
      engagementRate: Number(m[5]?.value ?? 0),
      bounceRate: Number(m[6]?.value ?? 0),
      userEngagementDuration: Number(m[7]?.value ?? 0),
    };
  });

  const label = connection.external_account_label || `GA4 ${propertyId}`;
  await writeCurrentDataset({
    projectId,
    name: `GA4 · ${label}`,
    category: "Website",
    subcategory: "ga4",
    rows,
    sourceType: "sync",
    connectionId: connection.id,
    syncWindowStart: startDate,
    syncWindowEnd: endDate,
    externalAccountLabel: label,
    createdBy,
  });

  return { streams: ["ga4"], rows: rows.length };
}

async function queryGsc(
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  auth: Awaited<ReturnType<typeof getGoogleAuthClient>>
) {
  const webmasters = google.searchconsole({ version: "v1", auth });
  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions,
      rowLimit: 25000,
    },
  });
  return res.data.rows ?? [];
}

export async function syncGoogleSearchConsole(
  projectId: string,
  connection: ProjectConnection,
  createdBy?: string | null
): Promise<{ streams: string[]; rows: number }> {
  const siteUrl = connection.external_account_id;
  if (!siteUrl) throw new Error("Pick a Search Console property before syncing SEO.");

  const auth = await getGoogleAuthClient();
  const startDate = isoDaysAgo(90);
  const endDate = isoDaysAgo(1);
  const label = connection.external_account_label || siteUrl;

  const specs: { dim: string; subcategory: string; key: string }[] = [
    { dim: "date", subcategory: "gsc_dates", key: "date" },
    { dim: "query", subcategory: "gsc_queries", key: "query" },
    { dim: "page", subcategory: "gsc_pages", key: "page" },
    { dim: "country", subcategory: "gsc_countries", key: "country" },
    { dim: "device", subcategory: "gsc_devices", key: "device" },
    { dim: "searchAppearance", subcategory: "gsc_search_appearance", key: "searchAppearance" },
  ];

  let total = 0;
  const streams: string[] = [];

  for (const spec of specs) {
    const raw = await queryGsc(siteUrl, startDate, endDate, [spec.dim], auth);
    const rows = raw.map((r) =>
      gscRow(
        r.keys,
        spec.key,
        r.clicks ?? 0,
        r.impressions ?? 0,
        r.ctr ?? 0,
        r.position ?? 0
      )
    );
    await writeCurrentDataset({
      projectId,
      name: `GSC · ${spec.key} · ${label}`,
      category: "SEO",
      subcategory: spec.subcategory,
      rows,
      sourceType: "sync",
      connectionId: connection.id,
      syncWindowStart: startDate,
      syncWindowEnd: endDate,
      externalAccountLabel: label,
      createdBy,
    });
    total += rows.length;
    streams.push(spec.subcategory);
  }

  return { streams, rows: total };
}
