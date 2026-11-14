/**
 * Google Ads conversion map. Runtime-neutral (no window), so it is unit tested
 * (tests/google-ads.test.cjs).
 *
 * The conversion ID and labels are public by design: Google prints them in every page's tag.
 * The defaults are Velto's live conversion actions in account 946-036-7650 (created 15 Nov 2026);
 * NEXT_PUBLIC_GOOGLE_ADS_* overrides them without a code change.
 *
 * Only two site events count, and both are leads, never purchases (no order value):
 * - whatsapp_click: "WhatsApp click" (Primary, count One)
 * - booking_success: "Booking submitted" (Secondary, count One)
 */

export const DEFAULT_GOOGLE_ADS_ID = "AW-17685935382";
export const DEFAULT_WHATSAPP_LABEL = "3X4zCJOqyrgdEJbqp_FB";
export const DEFAULT_BOOKING_LABEL = "j_-WCOiryrgdEJbqp_FB";

const ID_PATTERN = /^AW-\d{6,}$/;
const LABEL_PATTERN = /^[A-Za-z0-9_-]{6,40}$/;

export type GoogleAdsConfig = {
  id: string;
  labels: Record<string, string>;
};

function pick(value: string | undefined, fallback: string, pattern: RegExp): string | null {
  const v = value?.trim();
  if (v === "off") return null;
  if (v) return pattern.test(v) ? v : null;
  return fallback;
}

/**
 * The Google Ads config, or null when switched off (NEXT_PUBLIC_GOOGLE_ADS_ID=off) or malformed.
 * A label set to "off" or malformed drops only that conversion.
 */
export function googleAdsConfig(env: {
  id?: string;
  whatsappLabel?: string;
  bookingLabel?: string;
}): GoogleAdsConfig | null {
  const id = pick(env.id, DEFAULT_GOOGLE_ADS_ID, ID_PATTERN);
  if (!id) return null;
  const labels: Record<string, string> = {};
  const whatsapp = pick(env.whatsappLabel, DEFAULT_WHATSAPP_LABEL, LABEL_PATTERN);
  const booking = pick(env.bookingLabel, DEFAULT_BOOKING_LABEL, LABEL_PATTERN);
  if (whatsapp) labels.whatsapp_click = whatsapp;
  if (booking) labels.booking_success = booking;
  return { id, labels };
}

/** The gtag send_to for a site event, or null when the event is not a Google Ads conversion. */
export function conversionSendTo(config: GoogleAdsConfig, event: string): string | null {
  const label = Object.prototype.hasOwnProperty.call(config.labels, event) ? config.labels[event] : undefined;
  return label ? `${config.id}/${label}` : null;
}
