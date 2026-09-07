import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/reports/sync/require-staff";
import { createAdminClient } from "@/utils/supabase/admin";
import { googleWorkspaceConnected } from "@/lib/reports/sync/google-auth";
import { listGoogleAccounts } from "@/lib/reports/sync/google";
import { FILE_ONLY_PLATFORMS, LIVE_PROVIDERS, type DataProvider } from "@/lib/reports/sync/providers";
import { listInstagramAccounts, listMetaAdAccounts } from "@/lib/reports/sync/meta";
import { getMetaAppStatus, saveMetaAppForProject } from "@/lib/reports/sync/oauth-apps";
import { listYouTubeChannels } from "@/lib/reports/sync/youtube";
import { listGoogleAdsCustomers } from "@/lib/reports/sync/google-ads-sync";
import { googleAdsDeveloperToken } from "@/lib/reports/sync/google-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireStaffUser();
  if (auth.error) return auth.error;

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const [{ data: connections }, { data: datasets }, google, metaApp] = await Promise.all([
    supabase
      .from("project_data_connections")
      .select(
        "id, provider, status, external_account_id, external_account_label, last_synced_at, last_error, metadata, access_token, refresh_token"
      )
      .eq("project_id", projectId),
    supabase
      .from("datasets")
      .select(
        "id, name, category, subcategory, source_type, synced_at, created_at, row_count, external_account_label, is_current"
      )
      .eq("project_id", projectId)
      .eq("is_current", true)
      .order("created_at", { ascending: false }),
    googleWorkspaceConnected(),
    getMetaAppStatus(projectId),
  ]);

  let ga4: { id: string; label: string }[] = [];
  let gsc: { id: string; label: string }[] = [];
  if (google.connected) {
    try {
      const listed = await listGoogleAccounts();
      ga4 = listed.ga4;
      gsc = listed.gsc;
    } catch {
      // Listing can fail if Analytics scope is missing; UI still shows Connect.
    }
  }

  const metaAds = (connections ?? []).find((c) => c.provider === "meta_ads" && c.status !== "revoked");
  const metaIg = (connections ?? []).find((c) => c.provider === "meta_instagram" && c.status !== "revoked");
  const ytConn = (connections ?? []).find((c) => c.provider === "youtube" && c.status !== "revoked");
  const gadsConn = (connections ?? []).find((c) => c.provider === "google_ads" && c.status !== "revoked");

  let metaAdAccounts: { id: string; label: string }[] = [];
  let igAccounts: { id: string; label: string }[] = [];
  let youtube: { id: string; label: string }[] = [];
  let googleAds: { id: string; label: string }[] = [];

  const metaToken = metaAds?.access_token || metaIg?.access_token || null;
  if (metaToken) {
    try {
      metaAdAccounts = await listMetaAdAccounts(metaToken);
    } catch {
      /* token may be ads-only */
    }
    try {
      igAccounts = (await listInstagramAccounts(metaToken)).map((a) => ({
        id: a.id,
        label: a.label,
      }));
    } catch {
      /* ignore */
    }
  }

  if (ytConn?.refresh_token || ytConn?.access_token) {
    try {
      youtube = await listYouTubeChannels(ytConn as never);
    } catch {
      /* reconnect */
    }
  }
  if (gadsConn?.refresh_token || gadsConn?.access_token) {
    try {
      googleAds = await listGoogleAdsCustomers(gadsConn as never);
    } catch {
      /* developer token or reconnect */
    }
  }

  const publicConnections = (connections ?? []).map((c) => ({
    id: c.id,
    provider: c.provider,
    status: c.status,
    external_account_id: c.external_account_id,
    external_account_label: c.external_account_label,
    last_synced_at: c.last_synced_at,
    last_error: c.last_error,
    metadata: c.metadata,
  }));

  return NextResponse.json({
    google,
    metaConfigured: metaApp.configured,
    metaApp,
    googleAdsConfigured: !!googleAdsDeveloperToken(),
    connections: publicConnections,
    streams: datasets ?? [],
    accounts: { ga4, gsc, metaAds: metaAdAccounts, instagram: igAccounts, youtube, googleAds },
    liveProviders: LIVE_PROVIDERS,
    fileOnly: FILE_ONLY_PLATFORMS,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffUser();
  if (auth.error) return auth.error;

  const body = (await req.json().catch(() => ({}))) as {
    projectId?: string;
    provider?: DataProvider;
    externalAccountId?: string;
    externalAccountLabel?: string;
    action?: "save" | "disconnect" | "save_meta_app";
    appId?: string;
    appSecret?: string;
  };

  if (body.action === "save_meta_app") {
    if (!body.projectId || !body.appId) {
      return NextResponse.json({ error: "projectId and appId required" }, { status: 400 });
    }
    try {
      const metaApp = await saveMetaAppForProject({
        projectId: body.projectId,
        appId: body.appId,
        secret: body.appSecret,
        userId: auth.user.id,
      });
      return NextResponse.json({ ok: true, metaApp });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Save failed" },
        { status: 400 }
      );
    }
  }

  if (!body.projectId || !body.provider) {
    return NextResponse.json({ error: "projectId and provider required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (body.action === "disconnect") {
    await supabase
      .from("project_data_connections")
      .update({
        status: "revoked",
        access_token: null,
        refresh_token: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", body.projectId)
      .eq("provider", body.provider);
    return NextResponse.json({ ok: true });
  }

  const patch = {
    project_id: body.projectId,
    provider: body.provider,
    status: "connected" as const,
    external_account_id: body.externalAccountId ?? null,
    external_account_label: body.externalAccountLabel ?? null,
    created_by: auth.user.id,
    updated_at: new Date().toISOString(),
    last_error: null,
  };

  const { error } = await supabase.from("project_data_connections").upsert(patch, {
    onConflict: "project_id,provider",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
