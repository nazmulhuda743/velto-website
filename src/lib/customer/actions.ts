"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale, localHref, loginRedirectPath } from "@/lib/i18n/server";
import { accountText } from "@/content/i18n/account";
import { fill } from "@/lib/i18n/config";
import { SITE_URL } from "@/lib/site-url";
import { ACCOUNT_HINT_COOKIE, RECOVERY_COOKIE } from "./config";
import { AUTH_COOKIE_OPTIONS, customerSupabase } from "./supabase";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  TERMS_VERSION,
  normaliseBdPhone,
  passwordIssue,
  safeNextPath,
  validArea,
  validEmail,
  validName,
} from "./validation";

export type FieldErrors = Partial<Record<"fullName" | "email" | "phone" | "password" | "confirm" | "terms" | "address" | "area", string>>;

export type AuthFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: FieldErrors; message?: string; values?: Record<string, string> }
  | { status: "error"; message: string; values?: Record<string, string> }
  | { status: "unavailable" }
  | { status: "check-email"; email: string }
  | { status: "verify-required"; email: string }
  | { status: "sent" }
  | { status: "expired" }
  | { status: "saved" };

const UNAVAILABLE: AuthFormState = { status: "unavailable" };

/** Messages in the language of the page the form was sent from (the proxy's locale header). */
async function messages() {
  const locale = await getLocale();
  const t = accountText(locale).actions;
  const password = (value: string) => {
    const issue = passwordIssue(value);
    if (issue === "short") return fill(t.passwordShort, { n: PASSWORD_MIN }, locale);
    if (issue === "long") return fill(t.passwordLong, { n: PASSWORD_MAX }, locale);
    if (issue === "mix") return t.passwordMix;
    return null;
  };
  return {
    t,
    password,
    disabled: { status: "error", message: t.disabled } as AuthFormState,
    tooMany: { status: "error", message: t.tooMany } as AuthFormState,
  };
}

const str = (form: FormData, key: string, max = 300) => String(form.get(key) ?? "").slice(0, max);

/* ---------- Best-effort brake per IP (each server instance keeps its own window) ---------- */

const WINDOWS = { signin: [10, 10 * 60_000], signup: [5, 60 * 60_000], recover: [5, 60 * 60_000], resend: [3, 60 * 60_000] } as const;
const hits = new Map<string, number[]>();

async function throttled(kind: keyof typeof WINDOWS) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const [max, windowMs] = WINDOWS[kind];
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}

/** Supabase auth error → customer-facing state. Never echoes raw provider messages. */
function authFailure(error: { name?: string; code?: string; status?: number }, tooMany: AuthFormState): AuthFormState | null {
  if (error.name === "AuthRetryableFetchError" || !error.status) return UNAVAILABLE;
  if (error.status === 429 || error.code?.startsWith("over_")) return tooMany;
  return null;
}

/** Email links land on /auth/confirm, then continue to `next` in the language the form was used in. */
const redirectTo = async (next: string) => `${SITE_URL}/auth/confirm?next=${encodeURIComponent(await localHref(next))}`;

