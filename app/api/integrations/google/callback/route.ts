import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(`${req.nextUrl.origin}/app/projects/settings?error=${error}`);
    }

    if (!code) {
      return NextResponse.redirect(`${req.nextUrl.origin}/app/projects/settings?error=No+code+provided`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${req.nextUrl.origin}/api/integrations/google/callback`;

    if (!clientId || !clientSecret) {
      throw new Error("Missing Google OAuth credentials");
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Exchange authorization code for access & refresh tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Create an authenticated Supabase client using SSR cookies to get the current admin
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.redirect(`${req.nextUrl.origin}/login?error=Not+Authenticated`);
    }

    // Now insert or update the admin_integrations table using the service role key to bypass RLS if needed,
    // or just rely on RLS if the token has the right claims. We'll use service role for safety here.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the profile id for the authenticated user
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error("Profile not found");
    }

    const expiresAt = tokens.expiry_date 
      ? new Date(tokens.expiry_date).toISOString() 
      : null;

    // Upsert into admin_integrations
    const { error: upsertError } = await supabaseAdmin
      .from("admin_integrations")
      .upsert({
        profile_id: profile.id,
        provider: "google_workspace",
        access_token: tokens.access_token,
        // Only update refresh token if a new one was provided, otherwise keep existing
        ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
        expires_at: expiresAt,
        scope: tokens.scope,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "profile_id,provider"
      });

    if (upsertError) {
      console.error("Error saving integration:", upsertError);
      return NextResponse.redirect(`${req.nextUrl.origin}/app/projects/settings?error=Database+Error`);
    }

    return NextResponse.redirect(`${req.nextUrl.origin}/app/projects/settings?integration_success=google_workspace`);
  } catch (err: any) {
    console.error("OAuth Callback Error:", err);
    return NextResponse.redirect(`${req.nextUrl.origin}/app/projects/settings?error=Authentication+Failed`);
  }
}
