/**
 * Canonical attribution contract (Revenue Attribution V1), shared by browser
 * capture, booking/quote validation, website_create_request
 * (public.website_clean_attribution) and the lead snapshot. Runtime-neutral.
 *
 *   URL keys (captured from a landing URL):
 *     utm_source utm_medium utm_campaign utm_content utm_term
 *     source medium campaign content ad service landing_page
 *     fbclid fbc fbp gclid            ← advertising ids: Marketing consent only
 *   Site keys (set by the website at submission, never read from a URL):
 *     referrer (external host only)  device (mobile|tablet|desktop)
 *     consent  (none|essential|analytics|marketing|analytics+marketing)
 *     analytics_session (UUID v4)     ← Analytics consent only
 *
 * Anything else is dropped. The same rules are enforced again in SQL.
 */
export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "fbc",
  "fbp",
  "gclid",
] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];

export type Attribution = Partial<Record<AttributionKey, string>> & {
  landing_page?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  ad?: string;
  service?: string;
  /** Coarse device class (mobile / tablet / desktop). */
  device?: string;
  /** Consent categories granted at submission: essential | analytics | marketing | analytics+marketing | none. */
  consent?: string;
  /** Anonymous first-party analytics session id, present only with Analytics consent. */
  analytics_session?: string;
  /** Host of the external site the visitor arrived from (never the full URL). */
  referrer?: string;
};

const MAX_VALUE_LENGTH = 256;
const MAX_PATH_LENGTH = 1024;

function clean(value: string | null | undefined, maxLength = MAX_VALUE_LENGTH) {
  const normalized = value?.trim();
  if (!normalized || /[\u0000-\u001f\u007f]/.test(normalized)) return undefined;
  return normalized.slice(0, maxLength);
}

/** Accept only an on-site pathname as the recorded landing page. */
function cleanPath(value: string | null | undefined) {
  const path = clean(value, MAX_PATH_LENGTH);
  return path?.startsWith("/") && !path.startsWith("//") ? path : undefined;
}

export function readAttribution(
  params: Pick<URLSearchParams, "get">,
  landingPage?: string,
): Attribution {
  const attribution: Attribution = {};

  for (const key of ATTRIBUTION_KEYS) {
    const value = clean(params.get(key));
    if (value) attribution[key] = value;
  }

  const directKeys = ["source", "medium", "campaign", "content", "ad", "service"] as const;
  for (const key of directKeys) {
    const value = clean(params.get(key));
    if (value) attribution[key] = value;
  }
  const landing = cleanPath(landingPage ?? params.get("landing_page"));

  if (landing) attribution.landing_page = landing;

  const referrer = params.get("referrer")?.trim().toLowerCase();
  if (referrer && REFERRER_HOST.test(referrer)) attribution.referrer = referrer;

  return attribution;
}

const REFERRER_HOST = /^[a-z0-9.-]{1,120}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const CONSENT_VALUES = ["none", "essential", "analytics", "marketing", "analytics+marketing"] as const;
export type ConsentValue = (typeof CONSENT_VALUES)[number];
export const MARKETING_ATTRIBUTION_KEYS = ["fbclid", "fbc", "fbp", "gclid"] as const;

/**
 * Attribution accepted with a booking or quote submission. Applies the
 * canonical allowlist plus the consent gates, whatever the client sent.
 */
export function readSubmissionAttribution(data: Record<string, unknown> | null | undefined): Attribution {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data ?? {})) {
    if (typeof value === "string") params.set(key, value);
  }
  const attribution = readAttribution(params);

  const consentRaw = params.get("consent")?.trim();
  const consent: ConsentValue = (CONSENT_VALUES as readonly string[]).includes(consentRaw ?? "") ? (consentRaw as ConsentValue) : "none";
  attribution.consent = consent;
  const analytics = consent === "analytics" || consent === "analytics+marketing";
  const marketing = consent === "marketing" || consent === "analytics+marketing";

  if (!marketing) for (const key of MARKETING_ATTRIBUTION_KEYS) delete attribution[key];

  const device = params.get("device")?.trim();
  if (device === "mobile" || device === "tablet" || device === "desktop") attribution.device = device;

  const session = params.get("analytics_session")?.trim().toLowerCase();
  if (analytics && session && UUID_V4.test(session)) attribution.analytics_session = session;

  return attribution;
}

/**
 * Adds missing attribution to an internal booking or quote destination.
 * Existing destination parameters always win.
 */
export function appendAttribution(href: string, attribution: Attribution) {
  const url = new URL(href, "https://velto.local");

  if (url.origin !== "https://velto.local" || !/^\/(book|quote)(?:\/|$)/.test(url.pathname)) {
    return href;
  }

  const sanitized = readAttribution(
    new URLSearchParams(
      Object.entries(attribution).filter((entry): entry is [string, string] =>
        typeof entry[1] === "string",
      ),
    ),
  );

  for (const [key, value] of Object.entries(sanitized)) {
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
