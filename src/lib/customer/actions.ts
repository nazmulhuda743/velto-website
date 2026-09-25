"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SITE_URL } from "@/lib/site-url";
import { ACCOUNT_HINT_COOKIE, RECOVERY_COOKIE } from "./config";
import { AUTH_COOKIE_OPTIONS, customerSupabase } from "./supabase";
import {
  TERMS_VERSION,
  normaliseBdPhone,
  passwordProblem,
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
const DISABLED: AuthFormState = { status: "error", message: "Customer accounts aren't available yet." };

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

const TOO_MANY: AuthFormState = { status: "error", message: "Too many attempts. Please wait a few minutes and try again." };

/** Supabase auth error → customer-facing state. Never echoes raw provider messages. */
function authFailure(error: { name?: string; code?: string; status?: number }): AuthFormState | null {
  if (error.name === "AuthRetryableFetchError" || !error.status) return UNAVAILABLE;
  if (error.status === 429 || error.code?.startsWith("over_")) return TOO_MANY;
  return null;
}

const redirectTo = (next: string) => `${SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}`;

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

  const fullName = validName(values.fullName);
  const email = validEmail(values.email);
  const phone = normaliseBdPhone(values.phone);
  if (!fullName) errors.fullName = "Enter your name.";
  if (!email) errors.email = "Enter a valid email address.";
  if (!phone) errors.phone = "Enter a Bangladeshi mobile number, like 01712 345678.";
  const pwProblem = passwordProblem(password);
  if (pwProblem) errors.password = pwProblem;
  if (password !== str(form, "confirm", 200)) errors.confirm = "The passwords don't match.";
  if (form.get("terms") !== "on") errors.terms = "Please agree to the Terms and Privacy Policy to continue.";
  if (Object.keys(errors).length) return { status: "invalid", errors, values };

  const supabase = await customerSupabase();
  if (!supabase) return DISABLED;
  if (await throttled("signup")) return TOO_MANY;

  const { data, error } = await supabase.auth.signUp({
    email: email!,
    password,
    options: {
      emailRedirectTo: redirectTo("/account"),
      // Used once, to create the customer's own portal profile. Grants nothing.
      data: { full_name: fullName, phone, terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() },
    },
  });
  if (error) {
    const mapped = authFailure(error);
    if (mapped) return mapped;
    if (error.code === "weak_password") return { status: "invalid", errors: { password: "Choose a stronger password." }, values };
    if (error.code === "email_address_invalid") return { status: "invalid", errors: { email: "Enter a valid email address." }, values };
    if (error.code === "user_already_exists" || error.code === "email_exists") return { status: "check-email", email: email! };
    console.error("customer_signup_failed", error.code ?? error.status);
    return { status: "error", message: "We couldn't create your account. Please try again.", values };
  }
  if (data.session) {
    // Projects without email confirmation sign the customer straight in.
    await setAccountHint(true);
    redirect("/account");
  }
  // An existing address gets the same answer as a new one, so sign-up can't be used to
  // discover who has an account.
  return { status: "check-email", email: email! };
}

export async function resendVerificationAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = validEmail(str(form, "email", 254));
  if (!email) return { status: "invalid", errors: { email: "Enter a valid email address." } };
  const supabase = await customerSupabase();
  if (!supabase) return DISABLED;
  if (await throttled("resend")) return TOO_MANY;
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectTo("/account") } });
  if (error) {
    const mapped = authFailure(error);
    if (mapped) return mapped;
  }
  return { status: "sent" };
}

/* ---------- Sign in / out ---------- */

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { email: str(form, "email", 254) };
  const email = validEmail(values.email);
  const password = str(form, "password", 200);
  const next = safeNextPath(str(form, "next", 300));
  const errors: FieldErrors = {};
  if (!email) errors.email = "Enter the email address you signed up with.";
  if (!password) errors.password = "Enter your password.";
  if (Object.keys(errors).length) return { status: "invalid", errors, values };

  const supabase = await customerSupabase();
  if (!supabase) return DISABLED;
  if (await throttled("signin")) return TOO_MANY;

  const { error } = await supabase.auth.signInWithPassword({ email: email!, password });
  if (error) {
    const mapped = authFailure(error);
    if (mapped) return mapped;
    if (error.code === "email_not_confirmed") return { status: "verify-required", email: email! };
    return { status: "error", message: "Email or password is incorrect.", values };
  }
  await supabase.rpc("portal_touch_login");
  await setAccountHint(true);
  redirect(next);
}

