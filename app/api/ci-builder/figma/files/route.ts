import { NextRequest, NextResponse } from "next/server";
import { requireAgencyStaff } from "@/lib/auth-guards";
import { getValidFigmaAccessToken } from "@/lib/ci-builder/figma/connection";
import {
  getProjectFiles,
  getFigmaFileMeta,
  parseFigmaFileKey,
  FigmaApiError,
} from "@/lib/ci-builder/figma/client";

/** GET ?project_id=… → list files; or ?file_key= / ?file_url= → single file meta */
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

  const projectId = req.nextUrl.searchParams.get("project_id");
  const fileInput =
    req.nextUrl.searchParams.get("file_key") ||
    req.nextUrl.searchParams.get("file_url") ||
    "";

  try {
    if (fileInput) {
      const fileKey = parseFigmaFileKey(fileInput);
      if (!fileKey) {
        return NextResponse.json(
          { error: "Invalid Figma file URL or key" },
          { status: 400 }
        );
      }
      const meta = await getFigmaFileMeta(auth.token, fileKey);
      const file = meta.file || meta;
      return NextResponse.json({
        file: {
          key: fileKey,
          name: file.name || "Untitled",
          lastModified: file.last_modified || null,
          version: file.version || null,
        },
      });
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "project_id or file_url is required" },
        { status: 400 }
      );
    }

    const data = await getProjectFiles(auth.token, projectId);
    return NextResponse.json({
      projectId,
      projectName: data.name || null,
      files: (data.files || []).map((f) => ({
        key: f.key,
        name: f.name,
        thumbnailUrl: f.thumbnail_url || null,
        lastModified: f.last_modified || null,
      })),
    });
  } catch (err: any) {
    const status = err instanceof FigmaApiError ? err.status : 500;
    return NextResponse.json(
      { error: err?.message || "Failed to load files" },
      { status }
    );
  }
}
