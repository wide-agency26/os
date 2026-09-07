import { createAdminClient } from "@/utils/supabase/admin";
import type { DataProvider } from "@/lib/reports/sync/providers";
import {
  syncGoogleAnalytics,
  syncGoogleSearchConsole,
  type ProjectConnection,
} from "@/lib/reports/sync/google";
import { syncInstagram, syncMetaAds } from "@/lib/reports/sync/meta";
import { syncGoogleAds } from "@/lib/reports/sync/google-ads-sync";
import { syncYouTube } from "@/lib/reports/sync/youtube";

export interface SyncResult {
  provider: DataProvider;
  ok: boolean;
  streams: string[];
  rows: number;
  error?: string;
}

function asConnection(row: {
  id: string;
  provider: string;
  status: string;
  external_account_id: string | null;
  external_account_label: string | null;
  metadata: unknown;
  access_token?: string | null;
  refresh_token?: string | null;
}): ProjectConnection {
  return {
    id: row.id,
    provider: row.provider as DataProvider,
    status: row.status,
    external_account_id: row.external_account_id,
    external_account_label: row.external_account_label,
    metadata: (row.metadata as Record<string, unknown>) || {},
    access_token: row.access_token,
    refresh_token: row.refresh_token,
  };
}

export async function syncProjectProviders(
  projectId: string,
  providers: DataProvider[] | "all",
  createdBy?: string | null
): Promise<SyncResult[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("project_data_connections")
    .select(
      "id, provider, status, external_account_id, external_account_label, metadata, access_token, refresh_token"
    )
    .eq("project_id", projectId)
    .neq("status", "revoked");

  if (providers !== "all") {
    query = query.in("provider", providers);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const connections = (rows ?? []).map(asConnection);
  if (!connections.length) {
    return [];
  }

  const results: SyncResult[] = [];

  for (const conn of connections) {
    try {
      let out = { streams: [] as string[], rows: 0 };
      if (conn.provider === "google_analytics") {
        out = await syncGoogleAnalytics(projectId, conn, createdBy);
      } else if (conn.provider === "google_search_console") {
        out = await syncGoogleSearchConsole(projectId, conn, createdBy);
      } else if (conn.provider === "google_ads") {
        out = await syncGoogleAds(projectId, conn, createdBy);
      } else if (conn.provider === "youtube") {
        out = await syncYouTube(projectId, conn, createdBy);
      } else if (conn.provider === "meta_ads") {
        if (!conn.access_token) throw new Error("Meta Ads is not connected.");
        out = await syncMetaAds(projectId, conn, conn.access_token, createdBy);
      } else if (conn.provider === "meta_instagram") {
        if (!conn.access_token) throw new Error("Instagram is not connected.");
        out = await syncInstagram(projectId, conn, conn.access_token, createdBy);
      } else {
        throw new Error(`Unknown provider ${conn.provider}`);
      }

      await supabase
        .from("project_data_connections")
        .update({
          status: "connected",
          last_synced_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conn.id);

      results.push({ provider: conn.provider, ok: true, ...out });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await supabase
        .from("project_data_connections")
        .update({
          status: "error",
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conn.id);
      results.push({
        provider: conn.provider,
        ok: false,
        streams: [],
        rows: 0,
        error: message,
      });
    }
  }

  return results;
}
