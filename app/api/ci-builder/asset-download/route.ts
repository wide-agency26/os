import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder } from "@/lib/rbac";
import { userCanAccessProject } from "@/lib/pdf/access";
import { BRAND_GUIDELINES_BUCKET } from "@/lib/brand-guideline/storage";
import { urlLooksPng, urlLooksSvg } from "@/lib/ci-builder/downloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function fileNameFrom(raw: string | null, kind: "png" | "original", url: string): string {
  const given = (raw || "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  if (kind === "png") {
    const base = given.replace(/\.png$/i, "") || "asset";
    return `${base}.png`;
  }
  if (given && /\.[a-z0-9]{2,5}$/i.test(given)) return given;
  const base = given || "asset";
  if (urlLooksSvg(url)) return `${base}.svg`;
  if (urlLooksPng(url)) return `${base}.png`;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext && /^(woff2|woff|ttf|otf)$/.test(ext)) return `${base}.${ext}`;
  return base;
}

function allowedSource(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.pathname.includes(`/${BRAND_GUIDELINES_BUCKET}/`)) return true;
    if (u.hostname.endsWith(".supabase.co") && u.pathname.includes("/storage/")) return true;
    return false;
  } catch {
    return false;
  }
}

async function toPngBytes(
  buf: ArrayBuffer,
  contentType: string
): Promise<{ bytes: Buffer; type: string }> {
  const type = (contentType || "").toLowerCase();
  if (type.includes("png")) return { bytes: Buffer.from(buf), type: "image/png" };
  if (type.includes("jpeg") || type.includes("jpg")) {
    try {
      const sharp = (await import("sharp")).default;
      const bytes = await sharp(Buffer.from(buf)).png().toBuffer();
      return { bytes, type: "image/png" };
    } catch {
      return { bytes: Buffer.from(buf), type: type || "image/jpeg" };
    }
  }
  try {
    const sharp = (await import("sharp")).default;
    const bytes = await sharp(Buffer.from(buf)).png().toBuffer();
    return { bytes, type: "image/png" };
  } catch {
    return { bytes: Buffer.from(buf), type: type || "application/octet-stream" };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId")?.trim();
  const kind = searchParams.get("kind") === "original" ? "original" : "png";
  const nameParam = searchParams.get("name");
  if (!assetId) return bad(400, "assetId required");

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return bad(500, "Storage unavailable");
  }

  const { data: asset, error } = await admin
    .from("ci_assets")
    .select("id, public_url, label, metadata, guideline_id")
    .eq("id", assetId)
    .maybeSingle();

  if (error || !asset) return bad(404, "Asset not found");

  const { data: guideline } = await admin
    .from("ci_guidelines")
    .select("id, status, project_id")
    .eq("id", asset.guideline_id)
    .maybeSingle();

  if (!guideline) return bad(404, "Guideline not found");

  if (guideline.status !== "published") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return bad(401, "Sign in to download this draft asset");
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const allowed =
      isFounder(profile?.role) ||
      (await userCanAccessProject(user.id, profile?.role ?? null, guideline.project_id));
    if (!allowed) return bad(403, "Not allowed");
  }

  const meta = (asset.metadata || {}) as { png_url?: string | null };
  const source =
    kind === "png"
      ? meta.png_url || asset.public_url
      : asset.public_url;
  if (!source || !allowedSource(source)) return bad(404, "File not available");

  const upstream = await fetch(source);
  if (!upstream.ok) return bad(502, "Could not fetch file");
  const buf = await upstream.arrayBuffer();
  const upstreamType = upstream.headers.get("content-type") || "";

  let bytes: Buffer;
  let contentType: string;
  if (kind === "png") {
    const converted = await toPngBytes(buf, upstreamType);
    bytes = converted.bytes;
    contentType = converted.type;
  } else {
    bytes = Buffer.from(buf);
    contentType =
      upstreamType ||
      (urlLooksSvg(source) ? "image/svg+xml" : "application/octet-stream");
  }

  const filename = fileNameFrom(nameParam || asset.label, kind, source);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
