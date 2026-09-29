import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { ACCOUNT_HINT_COOKIE } from "@/lib/customer/config";
import { AUTH_COOKIE_OPTIONS, customerSupabase } from "@/lib/customer/supabase";
import { safeNextPath } from "@/lib/customer/validation";
import { localizeHref, splitLocale } from "@/lib/i18n/config";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "email", "email_change", "invite", "magiclink"]);

/**
 * Landing point for Google sign-in (PKCE `code`) and for older Supabase email links
 * (`token_hash`). Customers no longer use passwords: a password-recovery link just goes to
 * sign-in. Tokens are never logged.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  // The link carries the language the form was used in (next=/bn/...); stay in it.
  const { locale, path: nextPath } = splitLocale(next);
  const to = (path: string) => NextResponse.redirect(new URL(localizeHref(path, locale), url.origin));
  const fail = (reason: "expired" | "unavailable") => to(`/login?error=link_${reason}`);
  if (url.searchParams.get("type") === "recovery") return to("/login");

  const supabase = await customerSupabase();
  if (!supabase) return to("/login");

  // Supabase reports a dead email link this way (e.g. error_code=otp_expired). A Google sign-in
  // that was cancelled or refused comes back with an OAuth error instead and no email-link type.
  const oauthError = url.searchParams.get("error");
  if (oauthError && !url.searchParams.get("type") && url.searchParams.get("error_code") !== "otp_expired") {
    return to("/login?error=oauth_failed");
  }
  if (oauthError || url.searchParams.get("error_code")) return fail("expired");

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let error: { status?: number; name?: string } | null = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    return fail("expired");
  }
  if (error) return fail(error.name === "AuthRetryableFetchError" || !error.status ? "unavailable" : "expired");

  const store = await cookies();
  store.set(ACCOUNT_HINT_COOKIE, "1", { path: "/", sameSite: "lax", secure: AUTH_COOKIE_OPTIONS.secure, maxAge: 60 * 60 * 24 * 30 });
  await supabase.rpc("portal_touch_login");
  return to(nextPath === "/account" ? "/account?welcome=1" : nextPath);
}