export async function signOutAction() {
  const supabase = await customerSupabase();
  await supabase?.auth.signOut({ scope: "local" });
  await setAccountHint(false);
  redirect("/");
}

/* ---------- Forgot / reset password ---------- */

export async function forgotPasswordAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = validEmail(str(form, "email", 254));
  if (!email) return { status: "invalid", errors: { email: "Enter a valid email address." } };
  const supabase = await customerSupabase();
  if (!supabase) return DISABLED;
  if (await throttled("recover")) return TOO_MANY;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo("/reset-password") });
  if (error && (error.name === "AuthRetryableFetchError" || !error.status)) return UNAVAILABLE;
  // Same answer whether or not the address has an account.
  return { status: "sent" };
}

export async function resetPasswordAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const password = str(form, "password", 200);
  const errors: FieldErrors = {};
  const pwProblem = passwordProblem(password);
  if (pwProblem) errors.password = pwProblem;
  if (password !== str(form, "confirm", 200)) errors.confirm = "The passwords don't match.";
  if (Object.keys(errors).length) return { status: "invalid", errors };

  const supabase = await customerSupabase();
  if (!supabase) return DISABLED;
  const store = await cookies();
  // Only a session that arrived through a recovery link may set a new password here.
  if (store.get(RECOVERY_COOKIE)?.value !== "1") return { status: "expired" };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "expired" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const mapped = authFailure(error);
    if (mapped) return mapped;
    if (error.code === "same_password") return { status: "invalid", errors: { password: "Choose a password you haven't used here before." } };
    if (error.code === "weak_password") return { status: "invalid", errors: { password: "Choose a stronger password." } };
    if (error.status === 401 || error.status === 403) return { status: "expired" };
    console.error("customer_reset_failed", error.code ?? error.status);
    return { status: "error", message: "We couldn't update your password. Please try again." };
  }
  store.delete(RECOVERY_COOKIE);
  // Anyone else holding an old session is signed out.
  await supabase.auth.signOut({ scope: "others" });
  await setAccountHint(true);
  redirect("/account?password=updated");
}

/* ---------- Profile & history link ---------- */

export async function saveProfileAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { fullName: str(form, "fullName", 120), phone: str(form, "phone", 30), address: str(form, "address", 400), area: str(form, "area", 20) };
  const completing = form.get("completing") === "1";
  const errors: FieldErrors = {};
  const fullName = validName(values.fullName);
  const phone = normaliseBdPhone(values.phone);
  const area = validArea(values.area);
  if (!fullName) errors.fullName = "Enter your name.";
  if (!phone) errors.phone = "Enter a Bangladeshi mobile number, like 01712 345678.";
  if (values.address.trim().length > 300) errors.address = "Keep the address under 300 characters.";
  if (area === null) errors.area = "Choose your area.";
  if (completing && form.get("terms") !== "on") errors.terms = "Please agree to the Terms and Privacy Policy to continue.";
  if (Object.keys(errors).length) return { status: "invalid", errors, values };

  const supabase = await customerSupabase();
  if (!supabase) return DISABLED;
  const { error } = await supabase.rpc("portal_profile_save", {
    p_full_name: fullName,
    p_phone: phone,
    p_address: values.address.trim(),
    p_area: area,
    p_terms_version: completing ? TERMS_VERSION : null,
  });
  if (error) {
    if (error.message?.includes("phone locked")) {
      return { status: "invalid", errors: { phone: "Your phone number is verified. To change it, contact Velto so we can verify the new number." }, values };
    }
    if (error.code === "PGRST301" || error.message?.includes("authentication required")) redirect("/login?next=/account/profile");
    console.error("portal_profile_save_failed", error.code);
    return { status: "error", message: "We couldn't save your details. Please try again.", values };
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
