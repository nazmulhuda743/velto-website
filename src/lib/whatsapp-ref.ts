/**
 * WhatsApp reference contract (Revenue Attribution §11). Runtime-neutral: shared by the browser
 * click handler, /go/whatsapp, the tests and (through the documented format) the Ops tools.
 *
 *   browser click ──► /go/whatsapp?text=…&vr=1&eid=…&pg=…&pl=…&svc=…&utm_…
 *        server: reads consent + _fbp/_fbc cookies, stores the attribution snapshot under a new
 *                reference (website_create_whatsapp_ref), redirects to wa.me with "Ref: WA-7K2PQ"
 *   customer sends the message ──► the reference sits in the WhatsApp chat
 *   Ops / Money Desk / PWA ──► extractWhatsAppRef(chat text) ──► website_link_whatsapp_ref(ref, order)
 *
 * The visible reference is only a key. The attribution itself (UTM, landing page, consented
 * click ids) is stored server-side, so nothing depends on staff typing anything.
 */
import { readAttribution, type Attribution } from "./attribution";

/** No 0/O, 1/I/L: the reference must survive being read aloud or retyped. */
export const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REF_PATTERN = /^WA-[2-9A-HJKMNP-Z]{5}$/;
const REF_IN_TEXT = /(?:^|[^A-Za-z0-9])[Ww][Aa][- ]?([2-9A-HJKMNP-Za-hjkmnp-z]{5})(?![A-Za-z0-9])/;

/** The first WhatsApp reference found in any text (a pasted chat, an order note), normalized. */
export function extractWhatsAppRef(text: string | null | undefined): string | null {
  const hit = text ? REF_IN_TEXT.exec(text) : null;
  if (!hit) return null;
  const ref = `WA-${hit[1].toUpperCase()}`;
  return REF_PATTERN.test(ref) ? ref : null;
}

const MAX_TEXT = 500;

/** The pre-filled message with the reference on its own line. */
export function composeWhatsAppText(text: string | null | undefined, ref: string | null): string | null {
  const base = text?.slice(0, MAX_TEXT - 20).trimEnd() || "";
  if (!ref) return base || null;
  return base ? `${base}\n\nRef: ${ref}` : `Ref: ${ref}\n`;
}

/* -------------------------------------------------------- request params */

export const REF_PARAMS = {
  request: "vr",
  clickId: "eid",
  page: "pg",
  placement: "pl",
  service: "svc",
  device: "dv",
  session: "as",
} as const;

const CLICK_ID = /^[A-Za-z0-9-]{8,64}$/;
const PATH = /^\/[A-Za-z0-9/_.\-[\]]{0,200}$/;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type RefRequestInput = {
  clickId: string;
  page?: string;
  placement?: string;
  service?: string;
  device?: string;
  analyticsSession?: string;
  attribution?: Attribution;
};

/**
 * The /go/whatsapp link for one click. Keeps only the message text from the existing link, so a
 * link that was already rewritten by an earlier click is rebuilt, not stacked.
 */
export function whatsappRefHref(href: string, input: RefRequestInput): string {
  const url = new URL(href, "https://velto.local");
  if (url.origin !== "https://velto.local" || url.pathname !== "/go/whatsapp") return href;
  const out = new URL("/go/whatsapp", "https://velto.local");
  const text = url.searchParams.get("text");
  if (text) out.searchParams.set("text", text);
  out.searchParams.set(REF_PARAMS.request, "1");
  out.searchParams.set(REF_PARAMS.clickId, input.clickId);
  const set = (key: string, value: string | undefined) => {
    if (value) out.searchParams.set(key, value);
  };
  set(REF_PARAMS.page, input.page);
  set(REF_PARAMS.placement, input.placement);
  set(REF_PARAMS.service, input.service);
  set(REF_PARAMS.device, input.device);
  set(REF_PARAMS.session, input.analyticsSession);
  for (const [key, value] of Object.entries(input.attribution ?? {})) {
    if (typeof value === "string" && !out.searchParams.has(key)) out.searchParams.set(key, value);
  }
  return `${out.pathname}${out.search}`;
}

