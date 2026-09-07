import { google } from "googleapis";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Search Console — the auditor's own connection.
 *
 * Deliberately independent of the SEO Report: this module never reads or writes
 * `datasets`, `dataset_rows`, or `published_reports`. The CSV upload flow that
 * powers the SEO Report tab is a separate product and stays untouched.
 *
 * Where we do not have property access, the phase reports itself unavailable
 * and the UI shows a "Not connected" card rather than an empty chart.
 */

export type GscQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscPageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchDataResult =
  | {
      available: true;
      property: string;
      queries: GscQueryRow[];
      pages: GscPageRow[];
      totals: { clicks: number; impressions: number; position: number };
      rangeDays: number;
    }
  | { available: false; reason: string };

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Any founder-connected Google account with Search Console scope can be used;
 * we try each until one has access to the property. Tokens live in
 * `admin_integrations`, written by the existing Google OAuth callback.
 */
async function getAuthorizedClients() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("admin_integrations")
    .select("access_token, refresh_token, provider")
    .in("provider", ["google_workspace", "google"])
    .not("refresh_token", "is", null);

  const rows = (data ?? []) as { access_token: string | null; refresh_token: string | null }[];

  return rows.map((row) => {
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({
      access_token: row.access_token ?? undefined,
      refresh_token: row.refresh_token ?? undefined,
    });
    return auth;
  });
}

export async function fetchSearchConsoleData(
  property: string | null,
  rangeDays = 90
): Promise<SearchDataResult> {
  if (!property) {
    return {
      available: false,
      reason:
        "No Search Console property is set for this site. Add the property (for example sc-domain:example.com) in the site settings and connect a Google account that has access to it.",
    };
  }

  const clients = await getAuthorizedClients();
  if (!clients.length) {
    return {
      available: false,
      reason:
        "No Google account with Search Console access is connected. Connect one under Integrations, making sure to grant the Search Console permission.",
    };
  }

  const startDate = isoDaysAgo(rangeDays);
  const endDate = isoDaysAgo(1);

  for (const auth of clients) {
    try {
      const webmasters = google.searchconsole({ version: "v1", auth });

      const [queryRes, pageRes] = await Promise.all([
        webmasters.searchanalytics.query({
          siteUrl: property,
          requestBody: { startDate, endDate, dimensions: ["query"], rowLimit: 500 },
        }),
        webmasters.searchanalytics.query({
          siteUrl: property,
          requestBody: { startDate, endDate, dimensions: ["page"], rowLimit: 500 },
        }),
      ]);

      const queries: GscQueryRow[] = (queryRes.data.rows ?? []).map((r) => ({
        query: r.keys?.[0] ?? "",
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      }));

      const pages: GscPageRow[] = (pageRes.data.rows ?? []).map((r) => ({
        page: r.keys?.[0] ?? "",
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      }));

      const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
      const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0);
      const avgPosition = queries.length
        ? queries.reduce((s, q) => s + q.position, 0) / queries.length
        : 0;

      return {
        available: true,
        property,
        queries,
        pages,
        totals: {
          clicks: totalClicks,
          impressions: totalImpressions,
          position: Number(avgPosition.toFixed(1)),
        },
        rangeDays,
      };
    } catch {
      // This account cannot see the property; try the next one.
      continue;
    }
  }

  return {
    available: false,
    reason: `None of the connected Google accounts have access to ${property}. Ask the site owner to grant access in Search Console, or verify the property string is correct.`,
  };
}

/** Queries ranking 4-15: already close, and the fastest wins available. */
export function strikingDistance(queries: GscQueryRow[]): GscQueryRow[] {
  return queries
    .filter((q) => q.position >= 4 && q.position <= 15 && q.impressions >= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50);
}
