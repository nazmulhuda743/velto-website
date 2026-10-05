import "server-only";

import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { isSupabaseConfigured, supabaseFetch } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { MARKETING_ATTRIBUTION_KEYS, readSubmissionAttribution, type Attribution } from "@/lib/attribution";
import { normalizeService } from "@/lib/analytics/destinations";
import { REF_PATTERN, adClickIds, type AdClickIds, type RefRequest } from "@/lib/whatsapp-ref";

/**
 * Server side of the WhatsApp reference (src/lib/whatsapp-ref.ts) and of the click-id store used
 * for future server-side conversions. Off unless VELTO_WHATSAPP_REFS_ENABLED is exactly "true"
 * and docs/technical/sql/website_whatsapp_refs.sql is applied to the project in VELTO_SUPABASE_URL.
 * Every failure falls back to the plain WhatsApp link: attribution never blocks a customer.
 */
export const isWhatsAppRefsEnabled = () =>
  process.env.VELTO_WHATSAPP_REFS_ENABLED === "true" && isSupabaseConfigured();

/** A reference must not hold up the WhatsApp redirect for long. */
const CREATE_TIMEOUT_MS = 1_500;
const STORE_TIMEOUT_MS = 2_500;

type CookieReader = { get(name: string): { value: string } | undefined };

export type ServerConsent = { analytics: boolean; marketing: boolean; label: string };

/** Consent as recorded in the visitor's cookie (never taken from the request parameters). */
export function consentFromCookies(cookies: CookieReader): ServerConsent {
  const c = parseConsent(cookies.get(CONSENT_COOKIE)?.value);
  if (!c) return { analytics: false, marketing: false, label: "none" };
  const label = [c.analytics && "analytics", c.marketing && "marketing"].filter(Boolean).join("+") || "essential";
  return { analytics: c.analytics, marketing: c.marketing, label };
}

/** Raw click ids for a request (Marketing consent only): the Pixel cookies first, then the landing link. */
export function clickIdsFromRequest(cookies: CookieReader, attribution: Attribution, consent: ServerConsent): AdClickIds {
  return adClickIds(consent.marketing, { fbp: cookies.get("_fbp")?.value, fbc: cookies.get("_fbc")?.value }, attribution, Date.now());
}

async function rpc<T>(fn: string, args: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const res = await supabaseFetch(`/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`rpc ${fn} failed with HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Store the attribution snapshot for one WhatsApp click and return its reference, or null
 * (feature off, database error or timeout). No name, phone or message text is ever stored.
 */
export async function createWhatsAppRef(request: RefRequest, cookies: CookieReader): Promise<string | null> {
  if (!isWhatsAppRefsEnabled()) return null;
  const consent = consentFromCookies(cookies);
  const a = { ...request.attribution };
  const clickIds = clickIdsFromRequest(cookies, a, consent);
  for (const key of MARKETING_ATTRIBUTION_KEYS) delete a[key];

  const payload = {
    contact_event_id: request.clickId,
    page_path: request.page,
    placement: request.placement,
    service: normalizeService(request.service),
    device: request.device,
    consent: consent.label,
    analytics_session_id: consent.analytics ? request.analyticsSession : undefined,
    landing_page: a.landing_page,
    referrer_host: a.referrer,
    utm_source: a.utm_source,
    utm_medium: a.utm_medium,
    utm_campaign: a.utm_campaign,
    utm_content: a.utm_content,
    utm_term: a.utm_term,
    source: a.source,
    medium: a.medium,
    campaign: a.campaign,
    content: a.content,
    ad: a.ad,
  };
  try {
    const ref = await rpc<unknown>("website_create_whatsapp_ref", { p_payload: payload, p_click_ids: clickIds }, CREATE_TIMEOUT_MS);
    return typeof ref === "string" && REF_PATTERN.test(ref) ? ref : null;
  } catch (error) {
    console.error("whatsapp_ref_failed", error instanceof Error ? error.message : "unknown");
    return null;
  }
}

/**
 * Keep the consented click ids of a website booking or quote (reference WEB-XXXXXXXX) for future
 * server-side Lead / Purchase events. The lead row itself never holds raw ids (presence only).
 */
export async function storeLeadClickIds(reference: string, clickIds: AdClickIds): Promise<void> {
  if (!isWhatsAppRefsEnabled() || !/^WEB-[A-Z0-9]{8}$/.test(reference) || !Object.keys(clickIds).length) return;
  try {
    await rpc<unknown>("website_store_ad_click_ids", { p_owner_ref: reference, p_click_ids: clickIds }, STORE_TIMEOUT_MS);
  } catch (error) {
    console.error("lead_click_ids_failed", error instanceof Error ? error.message : "unknown");
  }
}

/**
 * The consented click ids of the request being handled (booking or quote), read before the
 * response so they can be stored afterwards with storeLeadClickIds. Empty when the feature is off.
 */
export async function leadClickIdsForRequest(rawAttribution: unknown): Promise<AdClickIds> {
  if (!isWhatsAppRefsEnabled()) return {};
  const store = await cookies();
  const consent = consentFromCookies(store);
  const attribution = readSubmissionAttribution(
    rawAttribution && typeof rawAttribution === "object" ? (rawAttribution as Record<string, unknown>) : null,
  );
  return clickIdsFromRequest(store, attribution, consent);
}