export type RefRequest = {
  clickId: string;
  page?: string;
  placement?: string;
  service?: string;
  device?: "mobile" | "tablet" | "desktop";
  analyticsSession?: string;
  /** Campaign context from the link (advertising ids still need the consent check). */
  attribution: Attribution;
};

/** Parse a /go/whatsapp request. Null unless the browser asked for a reference with a valid click id. */
export function readRefRequest(params: Pick<URLSearchParams, "get">): RefRequest | null {
  if (params.get(REF_PARAMS.request) !== "1") return null;
  const clickId = params.get(REF_PARAMS.clickId) ?? "";
  if (!CLICK_ID.test(clickId)) return null;
  const page = params.get(REF_PARAMS.page) ?? "";
  const placement = (params.get(REF_PARAMS.placement) ?? "").toLowerCase();
  const service = (params.get(REF_PARAMS.service) ?? "").toLowerCase();
  const device = params.get(REF_PARAMS.device);
  const session = (params.get(REF_PARAMS.session) ?? "").toLowerCase();
  const attribution = readAttribution(params);
  // Site keys are set here, never from the link's own attribution keys.
  delete attribution.service;
  return {
    clickId,
    page: PATH.test(page) ? page : undefined,
    placement: SLUG.test(placement) ? placement : undefined,
    service: SLUG.test(service) ? service : undefined,
    device: device === "mobile" || device === "tablet" || device === "desktop" ? device : undefined,
    analyticsSession: UUID_V4.test(session) ? session : undefined,
    attribution,
  };
}

/* ---------------------------------------------------- Meta click cookies */

const FBP = /^fb\.[0-2]\.\d{10,13}\.\d{1,30}$/;
const FBC = /^fb\.[0-2]\.\d{10,13}\.[A-Za-z0-9_-]{10,500}$/;
const FBCLID = /^[A-Za-z0-9_-]{10,500}$/;
const GCLID = /^[A-Za-z0-9_-]{10,500}$/;

export const validFbp = (v: string | undefined | null) => (v && FBP.test(v) ? v : undefined);
export const validFbc = (v: string | undefined | null) => (v && FBC.test(v) ? v : undefined);
export const validFbclid = (v: string | undefined | null) => (v && FBCLID.test(v) ? v : undefined);
export const validGclid = (v: string | undefined | null) => (v && GCLID.test(v) ? v : undefined);

/** Meta's fbc format when only the fbclid is known: fb.1.<first seen, ms>.<fbclid>. */
export function fbcFromClick(fbclid: string | undefined, seenAtMs: number): string | undefined {
  const id = validFbclid(fbclid);
  return id ? `fb.1.${Math.trunc(seenAtMs)}.${id}` : undefined;
}

export type AdClickIds = { fbclid?: string; fbc?: string; fbp?: string; gclid?: string };

/**
 * Advertising click ids for server-side conversions. Empty unless Marketing consent was given.
 * The Pixel's own cookies win; otherwise the fbc is rebuilt from the landing fbclid.
 */
export function adClickIds(
  marketing: boolean,
  cookies: { fbp?: string; fbc?: string },
  attribution: Attribution,
  nowMs: number,
): AdClickIds {
  if (!marketing) return {};
  const fbclid = validFbclid(attribution.fbclid);
  const out: AdClickIds = {
    fbclid,
    fbc: validFbc(cookies.fbc) ?? validFbc(attribution.fbc) ?? fbcFromClick(fbclid, nowMs),
    fbp: validFbp(cookies.fbp) ?? validFbp(attribution.fbp),
    gclid: validGclid(attribution.gclid),
  };
  for (const key of Object.keys(out) as (keyof AdClickIds)[]) if (!out[key]) delete out[key];
  return out;
}
