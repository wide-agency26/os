import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/reports/sync/require-staff";
import { resolveMetaAppForProject } from "@/lib/reports/sync/oauth-apps";

export async function GET(req: NextRequest) {
  const auth = await requireStaffUser();
  if (auth.error) return auth.error;

  const project = req.nextUrl.searchParams.get("project") || "";
  if (!project) {
    return NextResponse.json({ error: "project required" }, { status: 400 });
  }

  const app = await resolveMetaAppForProject(project);
  if (!app) {
    return NextResponse.json(
      { error: "Save this client’s Meta App ID and secret on Sources first." },
      { status: 400 }
    );
  }

  const next = req.nextUrl.searchParams.get("next") || "/app/projects/report-data";
  const redirectUri = `${req.nextUrl.origin}/api/integrations/meta/callback`;
  const state = Buffer.from(JSON.stringify({ next, project }), "utf8").toString("base64url");

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", app.appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set(
    "scope",
    [
      "ads_read",
      "ads_management",
      "business_management",
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_manage_insights",
    ].join(",")
  );

  return NextResponse.redirect(url.toString());
}
