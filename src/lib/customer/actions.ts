"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale, localHref, loginRedirectPath } from "@/lib/i18n/server";
import { accountText } from "@/content/i18n/account";
import { fill } from "@/lib/i18n/config";
import { SITE_URL } from "@/lib/site-url";
import { otpAllowed } from "@/lib/sms/limits";
import { bdPhoneToE164, validOtp } from "@/lib/sms/otp";
import { ACCOUNT_HINT_COOKIE, RECOVERY_COOKIE } from "./config";
import { AREA, cleanIssues, happy, parsePreferences } from "./extras";
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
  validOrderNumber,
} from "./validation";

export type FieldErrors = Partial<Record<"fullName" | "email" | "phone" | "password" | "confirm" | "terms" | "address" | "area" | "code", string>>;

export type AuthFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: FieldErrors; message?: string; values?: Record<string, string> }
  | { status: "error"; message: string; values?: Record<string, string> }
  | { status: "unavailable" }
  | { status: "check-email"; email: string }
  | { status: "verify-required"; email: string }
  | { status: "sent" }
  | { status: "expired" }
  | { status: "saved" }
  /** An SMS code is on its way to `phone`; `message` reports a problem on this step (e.g. resend refused). */
  | { status: "code-sent"; phone: string; resent?: boolean; sentAt?: number; message?: string; errors?: FieldErrors };

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

const requesterIp = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

async function throttled(kind: keyof typeof WINDOWS) {
  const ip = await requesterIp();
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

/* ---------- Sign in with a mobile number (SMS code) ---------- */

/**
 * Step 1: text a sign-in code. One flow for new and returning customers: Supabase Auth creates
 * the account on first use. From the sign-up form, the name and accepted terms travel as
 * metadata so the account is ready straight away; otherwise /account asks for them once.
 * Supabase makes the code and delivers it through the Send SMS hook (/api/auth/sms-hook),
 * which also applies the per-phone and site-wide limits.
 */
export async function sendPhoneCodeAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const m = await messages();
  const signup = form.get("mode") === "signup";
  const resend = form.get("resend") === "1";
  // Field names differ from the email forms' so both can sit on one page.
  const values = { otpPhone: str(form, "otpPhone", 30), otpName: str(form, "otpName", 120) };
  const phone = normaliseBdPhone(values.otpPhone);
  const errors: FieldErrors = {};
  if (!phone) errors.phone = m.t.phone;
  const fullName = signup && !resend ? validName(values.otpName) : null;
  if (signup && !resend) {
    if (!fullName) errors.fullName = m.t.name;
    if (form.get("otpTerms") !== "on") errors.terms = m.t.terms;
  }
  if (Object.keys(errors).length) return { status: "invalid", errors, values };
  // On a resend, problems are shown on the code step instead of sending the customer back.
  const problem = (state: AuthFormState): AuthFormState =>
    resend ? { status: "code-sent", phone: phone!, message: "message" in state ? state.message : m.t.smsFailed } : state;

  const supabase = await customerSupabase();
  if (!supabase) return m.disabled;
  if (!(await otpAllowed("ip", await requesterIp()))) return problem(m.tooMany);

  const { error } = await supabase.auth.signInWithOtp({
    phone: bdPhoneToE164(phone!),
    options: {
      shouldCreateUser: true,
      channel: "sms",
      data: fullName
        ? { full_name: fullName, terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString(), locale: await getLocale() }
        : undefined,
    },
  });
  if (error) {
    const mapped = authFailure(error, m.tooMany);
    if (mapped) return mapped.status === "unavailable" ? mapped : problem(mapped);
    // Only Bangladeshi mobiles reach this point, so what's left is the SMS provider or setup.
    console.error("customer_otp_send_failed", error.code ?? error.status);
    return problem({ status: "error", message: error.code === "phone_provider_disabled" ? m.t.disabled : m.t.smsFailed, values });
  }
  return { status: "code-sent", phone: phone!, resent: resend, sentAt: Date.now() };
}

