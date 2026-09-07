import { NextResponse } from "next/server";
import {
  finalizeContextUpload,
  prepareContextUpload,
  removeContextDoc,
  setContextDocActive,
} from "@/app/actions/content-calendar";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Page server actions 404 the current route when PDF parse OOMs or the
 * action POST is too large. Keep research uploads on this fetch endpoint
 * so the proposal page never navigates away on failure.
 */
export async function POST(req: Request) {
  let body: {
    action?: string;
    projectId?: string;
    filename?: string;
    mimeType?: string | null;
    size?: number;
    path?: string;
    id?: string;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const action = body.action;
    const projectId = String(body.projectId || "");
    if (!projectId) {
      return NextResponse.json({ ok: false, error: "Missing project" }, { status: 400 });
    }

    if (action === "prepare") {
      const res = await prepareContextUpload(
        projectId,
        String(body.filename || ""),
        body.mimeType ?? null,
        Number(body.size) || 0
      );
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    if (action === "finalize") {
      const res = await finalizeContextUpload(projectId, {
        path: String(body.path || ""),
        filename: String(body.filename || ""),
        mimeType: body.mimeType ?? null,
      });
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    if (action === "toggle") {
      const id = String(body.id || "");
      if (!id) {
        return NextResponse.json({ ok: false, error: "Missing document" }, { status: 400 });
      }
      const res = await setContextDocActive(id, projectId, Boolean(body.active));
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    if (action === "remove") {
      const id = String(body.id || "");
      if (!id) {
        return NextResponse.json({ ok: false, error: "Missing document" }, { status: 400 });
      }
      const res = await removeContextDoc(id, projectId);
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
