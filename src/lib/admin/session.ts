import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseFetch } from "../supabase-server";
import { isAdminPreview } from "./preview";

const COOKIE = "velto_admin";
const MAX_AGE_SECONDS = 12 * 60 * 60;
/** Ops roles allowed into the website dashboard. */
const ADMIN_ROLES = new Set(["admin"]);

export type Admin = { id: string; name: string; email: string };

function secret() {
  const base = process.env.ADMIN_SESSION_SECRET || process.env.VELTO_SUPABASE_SECRET_KEY;
  if (!base) throw new Error("Admin sessions need VELTO_SUPABASE_SECRET_KEY or ADMIN_SESSION_SECRET");
  return createHash("sha256").update(`velto-admin-session:${base}`).digest();
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

function encode(payload: { uid: string; exp: number }) {
  const data = b64(JSON.stringify(payload));
  return `${data}.${sign(data)}`;
}

function decode(token: string | undefined): { uid: string; exp: number } | null {
  if (!token) return null;
  const [data, mac] = token.split(".");
  if (!data || !mac) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as { uid?: unknown; exp?: unknown };
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return { uid: payload.uid, exp: payload.exp };
  } catch {
    return null;
  }
}

async function loadAdminProfile(uid: string): Promise<Admin | null> {
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return null;
  const res = await supabaseFetch(`/rest/v1/profiles?id=eq.${uid}&select=id,name,email,role,active`, { cache: "no-store" });
  if (!res.ok) return null;
  const [profile] = (await res.json()) as { id: string; name: string | null; email: string | null; role: string; active: boolean }[];
  if (!profile || !profile.active || !ADMIN_ROLES.has(profile.role)) return null;
  return { id: profile.id, name: profile.name || profile.email || "Admin", email: profile.email || "" };
}

/** Email + password against Velto Ops accounts; only active admins get a dashboard session. */
export async function signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; reason: "credentials" | "role" | "unavailable" }> {
  let res: Response;
  try {
    res = await supabaseFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (res.status === 400 || res.status === 401) return { ok: false, reason: "credentials" };
  if (!res.ok) return { ok: false, reason: "unavailable" };
  const body = (await res.json()) as { user?: { id?: string } };
  const uid = body.user?.id;
  if (!uid) return { ok: false, reason: "credentials" };
  const admin = await loadAdminProfile(uid);
  if (!admin) return { ok: false, reason: "role" };

  (await cookies()).set(COOKIE, encode({ uid, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: MAX_AGE_SECONDS,
  });
  return { ok: true };
}

export async function signOut() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

/** The signed-in admin, re-checked against Ops on every request (deactivated admins lose access). */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  // Local visual QA only; always false outside `next dev` (see ./preview.ts).
  if (isAdminPreview()) return { id: "preview", name: "Preview admin", email: "local preview" };
  const session = decode((await cookies()).get(COOKIE)?.value);
  if (!session) return null;
  try {
    return await loadAdminProfile(session.uid);
  } catch {
    return null;
  }
});

export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
