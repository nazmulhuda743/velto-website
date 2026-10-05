import "server-only";

import { supabaseFetch, isSupabaseConfigured } from "@/lib/supabase-server";
import {
  BOT_UA,
  consentFromCookie,
  META_COOKIE,
  WHATSAPP_REF_PATTERN,
  whatsappLeadPayload,
  type CookieReader,
} from "@/lib/whatsapp-ref-core";

export { withReference, WHATSAPP_REF_PATTERN } from "@/lib/whatsapp-ref-core";

/**
 * WhatsApp reference attribution (docs/technical/sql/website_whatsapp_refs.sql).
 *
 * A tap on a public-page WhatsApp button goes to /go/whatsapp with `wr=1` and the visitor's
 * campaign context (added by the click handler in components/layout/Analytics.tsx). The route
 * records a `whatsapp` lead with a short reference and adds "Ref: W7K2PQ" to the prefilled
 * message. Staff copy the reference onto the Ops order (CSR notes), and
 * website_match_whatsapp_refs() links the tap to the order and its revenue.
 *
 * Never blocks the customer: any failure, timeout or switched-off flag simply opens WhatsApp
 * without a reference. No phone, name or message text is stored.
 */

const RPC_TIMEOUT_MS = 1_500;

/** Off unless "true"; switch on only after website_whatsapp_refs.sql is applied to VELTO_SUPABASE_URL. */
export const whatsappRefsEnabled = () => process.env.VELTO_WHATSAPP_REFS_ENABLED === "true" && isSupabaseConfigured();

/** Creates the lead and returns its reference, or null on any problem (the tap still opens WhatsApp). */
export async function createWhatsAppRef(
  params: URLSearchParams,
  cookies: CookieReader,
  userAgent: string | null,
): Promise<string | null> {
  if (!whatsappRefsEnabled() || params.get("wr") !== "1") return null;
  if (!userAgent || BOT_UA.test(userAgent)) return null;
  try {
    const res = await supabaseFetch("/rest/v1/rpc/website_create_whatsapp_lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p: whatsappLeadPayload(params, cookies) }),
      cache: "no-store",
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: unknown; reference?: unknown };
    return data.ok === true && typeof data.reference === "string" && WHATSAPP_REF_PATTERN.test(data.reference)
      ? data.reference
      : null;
  } catch {
    return null;
  }
}

/** Raw advertising ids for a booking/quote lead (Marketing consent only; 90-day store). Best-effort. */
export async function storeClickIds(reference: string, attribution: Record<string, unknown>, cookies: CookieReader) {
  if (!whatsappRefsEnabled()) return;
  const consent = consentFromCookie(cookies);
  if (consent !== "marketing" && consent !== "analytics+marketing") return;
  const ids: Record<string, string> = {};
  for (const key of ["fbclid", "gclid"] as const) {
    const v = attribution[key];
    if (typeof v === "string" && v) ids[key] = v;
  }
  const fbp = cookies.get("_fbp")?.value;
  const fbc = cookies.get("_fbc")?.value;
  if (fbp && META_COOKIE.test(fbp)) ids.fbp = fbp;
  if (fbc && META_COOKIE.test(fbc)) ids.fbc = fbc;
  if (Object.keys(ids).length === 0) return;
  try {
    await supabaseFetch("/rest/v1/rpc/website_store_click_ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_reference: reference, p: ids }),
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    /* best-effort */
  }
}

