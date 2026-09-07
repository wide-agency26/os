import { writeCurrentDataset } from "@/lib/reports/sync/write-dataset";
import {
  getGoogleAuthFromConnection,
  googleAdsDeveloperToken,
  isoDaysAgo,
} from "@/lib/reports/sync/google-auth";
import type { ProjectConnection } from "@/lib/reports/sync/google";

const ADS_API = "https://googleads.googleapis.com/v19";

const CHANNEL_LABEL: Record<string, string> = {
  SEARCH: "Search",
  DISPLAY: "Display",
  SHOPPING: "Shopping",
  VIDEO: "Video",
  MULTI_CHANNEL: "Performance Max",
  DEMAND_GEN: "Demand Gen",
  LOCAL: "Local",
  SMART: "Smart",
  HOTEL: "Hotel",
  TRAVEL: "Travel",
};

type Conn = ProjectConnection & {
  refresh_token?: string | null;
  access_token?: string | null;
};

async function bearer(conn: Conn): Promise<string> {
  const auth = await getGoogleAuthFromConnection(conn);
  const tok = await auth.getAccessToken();
  if (!tok.token) throw new Error("Could not refresh the Google Ads token. Reconnect the account.");
  return tok.token;
}

async function adsRequest(
  path: string,
  token: string,
  opts?: { method?: string; body?: unknown; loginCustomerId?: string | null }
): Promise<unknown> {
  const developerToken = googleAdsDeveloperToken();
  if (!developerToken) {
    throw new Error(
      "Google Ads API needs GOOGLE_ADS_DEVELOPER_TOKEN in Vercel env (from Google Ads API Center)."
    );
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (opts?.loginCustomerId) headers["login-customer-id"] = opts.loginCustomerId.replace(/\D/g, "");
  const res = await fetch(`${ADS_API}/${path.replace(/^\//, "")}`, {
    method: opts?.method || (opts?.body ? "POST" : "GET"),
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string };
    resourceNames?: string[];
    results?: unknown[];
  };
  if (!res.ok) {
    throw new Error(json.error?.message || `Google Ads API ${res.status}`);
  }
  return json;
}

export async function listGoogleAdsCustomers(conn: Conn): Promise<{ id: string; label: string }[]> {
  const token = await bearer(conn);
  const listed = (await adsRequest("customers:listAccessibleCustomers", token)) as {
    resourceNames?: string[];
  };
  const ids = (listed.resourceNames ?? []).map((n) => n.replace("customers/", "")).filter(Boolean);
  const out: { id: string; label: string }[] = [];
  for (const id of ids) {
    try {
      const q = (await adsRequest(`customers/${id}/googleAds:search`, token, {
        body: {
          query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1",
        },
        loginCustomerId: id,
      })) as { results?: { customer?: { id?: string; descriptiveName?: string } }[] };
      const row = q.results?.[0]?.customer;
      out.push({
        id,
        label: row?.descriptiveName ? `${row.descriptiveName} (${id})` : id,
      });
    } catch {
      out.push({ id, label: id });
    }
  }
  return out;
}

export async function syncGoogleAds(
  projectId: string,
  connection: Conn,
  createdBy?: string | null
): Promise<{ streams: string[]; rows: number }> {
  const customerId = (connection.external_account_id || "").replace(/\D/g, "");
  if (!customerId) throw new Error("Pick a Google Ads account before syncing Ads.");

  const token = await bearer(connection);
  const startDate = isoDaysAgo(90);
  const endDate = isoDaysAgo(1);
  const loginCustomerId =
    (connection.metadata?.loginCustomerId as string | undefined) || customerId;

  const q = (await adsRequest(`customers/${customerId}/googleAds:search`, token, {
    body: {
      query: `
        SELECT
          campaign.name,
          campaign.advertising_channel_type,
          segments.date,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.cost_per_conversion,
          metrics.conversions_from_interactions_rate,
          metrics.view_through_conversions,
          metrics.absolute_top_impression_percentage,
          metrics.top_impression_percentage
        FROM campaign
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      `.replace(/\s+/g, " ").trim(),
    },
    loginCustomerId,
  })) as {
    results?: {
      campaign?: { name?: string; advertisingChannelType?: string };
      segments?: { date?: string };
      metrics?: {
        costMicros?: string | number;
        impressions?: string | number;
        clicks?: string | number;
        ctr?: number;
        averageCpc?: string | number;
        conversions?: number;
        costPerConversion?: number;
        conversionsFromInteractionsRate?: number;
        viewThroughConversions?: number;
        absoluteTopImpressionPercentage?: number;
        topImpressionPercentage?: number;
      };
    }[];
  };

  const rows: Record<string, unknown>[] = (q.results ?? []).map((r) => {
    const cost = Number(r.metrics?.costMicros ?? 0) / 1_000_000;
    const impressions = Number(r.metrics?.impressions ?? 0);
    const clicks = Number(r.metrics?.clicks ?? 0);
    const ctr = Number(r.metrics?.ctr ?? 0);
    const avgCpc = Number(r.metrics?.averageCpc ?? 0) / 1_000_000;
    const conversions = Number(r.metrics?.conversions ?? 0);
    const channel = r.campaign?.advertisingChannelType || "UNKNOWN";
    return {
      Day: r.segments?.date,
      Campaign: r.campaign?.name || "(not set)",
      "Campaign type": CHANNEL_LABEL[channel] || channel,
      Cost: cost,
      Impressions: impressions,
      Clicks: clicks,
      CTR: ctr <= 1 ? ctr * 100 : ctr,
      "Avg. CPC": avgCpc,
      Conversions: conversions,
      "Cost / conv.": Number(r.metrics?.costPerConversion ?? 0) / 1_000_000,
      "Conv. rate": Number(r.metrics?.conversionsFromInteractionsRate ?? 0) * 100,
      "View-through conv.": Number(r.metrics?.viewThroughConversions ?? 0),
      "Impr. (Abs. Top) %": Number(r.metrics?.absoluteTopImpressionPercentage ?? 0) * 100,
      "Impr. (Top) %": Number(r.metrics?.topImpressionPercentage ?? 0) * 100,
    };
  });

  const label = connection.external_account_label || customerId;
  await writeCurrentDataset({
    projectId,
    name: `Google Ads · ${label}`,
    category: "Ads",
    subcategory: "google_ads",
    rows,
    sourceType: "sync",
    connectionId: connection.id,
    syncWindowStart: startDate,
    syncWindowEnd: endDate,
    externalAccountLabel: label,
    createdBy,
  });

  return { streams: ["google_ads"], rows: rows.length };
}
