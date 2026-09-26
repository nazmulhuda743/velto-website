"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { isRole, passwordProblem, ROLE_INFO, type Role } from "@/lib/admin/permissions";
import { requireSection } from "@/lib/admin/session";
import { supabaseFetch } from "@/lib/supabase-server";

/**
 * Access page (Owners only). People given a website role never get a Velto Ops profile, so a
 * designer or marketer can't read Ops data. Ops admins are Owners automatically and are managed
 * in Velto Ops, not here. Passwords are never logged or shown again.
 */

const TARGET = "/admin/access";
const back = (params: Record<string, string>): never => redirect(`${TARGET}?${new URLSearchParams(params)}`);
const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

type Found = { id: string; email: string; opsRole: string | null; opsActive: boolean | null } | null;

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await supabaseFetch(`/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return { ok: false, status: res?.status ?? 0 };
  return { ok: true, data: (await res.json()) as T };
}

async function upsertMember(row: Record<string, unknown>) {
  const res = await supabaseFetch("/rest/v1/website_admin_members?on_conflict=user_id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
    cache: "no-store",
  }).catch(() => null);
  return Boolean(res?.ok);
}

async function patchMember(userId: string, patch: Record<string, unknown>) {
  const res = await supabaseFetch(`/rest/v1/website_admin_members?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return null;
  const [row] = (await res.json()) as { name: string; email: string; role: Role; origin: string }[];
  return row ?? null;
}

export async function addMemberAction(form: FormData) {
  const admin = await requireSection("access");
  const name = text(form, "name", 80);
  const email = text(form, "email", 254).toLowerCase();
  const role = text(form, "role", 20);
  const password = String(form.get("password") ?? "");
  if (!name) back({ error: "Enter the person's name." });
  if (!EMAIL.test(email)) back({ error: "Enter a valid email address." });
  if (!isRole(role)) back({ error: "Choose a role." });

  const found = await rpc<Found>("website_admin_find_user", { p_email: email });
  if (!found.ok) back({ error: found.status === 404 ? "The Access tables aren't installed yet." : "Couldn't check that email. Try again." });
  const existing = (found as { ok: true; data: Found }).data;

  let userId: string;
  let origin: "existing" | "website";
  if (existing) {
    if (existing.opsRole === "admin") back({ error: `${email} is a Velto Ops admin, so they are already an Owner.` });
    if (existing.opsActive === false) back({ error: `${email} is deactivated in Velto Ops. Reactivate them there first.` });
    userId = existing.id;
    origin = "existing";
  } else {
    const problem = passwordProblem(password);
    if (problem) back({ error: `${email} doesn't have a login yet. ${problem}` });
    const res = await supabaseFetch("/auth/v1/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name, created_for: "velto-website-dashboard" } }),
      cache: "no-store",
    }).catch(() => null);
    const body = res ? ((await res.json().catch(() => null)) as { id?: string; msg?: string } | null) : null;
    if (!res?.ok || !body?.id) back({ error: `Couldn't create the login${body?.msg ? `: ${body.msg.slice(0, 120)}` : "."}` });
    userId = body!.id!;
    origin = "website";
  }

  const ok = await upsertMember({
    user_id: userId,
    email,
    name,
    role,
    active: true,
    origin,
    created_by: admin.name,
    updated_by: admin.name,
    updated_at: new Date().toISOString(),
  });
  if (!ok) back({ error: "Couldn't save the role. Try again." });
  await logActivity(admin, {
    section: "access",
    action: "member_added",
    target: email,
    summary: `Gave ${name} the ${ROLE_INFO[role as Role].label} role${origin === "website" ? " (new login)" : ""}`,
    detail: { role, origin },
  });
  back({ saved: origin === "website" ? "created" : "added" });
}

export async function updateMemberAction(form: FormData) {
  const admin = await requireSection("access");
  const userId = text(form, "userId", 40);
  const op = text(form, "op", 20);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) back({ error: "Unknown person." });
  if (userId === admin.id) back({ error: "You can't change your own access. Ask another Owner." });

  if (op === "role") {
    const role = text(form, "role", 20);
    if (!isRole(role)) back({ error: "Choose a role." });
    const row = await patchMember(userId, { role, updated_by: admin.name });
    if (!row) back({ error: "Couldn't change the role." });
    await logActivity(admin, { section: "access", action: "role_changed", target: row!.email, summary: `Changed ${row!.name}'s role to ${ROLE_INFO[role as Role].label}`, detail: { role } });
    back({ saved: "role" });
  }
  if (op === "deactivate" || op === "reactivate") {
    const row = await patchMember(userId, { active: op === "reactivate", updated_by: admin.name });
    if (!row) back({ error: "Couldn't update access." });
    await logActivity(admin, {
      section: "access",
      action: op === "deactivate" ? "member_deactivated" : "member_reactivated",
      target: row!.email,
      summary: `${op === "deactivate" ? "Removed" : "Restored"} dashboard access for ${row!.name}`,
    });
    back({ saved: op });
  }
  if (op === "password") {
    const password = String(form.get("password") ?? "");
    const problem = passwordProblem(password);
    if (problem) back({ error: problem });
    // Only logins created here: never touch the password of a Velto Ops staff account.
    const check = await supabaseFetch(`/rest/v1/website_admin_members?user_id=eq.${userId}&select=name,email,origin`, { cache: "no-store" }).catch(() => null);
    const [row] = check?.ok ? ((await check.json()) as { name: string; email: string; origin: string }[]) : [];
    if (!row) back({ error: "Unknown person." });
    if (row.origin !== "website") back({ error: "This login wasn't created here, so its password is managed by its owner (Forgot password) or in Velto Ops." });
    const res = await supabaseFetch(`/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      cache: "no-store",
    }).catch(() => null);
    if (!res?.ok) back({ error: "Couldn't set the new password." });
    await logActivity(admin, { section: "access", action: "password_reset", target: row.email, summary: `Set a new temporary password for ${row.name}` });
    back({ saved: "password" });
  }
  back({ error: "Unknown request." });
}
