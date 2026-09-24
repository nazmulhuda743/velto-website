/**
 * Campaign fields approved by the project specification (§9 and §22).
 * This module is runtime-neutral so it can be used by browser capture and
 * server-side booking/quote validation without importing either environment.
 */
export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];

export type Attribution = Partial<Record<AttributionKey, string>> & {
  landing_page?: string;
  source?: string;
  service?: string;
};

const MAX_VALUE_LENGTH = 256;
const MAX_PATH_LENGTH = 1024;

function clean(value: string | null | undefined, maxLength = MAX_VALUE_LENGTH) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
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

  const source = clean(params.get("source"));
  const service = clean(params.get("service"));
  const landing = cleanPath(landingPage ?? params.get("landing_page"));

  if (source) attribution.source = source;
  if (service) attribution.service = service;
  if (landing) attribution.landing_page = landing;

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

  for (const [key, value] of Object.entries(attribution)) {
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
