import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * "Show my past orders" for email and Google accounts: the website texts a 6-digit code to the
 * account's phone and keeps a signed, httpOnly cookie that binds the code to this login and
 * phone for ten minutes. Nothing is stored in the database until the code is right; then
 * portal_link_verified_phone links the history (docs/technical/CUSTOMER-PORTAL.md).
 */
export const LINK_CODE_COOKIE = "velto_link_code";
export const LINK_CODE_TTL_SECONDS = 10 * 60;

function key(): Buffer | null {
  const secret = process.env.VELTO_SUPABASE_SECRET_KEY?.trim();
  return secret ? createHmac("sha256", secret).update("velto-link-code-v1").digest() : null;
}

const sign = (k: Buffer, uid: string, phone: string, exp: number, code: string) =>
  createHmac("sha256", k).update(`${uid}|${phone}|${exp}|${code}`).digest("base64url");

/** A new code and the cookie value that proves it was sent to `phone` for `uid`. */
export function issueLinkCode(uid: string, phone: string): { code: string; cookie: string } | null {
  const k = key();
  if (!k) return null;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const exp = Math.floor(Date.now() / 1000) + LINK_CODE_TTL_SECONDS;
  return { code, cookie: `${phone}.${exp}.${sign(k, uid, phone, exp, code)}` };
}

/** The phone the code was sent to when `code` matches the cookie for this login; else null. */
export function checkLinkCode(uid: string, cookie: string | undefined, code: string): { phone: string } | { expired: true } | null {
  const k = key();
  const [phone, expRaw, mac] = (cookie ?? "").split(".");
  if (!k || !phone || !/^01[3-9]\d{8}$/.test(phone) || !/^\d{10}$/.test(expRaw ?? "") || !mac) return null;
  const exp = Number(expRaw);
  if (exp < Math.floor(Date.now() / 1000)) return { expired: true };
  const expected = Buffer.from(sign(k, uid, phone, exp, code));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given) ? { phone } : null;
}
