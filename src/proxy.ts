import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNT_HINT_COOKIE, customerAuthConfig } from "@/lib/customer/config";

const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Customer session upkeep for the account area, sign-in pages and booking prefill:
 * refreshes the Supabase session cookies, sends signed-out visitors from /account to
 * /login (and back afterwards), and keeps the header's "signed in" hint accurate.
 */
export async function proxy(request: NextRequest) {
  const auth = customerAuthConfig();
  const path = request.nextUrl.pathname;
  const protectedRoute = path === "/account" || path.startsWith("/account/");
  const hasSessionCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));

  if (!auth) return NextResponse.next();
  if (!hasSessionCookie) {
    if (protectedRoute) return toLogin(request);
    const response = NextResponse.next();
    if (request.cookies.has(ACCOUNT_HINT_COOKIE)) response.cookies.delete(ACCOUNT_HINT_COOKIE);
    return response;
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(auth.url, auth.key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, { ...options, ...AUTH_COOKIE_OPTIONS });
      },
    },
  });

  // getUser() validates the token with Supabase Auth and refreshes it when needed.
  const { data, error } = await supabase.auth.getUser();
  const signedIn = Boolean(data.user) && !error;

  if (!signedIn && protectedRoute && error?.name !== "AuthRetryableFetchError") {
    const redirect = toLogin(request);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.cookies.delete(ACCOUNT_HINT_COOKIE);
    return redirect;
  }
  if (signedIn && !request.cookies.has(ACCOUNT_HINT_COOKIE)) {
    response.cookies.set(ACCOUNT_HINT_COOKIE, "1", {
      path: "/",
      sameSite: "lax",
      secure: AUTH_COOKIE_OPTIONS.secure,
      maxAge: 60 * 60 * 24 * 30,
    });
  } else if (!signedIn && request.cookies.has(ACCOUNT_HINT_COOKIE) && error?.name !== "AuthRetryableFetchError") {
    response.cookies.delete(ACCOUNT_HINT_COOKIE);
  }
  return response;
}

function toLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/account", "/account/:path*", "/login", "/signup", "/forgot-password", "/reset-password", "/book"],
};
