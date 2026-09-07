import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function popupHtml(origin: string, payload: Record<string, unknown>) {
  const json = JSON.stringify({ type: "wide-google-oauth", ...payload });
  return `<!doctype html>
<html><body>
<script>
  try {
    window.opener && window.opener.postMessage(${json}, ${JSON.stringify(origin)});
  } catch (e) {}
  window.close();
  setTimeout(function () { document.body.innerText = "You can close this window."; }, 400);
</script>
</body></html>`;
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  let returnTo = "/app/projects/settings";
  let projectId = "";
  let intent = "workspace";
  let popup = false;
  try {
    const rawState = searchParams.get("state");
    if (rawState) {
      const parsed = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8")) as {
        next?: string;
        project?: string;
        intent?: string;
        popup?: boolean;
      };
      if (parsed.next && parsed.next.startsWith("/")) {
        returnTo = parsed.next;
      }
      projectId = parsed.project || "";
      intent = parsed.intent || "workspace";
      popup = !!parsed.popup;
      if (projectId && !returnTo.includes("project=")) {
        returnTo += `${returnTo.includes("?") ? "&" : "?"}project=${encodeURIComponent(projectId)}`;
      }
    }
  } catch {
    /* ignore malformed state */
  }

  const fail = (message: string) => {
    if (popup) {
      return new NextResponse(popupHtml(origin, { ok: false, error: message, intent }), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    const sep = returnTo.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${origin}${returnTo}${sep}error=${encodeURIComponent(message)}`);
  };

  if (error) return fail(error);
  if (!code) return fail("No code provided");

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${origin}/api/integrations/google/callback`;
    if (!clientId || !clientSecret) throw new Error("Missing Google OAuth credentials");

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.redirect(`${origin}/login?error=Not+Authenticated`);
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null;

    if (intent === "youtube" || intent === "google_ads") {
      if (!projectId) return fail("Missing project for this connection");
      const provider = intent === "youtube" ? "youtube" : "google_ads";
      const { error: upsertError } = await supabaseAdmin.from("project_data_connections").upsert(
        {
          project_id: projectId,
          provider,
          status: "connected",
          access_token: tokens.access_token,
          ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
          token_expires_at: expiresAt,
          scopes: tokens.scope,
          created_by: user.id,
          updated_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: "project_id,provider" }
      );
      if (upsertError) return fail(upsertError.message);

      if (popup) {
        return new NextResponse(popupHtml(origin, { ok: true, intent, projectId }), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      const sep = returnTo.includes("?") ? "&" : "?";
      return NextResponse.redirect(
        `${origin}${returnTo}${sep}integration_success=${encodeURIComponent(provider)}`
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();
    if (!profile) throw new Error("Profile not found");

    const { error: upsertError } = await supabaseAdmin.from("admin_integrations").upsert(
      {
        profile_id: profile.id,
        provider: "google_workspace",
        access_token: tokens.access_token,
        ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
        expires_at: expiresAt,
        scope: tokens.scope,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,provider" }
    );

    if (upsertError) return fail("Database Error");

    if (popup) {
      return new NextResponse(popupHtml(origin, { ok: true, intent: "workspace" }), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    const sep = returnTo.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${origin}${returnTo}${sep}integration_success=google_workspace`);
  } catch (err: unknown) {
    console.error("OAuth Callback Error:", err);
    return fail(err instanceof Error ? err.message : "Authentication Failed");
  }
}
