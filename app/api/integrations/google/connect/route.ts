import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  // Validate that we have the necessary environment variables
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables." },
      { status: 500 }
    );
  }

  // Get the absolute base URL dynamically
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/integrations/google/callback`;

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  // Define the scopes required to read Tasks, Spaces (Chat), Gmail, and Calendar
  const scopes = [
    "https://www.googleapis.com/auth/tasks.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/chat.spaces.readonly",
  ];

  const authorizationUrl = oauth2Client.generateAuthUrl({
    // 'offline' gets us a refresh token
    access_type: "offline",
    scope: scopes,
    include_granted_scopes: true,
    prompt: "consent", // Force consent screen to ensure we get a refresh token
  });

  return NextResponse.redirect(authorizationUrl);
}
