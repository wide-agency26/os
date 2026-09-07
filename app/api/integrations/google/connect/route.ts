import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/tasks.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

const GOOGLE_ADS_SCOPES = ["https://www.googleapis.com/auth/adwords"];

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables." },
      { status: 500 }
    );
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/integrations/google/callback`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const intent = req.nextUrl.searchParams.get("intent") || "workspace";
  const popup = req.nextUrl.searchParams.get("popup") === "1";
  const next = req.nextUrl.searchParams.get("next") || "";
  const project = req.nextUrl.searchParams.get("project") || "";

  const scopes =
    intent === "youtube"
      ? YOUTUBE_SCOPES
      : intent === "google_ads"
        ? GOOGLE_ADS_SCOPES
        : WORKSPACE_SCOPES;

  const state = Buffer.from(
    JSON.stringify({ next, project, intent, popup }),
    "utf8"
  ).toString("base64url");

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    include_granted_scopes: true,
    // YouTube/Ads: account picker in a new window so the WIDE inbox stays signed in.
    prompt: intent === "workspace" ? "consent" : "select_account consent",
    state,
  });

  return NextResponse.redirect(authorizationUrl);
}