async function setAccountHint(signedIn: boolean) {
  const store = await cookies();
  if (signedIn) {
    store.set(ACCOUNT_HINT_COOKIE, "1", {
      path: "/",
      sameSite: "lax",
      secure: AUTH_COOKIE_OPTIONS.secure,
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    store.delete(ACCOUNT_HINT_COOKIE);
  }
}

/* ---------- Sign up ---------- */

export async function signUpAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { fullName: str(form, "fullName", 120), email: str(form, "email", 254), phone: str(form, "phone", 30) };
  const password = str(form, "password", 200);
  const errors: FieldErrors = {};
  const m = await messages();

  const fullName = validName(values.fullName);
  const email = validEmail(values.email);
  const phone = normaliseBdPhone(values.phone);
  if (!fullName) errors.fullName = m.t.name;
  if (!email) errors.email = m.t.email;
  if (!phone) errors.phone = m.t.phone;
  const pwProblem = m.password(password);
  if (pwProblem) errors.password = pwProblem;
  if (password !== str(form, "confirm", 200)) errors.confirm = m.t.confirm;
  if (form.get("terms") !== "on") errors.terms = m.t.terms;
  if (Object.keys(errors).length) return { status: "invalid", errors, values };

  const supabase = await customerSupabase();
  if (!supabase) return m.disabled;
  if (await throttled("signup")) return m.tooMany;

  const { data, error } = await supabase.auth.signUp({
    email: email!,
    password,
    options: {
      emailRedirectTo: await redirectTo("/account"),
      // Used once, to create the customer's own portal profile. Grants nothing. `locale` only
      // picks the language of the pages the emailed links open (see docs/technical/email-templates).
      data: {
        full_name: fullName,
        phone,
        terms_version: TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
        locale: await getLocale(),
      },
    },
  });
  if (error) {
    const mapped = authFailure(error, m.tooMany);
    if (mapped) return mapped;
    if (error.code === "weak_password") return { status: "invalid", errors: { password: m.t.weakPassword }, values };
    if (error.code === "email_address_invalid") return { status: "invalid", errors: { email: m.t.email }, values };
    if (error.code === "user_already_exists" || error.code === "email_exists") return { status: "check-email", email: email! };
    console.error("customer_signup_failed", error.code ?? error.status);
    return { status: "error", message: m.t.signUpFailed, values };
  }
  if (data.session) {
    // Projects without email confirmation sign the customer straight in.
    await setAccountHint(true);
    redirect(await localHref("/account"));
  }
  // An existing address gets the same answer as a new one, so sign-up can't be used to
  // discover who has an account.
  return { status: "check-email", email: email! };
}

export async function resendVerificationAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const m = await messages();
  const email = validEmail(str(form, "email", 254));
  if (!email) return { status: "invalid", errors: { email: m.t.email } };
  const supabase = await customerSupabase();
  if (!supabase) return m.disabled;
  if (await throttled("resend")) return m.tooMany;
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: await redirectTo("/account") } });
  if (error) {
    const mapped = authFailure(error, m.tooMany);
    if (mapped) return mapped;
  }
  return { status: "sent" };
}

/* ---------- Sign in / out ---------- */

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { email: str(form, "email", 254) };
  const email = validEmail(values.email);
  const password = str(form, "password", 200);
  // The form's language wins: /bn/login with next=/account continues to /bn/account.
  const next = await localHref(safeNextPath(str(form, "next", 300)));
  const errors: FieldErrors = {};
  const m = await messages();
  if (!email) errors.email = m.t.signInEmail;
  if (!password) errors.password = m.t.signInPassword;
  if (Object.keys(errors).length) return { status: "invalid", errors, values };

  const supabase = await customerSupabase();
  if (!supabase) return m.disabled;
  if (await throttled("signin")) return m.tooMany;

  const { error } = await supabase.auth.signInWithPassword({ email: email!, password });
  if (error) {
    const mapped = authFailure(error, m.tooMany);
    if (mapped) return mapped;
    if (error.code === "email_not_confirmed") return { status: "verify-required", email: email! };
    // One message for an unknown email and a wrong password, in either language.
    return { status: "error", message: m.t.wrongCredentials, values };
  }
  await supabase.rpc("portal_touch_login");
  await setAccountHint(true);
  redirect(next);
}

/* ---------- Sign in with Google ---------- */

/**
 * Starts Google sign-in (Supabase OAuth, PKCE). The code verifier is stored in an httpOnly
 * cookie here and redeemed by /auth/confirm, which also serves sign-up links. A new Google
 * customer has no phone or accepted terms yet, so /account shows "finish setting up" first.
 */
