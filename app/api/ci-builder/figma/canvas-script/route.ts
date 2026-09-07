import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { NextResponse } from "next/server";
import { requireAgencyStaff } from "@/lib/auth-guards";

const SCRIPT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../figma-plugins/wide-os-ci-canvas/run.js"
);
const FILENAME = "wide-os-ci-canvas.js";

export async function GET() {
  const gate = await requireAgencyStaff();
  if (!gate.ok || !gate.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const source = await readFile(SCRIPT_PATH, "utf8");
    return new NextResponse(source, {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Content-Disposition": `attachment; filename="${FILENAME}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("CI canvas script read failed:", err);
    return NextResponse.json(
      { error: "Canvas script is not available on this deploy." },
      { status: 404 }
    );
  }
}
