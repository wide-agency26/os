import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { exchangeMetaCode } from "@/lib/reports/sync/meta";
import { resolveMetaAppForProject } from "@/lib/reports/sync/oauth-apps";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const searchParams = req.nextUrl.searchParams;
  let returnTo = "/app/projects/report-data";
  let projectId = "";
  try {
    const rawState = searchParams.get("state");
    if (rawState) {
      const parsed = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8")) as {
        next?: string;
        project?: string;
      };
      if (parsed.next?.startsWith("/")) returnTo = parsed.next;
      projectId = parsed.project || "";
    }
  } catch {
    /* ignore */
  }
  if (projectId && !returnTo.includes("project=")) {
    returnTo += `${returnTo.includes("?") ? "&" : "?"}project=${encodeURIComponent(projectId)}`;
  }

  const err = searchParams.get("error");
  const code = searchParams.get("code");
  if (err || !code) {
    const sep = returnTo.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${origin}${returnTo}${sep}error=${encodeURIComponent(err || "No code")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=Not+Authenticated`);
  }

  try {
    const redirectUri = `${origin}/api/integrations/meta/callback`;
    const app = await resolveMetaAppForProject(projectId);
    if (!app) {
      throw new Error("Meta app is not configured for this client");
    }
    const tokens = await exchangeMetaCode(code, redirectUri, app.appId, app.secret);
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    if (!projectId) {
      throw new Error("Missing project in OAuth state");
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();
    for (const provider of ["meta_ads", "meta_instagram"] as const) {
      await admin.from("project_data_connections").upsert(
        {
          project_id: projectId,
          provider,
          status: "connected",
          access_token: tokens.access_token,
          token_expires_at: expiresAt,
          created_by: user.id,
          updated_at: now,
          last_error: null,
        },
        { onConflict: "project_id,provider" }
      );
    }

    const sep = returnTo.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${origin}${returnTo}${sep}integration_success=meta`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Authentication Failed";
    const sep = returnTo.includes("?") ? "&" : "?";
    return NextResponse.redirect(`${origin}${returnTo}${sep}error=${encodeURIComponent(message)}`);
  }
}
