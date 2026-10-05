/**
 * Runtime-neutral pieces of WhatsApp reference attribution (lib/whatsapp-ref.ts), kept apart
 * from the server module so they can be unit-tested.
 */
import { readSubmissionAttribution, type ConsentValue } from "./attribution";
import { parseConsent, CONSENT_COOKIE } from "./consent";

export const WHATSAPP_REF_PATTERN = /^W[2-9A-HJ-NP-Z]{5}$/;

/** Link-preview fetchers and crawlers follow hrefs too; they must not mint references. */
export const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|skype|discord|headless|lighthouse|curl|wget|python|go-http/i;

export const META_COOKIE = /^fb\.\d\.\d{10,16}\.[A-Za-z0-9_.-]{1,200}$/;

export type CookieReader = { get(name: string): { value: string } | undefined };

/** The visitor's consent from the cookie itself; a link can never claim more than this. */
export function consentFromCookie(cookies: CookieReader): ConsentValue {
  const state = parseConsent(cookies.get(CONSENT_COOKIE)?.value);
  if (!state) return "none";
  if (state.analytics && state.marketing) return "analytics+marketing";
  if (state.analytics) return "analytics";
  if (state.marketing) return "marketing";
  return "essential";
}

/**
 * The attribution payload for a WhatsApp lead: campaign keys from the tap's query string, consent
 * from the cookie, and (Marketing consent only) Meta's _fbp/_fbc first-party cookies.
 */
export function whatsappLeadPayload(params: URLSearchParams, cookies: CookieReader): Record<string, string> {
  const consent = consentFromCookie(cookies);
  const raw: Record<string, string> = {};
  for (const [key, value] of params) raw[key] = value;
  // _fbp/_fbc are cookies Meta's Pixel sets on this domain; never accepted from a URL.
  delete raw.fbp;
  delete raw.fbc;
  raw.consent = consent;
  const marketing = consent === "marketing" || consent === "analytics+marketing";
  if (marketing) {
    const fbp = cookies.get("_fbp")?.value;
    const fbc = cookies.get("_fbc")?.value;
    if (fbp && META_COOKIE.test(fbp)) raw.fbp = fbp;
    if (fbc && META_COOKIE.test(fbc)) raw.fbc = fbc;
  }
  const attribution = readSubmissionAttribution(raw);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(attribution)) if (typeof value === "string") out[key] = value;
  const sector = params.get("area_sector");
  if (sector && /^(?:[0-9]|1[0-8])$/.test(sector)) out.area_sector = sector;
  return out;
}

/** The prefilled message with the reference on its own last line. */
export function withReference(text: string | null, reference: string, locale: "en" | "bn"): string {
  const base = text?.trim() || (locale === "bn" ? "হ্যালো Velto" : "Hi Velto");
  return `${base.slice(0, 460)}\n\nRef: ${reference}`;
}
