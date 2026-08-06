import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { exchangeFigmaCode } from "@/lib/ci-builder/figma/oauth";
import { getFigmaMe } from "@/lib/ci-builder/figma/client";
import { FIGMA_SCOPES } from "@/lib/ci-builder/figma/oauth";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error");

    const cookieStore = await cookies();
    const savedState = cookieStore.get("figma_oauth_state")?.value;
    const ctxRaw = cookieStore.get("figma_oauth_ctx")?.value;
    let returnTo = "/app/projects/ci-builder";
    try {
      if (ctxRaw) {
        const ctx = JSON.parse(ctxRaw);
        if (ctx.returnTo) returnTo = ctx.returnTo;
      }
    } catch {
      /* ignore */
    }

    cookieStore.delete("figma_oauth_state");
    cookieStore.delete("figma_oauth_ctx");

    if (error) {
      return NextResponse.redirect(
        `${origin}${returnTo}?figma_error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state || state !== savedState) {
      return NextResponse.redirect(
        `${origin}${returnTo}?figma_error=${encodeURIComponent("Invalid OAuth state")}`
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=Not+Authenticated`);
    }

    const tokens = await exchangeFigmaCode(code, origin);
    const me = await getFigmaMe(tokens.access_token);
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const admin = createAdminClient();
    const { error: upsertError } = await (admin as any)
      .from("ci_figma_connections")
      .upsert(
        {
          user_id: user.id,
          figma_user_id: String(tokens.user_id_string || tokens.user_id || me.id),
          figma_email: me.email || null,
          figma_handle: me.handle || null,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: expiresAt,
          scope: FIGMA_SCOPES,
          auth_method: "oauth",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Figma connection upsert failed:", upsertError);
      return NextResponse.redirect(
        `${origin}${returnTo}?figma_error=${encodeURIComponent("Failed to save connection")}`
      );
    }

    return NextResponse.redirect(
      `${origin}${returnTo}?figma_connected=1`
    );
  } catch (err: any) {
    console.error("Figma OAuth callback error:", err);
    return NextResponse.redirect(
      `${origin}/app/projects/ci-builder?figma_error=${encodeURIComponent(err?.message || "OAuth failed")}`
    );
  }
}
