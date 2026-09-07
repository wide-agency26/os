import { google } from "googleapis";
import { createAdminClient } from "@/utils/supabase/admin";

function oauthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  return new google.auth.OAuth2(clientId, clientSecret);
}

export async function getGoogleAuthClient() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("admin_integrations")
    .select("id, access_token, refresh_token, expires_at, scope")
    .in("provider", ["google_workspace", "google"])
    .not("refresh_token", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.refresh_token) {
    throw new Error("No Google account is connected. Connect Google under Sources first.");
  }

  const auth = oauthClient();
  auth.setCredentials({
    access_token: data.access_token ?? undefined,
    refresh_token: data.refresh_token,
  });

  auth.on("tokens", async (tokens) => {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (tokens.access_token) patch.access_token = tokens.access_token;
    if (tokens.refresh_token) patch.refresh_token = tokens.refresh_token;
    if (tokens.expiry_date) patch.expires_at = new Date(tokens.expiry_date).toISOString();
    await supabase.from("admin_integrations").update(patch).eq("id", data.id);
  });

  return auth;
}

export async function getGoogleAuthFromConnection(conn: {
  id: string;
  access_token?: string | null;
  refresh_token?: string | null;
}) {
  if (!conn.refresh_token && !conn.access_token) {
    throw new Error("This Google connection has no tokens. Connect the account again.");
  }
  const supabase = createAdminClient();
  const auth = oauthClient();
  auth.setCredentials({
    access_token: conn.access_token ?? undefined,
    refresh_token: conn.refresh_token ?? undefined,
  });
  auth.on("tokens", async (tokens) => {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (tokens.access_token) patch.access_token = tokens.access_token;
    if (tokens.refresh_token) patch.refresh_token = tokens.refresh_token;
    if (tokens.expiry_date) patch.token_expires_at = new Date(tokens.expiry_date).toISOString();
    await supabase.from("project_data_connections").update(patch).eq("id", conn.id);
  });
  return auth;
}

export async function googleWorkspaceConnected(): Promise<{
  connected: boolean;
  scopes: string[];
  hasAnalytics: boolean;
  hasSearchConsole: boolean;
}> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("admin_integrations")
    .select("scope, refresh_token")
    .in("provider", ["google_workspace", "google"])
    .not("refresh_token", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const scopes = (data?.scope || "").split(/[,\s]+/).filter((s: string) => Boolean(s));
  return {
    connected: !!data?.refresh_token,
    scopes,
    hasAnalytics: scopes.some((s: string) => s.includes("analytics")),
    hasSearchConsole: scopes.some((s: string) => s.includes("webmasters")),
  };
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function googleAdsDeveloperToken(): string | null {
  return process.env.GOOGLE_ADS_DEVELOPER_TOKEN || null;
}

