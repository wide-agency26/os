import { NextRequest, NextResponse } from "next/server";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { createClient } from "@/utils/supabase/server";
import {
  getFigmaConnectionForUser,
  publicConnectionInfo,
} from "@/lib/ci-builder/figma/connection";
import { getFigmaOAuthConfig } from "@/lib/ci-builder/figma/oauth";
import { getFigmaMe } from "@/lib/ci-builder/figma/client";

/** GET — connection status */
export async function GET() {
  const gate = await requireAgencyStaff();
  if (!gate.ok || !gate.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await getFigmaConnectionForUser(gate.user.id);
  return NextResponse.json({
    oauthConfigured: getFigmaOAuthConfig().configured,
    connection: publicConnectionInfo(connection),
  });
}

/** POST — connect via Personal Access Token (dev / fallback) */
export async function POST(req: NextRequest) {
  const gate = await requireAgencyStaff();
  if (!gate.ok || !gate.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body.personalAccessToken || "").trim();
  if (!token) {
    return NextResponse.json(
      { error: "personalAccessToken is required" },
      { status: 400 }
    );
  }

  try {
    const me = await getFigmaMe(token);
    const supabase = await createClient();
    const { error } = await (supabase as any).from("ci_figma_connections").upsert(
      {
        user_id: gate.user.id,
        figma_user_id: String(me.id),
        figma_email: me.email || null,
        figma_handle: me.handle || null,
        access_token: token,
        refresh_token: null,
        expires_at: null,
        scope: "pat",
        auth_method: "pat",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      connection: {
        connected: true,
        authMethod: "pat",
        figmaHandle: me.handle || null,
        figmaEmail: me.email || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Invalid Figma token" },
      { status: 400 }
    );
  }
}

/** DELETE — disconnect */
export async function DELETE() {
  const gate = await requireAgencyStaff();
  if (!gate.ok || !gate.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  await (supabase as any)
    .from("ci_figma_connections")
    .delete()
    .eq("user_id", gate.user.id);

  return NextResponse.json({ ok: true });
}
