/**
 * Load / refresh the current user's Figma connection (server-only).
 */

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { refreshFigmaToken } from "@/lib/ci-builder/figma/oauth";

export type FigmaConnectionRow = {
  id: string;
  user_id: string;
  figma_user_id: string | null;
  figma_email: string | null;
  figma_handle: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  auth_method: "oauth" | "pat";
};

export async function getFigmaConnectionForUser(
  userId: string
): Promise<FigmaConnectionRow | null> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("ci_figma_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as FigmaConnectionRow;
}

/** Returns a usable access token, refreshing OAuth if needed. */
export async function getValidFigmaAccessToken(
  userId: string
): Promise<{ token: string; connection: FigmaConnectionRow } | null> {
  const connection = await getFigmaConnectionForUser(userId);
  if (!connection) return null;

  if (connection.auth_method === "pat") {
    return { token: connection.access_token, connection };
  }

  const expiresAt = connection.expires_at
    ? new Date(connection.expires_at).getTime()
    : 0;
  const needsRefresh =
    connection.refresh_token &&
    expiresAt > 0 &&
    expiresAt < Date.now() + 60_000;

  if (!needsRefresh) {
    return { token: connection.access_token, connection };
  }

  try {
    const tokens = await refreshFigmaToken(connection.refresh_token!);
    const newExpires = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : connection.expires_at;

    const admin = createAdminClient();
    await (admin as any)
      .from("ci_figma_connections")
      .update({
        access_token: tokens.access_token,
        ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
        expires_at: newExpires,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    return {
      token: tokens.access_token,
      connection: {
        ...connection,
        access_token: tokens.access_token,
        expires_at: newExpires,
      },
    };
  } catch {
    // Fall back to existing token — caller may still get 401
    return { token: connection.access_token, connection };
  }
}

export function publicConnectionInfo(c: FigmaConnectionRow | null) {
  if (!c) return null;
  return {
    connected: true as const,
    authMethod: c.auth_method,
    figmaHandle: c.figma_handle,
    figmaEmail: c.figma_email,
    expiresAt: c.expires_at,
  };
}
