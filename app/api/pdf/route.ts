import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { userCanAccessProject, userCanAccessPublishedSlug } from "@/lib/pdf/access";
import { signPrintToken, printFilename } from "@/lib/pdf/print-token";
import { appOrigin, printPath } from "@/lib/pdf/origin";
import { renderPrintUrlToPdf } from "@/lib/pdf/chromium";
import { loadGuidelinePrintByProject, loadGuidelinePrintBySlug } from "@/lib/ci-builder/load-guideline-for-print";
import { loadReportPrintData } from "@/lib/reports/load-print-data";
import { isReportCategory, type ReportCategory } from "@/lib/reports/categories";
import type { PdfRequest } from "@/lib/pdf/types";
import { REPORT_SHARE_COOKIE, verifyShareToken } from "@/lib/reports/share-token";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function jsonError(
  status: number,
  error: string,
  printUrl?: string
) {
  return NextResponse.json({ error, printUrl }, { status });
}

function withPrintUrl(res: NextResponse, printUrl: string) {
  res.headers.set("X-Print-Url", printUrl);
  return res;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as PdfRequest | null;
  if (!body || (body.kind !== "ci" && body.kind !== "report")) {
    return jsonError(400, "kind must be ci or report");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const role = profile?.role ?? null;

  let printKind: "ci" | "ci_draft" | "report";
  let slug: string | undefined;
  let projectId: string | undefined;
  let category: string | undefined;
  let filename = "download.pdf";
  let landscape = false;

  if (body.kind === "ci" && "slug" in body && body.slug) {
    slug = body.slug;
    const access = await userCanAccessPublishedSlug(user?.id ?? null, role, slug);
    if (!access.ok) {
      return jsonError(access.published ? 403 : 404, "Brand book not available");
    }
    printKind = "ci";
    projectId = access.projectId;
    const doc = await loadGuidelinePrintBySlug(slug);
    if (!doc) return jsonError(404, "Brand book not found");
    filename = `${printFilename([doc.brandName, "brand-book"], "brand-book")}.pdf`;
  } else if (body.kind === "ci" && "projectId" in body && body.projectId) {
    if (!user) return jsonError(401, "Sign in to download this brand book");
    if (!isFounder(role)) return jsonError(403, "Only the WIDE team can export a draft brand book");
    projectId = body.projectId;
    printKind = "ci_draft";
    const doc = await loadGuidelinePrintByProject(projectId);
    if (!doc) return jsonError(404, "No brand book for this project");
    slug = doc.slug ?? undefined;
    filename = `${printFilename([doc.brandName, "brand-book"], "brand-book")}.pdf`;
  } else if (body.kind === "report") {
    if (!body.projectId) return jsonError(400, "projectId required");
    const jar = await cookies();
    const share = verifyShareToken(jar.get(REPORT_SHARE_COOKIE)?.value);
    const shareOk = share?.projectId === body.projectId;
    if (!user && !shareOk) return jsonError(401, "Sign in or unlock the public report to download");
    const allowed =
      shareOk ||
      (user ? await userCanAccessProject(user.id, role, body.projectId) : false);
    if (!allowed) return jsonError(403, "No access to this report");
    projectId = body.projectId;
    category = isReportCategory(body.category || "")
      ? (body.category as ReportCategory)
      : "General";
    printKind = "report";
    landscape = true;
    const data = await loadReportPrintData(projectId, category as ReportCategory);
    if (!data) return jsonError(404, "Report not found");
    filename = `${printFilename([data.organization, data.category, "report"], "report")}.pdf`;
  } else {
    return jsonError(400, "Provide a slug, projectId, or report projectId");
  }

  const token = signPrintToken({
    kind: printKind,
    slug,
    projectId,
    category,
    uid: user?.id,
  });
  const path = printPath({ kind: printKind, slug, projectId, category });
  const printUrl = new URL(path, appOrigin(req));
  printUrl.searchParams.set("token", token);
  const href = printUrl.toString();

  try {
    const pdf = await renderPrintUrlToPdf(href, { landscape });
    const res = new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
    return withPrintUrl(res, href);
  } catch (err) {
    console.error("[pdf] render failed", err);
    return jsonError(
      503,
      "Could not generate PDF. Open the print view instead.",
      href
    );
  }
}
