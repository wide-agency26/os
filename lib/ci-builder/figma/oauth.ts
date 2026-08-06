/**
 * Figma OAuth helpers (server-only).
 */

import { getSiteUrl } from "@/lib/site-url";

export const FIGMA_SCOPES = [
  "current_user:read",
  "file_content:read",
  "file_metadata:read",
  "projects:read",
  "file_variables:read",
].join(",");

export function getFigmaOAuthConfig() {
  const clientId = process.env.FIGMA_CLIENT_ID?.trim();
  const clientSecret = process.env.FIGMA_CLIENT_SECRET?.trim();
  return {
    clientId: clientId || null,
    clientSecret: clientSecret || null,
    configured: Boolean(clientId && clientSecret),
  };
}

export function getFigmaRedirectUri(origin?: string) {
  const base = (origin || getSiteUrl()).replace(/\/$/, "");
  return `${base}/api/ci-builder/figma/oauth/callback`;
}

export function buildFigmaAuthorizeUrl(state: string, origin?: string) {
  const { clientId } = getFigmaOAuthConfig();
  if (!clientId) throw new Error("FIGMA_CLIENT_ID is not configured");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getFigmaRedirectUri(origin),
    scope: FIGMA_SCOPES,
    state,
    response_type: "code",
  });
  return `https://www.figma.com/oauth?${params.toString()}`;
}

export type FigmaTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user_id_string?: string;
  user_id?: number | string;
};

export async function exchangeFigmaCode(
  code: string,
  origin?: string
): Promise<FigmaTokenResponse> {
  const { clientId, clientSecret } = getFigmaOAuthConfig();
  if (!clientId || !clientSecret) {
    throw new Error("Figma OAuth credentials are not configured");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    redirect_uri: getFigmaRedirectUri(origin),
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://api.figma.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Figma token exchange failed: ${text}`);
  }

  return res.json();
}

export async function refreshFigmaToken(
  refreshToken: string
): Promise<FigmaTokenResponse> {
  const { clientId, clientSecret } = getFigmaOAuthConfig();
  if (!clientId || !clientSecret) {
    throw new Error("Figma OAuth credentials are not configured");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://api.figma.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Figma token refresh failed: ${text}`);
  }

  return res.json();
}
