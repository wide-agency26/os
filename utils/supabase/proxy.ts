import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applyProxyRouting } from "@/lib/proxy-routing";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );

          if (headers) {
            Object.entries(headers).forEach(([key, value]) =>
              supabaseResponse.headers.set(key, value)
            );
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const routingRedirect = await applyProxyRouting(request, supabase, user);
  if (routingRedirect) {
    return routingRedirect;
  }

  return supabaseResponse;
}