export async function googleSignInAction(form: FormData): Promise<void> {
  const next = safeNextPath(str(form, "next", 300));
  const supabase = await customerSupabase();
  if (!supabase) redirect(await localHref("/login"));
  if (await throttled("signin")) redirect(await localHref("/login?error=oauth_failed"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: await redirectTo(next),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    console.error("customer_google_start_failed", error?.code ?? error?.status ?? "no_url");
    redirect(await localHref("/login?error=oauth_failed"));
  }
  redirect(data.url);
}

export async function signOutAction() {
  const supabase = await customerSupabase();
  await supabase?.auth.signOut({ scope: "local" });
  await setAccountHint(false);
  redirect(await localHref("/"));
}

/* ---------- Forgot / reset password ---------- */

export async function forgotPasswordAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const m = await messages();
  const email = validEmail(str(form, "email", 254));
  if (!email) return { status: "invalid", errors: { email: m.t.email } };
  const supabase = await customerSupabase();
  if (!supabase) return m.disabled;
  if (await throttled("recover")) return m.tooMany;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: await redirectTo("/reset-password") });
  if (error && (error.name === "AuthRetryableFetchError" || !error.status)) return UNAVAILABLE;
  // Same answer whether or not the address has an account.
  return { status: "sent" };
}

export async function resetPasswordAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const password = str(form, "password", 200);
  const errors: FieldErrors = {};
  const m = await messages();
  const pwProblem = m.password(password);
  if (pwProblem) errors.password = pwProblem;
  if (password !== str(form, "confirm", 200)) errors.confirm = m.t.confirm;
  if (Object.keys(errors).length) return { status: "invalid", errors };

  const supabase = await customerSupabase();
  if (!supabase) return m.disabled;
  const store = await cookies();
  // Only a session that arrived through a recovery link may set a new password here.
  if (store.get(RECOVERY_COOKIE)?.value !== "1") return { status: "expired" };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "expired" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const mapped = authFailure(error, m.tooMany);
    if (mapped) return mapped;
    if (error.code === "same_password") return { status: "invalid", errors: { password: m.t.samePassword } };
    if (error.code === "weak_password") return { status: "invalid", errors: { password: m.t.weakPassword } };
    if (error.status === 401 || error.status === 403) return { status: "expired" };
    console.error("customer_reset_failed", error.code ?? error.status);
    return { status: "error", message: m.t.resetFailed };
  }
  store.delete(RECOVERY_COOKIE);
  // Anyone else holding an old session is signed out.
  await supabase.auth.signOut({ scope: "others" });
  await setAccountHint(true);
  redirect(await localHref("/account?password=updated"));
}

/* ---------- Profile & history link ---------- */

export async function saveProfileAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { fullName: str(form, "fullName", 120), phone: str(form, "phone", 30), address: str(form, "address", 400), area: str(form, "area", 20) };
  const completing = form.get("completing") === "1";
  const errors: FieldErrors = {};
  const m = await messages();
  const fullName = validName(values.fullName);
  const phone = normaliseBdPhone(values.phone);
  const area = validArea(values.area);
  if (!fullName) errors.fullName = m.t.name;
  if (!phone) errors.phone = m.t.phone;
  if (values.address.trim().length > 300) errors.address = m.t.addressLong;
  if (area === null) errors.area = m.t.area;
  if (completing && form.get("terms") !== "on") errors.terms = m.t.terms;
  if (Object.keys(errors).length) return { status: "invalid", errors, values };

  const supabase = await customerSupabase();
  if (!supabase) return m.disabled;
  const { error } = await supabase.rpc("portal_profile_save", {
    p_full_name: fullName,
    p_phone: phone,
    p_address: values.address.trim(),
    p_area: area,
    p_terms_version: completing ? TERMS_VERSION : null,
  });
  if (error) {
    if (error.message?.includes("phone locked")) {
      return { status: "invalid", errors: { phone: m.t.phoneLocked }, values };
    }
    if (error.code === "PGRST301" || error.message?.includes("authentication required")) redirect(await loginRedirectPath("/account/profile"));
    console.error("portal_profile_save_failed", error.code);
    return { status: "error", message: m.t.saveFailed, values };
  }
  revalidatePath("/account", "layout");
  return { status: "saved" };
}

export async function requestLinkAction(): Promise<void> {
  const supabase = await customerSupabase();
  if (!supabase) return;
  const { error } = await supabase.rpc("portal_request_link");
  if (error) console.error("portal_request_link_failed", error.code);
  revalidatePath("/account", "layout");
}
