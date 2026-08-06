import { NextRequest, NextResponse } from "next/server";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { getValidFigmaAccessToken } from "@/lib/ci-builder/figma/connection";
import {
  getTeamProjects,
  parseFigmaTeamId,
  FigmaApiError,
} from "@/lib/ci-builder/figma/client";

/** GET ?team_id=… or ?team_url=… → list projects */
export async function GET(req: NextRequest) {
  const gate = await requireAgencyStaff();
  if (!gate.ok || !gate.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await getValidFigmaAccessToken(gate.user.id);
  if (!auth) {
    return NextResponse.json(
      { error: "Connect Figma first" },
      { status: 400 }
    );
  }

  const teamInput =
    req.nextUrl.searchParams.get("team_id") ||
    req.nextUrl.searchParams.get("team_url") ||
    "";
  const teamId = parseFigmaTeamId(teamInput);
  if (!teamId) {
    return NextResponse.json(
      {
        error:
          "Provide a Figma team id or team URL (e.g. https://www.figma.com/files/team/123456789/...)",
      },
      { status: 400 }
    );
  }

  try {
    const data = await getTeamProjects(auth.token, teamId);
    return NextResponse.json({
      teamId,
      teamName: data.name || null,
      projects: (data.projects || []).map((p) => ({
        id: String(p.id),
        name: p.name,
      })),
    });
  } catch (err: any) {
    const status = err instanceof FigmaApiError ? err.status : 500;
    return NextResponse.json(
      { error: err?.message || "Failed to list projects" },
      { status }
    );
  }
}
