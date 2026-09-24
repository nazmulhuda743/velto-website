import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function refreshPortalSession(request: NextRequest) {
  const url = process.env.VELTO_PORTAL_SUPABASE_URL?.trim();
  const key = process.env.VELTO_PORTAL_SUPABASE_PUBLISHABLE_KEY?.trim();
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Keep this immediately after client creation. getClaims verifies the JWT.
  const { data } = await supabase.auth.getClaims();
  const authenticated = typeof data?.claims?.sub === "string";
  const path = request.nextUrl.pathname;

  if (path.startsWith("/account") && !authenticated) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = "";
    target.searchParams.set("next", path);
    target.searchParams.set("reason", "session");
    return NextResponse.redirect(target);
  }

  if (authenticated && (path === "/login" || path === "/signup")) {
    const target = request.nextUrl.clone();
    target.pathname = "/account";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}
