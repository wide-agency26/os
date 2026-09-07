/**
 * WIDE OS traffic controller (Next.js 16 `proxy` = legacy `middleware`).
 * Inspects JWT session + role → routes to /admin, /finance, /bd, /cm, or /client.
 */
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy";
import { CANONICAL_ORIGIN, isLegacyProductionHost } from "@/lib/site-url";
import { isMachinePath } from "@/lib/proxy-routing";

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  if (
    isLegacyProductionHost(host) &&
    !isMachinePath(request.nextUrl.pathname)
  ) {
    const dest = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      CANONICAL_ORIGIN
    );
    return NextResponse.redirect(dest, 308);
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
