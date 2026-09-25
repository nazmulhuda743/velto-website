import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNT_HINT_COOKIE, customerAuthConfig } from "@/lib/customer/config";
import { banglaEnabled, LANG_COOKIE, LOCALE_HEADER, localizeHref, splitLocale } from "@/lib/i18n/config";

const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

/** Customer-session upkeep only runs where it's needed (account, sign-in, booking prefill). */
const AUTH_PATH = /^\/(?:account(?:\/|$)|login$|signup$|forgot-password$|reset-password$|book$)/;

/**
 * 1. Language: public pages live in app/[lang]. English keeps its URLs ("/pricing" is served
 *    from /en/pricing by rewrite); Bangla is "/bn/pricing". "/en/..." redirects to the plain
 *    URL so each page has one English address. While Bangla is off, "/bn/..." redirects too.
 *    A visitor who chose Bangla in the switcher (velto_lang=bn) is sent to the Bangla page.
 * 2. Customer sessions (unchanged): refreshes the Supabase session cookies, sends signed-out
 *    visitors from /account to /login (and back afterwards), and keeps the header's
 *    "signed in" hint accurate.
 */
export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const { locale, path } = splitLocale(url.pathname);
  const explicitEnglish = /^\/en(?:\/|$)/.test(url.pathname);

  if (explicitEnglish) return redirectTo(request, path, "en", 308);
  // Temporary: switching Bangla on later must not be blocked by cached redirects.
  if (locale === "bn" && !banglaEnabled()) return redirectTo(request, path, "en", 307);
  if (locale === "en" && banglaEnabled() && request.cookies.get(LANG_COOKIE)?.value === "bn" && isDocument(request)) {
    return redirectTo(request, path, "bn", 307);
  }

  // English is served from the /en tree without changing the visible URL. The language also
  // travels as a request header, for server actions (root params aren't available there).
  const pass = () => {
    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, locale);
    if (locale === "bn") return NextResponse.next({ request: { headers } });
    const target = url.clone();
    target.pathname = `/en${path === "/" ? "" : path}`;
    return NextResponse.rewrite(target, { request: { headers } });
  };

  const auth = customerAuthConfig();
  if (!auth || !AUTH_PATH.test(path)) return pass();

  const protectedRoute = path === "/account" || path.startsWith("/account/");
  const hasSessionCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasSessionCookie) {
    if (protectedRoute) return toLogin(request, locale);
    const response = pass();
    if (request.cookies.has(ACCOUNT_HINT_COOKIE)) response.cookies.delete(ACCOUNT_HINT_COOKIE);
    return response;
  }

  let response = pass();
  const supabase = createServerClient(auth.url, auth.key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = pass();
        for (const { name, value, options } of list) response.cookies.set(name, value, { ...options, ...AUTH_COOKIE_OPTIONS });
      },
    },
  });

  // getUser() validates the token with Supabase Auth and refreshes it when needed.
  const { data, error } = await supabase.auth.getUser();
  const signedIn = Boolean(data.user) && !error;

  if (!signedIn && protectedRoute && error?.name !== "AuthRetryableFetchError") {
    const redirect = toLogin(request, locale);
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

/** A top-level page load (not a prefetch, RSC or asset request). */
const isDocument = (request: NextRequest) =>
  request.method === "GET" && request.headers.get("sec-fetch-dest") === "document" && !request.headers.has("rsc");

function redirectTo(request: NextRequest, path: string, locale: "en" | "bn", status: 307 | 308) {
  const url = request.nextUrl.clone();
  const target = localizeHref(path, locale);
  const q = target.indexOf("?");
  url.pathname = q === -1 ? target : target.slice(0, q);
  return NextResponse.redirect(url, status);
}

function toLogin(request: NextRequest, locale: "en" | "bn") {
  const url = request.nextUrl.clone();
  url.pathname = localizeHref("/login", locale);
  // next= keeps the visible URL (with /bn), so the reader returns to the same language.
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Every page request except APIs, admin, redirects, Next internals and files.
  matcher: ["/((?!api/|admin|go/|auth/|_next/|opengraph-image|twitter-image|.*\\.[a-zA-Z0-9]{2,5}$).*)"],
};
