"use server";

import { redirect } from "next/navigation";
import { portalMe, requestHistoryLink, savePortalProfile, touchPortalLogin } from "@/lib/customer-portal";
import { portalSiteUrl, safePortalNext } from "@/lib/supabase/portal-config";
import { createPortalServerClient, getPortalIdentity, requirePortalIdentity } from "@/lib/supabase/portal-server";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const phoneOk = (value: string) => !value || /^(?:\+?880|0)1\d{9}$/.test(value.replace(/[\s-]/g, ""));

export async function loginAction(form: FormData) {
  const email = text(form, "email").toLowerCase();
  const password = text(form, "password");
  const next = safePortalNext(text(form, "next"));
  if (!emailOk(email) || !password) redirect(`/login?error=credentials&next=${encodeURIComponent(next)}`);
  const supabase = await createPortalServerClient();
  if (!supabase) redirect("/login?error=unavailable");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=credentials&next=${encodeURIComponent(next)}`);
  try { await touchPortalLogin(supabase); } catch { /* account row can be created by portal_me */ }
  redirect(next);
}

export async function signupAction(form: FormData) {
  const fullName = text(form, "fullName");
  const email = text(form, "email").toLowerCase();
  const phone = text(form, "phone").replace(/[\s-]/g, "");
  const password = text(form, "password");
  const accepted = form.get("terms") === "on";
  if (!fullName || !emailOk(email) || !phoneOk(phone) || password.length < 10 || !accepted) redirect("/signup?error=invalid");
  const supabase = await createPortalServerClient();
  if (!supabase) redirect("/signup?error=unavailable");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: portalSiteUrl("/auth/callback?next=/account"),
      data: { full_name: fullName, phone, terms_version: "portal-v1-2026-09-25" },
    },
  });
  if (error) redirect("/signup?error=signup");
  if (data.session) redirect("/account");
  redirect("/signup?state=verification-pending");
}

export async function forgotPasswordAction(form: FormData) {
  const email = text(form, "email").toLowerCase();
  const supabase = await createPortalServerClient();
  if (supabase && emailOk(email)) {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: portalSiteUrl("/auth/callback?next=/reset-password"),
    });
  }
  // Deliberately generic to avoid revealing whether an email exists.
  redirect("/forgot-password?sent=1");
}

export async function resetPasswordAction(form: FormData) {
  const password = text(form, "password");
  const confirm = text(form, "confirmPassword");
  if (password.length < 10 || password !== confirm) redirect("/reset-password?error=password");
  const identity = await getPortalIdentity();
  if (!identity) redirect("/reset-password?invalid=1");
  const { error } = await identity.supabase.auth.updateUser({ password });
  if (error) redirect("/reset-password?invalid=1");
  await identity.supabase.auth.signOut();
  redirect("/login?state=reset-success");
}

export async function logoutAction() {
  const supabase = await createPortalServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login?state=signed-out");
}

export async function requestLinkAction() {
  const { supabase } = await requirePortalIdentity("/account/profile");
  const profile = await portalMe(supabase);
  if (!profile.phone) redirect("/account/profile?error=phone-required");
  await requestHistoryLink(supabase);
  redirect("/account/profile?state=link-pending");
}

export async function updateProfileAction(form: FormData) {
  const { supabase, user } = await requirePortalIdentity("/account/profile");
  const current = await portalMe(supabase);
  const fullName = text(form, "fullName");
  const email = text(form, "email").toLowerCase();
  const phone = text(form, "phone").replace(/[\s-]/g, "");
  const address = text(form, "address");
  const area = text(form, "area");
  if (!fullName || !emailOk(email) || !phoneOk(phone)) redirect("/account/profile?error=invalid");

  const linkedIdentity = current.link.status === "linked" || current.link.status === "pending";
  const phoneToSave = linkedIdentity ? current.phone : phone || null;
  await savePortalProfile(supabase, { fullName, phone: phoneToSave, address: address || null, area: area || null });

  if (email !== (user.email ?? "").toLowerCase()) {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) redirect("/account/profile?error=email");
    redirect("/account/profile?state=email-verification");
  }
  redirect("/account/profile?state=saved");
}
