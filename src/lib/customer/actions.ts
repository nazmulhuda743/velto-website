"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale, localHref, loginRedirectPath } from "@/lib/i18n/server";
import { accountText } from "@/content/i18n/account";
import { SITE_URL } from "@/lib/site-url";
import { otpAllowed } from "@/lib/sms/limits";
import { bdPhoneToE164, linkCodeMessage, validOtp } from "@/lib/sms/otp";
import { sendSms } from "@/lib/sms/send";
import { supabaseRpc } from "@/lib/supabase-server";
import { LINK_CODE_COOKIE, LINK_CODE_TTL_SECONDS, checkLinkCode, issueLinkCode } from "./sms-link";
import { ACCOUNT_HINT_COOKIE } from "./config";
import { AREA, cleanIssues, happy, parsePreferences } from "./extras";
import { AUTH_COOKIE_OPTIONS, customerSupabase } from "./supabase";
import {
  TERMS_VERSION,
  normaliseBdPhone,
  safeNextPath,
  validArea,
  validName,
  validOrderNumber,
} from "./validation";

export type FieldErrors = Partial<Record<"fullName" | "phone" | "terms" | "address" | "area" | "code", string>>;

export type AuthFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: FieldErrors; message?: string; values?: Record<string, string> }
  | { status: "error"; message: string; values?: Record<string, string> }
  | { status: "unavailable" }
  | { status: "saved" }
  /** An SMS code is on its way to `phone`; `message` reports a problem on this step (e.g. resend refused). */
  | { status: "code-sent"; phone: string; resent?: boolean; sentAt?: number; message?: string; errors?: FieldErrors }
  /** "Show my past orders": the phone is proven; `result` says what was found under it. */
  | { status: "linked"; result: "linked" | "no_orders" | "pending" };

const UNAVAILABLE: AuthFormState = { status: "unavailable" };

/** Messages in the language of the page the form was sent from (the proxy's locale header). */
async function messages() {
  const t = accountText(await getLocale()).actions;
  return {
    t,
    disabled: { status: "error", message: t.disabled } as AuthFormState,
    tooMany: { status: "error", message: t.tooMany } as AuthFormState,
  };
}

const str = (form: FormData, key: string, max = 300) => String(form.get(key) ?? "").slice(0, max);

/* ---------- Best-effort brake per IP (each server instance keeps its own window) ---------- */

const WINDOWS = { signin: [10, 10 * 60_000] } as const;
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

/** Google sign-in lands on /auth/confirm, then continue to `next` in the language the form was used in. */
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

/* ---------- Show my past orders: prove the account's phone with an SMS code ---------- */

/**
 * Email and Google accounts: text a code to the phone on the account. The code is bound to this
 * login and phone by a signed httpOnly cookie (lib/customer/sms-link.ts); same database limits as
 * sign-in codes (5 per phone and 10 per IP an hour, 300 site-wide).
 */
export async function sendLinkCodeAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const m = await messages();
  const resend = form.get("resend") === "1";
  const supabase = await customerSupabase();
  if (!supabase) return m.disabled;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(await loginRedirectPath("/account"));
  const me = await supabase.rpc("portal_me");
  const phone = (me.data as { state?: string; phone?: string } | null)?.state === "ready" ? (me.data as { phone: string }).phone : null;
  if (!phone) return { status: "error", message: m.t.saveFailed };
  const fail = (message: string): AuthFormState => (resend ? { status: "code-sent", phone, message } : { status: "error", message });

  const [perPhone, perIp, global] = await Promise.all([
    otpAllowed("phone", phone),
    otpAllowed("ip", await requesterIp()),
    otpAllowed("global", "site"),
  ]);
  if (!perPhone || !perIp || !global) return fail(m.t.tooMany);

  const issued = issueLinkCode(data.user.id, phone);
  if (!issued) return fail(m.t.smsFailed);
  const sent = await sendSms(phone, linkCodeMessage(issued.code));
  if (!sent.ok) {
    console.error("link_code_sms_failed", sent.provider, sent.code);
    return fail(m.t.smsFailed);
  }
  (await cookies()).set(LINK_CODE_COOKIE, issued.cookie, {
    ...AUTH_COOKIE_OPTIONS,
    path: "/",
    maxAge: LINK_CODE_TTL_SECONDS,
  });
  return { status: "code-sent", phone, resent: resend, sentAt: Date.now() };
}

/** Check the code; a right one links the history (or reports that none was found). */
export async function confirmLinkCodeAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const m = await messages();
  const code = validOtp(str(form, "linkCode", 20));
  const supabase = await customerSupabase();
  if (!supabase) return m.disabled;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(await loginRedirectPath("/account"));
  const store = await cookies();
  const pending = store.get(LINK_CODE_COOKIE)?.value;
  const phone = pending?.split(".")[0] ?? "";
  if (!code) return { status: "code-sent", phone, errors: { code: m.t.code } };
  if (!(await otpAllowed("verify", phone || data.user.id))) return { status: "code-sent", phone, message: m.t.tooMany };

  const checked = checkLinkCode(data.user.id, pending, code);
  if (!checked || "expired" in checked) return { status: "code-sent", phone, errors: { code: m.t.codeWrong } };

  try {
    const r = await supabaseRpc<{ ok?: boolean; result?: string; reason?: string }>("portal_link_verified_phone", {
      p_auth_user_id: data.user.id,
      p_phone: checked.phone,
    });
    if (!r.ok || !r.result) return { status: "error", message: m.t.saveFailed };
    store.delete(LINK_CODE_COOKIE);
    revalidatePath("/account", "layout");
    return { status: "linked", result: r.result === "linked" ? "linked" : r.result === "pending" ? "pending" : "no_orders" };
  } catch (error) {
    console.error("portal_link_verified_phone_failed", error instanceof Error ? error.message : "unknown");
    return { status: "error", message: m.t.saveFailed };
  }
}

