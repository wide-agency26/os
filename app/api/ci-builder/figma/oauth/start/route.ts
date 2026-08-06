import { NextRequest, NextResponse } from "next/server";
import { requireAgencyStaff } from "@/lib/auth-guards";
import {
  buildFigmaAuthorizeUrl,
  getFigmaOAuthConfig,
} from "@/lib/ci-builder/figma/oauth";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const gate = await requireAgencyStaff();
  if (!gate.ok || !gate.user) {
    return NextResponse.redirect(
      `${req.nextUrl.origin}/login?error=Not+Authenticated`
    );
  }

  const { configured } = getFigmaOAuthConfig();
  if (!configured) {
    return NextResponse.json(
      {
        error:
          "Figma OAuth is not configured. Set FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET, or connect with a Personal Access Token.",
      },
      { status: 500 }
    );
  }

  const guidelineId = req.nextUrl.searchParams.get("guideline_id") || "";
  const returnTo =
    req.nextUrl.searchParams.get("return_to") ||
    "/app/projects/ci-builder";

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("figma_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  cookieStore.set(
    "figma_oauth_ctx",
    JSON.stringify({ guidelineId, returnTo }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    }
  );

  const url = buildFigmaAuthorizeUrl(state, req.nextUrl.origin);
  return NextResponse.redirect(url);
}
