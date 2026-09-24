/**
 * Acquisition channel and device classification shared by the dashboard,
 * the ingestion endpoint and request intelligence. Runtime-neutral.
 *
 * Rules are deliberately conservative: a channel is only claimed when the
 * UTM fields, click-id presence or referrer actually say so. Anything else is
 * "Other", never a guess.
 */

export type Channel = "direct" | "google_organic" | "meta_ads" | "google_ads" | "referral" | "whatsapp" | "other";

export const CHANNEL_LABELS: Record<Channel, string> = {
  direct: "Direct",
  google_organic: "Google organic",
  meta_ads: "Facebook / Instagram ads",
  google_ads: "Google ads",
  referral: "Referral",
  whatsapp: "WhatsApp / shared link",
  other: "Other",
};

export const CHANNEL_ORDER: Channel[] = ["direct", "google_organic", "meta_ads", "google_ads", "referral", "whatsapp", "other"];

export type AcquisitionFields = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  referrer_host?: string | null;
  click_id?: string | null;
};

const PAID_MEDIUMS = /^(cpc|ppc|paid|paid_?social|paid_?search|paidsocial|paidsearch|ads?|display|cpm|retargeting|sponsored)$/;
const META_SOURCES = /^(facebook|fb|instagram|ig|meta|messenger|audience_?network)$/;
const GOOGLE_SOURCES = /^(google|adwords|google_?ads|youtube)$/;
const WHATSAPP = /^(whatsapp|wa|wa\.me|share|shared|shared_link)$/;

const lower = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export function classifyChannel(f: AcquisitionFields): Channel {
  const source = lower(f.utm_source);
  const medium = lower(f.utm_medium);
  const host = lower(f.referrer_host).replace(/^www\./, "");

  if (f.click_id === "gclid" || (GOOGLE_SOURCES.test(source) && PAID_MEDIUMS.test(medium))) return "google_ads";
  // Paid Meta traffic needs a paid medium; fbclid alone is added to organic Facebook links too.
  if (META_SOURCES.test(source) && PAID_MEDIUMS.test(medium)) return "meta_ads";
  if (WHATSAPP.test(source) || WHATSAPP.test(medium) || /(^|\.)whatsapp\.com$|^wa\.me$/.test(host)) return "whatsapp";
  if (source || medium) {
    if (GOOGLE_SOURCES.test(source) && (medium === "organic" || medium === "")) return "google_organic";
    if (medium === "referral" || medium === "social" || medium === "organic_social" || (META_SOURCES.test(source) && medium === "")) return "referral";
    return "other";
  }
  if (/^google\.[a-z.]+$/.test(host)) return "google_organic";
  if (host) return "referral";
  return "direct";
}

export type Device = "mobile" | "tablet" | "desktop";

/** Coarse device class from viewport width (browser) — no user-agent fingerprinting. */
export function deviceFromWidth(width: number): Device {
  if (width < 768) return "mobile";
  if (width < 1200) return "tablet";
  return "desktop";
}

export const isDevice = (v: unknown): v is Device => v === "mobile" || v === "tablet" || v === "desktop";

/** Reduce a referrer URL to its host; drops our own host and anything unparsable. */
export function referrerHost(referrer: string, ownHost?: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (!host || host === ownHost?.toLowerCase()) return undefined;
    return host.slice(0, 120);
  } catch {
    return undefined;
  }
}