/** Step 2: check the code. A correct code signs the customer in (and creates the account if new). */
export async function verifyPhoneCodeAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const m = await messages();
  const phone = normaliseBdPhone(str(form, "otpPhone", 30));
  const code = validOtp(str(form, "otpCode", 20));
  const next = await localHref(safeNextPath(str(form, "next", 300)));
  if (!phone) return { status: "invalid", errors: { phone: m.t.phone } };
  if (!code) return { status: "code-sent", phone, errors: { code: m.t.code } };

  const supabase = await customerSupabase();
  if (!supabase) return m.disabled;
  if (!(await otpAllowed("verify", phone))) return { status: "code-sent", phone, message: m.t.tooMany };

  const { error } = await supabase.auth.verifyOtp({ phone: bdPhoneToE164(phone), token: code, type: "sms" });
  if (error) {
    const mapped = authFailure(error, m.tooMany);
    if (mapped?.status === "unavailable") return mapped;
    if (mapped) return { status: "code-sent", phone, message: m.t.tooMany };
    return { status: "code-sent", phone, errors: { code: m.t.codeWrong } };
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

/* ---------- order feedback ---------- */

export type FeedbackState = { status: "idle" } | { status: "saved"; rating: number } | { status: "error"; message: string };

/** Rate a delivered order. The database checks the order is this customer's and delivered. */
export async function saveFeedbackAction(_prev: FeedbackState, form: FormData): Promise<FeedbackState> {
  const m = await messages();
  const orderNumber = validOrderNumber(str(form, "orderNumber", 20));
  const rating = Number(str(form, "rating", 2));
  if (!orderNumber) return { status: "error", message: m.t.feedbackFailed };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { status: "error", message: m.t.feedbackRating };
  const issues = happy(rating) ? [] : cleanIssues(form.getAll("issues"));
  const comment = String(form.get("comment") ?? "").trim();
  if (comment.length > 1000) return { status: "error", message: m.t.feedbackLong };

  const supabase = await customerSupabase();
  if (!supabase) return m.disabled as FeedbackState;
  const { error } = await supabase.rpc("portal_feedback_save", {
    p_order_number: orderNumber,
    p_rating: rating,
    p_issues: issues,
    p_comment: comment || null,
  });
  if (error) {
    if (error.code === "PGRST301" || error.message?.includes("authentication required")) redirect(await loginRedirectPath(`/account/orders/${orderNumber}`));
    if (error.message?.includes("feedback closed")) return { status: "error", message: m.t.feedbackClosed };
    console.error("portal_feedback_save_failed", error.code);
    return { status: "error", message: m.t.feedbackFailed };
  }
  revalidatePath("/account", "layout");
  return { status: "saved", rating };
}

/* ---------- saved preferences ---------- */

export type PreferencesState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

/** Garment care and up to three pickup addresses, added to future booking requests. */
export async function savePreferencesAction(_prev: PreferencesState, form: FormData): Promise<PreferencesState> {
  const m = await messages();
  const note = str(form, "note", 400).trim();
  if (note.length > 300) return { status: "error", message: m.t.prefsNoteLong };
  const addresses = [0, 1, 2]
    .map((i) => ({ label: str(form, `label${i}`, 60).trim(), address: str(form, `address${i}`, 400).trim(), area: str(form, `area${i}`, 10).trim() }))
    .filter((a) => a.address);
  if (addresses.some((a) => a.address.length > 300 || a.label.length > 30)) return { status: "error", message: m.t.addressLong };
  if (addresses.some((a) => a.area && !AREA.test(a.area))) return { status: "error", message: m.t.area };
  const prefs = parsePreferences({
    care: { shirts: str(form, "shirts", 10), starch: str(form, "starch", 10), fragrance: str(form, "fragrance", 10), separate: form.get("separate") === "on", note },
    addresses,
  });

  const supabase = await customerSupabase();
  if (!supabase) return m.disabled as PreferencesState;
  const { error } = await supabase.rpc("portal_prefs_save", { p_care: prefs.care, p_addresses: prefs.addresses });
  if (error) {
    if (error.code === "PGRST301" || error.message?.includes("authentication required")) redirect(await loginRedirectPath("/account/profile"));
    console.error("portal_prefs_save_failed", error.code);
    return { status: "error", message: m.t.saveFailed };
  }
  revalidatePath("/account", "layout");
  return { status: "saved" };
}

/* ---------- change or cancel a website pickup ---------- */

export type PickupState = { status: "idle" } | { status: "changed" } | { status: "cancelled" } | { status: "error"; message: string };

const UUID = /^[0-9a-f-]{36}$/i;
const SLOTS = new Set(["morning", "afternoon", "evening"]);

async function pickupError(error: { code?: string; message?: string }, t: Awaited<ReturnType<typeof messages>>["t"]): Promise<PickupState> {
  if (error.code === "PGRST301" || error.message?.includes("authentication required")) redirect(await loginRedirectPath("/account"));
  const m = error.message ?? "";
  if (m.includes("too late")) return { status: "error", message: t.pickupTooLate };
  if (m.includes("too many changes")) return { status: "error", message: t.pickupTooMany };
  if (m.includes("slot too soon")) return { status: "error", message: t.pickupTooSoon };
  if (m.includes("invalid time")) return { status: "error", message: t.pickupInvalid };
  if (m.includes("not found") || m.includes("closed")) return { status: "error", message: t.pickupGone };
  console.error("portal_pickup_failed", error.code);
  return { status: "error", message: t.pickupFailed };
}

/** New day and part of the day for an open pickup. The database checks it is the caller's. */
export async function changePickupAction(_prev: PickupState, form: FormData): Promise<PickupState> {
  const m = await messages();
  const id = str(form, "id", 40);
  const date = str(form, "date", 10);
  const slot = str(form, "slot", 10);
  if (!UUID.test(id)) return { status: "error", message: m.t.pickupGone };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !SLOTS.has(slot)) return { status: "error", message: m.t.pickupInvalid };
  const supabase = await customerSupabase();
  if (!supabase) return m.disabled as PickupState;
  const { error } = await supabase.rpc("portal_pickup_change", { p_task: id, p_date: date, p_slot: slot });
  if (error) return pickupError(error, m.t);
  revalidatePath("/account", "layout");
  return { status: "changed" };
}

export async function cancelPickupAction(_prev: PickupState, form: FormData): Promise<PickupState> {
  const m = await messages();
  const id = str(form, "id", 40);
  const reason = str(form, "reason", 200).trim();
  if (!UUID.test(id)) return { status: "error", message: m.t.pickupGone };
  const supabase = await customerSupabase();
  if (!supabase) return m.disabled as PickupState;
  const { error } = await supabase.rpc("portal_pickup_cancel", { p_task: id, p_reason: reason || null });
  if (error) return pickupError(error, m.t);
  revalidatePath("/account", "layout");
  return { status: "cancelled" };
}
